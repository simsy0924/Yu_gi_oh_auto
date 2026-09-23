import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DuelSession} from '../src/session.js';
import {ghostChoice,fieldPlaces,makePrompt,selectionResponse,counterResponse,requestTypes} from '../src/prompts.js';
import {parseDeck} from '../src/decks.js';
import {OcgMessageType as M,OcgResponseType as R,OcgQueryFlags as Q,OcgOpCode} from 'ocgcore-wasm';
import {cardFacts,cardInfoHtml} from '../src/card-info.js';
import {promptHelp,selectionProgress} from '../src/duel-guidance.js';
import {deckWithStartingHand} from '../src/practice.js';
import {soloOpponentChoice} from '../src/solo.js';
const cards=JSON.parse(gunzipSync(readFileSync('public/engine/cards.json.gz')));
const koreanStrings=JSON.parse(gunzipSync(readFileSync('public/engine/ko-strings.json.gz')));
const scripts=JSON.parse(gunzipSync(readFileSync('public/engine/scripts.json.gz')));
const buf=readFileSync('node_modules/ocgcore-wasm/lib/ocgcore.sync.wasm');
const wasmBinary=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
const you=JSON.parse(readFileSync('public/decks/starter.json'));
const ghost=JSON.parse(readFileSync('public/ghosts/sample.json'));
test('effect commands use Korean choice strings and show the Korean card context',()=>{
  const code=64964750,card={...cards[code],name:'발금령',desc:'카드명을 1개 선언하고 발동할 수 있다.',englishDesc:cards[code].desc,koreanStrings:koreanStrings[code]};
  const description=(BigInt(code)<<20n)|0n;
  const p=makePrompt({type:M.SELECT_IDLECMD,player:0,summons:[],special_summons:[],pos_changes:[],monster_sets:[],spell_sets:[],activates:[{code,controller:0,location:2,sequence:0,description}],to_bp:false,to_ep:false},{[code]:card});
  assert.match(p.choices[0].label,/카드명을 1개 선언하고/);
  assert.doesNotMatch(p.choices[0].label,/Declare/);
  assert.match(p.choices[0].shortLabel,/카드명을 1개 선언하고/);
  const option=makePrompt({type:M.SELECT_OPTION,player:0,options:[description]},{[code]:card});
  assert.equal(option.context.name,'발금령');
  assert.match(option.choices[0].label,/카드명을 1개 선언하고/);
  assert.match(promptHelp(option),/효과/);
  const fallback=makePrompt({type:M.SELECT_OPTION,player:0,options:[description]},{[code]:{...card,koreanStrings:[]}});
  assert.equal(fallback.choices[0].label,'선택 1');
});
test('card details include the applicable printed stats and selection progress',()=>{
  const monster={code:1,name:'시험 카드',desc:'시험 효과',type:1|0x20|0x1000000|0x4000000,race:'8192',attribute:16,level:3,attack:2000,lscale:2,rscale:7,link_marker:128|2,counters:{257:2}};
  const details=cardFacts(monster);
  assert.deepEqual(details.find(([label])=>label==='종류')[1],'몬스터 · 효과 · 펜듈럼 · 링크');
  assert.ok(details.some(([label,value])=>label==='종족'&&value==='드래곤족'));
  assert.ok(details.some(([label,value])=>label==='속성'&&value==='빛'));
  assert.ok(details.some(([label,value])=>label==='링크 마커'&&value==='↑ ↓'));
  assert.ok(details.some(([label,value])=>label==='펜듈럼 스케일'&&value==='2 / 7'));
  assert.ok(details.some(([label])=>label==='카운터 257'));
  assert.match(cardInfoHtml({...monster,name:'<script>'}),/&lt;script&gt;/);
  const normal={...cards[47894537],name:'종글구울의 환술사',link:{rating:0,marker:0}};
  assert.ok(cardFacts(normal).some(([label,value])=>label==='레벨'&&value===4));
  assert.match(cardInfoHtml(normal),/카드 설명/);
  assert.equal(selectionProgress({mode:'sort',options:[1,2,3]},[0,1]),'2/3장 순서 지정');
});
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

test('each duel shuffles the ghost deck; the opening hand stays hidden in the player snapshot',async()=>{
  const openings=new Set();
  for(const first of [1,2,3,4,5]){
    const s=await DuelSession.create({cards,scripts,wasmBinary,you,ghost,seed:[first,2,3,4]});
    try{
      const hand=s.core.duelQueryLocation(s.handle,{controller:1,location:2,flags:Q.CODE});
      openings.add(hand.map(c=>c.code).join(','));
      assert.equal(s.snapshot().zones[1][2].cards,undefined);
      assert.equal(s.snapshot().zones[1][2].count,5);
    }finally{s.destroy();}
  }
  assert.ok(openings.size>1,'different duel seeds should change the ghost opening hand');
});

