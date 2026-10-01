import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const MCP_PROTOCOL_VERSIONS=['2026-07-28','2025-11-25','2025-06-18','2025-03-26','2024-11-05'];
const DEFAULT_HOST='127.0.0.1';
const DEFAULT_PORT=3210;
const CLIENT_TIMEOUT_MS=15000;
const ACTION_TIMEOUT_MS=60000;
const MAX_BODY_BYTES=8*1024*1024;
const PAGE_SIZE=100;

function json(res,status,body,headers={}) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});
  res.end(body===null?'':JSON.stringify(body));
}

function allowedOrigin(origin) {
  if(!origin)return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)||origin==='https://simsy0924.github.io';
}

async function bodyJson(req) {
  const chunks=[];let size=0;
  for await(const chunk of req) {
    size+=chunk.length;
    if(size>MAX_BODY_BYTES)throw new Error('요청 크기가 너무 큽니다.');
    chunks.push(chunk);
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw new Error('JSON 요청 본문을 읽을 수 없습니다.');}
}

function stateForTool(state) {
  const result={...state,logs:(state.logs??[]).slice(-30)};
  const options=result.prompt?.selection?.options;
  if(options?.length>PAGE_SIZE) {
    result.prompt={...result.prompt,selection:{...result.prompt.selection,options:options.slice(0,PAGE_SIZE),optionSummary:{total:options.length,shown:PAGE_SIZE,tool:'list_legal_options'}}};
  }
  return result;
}

function validateAction(state,args) {
  if(!state)throw new Error('듀얼 화면에서 Claude 대전을 먼저 시작하세요.');
  if(state.ended)throw new Error('듀얼이 이미 끝났습니다.');
  const prompt=state.prompt;
  if(prompt?.player!==1)throw new Error('지금은 Claude 차례가 아닙니다. wait_for_duel_turn 도구로 차례를 기다리세요.');
  const supplied=[args.choiceId!==undefined,args.selectionIds!==undefined,args.counterCounts!==undefined].filter(Boolean).length;
  if(supplied!==1)throw new Error('choiceId, selectionIds, counterCounts 중 하나만 전달하세요.');
  if(args.choiceId!==undefined) {
    if(typeof args.choiceId!=='string'||!prompt.choices?.some(choice=>choice.id===args.choiceId))throw new Error('현재 합법 행동 목록에 없는 choiceId입니다.');
    return {choice:args.choiceId};
  }
  if(args.selectionIds!==undefined) {
    const selection=prompt.selection;
    if(!selection||selection.mode==='counter'||!Array.isArray(args.selectionIds)||args.selectionIds.some(id=>!Number.isInteger(id))||new Set(args.selectionIds).size!==args.selectionIds.length)throw new Error('selectionIds가 현재 선택 요청에 맞지 않습니다.');
    const allowed=new Set((selection.options??[]).map(option=>option.id));
    if(args.selectionIds.some(id=>!allowed.has(id)))throw new Error('합법 선택 목록에 없는 selectionId입니다.');
    return {indices:args.selectionIds};
  }
  const selection=prompt.selection;
  if(selection?.mode!=='counter'||!Array.isArray(args.counterCounts)||args.counterCounts.length!==selection.options.length||args.counterCounts.some((count,index)=>!Number.isInteger(count)||count<0||count>selection.options[index].cap)||args.counterCounts.reduce((sum,count)=>sum+count,0)!==selection.total)throw new Error(`카운터를 정확히 ${selection?.total??0}개 분배하세요.`);
  return {counters:args.counterCounts};
}

