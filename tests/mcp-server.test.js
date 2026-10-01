import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'ws';
import {createBridgeServer,createRemoteMcpServer,createToolHandlers} from '../mcp-server/server.js';

async function freePort(){
  const server=createServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  return port;
}

test('browser bridge validates and applies a Claude action against the live prompt',async t=>{
  const bridge=createBridgeServer({port:0});
  await bridge.listen();
  t.after(()=>bridge.close());
  const address=bridge.server.address();
  const base=`http://127.0.0.1:${address.port}`;
  const clientId='test-browser-client-123';
  const request=(path,body)=>fetch(`${base}${path}`,{
    method:body?'POST':'GET',
    headers:{origin:'http://localhost:5173',...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  assert.equal((await request('/connect',{clientId})).status,200);
  const promptState={viewer:1,revision:7,ended:false,logs:[],prompt:{player:1,choices:[{id:'yes',label:'효과 발동'}],selection:null}};
  assert.equal((await request('/state',{clientId,state:promptState})).status,200);

  const tools=createToolHandlers(bridge);
  assert.deepEqual(tools.get_duel_state().prompt.choices.map(choice=>choice.id),['yes']);
  await assert.rejects(tools.duel_action({choiceId:'not-legal'}),/합법 행동 목록/);
  await assert.rejects(tools.duel_action({choiceId:'yes',commentary:'x'.repeat(281)}),/280자 이내/);

  const actionResult=tools.duel_action({choiceId:'yes',commentary:'효과를 확인할게.'});
  const actionResponse=await request(`/action?clientId=${clientId}&after=0`);
  assert.equal(actionResponse.status,200);
  const action=await actionResponse.json();
  assert.equal(action.revision,7);
  assert.deepEqual(action.input,{choice:'yes'});
  assert.equal(action.commentary,'효과를 확인할게.');

  const nextState={viewer:1,revision:8,ended:false,logs:['Claude · 효과 발동'],prompt:null};
  assert.equal((await request('/state',{clientId,state:nextState,actionResult:{requestId:action.id,ok:true}})).status,200);
  const applied=await actionResult;
  assert.equal(applied.applied,true);
  assert.equal(applied.nextState.revision,8);
});

test('MCP stdio process initializes and lists duel tools using JSON-RPC lines',async t=>{
  const port=await freePort();
  const serverPath=fileURLToPath(new URL('../mcp-server/server.js',import.meta.url));
  const child=spawn(process.execPath,[serverPath],{env:{...process.env,YGO_DUEL_MCP_PORT:String(port)},stdio:['pipe','pipe','pipe']});
  t.after(()=>{if(!child.killed)child.kill('SIGTERM');});
  let buffer='';const queued=[];const waiters=[];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{
    buffer+=chunk;let end;
    while((end=buffer.indexOf('\n'))>=0){
      const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
      if(!line.trim())continue;
      const value=JSON.parse(line),waiter=waiters.shift();
      if(waiter){clearTimeout(waiter.timer);waiter.resolve(value);}else queued.push(value);
    }
  });
  child.stderr.setEncoding('utf8');
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
  const nextMessage=()=>new Promise((resolve,reject)=>{
    if(queued.length){resolve(queued.shift());return;}
    const waiter={resolve,reject,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(waiter),1);reject(new Error(`MCP server response timeout. stderr: ${stderr}`));},5000)};
    waiters.push(waiter);
  });

  const initialized=nextMessage();
  child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}})}\n`);
  const init=await initialized;
  assert.equal(init.id,1);
  assert.equal(init.result.protocolVersion,'2025-06-18');
  assert.ok(init.result.capabilities.tools);

  const listed=nextMessage();
  child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})}\n`);
  const response=await listed;
  assert.deepEqual(response.result.tools.map(tool=>tool.name),['get_duel_state','wait_for_duel_turn','list_legal_options','duel_action']);
});

