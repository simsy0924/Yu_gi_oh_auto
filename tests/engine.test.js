import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DuelSession} from '../src/session.js';
import {ghostChoice,fieldPlaces,makePrompt,selectionResponse,counterResponse,requestTypes} from '../src/prompts.js';
import {parseDeck} from '../src/decks.js';
import {OcgMessageType as M,OcgResponseType as R,OcgQueryFlags as Q,OcgOpCode} from 'ocgcore-wasm';
import {cardFacts,cardInfoHtml,deckCardInfoText} from '../src/card-info.js';
import {promptHelp,selectionProgress,promptCardName} from '../src/duel-guidance.js';
import {deckWithStartingHand} from '../src/practice.js';
import {soloOpponentChoice} from '../src/solo.js';
import {replayPlayerInputs} from '../src/duel-history.js';
import {describeDecision,describeChain,decisionUsesPrivateCard} from '../src/duel-log.js';
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
  const extraPrompt=makePrompt({type:M.SELECT_IDLECMD,player:0,summons:[],special_summons:[{code,controller:0,location:64,sequence:0,position:1}],pos_changes:[],monster_sets:[],spell_sets:[],activates:[],to_bp:false,to_ep:false},{[code]:card});
  assert.equal(extraPrompt.choices[0].source.position,1);
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
test('Pendulum card details always show Pendulum and monster effects',()=>{
  const card={
    code:99001,name:'펜듈럼 시험 카드',type:1|0x20|0x1000000,
    desc:'【펜듈럼 효과】\n한국어 펜듈럼 효과\n【몬스터 효과】\n한국어 몬스터 효과',
    englishDesc:'[ Pendulum Effect ]\nEnglish Pendulum Effect\n[ Monster Effect ]\nEnglish Monster Effect'
  };
  const html=cardInfoHtml(card);
  assert.ok(html.indexOf('한국어 펜듈럼 효과')<html.indexOf('한국어 몬스터 효과'));
  assert.match(html,/펜듈럼 효과/);
  assert.match(html,/몬스터 효과/);
  const copied=deckCardInfoText({name:'펜듈럼 테스트 덱',main:[99001],extra:[],side:[]},{99001:card});
  assert.match(copied,/펜듈럼 효과:\n한국어 펜듈럼 효과/);
  assert.match(copied,/몬스터 효과:\n한국어 몬스터 효과/);

  const missingTranslation={...card,desc:'【몬스터 효과】\n한국어 몬스터 효과'};
  const fallbackHtml=cardInfoHtml(missingTranslation);
  assert.match(fallbackHtml,/펜듈럼 효과 \(영문 원문\)/);
  assert.match(fallbackHtml,/English Pendulum Effect/);
  assert.match(fallbackHtml,/한국어 몬스터 효과/);
  const fallbackCopy=deckCardInfoText({main:[99001],extra:[],side:[]},{99001:missingTranslation});
  assert.match(fallbackCopy,/펜듈럼 효과 \(영문 원문\):\nEnglish Pendulum Effect/);

  const untranslated={...card,desc:card.englishDesc};
  const untranslatedHtml=cardInfoHtml(untranslated);
  assert.match(untranslatedHtml,/펜듈럼 효과 \(영문 원문\)/);
  assert.match(untranslatedHtml,/몬스터 효과 \(영문 원문\)/);

  const unmarkedTranslation={...card,desc:'한국어로 번역된 몬스터 효과'};
  const unmarkedHtml=cardInfoHtml(unmarkedTranslation);
  assert.match(unmarkedHtml,/펜듈럼 효과 \(영문 원문\)/);
  assert.match(unmarkedHtml,/몬스터 효과/);
  assert.match(unmarkedHtml,/한국어로 번역된 몬스터 효과/);
  assert.doesNotMatch(unmarkedHtml,/English Monster Effect/);

  const unstructuredBoth={...card,desc:'구분 표기가 없는 한국어 몬스터 효과',englishDesc:'Unstructured English source',pendulumEffect:'한국어 펜듈럼 효과'};
  const unstructuredHtml=cardInfoHtml(unstructuredBoth);
  assert.match(unstructuredHtml,/한국어 펜듈럼 효과/);
  assert.match(unstructuredHtml,/구분 표기가 없는 한국어 몬스터 효과/);
  assert.doesNotMatch(unstructuredHtml,/몬스터 효과 텍스트를 찾을 수 없습니다/);

  const normalPendulum={
    ...card,type:1|0x10|0x1000000,
    desc:'한국어 펜듈럼 일반 몬스터 설명',
    englishDesc:'[ Pendulum Effect ]\nEnglish Pendulum effect\n[ Flavor Text ]\nEnglish flavor text',
    pendulumEffect:'한국어 펜듈럼 효과'
  };
  const normalPendulumHtml=cardInfoHtml(normalPendulum);
  assert.ok(normalPendulumHtml.indexOf('한국어 펜듈럼 효과')<normalPendulumHtml.indexOf('한국어 펜듈럼 일반 몬스터 설명'));
  assert.match(normalPendulumHtml,/카드 설명/);
  assert.doesNotMatch(normalPendulumHtml,/English flavor text/);
});
test('duel action descriptions identify selected cards and effects',()=>{
  const cards={73218792:{name:'정크 마이스터'}};
  const action={type:'SELECT_IDLECMD',title:'행동을 선택하세요',choices:[{id:'1',card:73218792,shortLabel:'특수 소환'}]};
  assert.equal(describeDecision(action,{choice:'1'},cards),'정크 마이스터 · 특수 소환');
  const selection={type:'SELECT_CARD',title:'카드 선택',selection:{options:[{id:0,label:'정크 싱크론 · 묘지 1'}]}};
  assert.equal(describeDecision(selection,{indices:[0]},cards),'카드 선택 · 정크 싱크론 · 묘지 1');
  const effect={type:'SELECT_EFFECTYN',title:'정크 마이스터 · 특수 소환할까요?',choices:[{id:'0',kind:'yes',shortLabel:'예'}]};
  assert.equal(describeDecision(effect,{choice:'0'},cards),'정크 마이스터 · 특수 소환할까요? · 예');
});
test('public duel logs hide private cards and retain information revealed by actions or face-up zones',()=>{
  const hiddenName='비밀 카드',cards={12345:{name:hiddenName}};
  const setPrompt={title:'행동을 선택하세요',choices:[{id:'0',kind:'set',card:12345,shortLabel:'몬스터 세트',source:{controller:0,location:2,sequence:0,position:1}}]};
  assert.equal(describeDecision(setPrompt,{choice:'0'},cards),'몬스터 세트');
  assert.equal(decisionUsesPrivateCard(setPrompt,{choice:'0'}),true);

  const selectPrompt={title:'카드 선택',selection:{options:[{id:0,label:`${hiddenName} · 패 1`,card:12345,source:{controller:0,location:2,sequence:0,position:1}}]}};
  assert.equal(describeDecision(selectPrompt,{indices:[0]},cards),'카드 선택 · 비공개 카드');
  assert.equal(decisionUsesPrivateCard(selectPrompt,{indices:[0]}),true);

  const deckPrompt={title:'카드 선택',selection:{options:[{id:0,label:`${hiddenName} · 덱 1`,card:12345,source:{controller:1,location:1,sequence:0}}]}};
  assert.equal(describeDecision(deckPrompt,{indices:[0]},cards),'카드 선택 · 덱에서 카드');
  assert.equal(decisionUsesPrivateCard(deckPrompt,{indices:[0]}),true);
  const revealedDeckCard=[{code:12345,controller:1,location:1,sequence:0}];
  assert.equal(describeDecision(deckPrompt,{indices:[0]},cards,revealedDeckCard),`카드 선택 · ${hiddenName} · 덱 1`);
  assert.equal(decisionUsesPrivateCard(deckPrompt,{indices:[0]},revealedDeckCard),false);

  const handSummon={title:'행동을 선택하세요',choices:[{id:'0',kind:'special',card:12345,shortLabel:'특수 소환',source:{controller:0,location:2,sequence:0,position:1}}]};
  assert.equal(describeDecision(handSummon,{choice:'0'},cards),`${hiddenName} · 특수 소환`);
  assert.equal(decisionUsesPrivateCard(handSummon,{choice:'0'}),false);

  const faceUpExtra={title:'행동을 선택하세요',choices:[{id:'0',kind:'special',card:12345,shortLabel:'특수 소환',source:{controller:1,location:64,sequence:0,position:1}}]};
  assert.equal(describeDecision(faceUpExtra,{choice:'0'},cards),`${hiddenName} · 특수 소환`);
  assert.equal(decisionUsesPrivateCard(faceUpExtra,{choice:'0'}),false);

  const faceUpExtraSelection={title:'카드 선택',selection:{options:[{id:0,label:hiddenName,card:12345,source:{controller:1,location:64,sequence:0,position:4}}]}};
  assert.equal(describeDecision(faceUpExtraSelection,{indices:[0]},cards),`카드 선택 · ${hiddenName}`);
  const faceDownExtraSelection={title:'카드 선택',selection:{options:[{id:0,label:hiddenName,card:12345,source:{controller:1,location:64,sequence:0,position:8}}]}};
  assert.equal(describeDecision(faceDownExtraSelection,{indices:[0]},cards),'카드 선택 · 비공개 카드');

  const faceUpBanished={title:'카드 선택',selection:{options:[{id:0,label:hiddenName,card:12345,source:{controller:1,location:32,sequence:0,position:1}}]}};
  assert.equal(describeDecision(faceUpBanished,{indices:[0]},cards),`카드 선택 · ${hiddenName}`);
  const faceDownBanished={title:'카드 선택',selection:{options:[{id:0,label:hiddenName,card:12345,source:{controller:1,location:32,sequence:0,position:8}}]}};
  assert.equal(describeDecision(faceDownBanished,{indices:[0]},cards),'카드 선택 · 비공개 카드');

  assert.equal(describeChain({chain_size:1,code:12345,position:2},cards),'체인 1 · 세트 카드 효과');
  assert.equal(describeChain({chain_size:1,code:12345},cards),'체인 1 · 세트 카드 효과');
  assert.equal(describeChain({chain_size:1,code:12345,position:1},cards),`체인 1 · ${hiddenName}`);
  assert.equal(describeChain({chain_size:1,code:12345,location:2,position:8},cards),`체인 1 · ${hiddenName}`);
});
test('public deck reveals appear in both hand rows and stay visible when moved into a hand',()=>{
  const session=new DuelSession();
  session.cards={12345:{code:12345,name:'공개된 카드',desc:'테스트 효과',type:1,race:'1',attribute:1,level:4,attack:1700,defense:1200}};
  session.userCorePlayer=0;session.lp=[8000,8000];session.turn=1;session.phase=4;session.active=0;session.ended=false;session.winner=undefined;session.prompt=null;
  session.confirmation=null;session.confirmationByPlayer={0:null,1:null};session.confirmationSerial=0;session.confirmationSerialByPlayer={0:0,1:0};session.knownCardsByViewer={0:[],1:[]};session.publicCards=[];
  session.recordConfirmation({type:M.CONFIRM_DECKTOP,player:1,cards:[{code:12345,controller:1,location:1,sequence:0}]});
  assert.equal(session.confirmation.type,'CONFIRM_DECKTOP');
  assert.equal(session.confirmationByPlayer[1].cards[0].name,'공개된 카드');
  assert.match(session.logs.at(-1),/덱 위 공개 · 공개된 카드/);
  const prompt={title:'카드 선택',selection:{options:[{id:0,label:'공개된 카드 · 덱 1',card:12345,source:{controller:1,location:1,sequence:0}}]}};
  assert.equal(describeDecision(prompt,{indices:[0]},session.cards,session.publicCards),'카드 선택 · 공개된 카드 · 덱 1');
  assert.equal(session.recordMovement({card:12345,from:{controller:1,location:1,sequence:0},to:{controller:1,location:2,sequence:0}}),true);
  session.core={duelQueryCount:()=>2,duelQueryLocation:(_handle,place)=>place.controller===1&&place.location===2?[{code:12345,position:8},{code:67890,position:8}]:[]};
  const state=session.snapshot(0);
  assert.equal(state.zones[1][2].count,2);
  assert.equal(state.zones[1][2].cards[0].name,'공개된 카드');
  assert.equal(state.zones[1][2].cards[0].sequence,0);
  assert.equal(state.zones[1][2].cards[1].hidden,true);
  assert.equal('code' in state.zones[1][2].cards[1],false);
});
test('public Deck knowledge follows cards when Deck order changes',()=>{
  const session=new DuelSession();session.userCorePlayer=0;
  session.cards={
    12345:{code:12345,name:'첫 공개 카드'},
    67890:{code:67890,name:'둘째 공개 카드'}
  };
  session.confirmationByPlayer={0:null,1:null};session.confirmationSerialByPlayer={0:0,1:0};session.knownCardsByViewer={0:[],1:[]};session.publicCards=[];
  session.recordConfirmation({type:M.CONFIRM_DECKTOP,player:1,cards:[
    {code:12345,controller:1,location:1,sequence:0},
    {code:67890,controller:1,location:1,sequence:1}
  ]});
  assert.equal(session.recordMovement({card:12345,from:{controller:1,location:1,sequence:0},to:{controller:1,location:1,sequence:2}}),true);
  assert.deepEqual(session.publicCards.map(({code,location,sequence})=>({code,location,sequence})),[
    {code:12345,location:1,sequence:2},
    {code:67890,location:1,sequence:0}
  ]);
  const prompt={title:'카드 선택',selection:{options:[{id:0,label:'둘째 공개 카드 · 덱 1',card:67890,source:{controller:1,location:1,sequence:0}}]}};
  assert.equal(describeDecision(prompt,{indices:[0]},session.cards,session.publicCards),'카드 선택 · 둘째 공개 카드 · 덱 1');
  assert.equal(session.recordMovement({card:67890,from:{controller:1,location:1,sequence:0},to:{controller:1,location:2,sequence:0}}),true);
  session.core={duelQueryCount:()=>2,duelQueryLocation:(_handle,place)=>place.controller===1&&place.location===2?[{code:67890,position:8},{code:99999,position:8}]:[]};
  const state=session.snapshot(0);
  assert.equal(state.zones[1][2].cards[0].name,'둘째 공개 카드');
  assert.equal(state.zones[1][2].cards[1].hidden,true);
  assert.equal('code' in state.zones[1][2].cards[1],false);
});
test('confirmed hidden cards are exposed only when the local player is allowed to see them',()=>{
  const session=new DuelSession();
  session.cards={
    12345:{code:12345,name:'확인 카드',desc:'테스트 효과',type:1|0x20,race:'1',attribute:1,level:4,attack:1700,defense:1200}
  };
  session.confirmation=null;session.confirmationSerial=0;
  const card={code:12345,controller:1,location:2,sequence:0};
  session.recordConfirmation({type:M.CONFIRM_CARDS,player:1,cards:[card]});
  assert.equal(session.confirmation,null,'상대만 확인한 비공개 정보는 노출하지 않는다');
  session.recordConfirmation({type:M.CONFIRM_CARDS,player:0,cards:[card]});
  assert.equal(session.confirmation.id,1);
  assert.equal(session.confirmation.type,'CONFIRM_CARDS');
  assert.equal(session.confirmation.cards[0].name,'확인 카드');
  assert.equal(session.confirmation.cards[0].location,2);
  assert.equal(session.confirmation.cards[0].attack,1700);
});
test('CONFIRM_CARDS keeps a revealed opponent card private to the addressed viewer',()=>{
  const session=new DuelSession();
  session.cards={12345:{code:12345,name:'확인 카드'}};
  session.confirmationByPlayer={0:null,1:null};session.confirmationSerialByPlayer={0:0,1:0};session.knownCardsByViewer={0:[],1:[]};session.publicCards=[];
  session.recordConfirmation({type:M.CONFIRM_CARDS,player:0,cards:[{code:12345,controller:1,location:2,sequence:0}]});
  assert.equal(session.confirmationByPlayer[0].cards[0].name,'확인 카드');
  assert.equal(session.confirmationByPlayer[1],null);
  assert.deepEqual(session.knownCardsByViewer[0],[{code:12345,controller:1,location:2,sequence:0}]);
  assert.deepEqual(session.knownCardsByViewer[1],[]);
  assert.deepEqual(session.publicCards,[]);
  assert.equal(session.logs.at(-1),'내가 카드 1장 확인');
});
test('duel logs retain actions from the beginning of a long match',()=>{
  const session=new DuelSession();session.logs=[];
  for(let i=0;i<60;i++)session.log(`고스트 · 행동 ${i+1}`);
  assert.equal(session.logs.length,60);
  assert.equal(session.logs[0],'고스트 · 행동 1');
  assert.equal(session.logs.at(-1),'고스트 · 행동 60');
});
test('real WASM core: draw, summon, battle, damage and win',async()=>{
  const s=await DuelSession.create({cards,scripts,wasmBinary,you,ghost});
  try {
    let summons=0,attacks=0,damage=false;
    for(let i=0;i<1000&&!s.ended;i++) {
      const snap=s.snapshot(),opponentHand=snap.zones[1][2];
      assert.equal(opponentHand.cards.length,opponentHand.count);
      assert.ok(opponentHand.cards.every(card=>card.hidden&&!('code' in card)));
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
test('duel history replay restores the same state before the latest player action',async()=>{
  const createSession=()=>DuelSession.create({cards,scripts,wasmBinary,you,ghost,seed:[343,2,3,4]});
  const original=await createSession();let restored;
  try{
    const action=original.prompt.choices.find(choice=>choice.kind==='end');
    assert.ok(action,'the opening hand should allow ending the turn');
    const input={choice:action.id},prompt=original.prompt;
    original.log(`나 · ${describeDecision(prompt,input,original.cards)}`);original.respond(input);
    let cursor=0;
    for(let actions=0;original.prompt?.player===1&&!original.ended&&actions<1000;actions++){
      const decision=ghostChoice(original.prompt,ghost.behavior,cursor);assert.ok(!decision.blocked,decision.blocked);
      cursor=decision.cursor??cursor;original.respond(decision);
    }
    assert.equal(original.prompt?.player,0,'the next player decision is available');
    const before=JSON.stringify(original.snapshot());
    const replayed=await replayPlayerInputs({
      createSession,
      playerInputs:[input],
      logPlayerAction:(session,actionPrompt,actionInput)=>session.log(`나 · ${describeDecision(actionPrompt,actionInput,session.cards)}`),
      resolveOpponent:(session,nextCursor)=>{
        let replayCursor=nextCursor;
        for(let actions=0;session.prompt?.player===1&&!session.ended&&actions<1000;actions++){
          const decision=ghostChoice(session.prompt,ghost.behavior,replayCursor);assert.ok(!decision.blocked,decision.blocked);
          replayCursor=decision.cursor??replayCursor;session.respond(decision);
        }
        if(session.prompt?.player===1&&!session.ended)throw new Error('opponent replay did not finish');
        return replayCursor;
      }
    });
    restored=replayed.session;
    assert.equal(JSON.stringify(restored.snapshot()),before);
  }finally{original.destroy();restored?.destroy();}
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
test('Junk Speeder style toggle selection keeps Deck card names and completion progress',()=>{
  const p=makePrompt({type:M.SELECT_UNSELECT_CARD,player:0,min:2,max:2,can_finish:false,can_cancel:false,
    select_cards:[{code:63977008,controller:0,location:1,sequence:0}],
    unselect_cards:[{code:19642774,controller:0,location:1,sequence:1}]},cards);
  assert.equal(p.selection.mode,'toggle');
  assert.equal(p.selection.selectedCount,1);
  assert.equal(p.selection.canFinish,false);
  assert.equal(promptCardName(p.choices[0],{0:{1:{count:34}}}),cards[63977008].name);
  assert.match(selectionProgress(p.selection,[]),/1\/2장 선택/);
  assert.ok(p.choices.some(choice=>choice.kind==='select'));
  assert.ok(p.choices.some(choice=>choice.kind==='unselect'));
  assert.ok(!p.choices.some(choice=>choice.kind==='finish'));
  const ready=makePrompt({type:M.SELECT_UNSELECT_CARD,player:0,min:2,max:2,can_finish:true,can_cancel:false,
    select_cards:[],unselect_cards:[{code:63977008,controller:0,location:1,sequence:0},{code:19642774,controller:0,location:1,sequence:1}]},cards);
  assert.equal(ready.selection.canFinish,true);
  assert.ok(ready.choices.some(choice=>choice.kind==='finish'&&choice.label==='선택 완료'));
});
test('field-zone choices are named from the acting player\'s viewpoint',()=>{
  const p=makePrompt({type:M.SELECT_PLACE,player:1,count:1,field_mask:0},{});
  assert.equal(p.selection.options.find(option=>option.place.player===1&&option.place.location===4&&option.place.sequence===0).label,'내 몬스터 존 1');
  assert.equal(p.selection.options.find(option=>option.place.player===0&&option.place.location===4&&option.place.sequence===0).label,'상대 몬스터 존 1');
});
test('core first-player assignment remaps zones while keeping both decks on their owners',async()=>{
  const ghostCard=ghost.deck.main[0],ghostWithHand={...ghost,startingHand:[ghostCard]};
  for(const firstPlayer of [0,1]){
    const s=await DuelSession.create({cards,scripts,wasmBinary,you,ghost:ghostWithHand,seed:[781,2,3,4],startingHand:[you.main[0]],firstPlayer});
    try{
      assert.equal(s.active,firstPlayer);
      assert.equal(s.prompt.player,firstPlayer);
      assert.deepEqual(s.snapshot(0).zones[0][2].cards.map(card=>card.code),[you.main[0]]);
      assert.deepEqual(s.snapshot(1).zones[1][2].cards.map(card=>card.code),[ghostCard]);
      const spectator=s.snapshot(2);
      assert.equal(spectator.zones[0][2].cards,undefined);
      assert.equal(spectator.zones[1][2].cards,undefined);
      assert.equal(spectator.zones[0][2].count,1);
      assert.equal(spectator.zones[1][2].count,1);
      assert.equal(s.snapshot(0).zones[1][2].count,1);
      if(firstPlayer===1){
        assert.equal(s.snapshot(0).prompt.type,'WAITING_FOR_PLAYER');
        assert.equal(s.snapshot(1).prompt.type,s.prompt.type);
      }
    }finally{s.destroy();}
  }
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
test('Junk Meister hand summon resolves without unsupported chain info flags',async()=>{
  const meister=73218792,stardustDragon=44508094;
  const deck={...you,main:[meister,...you.main.slice(1)],extra:[stardustDragon,...you.extra.slice(1)]};
  const s=await DuelSession.create({cards,scripts,wasmBinary,you:deck,ghost,seed:[71,2,3,4],startingHand:[meister]});
  try{
    const summon=s.prompt.choices.find(choice=>choice.kind==='activate'&&choice.card===meister);
    assert.ok(summon,'Junk Meister should be able to reveal Stardust Dragon and Special Summon itself');
    s.respond({choice:summon.id});
    assert.equal(s.prompt.type,'SELECT_CARD');
    const reveal=s.prompt.selection.options.find(option=>option.card===stardustDragon);
    assert.ok(reveal,'the required Extra Deck Synchro should be available to reveal');
    s.respond({indices:[reveal.id]});
    assert.equal(s.prompt.type,'SELECT_PLACE');
    s.respond({indices:[s.prompt.selection.options[0].id]});
    assert.equal(s.prompt.type,'SELECT_POSITION');
    s.respond({choice:s.prompt.choices[0].id});
    assert.equal(s.snapshot().zones[0][4].cards[0].code,meister);
    assert.ok(s.prompt.choices.some(choice=>choice.kind==='activate'&&choice.card===meister),'the on-Special Summon effect should be available');
  }finally{s.destroy();}
});
test('real Junk Speeder effect lists named Synchron Tuners and resolves one-at-a-time selection',async()=>{
  const helper=64964750,junk=63977008,fleur=19642774,jet=9742784,speeder=77075360;
  const nonTuner=Object.values(cards).find(card=>(card.type&1)&&!(card.type&0x1000)&&!(card.type&(0x40|0x2000|0x800000|0x4000000))&&card.level===2);
  assert.ok(nonTuner);
  const required=[helper,junk,junk,junk,fleur,jet,nonTuner.code];
  const extraMask=0x40|0x2000|0x800000|0x4000000;
  const fillers=Object.values(cards).filter(card=>(card.type&0x10)&&!(card.type&extraMask)&&!required.includes(card.code)).slice(0,40-required.length).map(card=>card.code);
  const main=[...required,...fillers];
  assert.equal(main.length,40);
  const deck={...you,main,extra:[speeder]};
  const vanilla=Object.values(cards).filter(card=>(card.type&0x10)&&!(card.type&(0x40|0x2000|0x800000|0x4000000))).slice(0,40).map(card=>card.code);
  const simpleGhost={deck:{name:'Normal monsters',main:vanilla,extra:[],side:[]},behavior:{type:'scripted',script:[],fallback:'basic'}};
  const setupScript=`local s,id=GetID()
function s.initial_effect(c)
  local e=Effect.CreateEffect(c)
  e:SetType(EFFECT_TYPE_ACTIVATE)
  e:SetCode(EVENT_FREE_CHAIN)
  e:SetOperation(s.op)
  c:RegisterEffect(e)
end
function s.op(e,tp,eg,ep,ev,re,r,rp)
  local tuner=Duel.GetFirstMatchingCard(Card.IsCode,tp,LOCATION_DECK,0,nil,${junk})
  local other=Duel.GetFirstMatchingCard(Card.IsCode,tp,LOCATION_DECK,0,nil,${nonTuner.code})
  if not tuner or not other then return end
  Duel.SpecialSummon(tuner,0,tp,tp,false,false,POS_FACEUP_ATTACK)
  Duel.SpecialSummon(other,0,tp,tp,false,false,POS_FACEUP_ATTACK)
  local synchro=Duel.GetFirstMatchingCard(Card.IsCode,tp,LOCATION_EXTRA,0,nil,${speeder})
  if synchro then Duel.SynchroSummon(tp,synchro,nil) end
end`;
  const testScripts={...scripts,'c64964750.lua':setupScript};
  const s=await DuelSession.create({cards,scripts:testScripts,wasmBinary,you:deck,ghost:simpleGhost,seed:[121,2,3,4],startingHand:[helper],firstPlayer:1});
  try{
    assert.equal(s.prompt.player,1,'the opponent occupies core player 0 and takes the first turn');
    for(let i=0;i<100&&s.prompt?.player===1;i++){
      const decision=ghostChoice(s.prompt,simpleGhost.behavior);assert.ok(!decision.blocked,decision.blocked);s.respond(decision);
    }
    assert.equal(s.prompt.player,0,'the user is mapped back to their own deck after the opponent turn');
    for(let i=0;i<30&&!(s.prompt?.type==='SELECT_UNSELECT_CARD'&&s.prompt.selection.options.some(option=>option.source?.location===1));i++){
      const p=s.prompt;
      if(p.type==='SELECT_IDLECMD'){
        const activate=p.choices.find(choice=>choice.kind==='activate'&&choice.card===helper);
        assert.ok(activate,'test setup spell is available');s.respond({choice:activate.id});
      }else if(p.type==='SELECT_PLACE')s.respond({indices:[p.selection.options[0].id]});
      else if(p.type==='SELECT_POSITION')s.respond({choice:p.choices[0].id});
      else if(p.type==='SELECT_EFFECTYN')s.respond({choice:p.choices.find(choice=>choice.kind==='yes').id});
      else if(p.type==='SELECT_UNSELECT_CARD')s.respond({choice:p.choices.find(choice=>choice.kind==='select').id});
      else if(p.type==='SELECT_CARD')s.respond({indices:p.selection.options.slice(0,p.selection.min).map(option=>option.id)});
      else if(p.type==='SELECT_CHAIN')s.respond({choice:p.choices.find(choice=>choice.kind==='pass')?.id??p.choices[0].id});
      else assert.fail(`unexpected Junk Speeder setup prompt: ${p.type}`);
    }
    let prompt=s.prompt;
    for(let i=0;i<12&&prompt?.type==='SELECT_UNSELECT_CARD'&&!prompt.selection.options.some(option=>option.source?.location===1);i++){
      const selectable=prompt.choices.find(choice=>choice.kind==='select');
      assert.ok(selectable);s.respond({choice:selectable.id});prompt=s.prompt;
    }
    assert.equal(prompt?.type,'SELECT_UNSELECT_CARD');
    assert.deepEqual(prompt.selection.options.filter(option=>option.kind==='select').map(option=>option.cardName).sort(),['Fleur Synchron','Jet Synchron','Junk Synchron'].sort());
    assert.equal(prompt.selection.min,3);assert.equal(prompt.selection.max,3);assert.equal(prompt.selection.canFinish,false);
    assert.equal(prompt.choices.some(choice=>choice.kind==='finish'),false);
    const first=prompt.choices.find(choice=>choice.kind==='select');assert.ok(first);
    s.respond({choice:first.id});prompt=s.prompt;
    assert.equal(prompt.selection.selectedCount,1);
    assert.match(selectionProgress(prompt.selection,[]),/1\/3장 선택/);
    while(prompt?.type==='SELECT_UNSELECT_CARD'&&prompt.selection.options.some(option=>option.source?.location===1)){
      const next=prompt.choices.find(choice=>choice.kind==='select');assert.ok(next);s.respond({choice:next.id});prompt=s.prompt;
    }
    for(let i=0;i<12&&prompt?.type!=='SELECT_IDLECMD';i++){
      if(prompt.type==='SELECT_PLACE')s.respond({indices:[prompt.selection.options[0].id]});
      else if(prompt.type==='SELECT_POSITION')s.respond({choice:prompt.choices[0].id});
      else if(prompt.type==='SELECT_CHAIN')s.respond({choice:prompt.choices.find(choice=>choice.kind==='pass')?.id??prompt.choices[0].id});
      else assert.fail(`unexpected Junk Speeder resolution prompt: ${prompt.type}`);
      prompt=s.prompt;
    }
    const summoned=s.snapshot(0).zones[0][4].cards.filter(Boolean).map(card=>card.name);
    for(const name of ['Junk Speeder','Fleur Synchron','Jet Synchron','Junk Synchron'])assert.ok(summoned.includes(name),`${name} should be on the field`);
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
      const opponentHand=s.snapshot().zones[1][2];
      assert.equal(opponentHand.count,5);
      assert.equal(opponentHand.cards.length,5);
      assert.ok(opponentHand.cards.every(card=>card.hidden&&!('code' in card)));
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
