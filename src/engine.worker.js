import {DuelSession} from './session.js';
import {ghostChoice} from './prompts.js';
import {soloOpponentChoice} from './solo.js';
import {replayPlayerInputs} from './duel-history.js';
import {describeDecision,decisionUsesPrivateCard} from './duel-log.js';
import wasmUrl from 'ocgcore-wasm/lib/ocgcore.sync.wasm?url';
let session, assets,engineData,sessionConfig,playerInputs=[],claudeInputs=[],behavior,cursor=0,paused=false,timer=null,revision=0,soloMode=false,claudeMode=false,aiDuelMode=false,undoing=false;
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
function publish({undone=false,undoError='',actionNotice='',actionResult=null}={}){
  const state=session.snapshot(aiDuelMode?2:0);state.paused=paused;state.solo=soloMode;state.revision=++revision;
  state.undoAvailable=!aiDuelMode&&playerInputs.length>0;
  let claudeState=null;
  if(claudeMode){claudeState=session.snapshot(1);claudeState.revision=revision;}
  const aiStates=aiDuelMode?[0,1].map(player=>{const aiState=session.snapshot(player);aiState.revision=revision;return aiState;}):null;
  if(aiDuelMode&&state.prompt?.player!==undefined){
    state.ghostBlocked=`AI ${state.prompt.player+1} 차례 · 해당 AI의 MCP에서 행동을 선택합니다.`;
    state.prompt={player:state.prompt.player,title:`AI ${state.prompt.player+1} 차례 · MCP에서 행동을 선택하세요`,type:state.prompt.type,choices:[]};
  }else if(state.prompt?.player===1) {
    if(claudeMode){
      state.ghostBlocked='Claude MCP에서 get_duel_state를 확인하고 행동을 선택하세요.';
      state.prompt={player:1,title:'Claude 차례 · MCP에서 행동을 선택하세요',type:state.prompt.type,choices:[]};
    }else{
      const decision=opponentDecision();state.ghostBlocked=soloMode?(paused?'연습 엔진 자동 진행 일시정지':'연습 엔진이 상대 차례를 자동으로 넘깁니다.'):decision.blocked;
      if(decision.blocked)state.ghostBlocked=decision.blocked;
      // Only the worker holds the opponent's available actions and hand identities.
      state.prompt={player:1,title:decision.blocked??(soloMode?'연습 엔진 자동 진행 중...':'고스트가 생각하는 중...'),type:state.prompt.type,choices:[]};
      if(!decision.blocked&&!paused&&!state.ended)timer=setTimeout(()=>actGhost(),soloMode?40:450+Math.floor(Math.random()*450));
    }
  }
  post('state',{state,...(claudeState?{claudeState}:{}),...(aiStates?{aiStates}:{}),undone,undoError,...(actionNotice?{actionNotice}:{}),...(actionResult?{actionResult}:{})});
}
function performOpponentAction(target,currentCursor,context){
  const decision=opponentDecision(target,{...context,cursor:currentCursor});
  if(decision.blocked)throw new Error(decision.blocked);
  const description=describeDecision(target.prompt,decision,target.cards,target.publicCards);
  target.log(`${context.soloMode?'연습 상대':'고스트'} · ${description}`);
  target.respond(decision);
  return {cursor:decision.cursor??currentCursor,description};
}
function resolveOpponentPrompts(target,currentCursor,context={behavior,soloMode}){
  let nextCursor=currentCursor;
  for(let actions=0;target?.prompt?.player===1&&!target.ended;actions++){
    if(actions>=10000)throw new Error('상대 행동 재생 횟수를 초과했습니다.');
    nextCursor=performOpponentAction(target,nextCursor,context).cursor;
  }
  return nextCursor;
}
function resolveClaudeHistoryPrompts(target,currentCursor,history){
  for(let actions=0;target?.prompt?.player===1&&!target.ended;actions++){
    if(actions>=10000)throw new Error('Claude 행동 기록 재생 횟수를 초과했습니다.');
    const input=history.inputs[history.index++];
    if(!input)throw new Error('Claude 행동 기록이 부족해 이전 상태를 복원할 수 없습니다.');
    target.log(`Claude · ${describeDecision(target.prompt,input,target.cards,target.publicCards)}`);
    target.respond(input);
  }
  return currentCursor;
}
function actGhost(){try{clearTimeout(timer);if(!session||session.ended||session.prompt?.player!==1)return;const action=performOpponentAction(session,cursor,{behavior,soloMode});cursor=action.cursor;publish({actionNotice:soloMode?'':action.description});}catch(e){post('error',{message:e.message});}}
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
    const claudeHistory={inputs:claudeInputs.slice(),index:0};
    const restored=await replayPlayerInputs({
      createSession:()=>DuelSession.create({...engineData,...sessionConfig}),
      playerInputs:playerInputs.slice(0,-1),
      resolveOpponent:(target,nextCursor)=>claudeMode?resolveClaudeHistoryPrompts(target,nextCursor,claudeHistory):resolveOpponentPrompts(target,nextCursor,{behavior,soloMode}),
      logPlayerAction:(target,prompt,input)=>target.log(`나 · ${describeDecision(prompt,input,target.cards,target.publicCards)}`)
    });
    session=restored.session;cursor=restored.cursor;playerInputs.pop();if(claudeMode)claudeInputs=claudeInputs.slice(0,claudeHistory.index);previousSession.destroy();publish({undone:true});
  }catch(error){
    session=previousSession;cursor=previousCursor;publish({undoError:error.message});
  }finally{undoing=false;}
}
self.onmessage=async({data:m})=>{
  try {
    if(m.type==='start') {
      clearTimeout(timer);session?.destroy();session=null;cursor=0;paused=false;soloMode=m.mode==='practice'||m.mode==='ghost-create';claudeMode=m.mode==='claude';aiDuelMode=m.mode==='ai-duel';behavior=m.ghost?.behavior??{};playerInputs=[];claudeInputs=[];sessionConfig=null;undoing=false;
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
      const playerNames=aiDuelMode?['AI 1','AI 2']:claudeMode?['나','Claude']:['나','고스트'];
      engineData={cards,scripts,wasmBinary};sessionConfig={you:m.you,ghost,seed:Array.isArray(m.seed)?[...m.seed]:[1,2,3,4],startingHand:Array.isArray(m.startingHand)?[...m.startingHand]:null,firstPlayer:m.firstPlayer===1?1:0,playerNames};
      session=await DuelSession.create({...engineData,...sessionConfig});publish();
    } else if(m.type==='respond') {
      if(undoing||m.revision!==revision||session?.prompt?.player!==0)return;
      clearTimeout(timer);const previousLogs=[...session.logs];try{const prompt=session.prompt,input=responseInput(m);session.log(`나 · ${describeDecision(prompt,input,session.cards,session.publicCards)}`);session.respond(input);playerInputs.push(input);publish();}catch(e){session.logs=previousLogs;post(session.prompt?'input-error':'error',{message:e.message});}
    } else if(m.type==='remote-action') {
      if(!claudeMode&&!aiDuelMode){post('action-result',{actionResult:{requestId:m.requestId,ok:false,error:'AI 대전 중이 아닙니다.'}});return;}
      const actingPlayer=aiDuelMode?m.player:1;
      if(![0,1].includes(actingPlayer)){post('action-result',{actionResult:{requestId:m.requestId,ok:false,error:'AI 플레이어가 올바르지 않습니다.'}});return;}
      if(m.revision!==revision||session?.prompt?.player!==actingPlayer){
        const actionResult={requestId:m.requestId,ok:false,error:'듀얼 상태가 바뀌었습니다. 현재 상태를 다시 확인하세요.',player:actingPlayer};
        if(claudeMode){const claudeState=session?.snapshot(1)??null;if(claudeState)claudeState.revision=revision;post('action-result',{actionResult,claudeState});}
        else {const aiStates=[0,1].map(player=>{const aiState=session?.snapshot(player)??null;if(aiState)aiState.revision=revision;return aiState;});post('action-result',{actionResult,aiStates});}
        return;
      }
      const previousLogs=[...session.logs];
      try{
        const prompt=session.prompt,input=responseInput(m),commentary=typeof m.commentary==='string'?m.commentary.trim():'';const publicCommentary=decisionUsesPrivateCard(prompt,input,session.publicCards)?'':commentary;session.log(`${aiDuelMode?`AI ${actingPlayer+1}`:'Claude'} · ${publicCommentary?`“${publicCommentary}” · `:''}${describeDecision(prompt,input,session.cards,session.publicCards)}`);session.respond(input);if(claudeMode)claudeInputs.push(input);publish({actionResult:{requestId:m.requestId,ok:true,player:actingPlayer},actionNotice:commentary});
      }catch(e){session.logs=previousLogs;const actionResult={requestId:m.requestId,ok:false,error:e.message,player:actingPlayer};if(claudeMode){const claudeState=session.snapshot(1);claudeState.revision=revision;post('action-result',{actionResult,claudeState});}else{const aiStates=[0,1].map(player=>{const aiState=session.snapshot(player);aiState.revision=revision;return aiState;});post('action-result',{actionResult,aiStates});}}
    } else if(m.type==='undo') {await undoLastPlayerAction();}
    else if(m.type==='pause') {if(undoing)return;clearTimeout(timer);paused=!paused;publish();}
    else if(m.type==='step') {if(!undoing&&paused)actGhost();}
  }catch(e){clearTimeout(timer);post('error',{message:e.message});}
};
