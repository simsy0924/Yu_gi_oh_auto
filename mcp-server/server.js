import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {WebSocket,WebSocketServer} from 'ws';

const MCP_PROTOCOL_VERSIONS=['2026-07-28','2025-11-25','2025-06-18','2025-03-26','2024-11-05'];
const DEFAULT_HOST='127.0.0.1';
const DEFAULT_PORT=3210;
const CLIENT_TIMEOUT_MS=15000;
const ACTION_TIMEOUT_MS=60000;
const ACTION_AUTO_WAIT_MS=55000;
const MAX_BODY_BYTES=8*1024*1024;
const PAGE_SIZE=100;
const STATE_HISTORY_LIMIT=32;
const TOOL_LOG_LIMIT=12;
const DEFAULT_ALLOWED_ORIGINS=['https://simsy0924.github.io','http://localhost:5173','http://127.0.0.1:5173'];
const PAIRING_CODE_PATTERN=/^[0-9a-f-]{36}$/i;
const ROOM_IDLE_TIMEOUT_MS=60*60*1000;
const MAX_REMOTE_ROOMS=256;

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

function toolStateSnapshot(state) {
  const result=structuredClone(state);
  result.logs=(result.logs??[]).slice(-TOOL_LOG_LIMIT);
  const cardTexts=result.cardTexts&&typeof result.cardTexts==='object'?{...result.cardTexts}:{};
  delete result.cardTexts;
  const collectCardTexts=value=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){for(const item of value)collectCardTexts(item);return;}
    const code=value.code;
    const validCode=(Number.isInteger(code)&&code>0)||(typeof code==='string'&&/^\\d+$/.test(code)&&Number(code)>0);
    if(validCode&&typeof value.desc==='string'&&value.desc.length) {
      const key=String(code);
      if(!Object.hasOwn(cardTexts,key))cardTexts[key]=value.desc;
      delete value.desc;
    }
    for(const child of Object.values(value))collectCardTexts(child);
  };
  collectCardTexts(result);
  result.cardTexts=cardTexts;
  const options=result.prompt?.selection?.options;
  if(options?.length>PAGE_SIZE) {
    result.prompt={...result.prompt,selection:{...result.prompt.selection,options:options.slice(0,PAGE_SIZE),optionSummary:{total:options.length,shown:PAGE_SIZE,tool:'list_legal_options'}}};
  }
  return result;
}

function pointerPath(path,key) {
  return `${path}/${String(key).replace(/~/g,'~0').replace(/\//g,'~1')}`;
}

function arrayItemKeys(items) {
  const occurrences=new Map();
  return items.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))return null;
    if(typeof item.id==='string'||typeof item.id==='number')return `id:${typeof item.id}:${item.id}`;
    if(typeof item.code!=='string'&&typeof item.code!=='number')return null;
    const base=`card:${item.controller??''}:${item.location??''}:${item.code}`;
    const occurrence=occurrences.get(base)??0;occurrences.set(base,occurrence+1);
    return `${base}:${occurrence}`;
  });
}

function diffArray(previous,next,path,changes) {
  const previousKeys=arrayItemKeys(previous),nextKeys=arrayItemKeys(next);
  if(!previousKeys.some(key=>key===null)&&!nextKeys.some(key=>key===null)) {
    const rows=Array.from({length:previous.length+1},()=>new Uint32Array(next.length+1));
    for(let i=previous.length-1;i>=0;i--)for(let j=next.length-1;j>=0;j--)
      rows[i][j]=previousKeys[i]===nextKeys[j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1]);
    const matches=[];let i=0,j=0;
    while(i<previous.length&&j<next.length) {
      if(previousKeys[i]===nextKeys[j]){matches.push([i,j]);i++;j++;}
      else if(rows[i+1][j]>=rows[i][j+1])i++;
      else j++;
    }
    const matchedPrevious=new Set(matches.map(([previousIndex])=>previousIndex));
    const matchedNext=new Set(matches.map(([,nextIndex])=>nextIndex));
    for(let index=previous.length-1;index>=0;index--)if(!matchedPrevious.has(index))changes.push({op:'remove',path:pointerPath(path,index)});
    for(let index=0;index<next.length;index++)if(!matchedNext.has(index))changes.push({op:'add',path:pointerPath(path,index),value:next[index]});
    for(const [previousIndex,nextIndex] of matches)diffJson(previous[previousIndex],next[nextIndex],pointerPath(path,nextIndex),changes);
    return changes;
  }
  if(previous.length===next.length) {
    for(let index=0;index<previous.length;index++)diffJson(previous[index],next[index],pointerPath(path,index),changes);
    return changes;
  }
  changes.push({op:'replace',path,value:next});
  return changes;
}

