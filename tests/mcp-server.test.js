import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {createBridgeServer,createToolHandlers} from '../mcp-server/server.js';

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

  const actionResult=tools.duel_action({choiceId:'yes'});
  const actionResponse=await request(`/action?clientId=${clientId}&after=0`);
  assert.equal(actionResponse.status,200);
  const action=await actionResponse.json();
  assert.equal(action.revision,7);
  assert.deepEqual(action.input,{choice:'yes'});

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