export function createBridgeServer({host=DEFAULT_HOST,port=DEFAULT_PORT}={}) {
  let activeClientId=null,lastClientSeen=0,latestState=null,latestAction=null,pendingAction=null,actionSequence=0;
  const turnWaiters=new Set();

  const connected=()=>!!activeClientId&&Date.now()-lastClientSeen<CLIENT_TIMEOUT_MS;
  const clearSession=()=>{
    activeClientId=null;lastClientSeen=0;latestState=null;latestAction=null;actionSequence=0;
    if(pendingAction){pendingAction.reject(new Error('듀얼 페이지 연결이 끊겼습니다.'));pendingAction=null;}
    for(const waiter of turnWaiters){clearTimeout(waiter.timer);waiter.reject(new Error('듀얼 페이지 연결이 끊겼습니다.'));}
    turnWaiters.clear();
  };
  const notifyWaiters=()=>{
    if(!latestState)return;
    for(const waiter of [...turnWaiters]) {
      if(latestState.ended||latestState.prompt?.player===1){turnWaiters.delete(waiter);clearTimeout(waiter.timer);waiter.resolve(latestState);}
    }
  };

  const server=createServer(async(req,res)=>{
    const origin=req.headers.origin??'';
    const cors=allowedOrigin(origin)?{
      'access-control-allow-origin':origin||'*',
      'access-control-allow-methods':'GET, POST, OPTIONS',
      'access-control-allow-headers':'content-type',
      'access-control-max-age':'600',
      'access-control-allow-private-network':'true',
      'vary':'Origin'
    }:null;
    if(!cors){json(res,403,{error:'이 웹 출처는 듀얼 브리지에 연결할 수 없습니다.'});return;}
    if(req.method==='OPTIONS'){res.writeHead(204,cors);res.end();return;}
    const url=new URL(req.url??'/',`http://${host}`);
    try{
      if(req.method==='GET'&&url.pathname==='/health'){
        json(res,200,{ok:true,gameConnected:connected(),duelStarted:!!latestState,awaitingClaudeAction:latestState?.prompt?.player===1},cors);return;
      }
      if(req.method==='POST'&&url.pathname==='/connect'){
        const body=await bodyJson(req),clientId=body?.clientId;
        if(typeof clientId!=='string'||clientId.length<8||clientId.length>100){json(res,400,{error:'clientId 형식이 올바르지 않습니다.'},cors);return;}
        if(connected()&&activeClientId!==clientId){json(res,409,{error:'다른 듀얼 탭이 이미 연결되어 있습니다. 기존 탭에서 종료한 뒤 다시 시도하세요.'},cors);return;}
        clearSession();activeClientId=clientId;lastClientSeen=Date.now();
        json(res,200,{ok:true,clientId},cors);return;
      }
      if(req.method==='POST'&&url.pathname==='/disconnect'){
        const body=await bodyJson(req);
        if(body?.clientId===activeClientId)clearSession();
        json(res,200,{ok:true},cors);return;
      }
      if(req.method==='POST'&&url.pathname==='/state'){
        const body=await bodyJson(req);
        if(!connected()||body?.clientId!==activeClientId){json(res,409,{error:'연결된 Claude 대전 탭이 아닙니다.'},cors);return;}
        if(!body.state||body.state.viewer!==1||!Array.isArray(body.state.logs)){json(res,400,{error:'player 1 시점의 듀얼 상태가 필요합니다.'},cors);return;}
        latestState=body.state;lastClientSeen=Date.now();notifyWaiters();
        if(body.actionResult&&pendingAction?.id===body.actionResult.requestId){
          const action=pendingAction;pendingAction=null;latestAction=null;
          if(body.actionResult.ok)action.resolve(latestState);
          else action.reject(new Error(body.actionResult.error||'듀얼 행동을 적용하지 못했습니다.'));
        }
        json(res,200,{ok:true},cors);return;
      }
      if(req.method==='GET'&&url.pathname==='/action'){
        const clientId=url.searchParams.get('clientId');
        if(!connected()||clientId!==activeClientId){json(res,409,{error:'연결된 Claude 대전 탭이 아닙니다.'},cors);return;}
        lastClientSeen=Date.now();
        const after=Number(url.searchParams.get('after')??0);
        if(latestAction&&latestAction.sequence>after)json(res,200,latestAction,cors);
        else json(res,204,null,cors);
        return;
      }
      json(res,404,{error:'요청한 경로가 없습니다.'},cors);
    }catch(error){json(res,400,{error:error.message||'요청을 처리하지 못했습니다.'},cors);}
  });

  function waitForTurn(timeoutMs=30000) {
    if(!connected())return Promise.reject(new Error('Claude MCP 서버와 듀얼 페이지를 모두 연결하세요.'));
    if(latestState?.ended||latestState?.prompt?.player===1)return Promise.resolve(latestState);
    return new Promise((resolve,reject)=>{
      const waiter={resolve,reject,timer:setTimeout(()=>{turnWaiters.delete(waiter);resolve(latestState);},timeoutMs)};
      turnWaiters.add(waiter);
    });
  }

  async function submitAction(args) {
    if(!connected())throw new Error('Claude MCP 서버와 듀얼 페이지를 모두 연결하세요.');
    const input=validateAction(latestState,args);
    if(pendingAction)throw new Error('앞서 보낸 행동이 아직 처리 중입니다.');
    const id=randomUUID();
    const action={id,sequence:++actionSequence,revision:latestState.revision,input};
    latestAction=action;
    const result=new Promise((resolve,reject)=>{pendingAction={id,resolve,reject};});
    let timeout;
    try{return await Promise.race([result,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('듀얼 페이지가 행동 응답을 보내지 않았습니다. 연결 상태를 확인하세요.')),ACTION_TIMEOUT_MS);})]);}
    finally{clearTimeout(timeout);if(pendingAction?.id===id){pendingAction=null;latestAction=null;}}
  }

  return {
    server,
    listen:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);}),
    close:()=>new Promise(resolve=>{clearSession();server.close(()=>resolve());}),
    connected,
    getState:()=>latestState,
    waitForTurn,
    submitAction
  };
}

