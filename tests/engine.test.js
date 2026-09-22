import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DuelSession} from '../src/session.js';
import {ghostChoice,fieldPlaces,makePrompt,selectionResponse} from '../src/prompts.js';
import {parseDeck} from '../src/decks.js';
import {OcgMessageType as M} from 'ocgcore-wasm';
const cards=JSON.parse(gunzipSync(readFileSync('public/engine/cards.json.gz')));
const scripts=JSON.parse(gunzipSync(readFileSync('public/engine/scripts.json.gz')));
const buf=readFileSync('node_modules/ocgcore-wasm/lib/ocgcore.sync.wasm');
const wasmBinary=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
const you=JSON.parse(readFileSync('public/decks/starter.json'));
const ghost=JSON.parse(readFileSync('public/ghosts/sample.json'));
test('real WASM core: draw, summon, battle, damage and win',async()=>{
  const s=await DuelSession.create({cards,scripts,wasmBinary,you,ghost});
  try {
    let summons=0,attacks=0,damage=false;
    for(let i=0;i<1000&&!s.ended;i++) {
      const snap=s.snapshot();assert.equal(snap.zones[1][2].cards,undefined);
      assert.ok(s.prompt, 'must wait for an actionable prompt');
      const d=ghostChoice(s.prompt,{},0);assert.ok(!d.blocked,d.blocked);
      const c=s.prompt.choices.find(c=>c.id===d.choice);
      if(c?.kind==='summon')summons++;if(c?.kind==='attack')attacks++;
      s.respond(d);damage ||= s.lp.some(x=>x<8000);
    }
    assert.ok(s.ended,'duel completes');assert.ok(summons>1);assert.ok(attacks>0);assert.ok(damage);
    console.log({turns:s.turn,winner:s.winner,summons,attacks,lp:s.lp});
  }finally{s.destroy();}
});
test('place mask is relative to player, including opponent zones',()=>{
  assert.deepEqual(fieldPlaces((~((1<<2)|(1<<25)))>>>0,1),[{player:1,location:4,sequence:2},{player:0,location:8,sequence:1}]);
});
test('YDK import, extra/side sections, limits, untrusted input',()=>{
  const d=parseDeck('#created by test\n#main\n'+you.main.join('\n')+'\n#extra\n!side\n');assert.deepEqual(d.main,you.main);
  assert.throws(()=>parseDeck('#main\n1'));
  assert.throws(()=>parseDeck(JSON.stringify({...you,main:Array(40).fill(1)})));
});
test('selection validates bounds and duplicates; forced chain cannot pass',()=>{
  const p=makePrompt({type:M.SELECT_CARD,player:0,min:1,max:1,can_cancel:false,selects:[{code:you.main[0]}]},cards);
  assert.throws(()=>selectionResponse(p,[]));assert.throws(()=>selectionResponse(p,[0,0]));assert.deepEqual(selectionResponse(p,[0]).indicies,[0]);
  const chain=makePrompt({type:M.SELECT_CHAIN,player:0,forced:true,selects:[{code:you.main[0]}]},cards);assert.equal(chain.choices.length,1);
});
test('real Lua effect resolves through a chain and draws two cards',async()=>{
  const deck={...you,main:[55144522,...you.main.slice(1)]};
  // Seed chosen by a bounded search: test the real shuffled opening, never alter field state.
  let s;
  for(let seed=1;seed<=100;seed++) {
    s=await DuelSession.create({cards,scripts,wasmBinary,you:deck,ghost,seed:[seed,2,3,4]});
    if(s.prompt.choices.some(c=>c.kind==='activate'&&c.card===55144522))break;
    s.destroy();s=null;
  }
  assert.ok(s,'a seed with the spell in opening hand exists');
  try {
    const action=s.prompt.choices.find(c=>c.kind==='activate'&&c.card===55144522);
    s.respond({choice:action.id});
    for(let i=0;i<50&&s.prompt.type!=='SELECT_IDLECMD';i++){const d=ghostChoice(s.prompt);assert.ok(!d.blocked,d.blocked);s.respond(d);}
    assert.equal(s.snapshot().zones[0][2].cards.length,6); // 5 - spell + 2
    assert.equal(s.snapshot().zones[0][16].cards[0].code,55144522);
  }finally{s.destroy();}
});
test('patched WASM card data preserves link markers',async()=>{
  const link=Object.values(cards).find(c=>(c.type&0x4000000)&&c.link_marker===32);
  assert.ok(link);
  const s=await DuelSession.create({cards,scripts,wasmBinary,you:{...you,extra:[link.code]},ghost});
  try{const q=s.snapshot().zones[0][64].cards[0];assert.equal(q.link.marker,link.link_marker);}finally{s.destroy();}
});
test('scripted ghost consumes only matching requests and fails clearly',()=>{
  const p=makePrompt({type:M.SELECT_IDLECMD,player:1,summons:[{code:you.main[0]}],special_summons:[],pos_changes:[],monster_sets:[],spell_sets:[],activates:[],to_bp:false,to_ep:true},cards);
  const behavior={script:[{on:'SELECT_IDLECMD',action:'summon',card:you.main[0]}],fallback:'pause'};
  assert.equal(ghostChoice(p,behavior).cursor,1);
  assert.ok(ghostChoice(p,{...behavior,script:[{on:'SELECT_IDLECMD',card:99999999}]}).blocked);
  assert.ok(ghostChoice(p,{fallback:'pause'}).blocked);
});