function diffJson(previous,next,path='',changes=[]) {
  if(Object.is(previous,next))return changes;
  const previousObject=previous!==null&&typeof previous==='object'&&!Array.isArray(previous);
  const nextObject=next!==null&&typeof next==='object'&&!Array.isArray(next);
  if(previousObject&&nextObject) {
    for(const key of new Set([...Object.keys(previous),...Object.keys(next)])) {
      const previousHas=Object.hasOwn(previous,key),nextHas=Object.hasOwn(next,key),childPath=pointerPath(path,key);
      if(!previousHas)changes.push({op:'add',path:childPath,value:next[key]});
      else if(!nextHas)changes.push({op:'remove',path:childPath});
      else diffJson(previous[key],next[key],childPath,changes);
    }
    return changes;
  }
  if(Array.isArray(previous)&&Array.isArray(next))return diffArray(previous,next,path,changes);
  changes.push({op:'replace',path,value:next});
  return changes;
}

function diffLogs(previous=[],next=[]) {
  let overlap=Math.min(previous.length,next.length);
  while(overlap>0&&!previous.slice(-overlap).every((entry,index)=>entry===next[index]))overlap--;
  if(previous.length&&next.length&&!overlap)return {replace:next};
  if(next.length<previous.length&&overlap<next.length)return {replace:next};
  return {append:next.slice(overlap),drop:overlap?previous.length-overlap:0};
}

function rememberedCardTexts(history) {
  const latestRevision=[...history.keys()].at(-1);
  return latestRevision===undefined?{}:history.get(latestRevision)?.cardTexts??{};
}

function stateForTool(state,baseState=null,knownCardTexts={}) {
  if(!state)return null;
  const current=toolStateSnapshot(state);
  current.cardTexts={...knownCardTexts,...(baseState?.cardTexts??{}),...current.cardTexts};
  if(!baseState||baseState.viewer!==state.viewer||!Number.isInteger(baseState.revision)||!Number.isInteger(state.revision)||baseState.revision>state.revision)
    return {kind:'full',revision:current.revision,state:current};
  const previous=toolStateSnapshot(baseState),before={...previous},after={...current};
  delete before.logs;delete after.logs;
  return {
    kind:'delta',baseRevision:previous.revision,revision:current.revision,
    changes:diffJson(before,after),logs:diffLogs(previous.logs,current.logs)
  };
}

function rememberState(history,state) {
  if(!Number.isInteger(state?.revision))return;
  const snapshot=toolStateSnapshot(state);
  snapshot.cardTexts={...rememberedCardTexts(history),...snapshot.cardTexts};
  history.delete(state.revision);history.set(state.revision,snapshot);
  while(history.size>STATE_HISTORY_LIMIT)history.delete(history.keys().next().value);
}

function readSinceRevision(value) {
  if(value===undefined)return null;
  if(!Number.isInteger(value)||value<0)throw new Error('sinceRevision은 0 이상의 정수여야 합니다.');
  return value;
}

function readWaitDuration(value,fallback,{minimum=0}={}) {
  if(value===undefined)return fallback;
  if(!Number.isInteger(value)||value<minimum||value>60000)throw new Error('대기 시간은 허용 범위 안의 정수여야 합니다.');
  return value;
}