test('remote Streamable HTTP MCP pairs through an origin-checked WebSocket and applies legal actions',async t=>{
  const remote=createRemoteMcpServer({host:'127.0.0.1',port:0,allowedOrigins:'http://localhost:5173'});
  await remote.listen();
  t.after(()=>remote.close());
  const address=remote.server.address(),base=`http://127.0.0.1:${address.port}`,code='9a0c168e-8252-4dd4-9db5-4e3c8b85c3ef';
  const mcp=async(id,method,params={})=>{
    const response=await fetch(`${base}/mcp`,{method:'POST',headers:{'content-type':'application/json','accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
    assert.equal(response.status,200);
    return response.json();
  };
  const initialize=await mcp(1,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}});
  assert.equal(initialize.result.protocolVersion,'2025-06-18');
  const listed=await mcp(2,'tools/list');
  assert.ok(listed.result.tools.every(tool=>tool.inputSchema.required.includes('pairingCode')));
  const actionTool=listed.result.tools.find(tool=>tool.name==='duel_action');
  assert.equal(actionTool.inputSchema.properties.commentary.maxLength,280);
  assert.ok(!actionTool.inputSchema.required.includes('commentary'));
  assert.match(actionTool.description,/nextState/);

  const connect=async()=>{
    const socket=new WebSocket(`${base.replace(/^http/,'ws')}/relay`,{headers:{origin:'http://localhost:5173'}});
    const messages=[],waiters=[];
    socket.on('message',data=>{
      const message=JSON.parse(data.toString()),waiter=waiters.shift();
      if(waiter){clearTimeout(waiter.timer);waiter.resolve(message);}else messages.push(message);
    });
    const nextMessage=()=>new Promise((resolve,reject)=>{
      if(messages.length){resolve(messages.shift());return;}
      const waiter={resolve,reject,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(waiter),1);reject(new Error('WebSocket relay response timeout'));},3000)};
      waiters.push(waiter);
    });
    await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
    const joined=nextMessage();
    socket.send(JSON.stringify({type:'join',pairingCode:code}));
    assert.deepEqual(await joined,{type:'joined'});
    return {socket,nextMessage};
  };
  let {socket,nextMessage}=await connect();
  const promptState={viewer:1,revision:7,ended:false,logs:[],prompt:{player:1,choices:[{id:'yes',label:'효과 발동'}],selection:null}};
  socket.send(JSON.stringify({type:'state',state:promptState}));
  let result=await mcp(3,'tools/call',{name:'get_duel_state',arguments:{pairingCode:code}});
  assert.equal(JSON.parse(result.result.content[0].text).prompt.player,1);
  result=await mcp(4,'tools/call',{name:'get_duel_state',arguments:{pairingCode:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}});
  assert.equal(result.result.isError,true);

  await new Promise(resolve=>{socket.once('close',resolve);socket.close(1000,'test reconnect');});
  ({socket,nextMessage}=await connect());
  result=await mcp(5,'tools/call',{name:'get_duel_state',arguments:{pairingCode:code}});
  assert.equal(JSON.parse(result.result.content[0].text).revision,7);

  await new Promise(resolve=>{socket.once('close',resolve);socket.close(1000,'test queued action');});
  const actionCall=mcp(6,'tools/call',{name:'duel_action',arguments:{pairingCode:code,choiceId:'yes',commentary:'이 효과는 막아야겠어.'}});
  ({socket,nextMessage}=await connect());
  const action=await nextMessage();
  assert.equal(action.type,'action');
  assert.equal(action.revision,7);
  assert.deepEqual(action.input,{choice:'yes'});
  assert.equal(action.commentary,'이 효과는 막아야겠어.');
  const nextState={viewer:1,revision:8,ended:false,logs:['Claude · 효과 발동'],prompt:{player:0,choices:[],selection:null}};
  socket.send(JSON.stringify({type:'state',state:nextState,actionResult:{requestId:action.id,ok:true}}));
  result=await actionCall;
  assert.equal(result.result.isError,undefined);
  assert.equal(JSON.parse(result.result.content[0].text).nextState.revision,8);
  socket.close();
});

test('remote browser relay rejects origins outside the configured allowlist',async t=>{
  const remote=createRemoteMcpServer({host:'127.0.0.1',port:0,allowedOrigins:'http://localhost:5173'});
  await remote.listen();
  t.after(()=>remote.close());
  const base=`http://127.0.0.1:${remote.server.address().port}`;
  const response=await fetch(`${base}/health`,{headers:{origin:'https://attacker.example'}});
  assert.equal(response.status,403);
  const socket=new WebSocket(`${base.replace(/^http/,'ws')}/relay`,{headers:{origin:'https://attacker.example'}});
  const status=await new Promise(resolve=>socket.once('unexpected-response',(_request,result)=>resolve(result.statusCode)));
  assert.equal(status,403);
});
