import {DuelSession} from './session.js';
import {ghostChoice} from './prompts.js';
import {soloOpponentChoice} from './solo.js';
import {replayPlayerInputs} from './duel-history.js';
import wasmUrl from 'ocgcore-wasm/lib/ocgcore.sync.wasm?url';
let session, assets,engineData,sessionConfig,playerInputs=[],behavior,cursor=0,paused=false,timer=null,revision=0,soloMode=false,undoing=false;
const actionNames={summon:'일반 소환',special:'특수 소환',activate:'효과 발동',set:'몬스터 세트','set-spell':'마법·함정 세트',attack:'공격',position:'표시 변경',battle:'배틀 페이즈',main2:'메인 페이즈 2',end:'턴 종료'};
const post=(type,data={})=>self.postMessage({type,...data});
function opponentDecision(target=session,context={cursor,behavior,soloMode}){
  const p=target?.prompt;
  if(!context.soloMode)return ghostChoice(p,context.behavior,context.cursor);
  return soloOpponentChoice(p,context.cursor);
}
async function bundle(url){
  const r=await fetch(url);if(!r.ok)throw new Error(`엔진 데이터 로드 실패 (${r.status})`);
  return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
}
function publish({undone=false,undoError=''}={}){
  const state=session.snapshot();state.paused=paused;state.solo=soloMode;state.revision=++revision;state.undoAvailable=playerInputs.length>0;
  if(state.prompt?.player===1) {
    const decision=opponentDecision();state.ghostBlocked=soloMode?(paused?'연습 엔진 자동 진행 일시정지':'연습 엔진이 상대 차례를 자동으로 넘깁니다.'):decision.blocked;
    if(decision.blocked)state.ghostBlocked=decision.blocked;
    // Only the worker holds the opponent's available actions and hand identities.
    state.prompt={player:1,title:decision.blocked??(soloMode?'연습 엔진 자동 진행 중...':'고스트가 생각하는 중...'),type:state.prompt.type,choices:[]};
    if(!decision.blocked&&!paused&&!state.ended)timer=setTimeout(()=>actGhost(),soloMode?40:450+Math.floor(Math.random()*450));
  }
  post('state',{state,undone,undoError});
}
function performOpponentAction(target,currentCursor,context){
  const decision=opponentDecision(target,{...context,cursor:currentCursor});
  if(decision.blocked)throw new Error(decision.blocked);
  const kind=target.prompt.choices.find(choice=>choice.id===String(decision.choice))?.kind;
  if(actionNames[kind])target.log((context.soloMode?'연습 엔진':'고스트')+' · '+actionNames[kind]);
  target.respond(decision);
  return decision.cursor??currentCursor;
}
function resolveOpponentPrompts(target,currentCursor,context={behavior,soloMode}){
  let nextCursor=currentCursor;
  for(let actions=0;target?.prompt?.player===1&&!target.ended;actions++){
    if(actions>=10000)throw new Error('상대 행동 재생 횟수를 초과했습니다.');
    nextCursor=performOpponentAction(target,nextCursor,context);
  }
  return nextCursor;
}
function actGhost(){try{clearTimeout(timer);if(!session||session.ended||session.prompt?.player!==1)return;cursor=performOpponentAction(session,cursor,{behavior,soloMode});publish();}catch(e){post('error',{message:e.message});}}
function responseInput(message){
  if(Array.isArray(message.counters))return {counters:[...message.counters]};
  if(Array.isArray(message.indices))return {indices:[...message.indices]};
  if(message.choice!==undefined)return {choice:String(message.choice)};
  throw new Error('저장할 플레이어 행동이 없습니다.');
}
async function undoLastPlayerAction(){
  if(undoing||!session||!sessionConfig||!engineData||playerInputs.length===0)return;
  undoing=true;clearTimeout(timer);timer=null;
  const previousSession=session,previousCursor=cursor;
  post('loading',{message:'이전 상태로 되돌리는 중...'});
  try{
    const restored=await replayPlayerInputs({
      createSession:()=>DuelSession.create({...engineData,...sessionConfig}),
      playerInputs:playerInputs.slice(0,-1),
      resolveOpponent:(target,nextCursor)=>resolveOpponentPrompts(target,nextCursor,{behavior,soloMode})
    });
    session=restored.session;cursor=restored.cursor;playerInputs.pop();previousSession.destroy();publish({undone:true});
  }catch(error){
    session=previousSession;cursor=previousCursor;publish({undoError:error.message});
  }finally{undoing=false;}
}
self.onmessage=async({data:m})=>{
  try {
    if(m.type==='start') {
      clearTimeout(timer);session?.destroy();session=null;cursor=0;paused=false;soloMode=m.mode==='practice'||m.mode==='ghost-create';behavior=m.ghost?.behavior??{};playerInputs=[];sessionConfig=null;undoing=false;
      post('loading',{message:'듀얼 엔진과 카드 데이터를 불러오는 중...'});
      assets??=Promise.all([bundle(new URL('engine/cards.json.gz',m.base)),bundle(new URL('engine/scripts.json.gz',m.base)),bundle(new URL('engine/ko-strings.json.gz',m.base)),fetch(wasmUrl).then(r=>{if(!r.ok)throw new Error('WASM 로드 실패');return r.arrayBuffer();})]);
      const [cards,scripts,koStrings,wasmBinary]=await assets;
      const [ko,koOverridesResponse]=await Promise.all([bundle(new URL('engine/ko.json.gz',m.base)),fetch(new URL('engine/ko-overrides.json',m.base))]);
      if(!koOverridesResponse.ok)throw new Error('카드 번역을 불러오지 못했습니다.');
      Object.assign(ko,await koOverridesResponse.json());
      for(const card of Object.values(cards)){card.englishName=card.name;card.englishDesc=card.desc;}
      for(const [code,card] of Object.entries(cards)){
        const alias=cards[card.alias];
        const aliasText=card.alias&&alias?.englishName===card.englishName?ko[card.alias]:undefined;
        const aliasTranslation=aliasText?{name:aliasText.name,...(alias.englishDesc===card.englishDesc?{desc:aliasText.desc}:{})}:undefined;
        const text=ko[code]??aliasTranslation;
        if(text)Object.assign(card,text);
      }
      for(const [code,strings] of Object.entries(koStrings))if(cards[code])cards[code].koreanStrings=strings;
      const ghost=m.ghost??{deck:m.you,behavior:{type:'scripted',mode:'priority',script:[],fallback:'basic'}};
      engineData={cards,scripts,wasmBinary};sessionConfig={you:m.you,ghost,seed:Array.isArray(m.seed)?[...m.seed]:[1,2,3,4],startingHand:Array.isArray(m.startingHand)?[...m.startingHand]:null};
      session=await DuelSession.create({...engineData,...sessionConfig});publish();
    } else if(m.type==='respond') {
      if(undoing||m.revision!==revision||session?.prompt?.player!==0)return;
      clearTimeout(timer);try{const input=responseInput(m);session.respond(input);playerInputs.push(input);publish();}catch(e){post(session.prompt?'input-error':'error',{message:e.message});}
    } else if(m.type==='undo') {await undoLastPlayerAction();}
    else if(m.type==='pause') {if(undoing)return;clearTimeout(timer);paused=!paused;publish();}
    else if(m.type==='step') {if(!undoing&&paused)actGhost();}
  }catch(e){clearTimeout(timer);post('error',{message:e.message});}
};
