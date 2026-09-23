import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportGhost,actionsByRequest} from '../src/ghosts.js';
import {ghostChoice,requestTypes} from '../src/prompts.js';
import {parseDeck} from '../src/decks.js';
import {OcgMessageType as M} from 'ocgcore-wasm';

const deck=JSON.parse(readFileSync('public/decks/starter.json'));
test('edited ghost exports into the existing import format and follows a scripted choice',()=>{
  const ghost=exportGhost({name:'테스트 고스트',description:'소환 후 공격',deck,
    behavior:{type:'scripted',fallback:'pause',script:[{on:'SELECT_IDLECMD',action:'summon',card:4148264},{on:'SELECT_BATTLECMD',action:'attack'}]}});
  const imported=JSON.parse(JSON.stringify(ghost));
  assert.equal(parseDeck(JSON.stringify(imported.deck)).main.length,40);
  assert.deepEqual(ghostChoice({type:'SELECT_IDLECMD',choices:[
    {id:'0',kind:'summon',card:14575467},{id:'1',kind:'summon',card:4148264}
  ]},imported.behavior,0),{choice:'1',cursor:1});
  assert.equal(ghostChoice({type:'SELECT_IDLECMD',choices:[]},imported.behavior,0).blocked?.length>0,true);
});

test('a scripted card selection takes priority over a cancel button',()=>{
  const p={type:'SELECT_CARD',choices:[{id:'0',kind:'cancel'}],selection:{options:[{id:0},{id:1}],min:1,max:2}};
  const behavior={script:[{on:'SELECT_CARD',indices:[1]}],fallback:'basic'};
  assert.deepEqual(ghostChoice(p,behavior,0),{indices:[1],cursor:1});
  assert.throws(()=>exportGhost({name:'오류',deck,behavior:{type:'scripted',fallback:'basic',script:[{on:'SELECT_CARD',indices:[0,0]}]}}),/1단계/);
});

test('priority rules adapt to the legal actions in the current hand and do not consume the rule',()=>{
  const p={type:'SELECT_IDLECMD',choices:[
    {id:'0',kind:'special',card:20},{id:'1',kind:'summon',card:30},
    {id:'2',kind:'set-spell',card:40},{id:'3',kind:'end',card:null}
  ]};
  const behavior={mode:'priority',fallback:'basic',script:[
    {on:'SELECT_IDLECMD',action:'activate',card:10},
    {on:'SELECT_IDLECMD',action:'special',card:20},
    {on:'SELECT_IDLECMD',action:'summon',card:30}
  ]};
  assert.equal(exportGhost({name:'우선순위',deck,behavior:{...behavior,type:'scripted'}}).behavior.mode,'priority');
  assert.deepEqual(ghostChoice(p,behavior,0),{choice:'0',cursor:0});
  assert.deepEqual(ghostChoice({...p,choices:p.choices.slice(1)},behavior,0),{choice:'1',cursor:0});
  assert.deepEqual(ghostChoice({...p,choices:p.choices.slice(2)},behavior,0),{choice:'2',cursor:0});
});

test('priority target rule follows a card rather than a shifting selection index',()=>{
  const p={type:'SELECT_CARD',choices:[{id:'0',kind:'cancel'}],selection:{options:[
    {id:0,card:100},{id:1,card:200}
  ],min:1,max:1}};
  const behavior={mode:'priority',fallback:'pause',script:[{on:'SELECT_CARD',card:200}]};
  assert.deepEqual(ghostChoice(p,behavior),{indices:[1],cursor:0});
  assert.ok(ghostChoice({...p,selection:{...p.selection,options:[p.selection.options[0]]}},behavior).blocked);
});
test('ghost JSON can allocate counters and declare a named card',()=>{
  const behavior={type:'scripted',mode:'priority',fallback:'basic',script:[
    {on:'SELECT_COUNTER',counters:[1,2]},
    {on:'ANNOUNCE_CARD',card:4148264}
  ]};
  const saved=exportGhost({name:'선언 고스트',deck,behavior});
  assert.deepEqual(JSON.parse(JSON.stringify(saved.behavior.script)),behavior.script);
  assert.deepEqual(ghostChoice({type:'SELECT_COUNTER',selection:{mode:'counter',total:3,options:[{cap:1},{cap:2}]},choices:[]},behavior).counters,[1,2]);
  assert.deepEqual(ghostChoice({type:'ANNOUNCE_CARD',selection:{mode:'card',min:1,max:1,options:[{id:0,card:99},{id:1,card:4148264}]},choices:[]},behavior).indices,[1]);
  assert.throws(()=>exportGhost({name:'오류',deck,behavior:{...behavior,script:[{on:'SELECT_COUNTER',counters:[-1]}]}}),/1단계/);
});
test('the behavior editor lists every core selection request',()=>{
  for(const [name,value] of Object.entries(M))if(requestTypes.has(value))assert.ok(Object.hasOwn(actionsByRequest,name),name);
});