function validateAction(state,args,player=1) {
  if(!state)throw new Error('듀얼 화면에서 AI 대전을 먼저 시작하세요.');
  if(state.ended)throw new Error('듀얼이 이미 끝났습니다.');
  const prompt=state.prompt;
  if(prompt?.player!==player)throw new Error(`지금은 AI ${player+1} 차례가 아닙니다. wait_for_duel_turn 도구로 차례를 기다리세요.`);
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

function validateCommentary(value) {
  if(value===undefined)return '';
  if(typeof value!=='string')throw new Error('commentary는 문자열이어야 합니다.');
  const commentary=value.trim();
  if([...commentary].length>280)throw new Error('commentary는 280자 이내로 작성하세요.');
  return commentary;
}

export function createBridgeServer({host=DEFAULT_HOST,port=DEFAULT_PORT}={}) {
  let activeClientId=null,lastClientSeen=0,latestState=null,latestAction=null,pendingAction=null,actionSequence=0;
  const turnWaiters=new Set();
  const stateHistory=new Map();

  const connected=()=>!!activeClientId&&Date.now()-lastClientSeen<CLIENT_TIMEOUT_MS;
  const clearSession=()=>{
    activeClientId=null;lastClientSeen=0;latestState=null;latestAction=null;actionSequence=0;
    stateHistory.clear();
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
        latestState=body.state;lastClientSeen=Date.now();rememberState(stateHistory,latestState);notifyWaiters();
        if(body.actionResult&&pendingAction?.id===body.actionResult.requestId){
          const action=pendingAction;pendingAction=null;latestAction=null;
          if(body.actionResult.ok)action.resolve({state:latestState,baseState:action.baseState});
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
    const commentary=validateCommentary(args.commentary);
    if(pendingAction)throw new Error('앞서 보낸 행동이 아직 처리 중입니다.');
    const baseState=toolStateSnapshot(latestState);baseState.cardTexts={...rememberedCardTexts(stateHistory),...baseState.cardTexts};
    const id=randomUUID();
    const action={id,sequence:++actionSequence,revision:latestState.revision,input,...(commentary?{commentary}:{})};
    latestAction=action;
    const result=new Promise((resolve,reject)=>{pendingAction={id,resolve,reject,baseState};});
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
    getKnownState:revision=>stateHistory.get(revision),
    getCardTexts:()=>rememberedCardTexts(stateHistory),
    waitForTurn,
    submitAction
  };
}

const toolDefinitions=[
  {name:'get_duel_state',description:'Read the current duel from the AI seat assigned to this pairing code. The first call returns that AI’s own hand, visible board cards, the current legal prompt, and legal choices; the opponent hand and unrevealed cards are hidden. For later calls, pass the last known revision as sinceRevision to receive only changed fields and new logs. duel_action returns nextState as a compact delta; apply its changes and logs before deciding. If kind=full, replace your stored state; if kind=delta, apply the JSON Patch changes and log update. Do not request another full state after every action.',inputSchema:{type:'object',properties:{sinceRevision:{type:'integer',minimum:0,description:'Last known state revision. Omit only for the initial full state.'}},additionalProperties:false}},
  {name:'wait_for_duel_turn',description:'Wait for the next action prompt assigned to this pairing code or for the duel to end. Pass sinceRevision to receive only changes since the last state. It returns waitingForAI=true if the wait expires before this AI gets a prompt. For continuous play, call again with the newest revision while waitingForAI is true.',inputSchema:{type:'object',properties:{timeoutMs:{type:'integer',minimum:1000,maximum:60000,description:'Maximum wait in milliseconds (default 30000).'},sinceRevision:{type:'integer',minimum:0,description:'Last known state revision, so only changes are returned.'}},additionalProperties:false}},
  {name:'list_legal_options',description:'List or search the current selection options when get_duel_state reports more than 100 options. Use the returned option IDs with duel_action.',inputSchema:{type:'object',properties:{query:{type:'string',description:'Optional case-insensitive text to search in visible option labels.'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}},
  {name:'duel_action',description:'Submit exactly one legal choice or selection from the current prompt assigned to this AI. The result includes nextState as a compact delta from the state used for this action; apply its changes and logs before deciding, and card descriptions omitted from card objects are available in cardTexts[code]. Do not call get_duel_state again. The tool waits up to waitForTurnMs for the next prompt assigned to this AI or the duel end. If waitingForAI is still true, keep the response active by calling wait_for_duel_turn with nextState.revision; apply its delta and repeat while waitingForAI stays true. Optionally include short commentary for the duel screen.',inputSchema:{type:'object',properties:{choiceId:{type:'string',description:'The id of one item in prompt.choices.'},selectionIds:{type:'array',items:{type:'integer'},description:'Option IDs selected from prompt.selection.options.'},counterCounts:{type:'array',items:{type:'integer',minimum:0},description:'Counter amounts, one for each prompt.selection.options item.'},commentary:{type:'string',maxLength:280,description:'Optional short message (up to 280 characters) shown in the duel screen and log.'},waitForTurnMs:{type:'integer',minimum:0,maximum:60000,description:'How long to wait after yielding priority for the next prompt assigned to this AI (default 55000; use 0 to return immediately).'}},additionalProperties:false}}
];

export function createToolHandlers(bridge,{player=bridge.player??1}={}) {
  return {
    get_duel_state:({sinceRevision:sinceValue}={})=>{
      const state=bridge.getState();
      if(!bridge.connected()||!state)throw new Error('듀얼 페이지가 연결되지 않았습니다. Ghost Duel에서 AI 대전을 시작하세요.');
      const sinceRevision=readSinceRevision(sinceValue);
      return stateForTool(state,sinceRevision===null?null:bridge.getKnownState(sinceRevision),bridge.getCardTexts());
    },
    wait_for_duel_turn:async({timeoutMs=30000,sinceRevision:sinceValue}={})=>{
      const sinceRevision=readSinceRevision(sinceValue);
      const waitMs=readWaitDuration(timeoutMs,30000,{minimum:1000});
      const baseState=sinceRevision===null?null:bridge.getKnownState(sinceRevision);
      const state=await bridge.waitForTurn(waitMs);
      if(!state)return {kind:'empty',waitingForClaude:true,waitingForAI:true,message:'아직 듀얼 상태가 없습니다.'};
      const snapshot=stateForTool(state,baseState,bridge.getCardTexts());
      return {...snapshot,waitingForClaude:!state.ended&&state.prompt?.player!==player,waitingForAI:!state.ended&&state.prompt?.player!==player};
    },
    list_legal_options:({query='',offset=0,limit=PAGE_SIZE}={})=>{
      const state=bridge.getState();
      if(!bridge.connected()||!state)throw new Error('현재 듀얼 상태가 없습니다.');
      if(state.prompt?.player!==player||!state.prompt.selection)throw new Error(`현재 AI ${player+1}에게 카드 선택 요청이 없습니다.`);
      const all=state.prompt.selection.options??[];
      const normalized=String(query).trim().toLocaleLowerCase();
      const matches=normalized?all.filter(option=>String(option.label).toLocaleLowerCase().includes(normalized)):all;
      const start=Math.max(0,Number.isInteger(offset)?offset:0),size=Math.max(1,Math.min(PAGE_SIZE,Number.isInteger(limit)?limit:PAGE_SIZE));
      return {options:matches.slice(start,start+size),offset:start,limit:size,total:matches.length,hasMore:start+size<matches.length};
    },
    duel_action:async args=>{
      const waitMs=readWaitDuration(args.waitForTurnMs,ACTION_AUTO_WAIT_MS);
      const submitted=await bridge.submitAction(args);
      let state=submitted?.state??null;
      if(waitMs>0&&state&&!state.ended&&state.prompt?.player!==player)state=await bridge.waitForTurn(waitMs)??state;
      return {
        applied:true,
        nextState:state?stateForTool(state,submitted?.baseState??null,bridge.getCardTexts()):null,
        waitingForClaude:!!state&&!state.ended&&state.prompt?.player!==player,
        waitingForAI:!!state&&!state.ended&&state.prompt?.player!==player
      };
    }
  };
}

function remoteToolDefinitions() {
  return toolDefinitions.map(tool=>({
    ...tool,
    description:`${tool.description} Every call must include the same pairingCode shown on the duel screen.`,
    inputSchema:{
      ...tool.inputSchema,
      properties:{
        pairingCode:{type:'string',pattern:PAIRING_CODE_PATTERN.source,description:'Ghost Duel 화면에서 만든 36자리 연결 코드. 이 듀얼에 접근할 때마다 전달하세요.'},
        ...tool.inputSchema.properties
      },
      required:[...(tool.inputSchema.required??[]),'pairingCode']
    }
  }));
}

function createRemoteDuelBridge(player=1) {
  let activeSocket=null,latestState=null,lastClientSeen=Date.now(),latestAction=null,pendingAction=null,actionSequence=0;
  const turnWaiters=new Set();
  const stateHistory=new Map();
  const connected=()=>!!latestState&&Date.now()-lastClientSeen<ROOM_IDLE_TIMEOUT_MS;
  const close=()=>{
    latestState=null;latestAction=null;stateHistory.clear();
    if(pendingAction){pendingAction.reject(new Error('듀얼 페이지 연결이 끊겼습니다.'));pendingAction=null;}
    for(const waiter of turnWaiters){clearTimeout(waiter.timer);waiter.reject(new Error('듀얼 페이지 연결이 끊겼습니다.'));}
    turnWaiters.clear();
  };
  const notifyWaiters=()=>{
    if(!latestState)return;
    for(const waiter of [...turnWaiters]) {
      if(latestState.ended||latestState.prompt?.player===player){turnWaiters.delete(waiter);clearTimeout(waiter.timer);waiter.resolve(latestState);}
    }
  };
  function updateState(message) {
    if(!message.state||message.state.viewer!==player||!Array.isArray(message.state.logs))throw new Error(`player ${player} 시점의 듀얼 상태가 필요합니다.`);
    latestState=message.state;lastClientSeen=Date.now();rememberState(stateHistory,latestState);notifyWaiters();
    if(message.actionResult&&pendingAction?.id===message.actionResult.requestId){
      const action=pendingAction;pendingAction=null;latestAction=null;
      if(message.actionResult.ok)action.resolve({state:latestState,baseState:action.baseState});
      else action.reject(new Error(message.actionResult.error||'듀얼 행동을 적용하지 못했습니다.'));
    }
  }
  function sendPendingAction() {
    if(!pendingAction||activeSocket?.readyState!==WebSocket.OPEN)return;
    activeSocket.send(JSON.stringify({type:'action',...latestAction}));
  }
  function waitForTurn(timeoutMs=30000) {
    if(!connected())return Promise.reject(new Error('연결 코드가 적용된 듀얼 화면이 열려 있어야 합니다.'));
    if(latestState?.ended||latestState?.prompt?.player===player)return Promise.resolve(latestState);
    return new Promise((resolve,reject)=>{
      const waiter={resolve,reject,timer:setTimeout(()=>{turnWaiters.delete(waiter);resolve(latestState);},timeoutMs)};
      turnWaiters.add(waiter);
    });
  }
  async function submitAction(args) {
    if(!connected())throw new Error('연결 코드가 적용된 듀얼 화면이 열려 있어야 합니다.');
    const input=validateAction(latestState,args,player);
    const commentary=validateCommentary(args.commentary);
    if(pendingAction)throw new Error('앞서 보낸 행동이 아직 처리 중입니다.');
    const baseState=toolStateSnapshot(latestState);baseState.cardTexts={...rememberedCardTexts(stateHistory),...baseState.cardTexts};
    const id=randomUUID();
    const action={id,sequence:++actionSequence,revision:latestState.revision,input,...(commentary?{commentary}:{})};
    latestAction=action;
    const result=new Promise((resolve,reject)=>{pendingAction={id,resolve,reject,baseState};});
    let timeout;
    try{
      sendPendingAction();
      return await Promise.race([result,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('듀얼 페이지가 행동 응답을 보내지 않았습니다. 연결 상태를 확인하세요.')),ACTION_TIMEOUT_MS);})]);
    }finally{clearTimeout(timeout);if(pendingAction?.id===id){pendingAction=null;latestAction=null;}}
  }
  return {
    player,connected,getState:()=>latestState,getKnownState:revision=>stateHistory.get(revision),getCardTexts:()=>rememberedCardTexts(stateHistory),updateState,waitForTurn,submitAction,close,touch:()=>{lastClientSeen=Date.now();},
    attach:nextSocket=>{activeSocket=nextSocket;sendPendingAction();},
    detach:closedSocket=>{if(activeSocket===closedSocket)activeSocket=null;}
  };
}

