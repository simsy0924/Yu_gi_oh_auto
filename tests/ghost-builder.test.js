import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportGhost} from '../src/ghosts.js';
import {ghostChoice} from '../src/prompts.js';
import {parseDeck} from '../src/decks.js';

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