const toolDefinitions=[
  {name:'get_duel_state',description:'Read the current duel from Claude player 1’s perspective. This includes Claude’s own hand, visible board cards, the current legal prompt, and legal choices. Opponent hand and unrevealed cards are hidden.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'wait_for_duel_turn',description:'Wait for the user’s turn to finish and return the state when Claude can act. Use this while the user is choosing a move.',inputSchema:{type:'object',properties:{timeoutMs:{type:'integer',minimum:1000,maximum:60000,description:'Maximum wait in milliseconds (default 30000).'}},additionalProperties:false}},
  {name:'list_legal_options',description:'List or search the current selection options when get_duel_state reports more than 100 options. Use the returned option IDs with duel_action.',inputSchema:{type:'object',properties:{query:{type:'string',description:'Optional case-insensitive text to search in visible option labels.'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}},
  {name:'duel_action',description:'Submit exactly one legal choice or selection from the current Claude prompt. The game engine validates and applies it.',inputSchema:{type:'object',properties:{choiceId:{type:'string',description:'The id of one item in prompt.choices.'},selectionIds:{type:'array',items:{type:'integer'},description:'Option IDs selected from prompt.selection.options.'},counterCounts:{type:'array',items:{type:'integer',minimum:0},description:'Counter amounts, one for each prompt.selection.options item.'}},additionalProperties:false}}
];

export function createToolHandlers(bridge) {
  return {
    get_duel_state:()=>{
      const state=bridge.getState();
      if(!bridge.connected()||!state)throw new Error('듀얼 페이지가 연결되지 않았습니다. Ghost Duel에서 Claude 대전을 시작하세요.');
      return stateForTool(state);
    },
    wait_for_duel_turn:async({timeoutMs=30000}={})=>{
      const state=await bridge.waitForTurn(Math.max(1000,Math.min(60000,Number(timeoutMs)||30000)));
      return state?stateForTool(state):{waiting:true,message:'아직 듀얼 상태가 없습니다.'};
    },
    list_legal_options:({query='',offset=0,limit=PAGE_SIZE}={})=>{
      const state=bridge.getState();
      if(!bridge.connected()||!state)throw new Error('현재 듀얼 상태가 없습니다.');
      if(state.prompt?.player!==1||!state.prompt.selection)throw new Error('현재 Claude에게 카드 선택 요청이 없습니다.');
      const all=state.prompt.selection.options??[];
      const normalized=String(query).trim().toLocaleLowerCase();
      const matches=normalized?all.filter(option=>String(option.label).toLocaleLowerCase().includes(normalized)):all;
      const start=Math.max(0,Number.isInteger(offset)?offset:0),size=Math.max(1,Math.min(PAGE_SIZE,Number.isInteger(limit)?limit:PAGE_SIZE));
      return {options:matches.slice(start,start+size),offset:start,limit:size,total:matches.length,hasMore:start+size<matches.length};
    },
    duel_action:async args=>{
      const state=await bridge.submitAction(args);
      return {applied:true,nextState:state?stateForTool(state):null};
    }
  };
}

function send(message) {process.stdout.write(`${JSON.stringify(message)}\n`);}

export function startMcpServer({host=DEFAULT_HOST,port=DEFAULT_PORT}={}) {
  const bridge=createBridgeServer({host,port});
  const handlers=createToolHandlers(bridge);
  bridge.listen().then(()=>process.stderr.write(`Ghost Duel MCP bridge listening at http://${host}:${bridge.server.address().port}\n`)).catch(error=>{
    process.stderr.write(`Ghost Duel MCP bridge failed: ${error.message}\n`);
    process.exitCode=1;
  });

  async function handle(line) {
    let request;
    try{request=JSON.parse(line);}catch{return;}
    const {id,method,params={}}=request;
    if(method==='notifications/initialized'||method==='notifications/cancelled')return;
    if(method==='initialize'){
      const requested=params.protocolVersion;
      send({jsonrpc:'2.0',id,result:{protocolVersion:MCP_PROTOCOL_VERSIONS.includes(requested)?requested:MCP_PROTOCOL_VERSIONS[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'ghost-duel',version:'1.0.0'}}});return;
    }
    if(method==='ping'){send({jsonrpc:'2.0',id,result:{}});return;}
    if(method==='tools/list'){send({jsonrpc:'2.0',id,result:{tools:toolDefinitions}});return;}
    if(method==='tools/call'){
      const name=params.name;
      const handler=handlers[name];
      if(!handler){send({jsonrpc:'2.0',id,result:{content:[{type:'text',text:`Unknown tool: ${String(name)}`}],isError:true}});return;}
      try{
        const value=await handler(params.arguments??{});
        send({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(value)}]}});
      }catch(error){send({jsonrpc:'2.0',id,result:{content:[{type:'text',text:error.message||'Tool call failed'}],isError:true}});}
      return;
    }
    if(id!==undefined)send({jsonrpc:'2.0',id,error:{code:-32601,message:`Method not found: ${String(method)}`}});
  }

  let buffer='';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data',chunk=>{
    buffer+=chunk;
    let newline;
    while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline).trim();buffer=buffer.slice(newline+1);if(line)void handle(line);}
  });
  process.stdin.on('end',()=>{void bridge.close();});
  process.on('SIGINT',()=>{void bridge.close().finally(()=>process.exit(0));});
  process.on('SIGTERM',()=>{void bridge.close().finally(()=>process.exit(0));});
  return {bridge,handlers};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)startMcpServer({port:Number(process.env.YGO_DUEL_MCP_PORT)||DEFAULT_PORT});
