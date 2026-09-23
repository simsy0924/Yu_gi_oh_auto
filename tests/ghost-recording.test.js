import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordDecision,createGhostDraft} from '../src/ghost-recording.js';
import {ghostChoice,makePrompt} from '../src/prompts.js';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {OcgMessageType as M} from 'ocgcore-wasm';
import {soloOpponentChoice} from '../src/solo.js';

const cards=JSON.parse(gunzipSync(readFileSync('public/engine/cards.json.gz')));
const deck=JSON.parse(readFileSync('public/decks/starter.json'));

test('recorded card actions replay by action and card instead of volatile button position',()=>{
  const code=deck.main[0];
  const prompt=makePrompt({type:M.SELECT_IDLECMD,player:0,summons:[{code,controller:0,location:2,sequence:0}],special_summons:[],pos_changes:[],monster_sets:[],spell_sets:[],activates:[],to_bp:false,to_ep:true},cards);
  const action=prompt.choices.find(choice=>choice.kind==='summon');
  const step=recordDecision(prompt,{choice:action.id});
  assert.deepEqual(step,{on:'SELECT_IDLECMD',action:'summon',card:code});
  const replay=ghostChoice(prompt,{mode:'sequence',script:[step],fallback:'basic'});
  assert.equal(prompt.choices.find(choice=>choice.id===replay.choice).card,code);
});

test('recorded card selections and counters use the ghost script schema',()=>{
  const selectionPrompt={player:0,type:'SELECT_CARD',selection:{options:[{id:0,card:deck.main[0]},{id:1,card:deck.main[1]}]}};
  assert.deepEqual(recordDecision(selectionPrompt,{indices:[1]}),{on:'SELECT_CARD',card:deck.main[1]});
  assert.deepEqual(recordDecision({player:0,type:'SELECT_COUNTER'},{counters:[2,1]}),{on:'SELECT_COUNTER',counters:[2,1]});
  const cancelPrompt={player:0,type:'SELECT_CARD',choices:[{id:'0',kind:'cancel'}],selection:{options:[]}};
  assert.deepEqual(recordDecision(cancelPrompt,{choice:'0'}),{on:'SELECT_CARD',choice:0});
});

test('a practice trace becomes a valid editable ghost draft',()=>{
  const draft=createGhostDraft({deck,steps:[{on:'SELECT_IDLECMD',action:'end'}],handNames:['테스트 카드'],startingHand:[deck.main[0]]});
  assert.equal(draft.behavior.mode,'sequence');
  assert.deepEqual(draft.behavior.script.map(({on,action})=>({on,action})),[{on:'SELECT_IDLECMD',action:'end'}]);
  assert.deepEqual(draft.startingHand,[deck.main[0]]);
  assert.match(draft.description,/테스트 카드/);
});

test('solo opponents end turns and decline optional effects',()=>{
  const end=makePrompt({type:M.SELECT_IDLECMD,player:1,summons:[],special_summons:[],pos_changes:[],monster_sets:[],spell_sets:[],activates:[],to_bp:true,to_ep:true},cards);
  assert.equal(end.choices.find(choice=>choice.id===soloOpponentChoice(end).choice)?.kind,'end');
  const optional=makePrompt({type:M.SELECT_EFFECTYN,player:1,code:deck.main[0],description:0},cards);
  assert.equal(optional.choices.find(choice=>choice.id===soloOpponentChoice(optional).choice)?.kind,'no');
});