test('fixed practice hand is dealt exactly and keeps the selected hand size',async()=>{
  const hand=[you.main[0],you.main[1],you.main[0]],deck=deckWithStartingHand(you,hand,cards);
  const s=await DuelSession.create({cards,scripts,wasmBinary,you:deck,ghost,startingHand:hand,seed:[31,2,3,4]});
  try{
    const actual=s.snapshot().zones[0][2].cards.map(card=>card.code).sort((a,b)=>a-b);
    assert.deepEqual(actual,[...hand].sort((a,b)=>a-b));
    assert.equal(actual.length,hand.length);
  }finally{s.destroy();}
});

test('a generated ghost receives its recorded opening hand',async()=>{
  const code=ghost.deck.main[0],scripted={...ghost,startingHand:[code]};
  const s=await DuelSession.create({cards,scripts,wasmBinary,you,ghost:scripted,seed:[32,2,3,4]});
  try{
    const actual=s.core.duelQueryLocation(s.handle,{controller:1,location:2,flags:Q.CODE}).map(card=>card.code);
    assert.deepEqual(actual,[code]);
  }finally{s.destroy();}
});

test('solo practice opponent passes its turns without placing cards',async()=>{
  const s=await DuelSession.create({cards,scripts,wasmBinary,you,ghost:{deck:you,behavior:{type:'scripted',script:[],fallback:'basic'}},seed:[33,2,3,4]});
  try{
    let passed=0;
    for(let i=0;i<100&&!s.ended&&passed<2;i++){
      const prompt=s.prompt;
      if(prompt.player===1){const decision=soloOpponentChoice(prompt);if(prompt.type==='SELECT_IDLECMD'){assert.equal(prompt.choices.find(choice=>choice.id===decision.choice)?.kind,'end');passed++;}s.respond(decision);}
      else s.respond(ghostChoice(prompt,{fallback:'basic'}));
    }
    assert.ok(passed>0);
    assert.equal(s.snapshot().zones[1][4].count??0,0);
  }finally{s.destroy();}
});