function jsonRpc(res,id,result) {
  json(res,200,{jsonrpc:'2.0',id,result});
}

function jsonRpcError(res,id,code,message,status=200) {
  json(res,status,{jsonrpc:'2.0',id,error:{code,message}});
}

export function createRemoteMcpServer({host='0.0.0.0',port=Number(process.env.PORT)||3333,allowedOrigins=process.env.YGO_ALLOWED_ORIGINS}={}) {
  const origins=new Set((allowedOrigins?String(allowedOrigins).split(','):DEFAULT_ALLOWED_ORIGINS).map(value=>value.trim()).filter(Boolean));
  const rooms=new Map();
  const cleanExpiredRooms=()=>{
    const now=Date.now();
    for(const [code,room] of rooms)if(now-room.lastSeen>ROOM_IDLE_TIMEOUT_MS){room.socket?.close(1001,'Duel expired');rooms.delete(code);room.bridge.close();}
  };
  const healthCors=origin=>origin&&origins.has(origin)?{
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET, OPTIONS',
    'access-control-allow-headers':'content-type',
    'access-control-max-age':'600',
    'vary':'Origin'
  }:null;
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url??'/',`http://${req.headers.host??'localhost'}`);
    try{
      if(url.pathname==='/health'){
        const cors=healthCors(req.headers.origin);
        if(req.headers.origin&&!cors){json(res,403,{error:'이 웹 출처는 듀얼 브리지에 연결할 수 없습니다.'});return;}
        if(req.method==='OPTIONS'){res.writeHead(204,cors??{});res.end();return;}
        if(req.method!=='GET'){json(res,405,{error:'GET 요청만 허용됩니다.'},cors??{});return;}
        cleanExpiredRooms();json(res,200,{ok:true,transport:'streamable-http',relay:'websocket'},cors??{});return;
      }
      if(url.pathname!=='/mcp'){json(res,404,{error:'요청한 경로가 없습니다.'});return;}
      if(req.method!=='POST'){json(res,405,{error:'MCP 요청에는 POST를 사용하세요.'},{allow:'POST'});return;}
      if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??'')){json(res,415,{error:'Content-Type은 application/json이어야 합니다.'});return;}
      const request=await bodyJson(req);
      if(!request||Array.isArray(request)||request.jsonrpc!=='2.0'||typeof request.method!=='string'){
        jsonRpcError(res,request?.id??null,-32600,'Invalid Request',400);return;
      }
      const {id,method,params={}}=request;
      if(id===undefined&&(method==='notifications/initialized'||method==='notifications/cancelled')){res.writeHead(202);res.end();return;}
      if(method==='initialize'){
        const requested=params.protocolVersion;
        jsonRpc(res,id,{protocolVersion:MCP_PROTOCOL_VERSIONS.includes(requested)?requested:MCP_PROTOCOL_VERSIONS[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'ghost-duel-remote',version:'1.0.0'}});return;
      }
      if(method==='ping'){jsonRpc(res,id,{});return;}
      if(method==='tools/list'){jsonRpc(res,id,{tools:remoteToolDefinitions()});return;}
      if(method==='tools/call'){
        const name=params.name,arguments_=params.arguments??{},code=arguments_.pairingCode;
        if(typeof code!=='string'||!PAIRING_CODE_PATTERN.test(code)){jsonRpc(res,id,{content:[{type:'text',text:'듀얼 화면에 표시된 연결 코드를 입력하세요.'}],isError:true});return;}
        cleanExpiredRooms();
        const room=rooms.get(code);
        if(!room||!room.bridge.connected()){jsonRpc(res,id,{content:[{type:'text',text:'연결 코드가 만료되었거나 듀얼 화면이 연결되지 않았습니다.'}],isError:true});return;}
        room.lastSeen=Date.now();room.bridge.touch();
        const handler=createToolHandlers(room.bridge,{player:room.player})[name];
        if(!handler){jsonRpc(res,id,{content:[{type:'text',text:`Unknown tool: ${String(name)}`}],isError:true});return;}
        const {pairingCode:_pairingCode,...toolArgs}=arguments_;
        try{const value=await handler(toolArgs);jsonRpc(res,id,{content:[{type:'text',text:JSON.stringify(value)}]});}
        catch(error){jsonRpc(res,id,{content:[{type:'text',text:error.message||'Tool call failed'}],isError:true});}
        return;
      }
      if(id!==undefined)jsonRpcError(res,id,-32601,`Method not found: ${method}`);
      else{res.writeHead(202);res.end();}
    }catch(error){json(res,400,{error:error.message||'요청을 처리하지 못했습니다.'});}
  });
  const webSockets=new WebSocketServer({noServer:true,maxPayload:MAX_BODY_BYTES});
  const heartbeatTimer=setInterval(()=>{
    for(const ws of webSockets.clients){
      if(ws.isAlive===false){ws.terminate();continue;}
      ws.isAlive=false;ws.ping();
    }
  },25000);
  heartbeatTimer.unref();
  server.on('upgrade',(req,socket,head)=>{
    const url=new URL(req.url??'/',`http://${req.headers.host??'localhost'}`),origin=req.headers.origin;
    if(url.pathname!=='/relay'||!origin||!origins.has(origin)){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
    webSockets.handleUpgrade(req,socket,head,ws=>webSockets.emit('connection',ws,req));
  });
  webSockets.on('connection',ws=>{
    let room=null,pairedCode=null,joined=false;
    ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true;});
    const joinTimeout=setTimeout(()=>{if(!joined)ws.close(1008,'Join message required');},10000);
    ws.on('message',(data,isBinary)=>{
      if(isBinary){ws.close(1003,'Text messages only');return;}
      let message;
      try{message=JSON.parse(data.toString());}catch{ws.close(1007,'Invalid JSON');return;}
      if(!joined){
        if(message?.type!=='join'||typeof message.pairingCode!=='string'||!PAIRING_CODE_PATTERN.test(message.pairingCode)||![undefined,0,1].includes(message.player)){ws.close(1008,'Invalid pairing code or player');return;}
        const player=message.player??1;
        cleanExpiredRooms();
        if(rooms.size>=MAX_REMOTE_ROOMS&&!rooms.has(message.pairingCode)){ws.close(1013,'Too many active duels');return;}
        room=rooms.get(message.pairingCode);
        if(!room){room={socket:null,lastSeen:Date.now(),player};room.bridge=createRemoteDuelBridge(player);rooms.set(message.pairingCode,room);}
        if(room.player!==player){ws.close(1008,'Pairing code already belongs to another player');return;}
        const previous=room.socket;
        pairedCode=message.pairingCode;
        room.socket=ws;room.lastSeen=Date.now();
        if(previous&&previous!==ws&&previous.readyState===WebSocket.OPEN)previous.close(4001,'Reconnected');
        joined=true;clearTimeout(joinTimeout);
        ws.send(JSON.stringify({type:'joined'}));room.bridge.attach(ws);return;
      }
      if(room.socket!==ws)return;
      if(message?.type==='state'){
        try{room.bridge.updateState(message);room.lastSeen=Date.now();}
        catch(error){ws.send(JSON.stringify({type:'error',message:error.message}));}
      }else if(message?.type==='leave'){
        if(message.pairingCode!==pairedCode)return;
        rooms.delete(pairedCode);
        room.bridge.close();
        room.socket=null;
        ws.close(1000,'Duel ended');
      }
    });
    ws.on('close',()=>{
      clearTimeout(joinTimeout);
      if(room&&room.socket===ws){room.socket=null;room.lastSeen=Date.now();room.bridge.detach(ws);}
    });
    ws.on('error',()=>{if(room)room.bridge.close();});
  });
  const cleanupTimer=setInterval(cleanExpiredRooms,60000);cleanupTimer.unref();
  return {
    server,webSockets,rooms,
    listen:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);}),
    close:()=>new Promise(resolve=>{
      clearInterval(heartbeatTimer);
      clearInterval(cleanupTimer);
      for(const room of rooms.values()){room.socket?.close(1001,'Server stopping');room.bridge.close();}
      rooms.clear();webSockets.close();server.close(()=>resolve());
    })
  };
}

export function startRemoteMcpServer(options={}) {
  const remote=createRemoteMcpServer(options);
  remote.listen().then(()=>process.stderr.write(`Ghost Duel remote MCP listening at http://${options.host??'0.0.0.0'}:${remote.server.address().port}\n`)).catch(error=>{
    process.stderr.write(`Ghost Duel remote MCP failed: ${error.message}\n`);
    process.exitCode=1;
  });
  const stop=()=>{void remote.close().finally(()=>process.exit(0));};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  return remote;
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

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(process.env.YGO_DUEL_MCP_MODE==='remote'||process.argv.includes('--remote'))startRemoteMcpServer({host:process.env.YGO_DUEL_MCP_HOST||'0.0.0.0',port:Number(process.env.PORT||process.env.YGO_DUEL_MCP_PORT)||3333});
  else startMcpServer({port:Number(process.env.YGO_DUEL_MCP_PORT)||DEFAULT_PORT});
}