test('legal card actions carry their exact field or hand position for card clicks',async()=>{
  const s=await DuelSession.create({cards,scripts,wasmBinary,you,ghost});
  try{
    const drawn=s.snapshot().zones[0][2].cards[0],record=cards[drawn.code];
    assert.equal(drawn.type,record.type);
    assert.equal(drawn.attribute,record.attribute);
    assert.equal(drawn.race,record.race);
    assert.equal(drawn.level,record.level);
    const choices=s.prompt.choices.filter(c=>c.source);
    assert.ok(choices.length>0);
    for(const c of choices){
      assert.equal(c.source.controller,0);
      assert.equal(s.snapshot().zones[0][c.source.location].cards[c.source.sequence].code,c.card);
    }
  }finally{s.destroy();}
});
test('counter allocation respects each card capacity and the exact requested total',()=>{
  const p=makePrompt({type:M.SELECT_COUNTER,player:0,counter_type:0x101,count:3,cards:[
    {code:1,controller:0,location:4,sequence:0,count:2},
    {code:2,controller:0,location:4,sequence:1,count:3}
  ]},cards);
  assert.equal(p.selection.mode,'counter');
  assert.deepEqual(counterResponse(p,[1,2]),{type:R.SELECT_COUNTER,counters:[1,2]});
  assert.throws(()=>counterResponse(p,[3,0]));assert.throws(()=>counterResponse(p,[1,1]));
  assert.deepEqual(ghostChoice(p,{fallback:'basic'}).counters,[2,1]);
});
test('sum selection includes mandatory material and alternate values',()=>{
  const card=(code,amount)=>({code,controller:0,location:4,sequence:code,amount});
  const p=makePrompt({type:M.SELECT_SUM,player:0,select_max:0,amount:6,min:1,max:2,
    selects_must:[card(1,2)],selects:[card(2,5),card(3,(4<<16)|3),card(4,1)]},cards);
  assert.deepEqual(selectionResponse(p,[1]),{type:R.SELECT_SUM,indicies:[1]});
  assert.throws(()=>selectionResponse(p,[0]));
  assert.deepEqual(ghostChoice(p,{fallback:'basic'}).indices,[1]);
  const greater=makePrompt({type:M.SELECT_SUM,player:0,select_max:1,amount:5,min:1,max:3,
    selects_must:[card(1,2)],selects:[card(2,2),card(3,3)]},cards);
  assert.throws(()=>selectionResponse(greater,[0]));
  assert.deepEqual(selectionResponse(greater,[1]),{type:R.SELECT_SUM,indicies:[1]});
});
test('announcements and sort prompts encode declared values and chosen order',()=>{
  const race=makePrompt({type:M.ANNOUNCE_RACE,player:0,count:2,available:1n|8192n},cards);
  assert.deepEqual(selectionResponse(race,[1,0]),{type:R.ANNOUNCE_RACE,races:[8192n,1n]});
  assert.throws(()=>selectionResponse(race,[0]));
  const attrib=makePrompt({type:M.ANNOUNCE_ATTRIB,player:0,count:1,available:16|32},cards);
  assert.deepEqual(selectionResponse(attrib,[1]),{type:R.ANNOUNCE_ATTRIB,attributes:[32]});
  const named=makePrompt({type:M.ANNOUNCE_CARD,player:0,opcodes:[32n,OcgOpCode.ISATTRIBUTE]},
    {16:{code:16,type:33,attribute:32,race:'8192',alias:0,setcodes:[],name:'어둠'},
     32:{code:32,type:33,attribute:16,race:'8192',alias:0,setcodes:[],name:'빛'}});
  assert.deepEqual(named.selection.options.map(o=>o.card),[16]);
  assert.deepEqual(selectionResponse(named,[0]),{type:R.ANNOUNCE_CARD,card:16});
  const number=makePrompt({type:M.ANNOUNCE_NUMBER,player:0,options:[4n,9n]},cards);
  assert.equal(number.choices[1].label,'9');
  assert.equal(number.choices[1].response.value,1); // core expects the option index
  for(const kind of [M.SORT_CARD,M.SORT_CHAIN]){
    const p=makePrompt({type:kind,player:0,cards:[{code:1},{code:2},{code:3}]},cards);
    assert.deepEqual(selectionResponse(p,[2,0,1]),{type:R.SORT_CARD,order:[1,2,0]});
    assert.deepEqual(ghostChoice(p,{fallback:'basic'}).indices,[0,1,2]);
    assert.throws(()=>selectionResponse(p,[0,2]));
  }
  for(const kind of [M.SELECT_COUNTER,M.SELECT_SUM,M.ANNOUNCE_CARD,M.ANNOUNCE_RACE,M.ANNOUNCE_ATTRIB,M.SORT_CARD,M.SORT_CHAIN])assert.ok(requestTypes.has(kind));
});
test('real core accepts a declared card after activating Sales Ban',async()=>{
  const code=64964750,deck={...you,main:[code,...you.main.slice(1)]};
  const localizedCards={...cards,[code]:{...cards[code],name:'발금령',desc:'카드명을 1개 선언하고 발동할 수 있다.',englishDesc:cards[code].desc,koreanStrings:koreanStrings[code]}};
  let s;
  for(let seed=1;seed<=100;seed++){
    s=await DuelSession.create({cards:localizedCards,scripts,wasmBinary,you:deck,ghost,seed:[seed,2,3,4]});
    if(s.prompt?.choices.some(c=>c.kind==='activate'&&c.card===code))break;
    s.destroy();s=null;
  }
  assert.ok(s,'Sales Ban must be in the shuffled opening hand');
  try{
    assert.match(s.prompt.choices.find(c=>c.kind==='activate'&&c.card===code).label,/카드명을 1개 선언하고/);
    s.respond({choice:s.prompt.choices.find(c=>c.kind==='activate'&&c.card===code).id});
    for(let i=0;i<10&&s.prompt?.type!=='ANNOUNCE_CARD';i++){
      const decision=ghostChoice(s.prompt,{fallback:'basic'});
      assert.ok(!decision.blocked,decision.blocked);
      s.respond(decision);
    }
    assert.equal(s.prompt.type,'ANNOUNCE_CARD');
    const selected=s.prompt.selection.options.find(o=>o.card===you.main[0]);
    assert.ok(selected);
    s.respond({indices:[selected.id]});
    assert.notEqual(s.prompt?.type,'ANNOUNCE_CARD');
  }finally{s.destroy();}
});
test('real field queries expose spell counters after a spell resolves',async()=>{
  const citadel=39910367,pot=55144522;
  const deck={...you,main:[...Array(3).fill(citadel),...Array(3).fill(pot),...you.main.slice(6)]};
  const s=await DuelSession.create({cards,scripts,wasmBinary,you:deck,ghost,seed:[9,2,3,4]});
  try{
    for(const code of [citadel,pot]){
      const choice=s.prompt.choices.find(c=>c.kind==='activate'&&c.card===code);
      assert.ok(choice,`${code} should be activatable`);
      s.respond({choice:choice.id});
    }
    for(let i=0;i<8&&!(s.snapshot().zones[0][8].cards[5]?.counters?.[1]>0);i++){
      const decision=ghostChoice(s.prompt,{fallback:'basic'});
      assert.ok(!decision.blocked,decision.blocked);
      s.respond(decision);
    }
    assert.ok(s.snapshot().zones[0][8].cards[5].counters[1]>0);
  }finally{s.destroy();}
});
