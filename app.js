import {openDeckBuilder} from './src/deck-builder.js';
import {openGhostBuilder} from './src/ghost-builder.js';
import {parseDeck} from './src/decks.js';
import {exportGhost} from './src/ghosts.js';
import {normalize} from './src/catalog.js';
import {openPracticeSetup} from './src/practice-setup.js';
import {createGhostDraft,recordDecision} from './src/ghost-recording.js';
import {cardInfoHtml,linkArrows} from './src/card-info.js';
import {promptHelp,selectionProgress} from './src/duel-guidance.js';
const root=document.getElementById('app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ghosts=[],decks=[],ghostId,deckId,worker=null,state=null,selection=[],counters=[],announcementQuery='',inputError='',selectedCard=null,busy=false,error='',loading='';
let setupMode='duel',sessionMode='duel',sessionDeck=null,sessionGhost=null,currentScenario=null,recordedSteps=[],scenarioCaptured=false;
const THEME_KEY='ghost-duel.theme.v1';
let theme='dark';
try{theme=localStorage.getItem(THEME_KEY)==='light'?'light':'dark';}catch{}
function applyTheme(nextTheme){
  theme=nextTheme==='light'?'light':'dark';
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#edf3f6':'#070a0f');
  try{localStorage.setItem(THEME_KEY,theme);}catch{}
  const label=theme==='dark'?'라이트 모드':'다크 모드';
  document.querySelectorAll('.theme-toggle').forEach(button=>{
    button.textContent=label;
    button.setAttribute('aria-label',`${label}로 전환`);
    button.title=`${label}로 전환`;
  });
}
const themeToggle=()=>{
  const label=theme==='dark'?'라이트 모드':'다크 모드';
  return `<button class="mini theme-toggle" type="button" aria-label="${label}로 전환" title="${label}로 전환">${label}</button>`;
};
document.addEventListener('click',event=>{
  if(event.target.closest('.theme-toggle'))applyTheme(theme==='dark'?'light':'dark');
});
applyTheme(theme);
const portrait=()=>'<div class="portrait"><strong>가로 화면으로 돌려주세요</strong><span>Ghost Duel은 모바일 가로 화면에 맞춰져 있습니다.</span></div>';
const choiceItem=(x,selected)=>`<button class="item ${x.id===selected?'active':''}" data-id="${esc(x.id)}"><div class="thumb"></div><div><strong>${esc(x.name)}</strong><small>${esc(x.description??`${x.main?.length??0}장 / 엑스트라 ${x.extra?.length??0}장`)}</small></div></button>`;
async function json(url){const r=await fetch(url);if(!r.ok)throw new Error(`${url} 로드 실패`);return r.json();}
const SAVED_DECKS_KEY='ghost-duel.decks.v1';
const SAVED_GHOSTS_KEY='ghost-duel.ghosts.v1';
function persistDecks(){try{localStorage.setItem(SAVED_DECKS_KEY,JSON.stringify(decks.filter(d=>d.id!=='starter')));return true;}catch{return false;}}
function persistGhosts(){try{localStorage.setItem(SAVED_GHOSTS_KEY,JSON.stringify(ghosts.filter(g=>g.id!=='sample')));return true;}catch{return false;}}
function builder(source){openDeckBuilder(root,{source,onClose:renderSetup,onSave:deck=>{const i=decks.findIndex(d=>d.id===deck.id);if(i>=0)decks[i]=deck;else decks.push(deck);deckId=deck.id;error=persistDecks()?'':'기기 저장에 실패했습니다. 덱 편집에서 JSON으로 내보내 주세요.';renderSetup();}});}
function saveGhost(ghost){if(ghost.id==='sample')ghost.id=crypto.randomUUID();const i=ghosts.findIndex(g=>g.id===ghost.id);if(i>=0)ghosts[i]=ghost;else ghosts.push(ghost);ghostId=ghost.id;error=persistGhosts()?'':'기기 저장에 실패했습니다. 고스트 편집에서 JSON으로 내보내 주세요.';renderSetup();}
function ghostBuilder(source){openGhostBuilder(root,{source,decks,selectedDeck:decks.find(d=>d.id===deckId),onClose:renderSetup,onSave:saveGhost});}
function renderSetup(){
  const deckPicker=`<div class="picker"><div class="deck-picker-heading"><h2>내 덱 선택</h2><button class="mini" id="newDeck">덱 만들기 / 이어서</button><button class="mini" id="editDeck">선택 덱 편집</button></div><div class="list" id="deckList">${decks.map(x=>choiceItem(x,deckId)).join('')}</div><label class="import">YDK / JSON 덱 불러오기<input id="deckFile" type="file" accept=".ydk,.json"></label></div>`;
  const ghostPicker=`<div class="picker"><div class="deck-picker-heading"><h2>고스트 선택</h2><button class="mini" id="newGhost">행동 만들기 / 이어서</button><button class="mini" id="editGhost">선택 고스트 편집</button></div><div class="list" id="ghostList">${ghosts.map(x=>choiceItem(x,ghostId)).join('')}</div><label class="import">고스트 JSON 불러오기<input id="ghostFile" type="file" accept=".json"></label></div>`;
  const scenarioInfo=`<section class="picker scenario-card"><h2>${setupMode==='practice'?'전개 연습':'고스트 생성'} · 상황</h2><p>${setupMode==='practice'?'상대를 두지 않고 혼자 전개합니다. 덱에서 무작위 시작 패를 뽑거나 카드를 골라 시작 패를 고정할 수 있어요.':'혼자 전개하면서 선택한 행동을 기록하고, 기록을 바탕으로 고스트 초안을 만듭니다.'}</p><div class="scenario-summary">선택 덱 <b>${esc(decks.find(d=>d.id===deckId)?.name??'없음')}</b><small>${decks.find(d=>d.id===deckId)?.main.length??0}장 · 시작 패는 다음 화면에서 설정</small></div><p class="scenario-hint">덱 목록에서 덱을 바꾸거나, 직접 편집·불러오기 할 수 있습니다.</p></section>`;
  root.innerHTML=portrait()+`<main class="screen setup"><header><div class="brand"><div class="brand-mark">GD</div><div><h1>Ghost Duel</h1><p>고스트 듀얼 · 혼자 전개 연습 · 고스트 생성</p></div></div><div class="setup-head-tools">${themeToggle()}<a href="https://github.com/simsy0924/Yu_gi_oh_auto" target="_blank" rel="noreferrer">소스 / 라이선스</a></div></header><nav class="setup-modes" aria-label="플레이 모드">${[['duel','고스트 듀얼'],['practice','전개 연습'],['ghost-create','고스트 생성']].map(([id,label])=>`<button class="deck-tab ${setupMode===id?'active':''}" data-mode="${id}" aria-pressed="${setupMode===id}">${label}</button>`).join('')}</nav><section class="setup-grid ${setupMode==='duel'?'':'solo-setup'}">${setupMode==='duel'?ghostPicker+deckPicker:deckPicker+scenarioInfo}</section><footer class="setup-footer"><div class="selection"><span role="alert">${esc(error)}</span><p>${setupMode==='duel'?'기본 덱으로 바로 시작할 수 있어요. 금제 검사는 적용하지 않습니다.':setupMode==='practice'?'시작 패 설정에서 덱 전체 또는 카드 종류별 무작위 패를 고를 수 있어요.':'전개 기록은 편집 가능한 고스트 초안으로 변환합니다.'}</p></div><button class="primary" id="start" ${!decks.length||(setupMode==='duel'&&!ghosts.length)?'disabled':''}>${setupMode==='duel'?'듀얼 시작':setupMode==='practice'?'시작 패 설정':'상황 설정'}</button></footer></main>`;
  root.querySelector('.setup-modes').onclick=e=>{const button=e.target.closest('[data-mode]');if(button){setupMode=button.dataset.mode;error='';renderSetup();}};
  document.getElementById('ghostList')?.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b){ghostId=b.dataset.id;renderSetup();}});
  document.getElementById('deckList').onclick=e=>{const b=e.target.closest('[data-id]');if(b){deckId=b.dataset.id;renderSetup();}};
  document.getElementById('deckFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const d=parseDeck(await file.text(),file.name);d.id=crypto.randomUUID();decks.push(d);deckId=d.id;error=persistDecks()?'':'기기 저장에 실패했습니다.';}catch(e){error=e.message;}renderSetup();};
  document.getElementById('ghostFile')?.addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;const g=JSON.parse(await file.text());g.deck=parseDeck(JSON.stringify(g.deck));if(g.behavior?.type==='basic')g.behavior={type:'scripted',script:[],fallback:'basic'};g.id=crypto.randomUUID();const imported=exportGhost(g);ghosts.push(imported);ghostId=imported.id;error=persistGhosts()?'':'기기 저장에 실패했습니다. 고스트 JSON을 보관해 주세요.';}catch(e){error=e.message;}renderSetup();});
  document.getElementById('start').onclick=()=>{
    if(setupMode==='duel')launchDuel('duel',{deck:decks.find(d=>d.id===deckId),startingHand:null,handNames:[]});
    else openPracticeSetup(root,{deck:decks.find(d=>d.id===deckId),mode:setupMode,onClose:renderSetup,onStart:scenario=>launchDuel(setupMode,scenario)});
  };
  document.getElementById('newDeck').onclick=()=>builder();
  document.getElementById('editDeck').onclick=()=>builder(decks.find(d=>d.id===deckId));
  document.getElementById('newGhost')?.addEventListener('click',()=>ghostBuilder());
  document.getElementById('editGhost')?.addEventListener('click',()=>ghostBuilder(ghosts.find(g=>g.id===ghostId)));
}
function launchDuel(mode='duel',scenario=null){
  sessionMode=mode;currentScenario=scenario;sessionDeck=scenario?.deck??decks.find(d=>d.id===deckId);sessionGhost=mode==='duel'?ghosts.find(g=>g.id===ghostId):null;recordedSteps=[];scenarioCaptured=false;
  error='';loading='엔진 준비 중...';state=null;busy=true;selection=[];counters=[];announcementQuery='';inputError='';selectedCard=null;
  worker?.terminate();worker=new Worker(new URL('./src/engine.worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data:m})=>{
    if(m.type==='state'){root.querySelector('.decision')?.scrollTo(0,0);state=m.state;if(sessionMode==='ghost-create'&&!scenarioCaptured&&state.zones?.[0]?.[2]?.cards){currentScenario={...currentScenario,startingHand:state.zones[0][2].cards.map(card=>card.code),handNames:state.zones[0][2].cards.map(card=>card.name)};scenarioCaptured=true;}loading='';busy=false;selection=[];counters=[];announcementQuery='';inputError='';selectedCard=null;}
    if(m.type==='loading')loading=m.message;
    if(m.type==='input-error'){inputError=m.message;busy=false;}
    if(m.type==='error'){error=m.message;loading='';busy=false;}
    renderDuel();
  };
  worker.onerror=e=>{error=e.message||'듀얼 엔진 실행 실패';loading='';busy=false;renderDuel();};
  worker.postMessage({type:'start',mode:sessionMode,you:sessionDeck,ghost:sessionGhost,startingHand:scenario?.startingHand,base:new URL('.',location.href).href,seed:Array.from(crypto.getRandomValues(new Uint32Array(4)))});
  renderDuel();
}
function start(){launchDuel(sessionMode,currentScenario);}
function stop(){worker?.terminate();worker=null;state=null;error='';selectedCard=null;sessionMode='duel';currentScenario=null;renderSetup();}
function editRecordedDraft(){
  const source=createGhostDraft({deck:sessionDeck,steps:recordedSteps,handNames:currentScenario?.handNames??[],startingHand:currentScenario?.startingHand,name:`${sessionDeck.name} 전개 초안`});
  worker?.terminate();worker=null;state=null;busy=false;
  openGhostBuilder(root,{source,decks,selectedDeck:sessionDeck,onClose:renderSetup,onSave:saveGhost});
}
const phaseName={1:'드로우',2:'스탠바이',4:'메인 1',8:'배틀 시작',16:'배틀',32:'데미지',64:'데미지 계산',128:'배틀 종료',256:'메인 2',512:'엔드'};
const sourceKey=s=>s?`${s.controller},${s.location},${s.sequence}`:null;
const zoneLabel=(owner,location,sequence)=>{
  const side=owner===0?'내':'상대';
  if(location===8&&sequence===5)return `${side} 필드 존`;
  const area=({1:'덱',2:'패',4:'몬스터 존',8:'마법·함정 존',16:'묘지',32:'제외',64:'엑스트라 덱'})[location]??'카드';
  return `${side} ${area}${[4,8].includes(location)?` ${sequence+1}`:''}`;
};
const myPrompt=()=>state?.prompt?.player===0&&!state?.ended&&!error?state.prompt:null;
const actionsFor=key=>(myPrompt()?.choices??[]).filter(c=>sourceKey(c.source)===key);
const targetFor=key=>(myPrompt()?.selection?.options??[]).find(o=>sourceKey(o.source)===key);
function card(c,player,location,sequence){
  if(!c)return `<div class="slot empty">${location===4?'M':'S'}${sequence+1}</div>`;
  const key=`${player},${location},${sequence}`;
  const available=actionsFor(key).length||targetFor(key);
  const counterText=Object.entries(c.counters??{}).filter(([,n])=>n>0).map(([type,n])=>`${type}: ${n}`).join(' · ');
  return `<button class="slot ${player===1?'rot':''} ${location===4&&(c.position&12)?'defense':''} ${available?'actionable':''} ${selectedCard===key?'focused':''}" data-card="${key}" aria-label="${esc(c.name??'뒷면 카드')}${available?' · 선택 가능':''}" title="${esc(c.name??'뒷면 카드')}">${c.hidden?'<span class="back">GD</span>':`<span>${esc(c.name)}</span><small>${location===4?`${c.attack??'?'} / ${c.defense??'?'}`:''}</small>${c.link_marker?`<small>링크 ${esc(c.link?.rating??c.level??'')} · ${linkArrows(c.link_marker)}</small>`:''}${counterText?`<small class="counter-badge" title="카운터 종류: 개수">카운터 ${esc(counterText)}</small>`:''}`}</button>`;
}
function field(player){
  const z=state?.zones[player]??{};
  const count=l=>z[l]?.count??z[l]?.cards?.filter(Boolean).length??0;
  const row=(l,n)=>`<div class="field-row">${Array.from({length:n},(_,i)=>card(z[l]?.cards?.[i],player,l,i)).join('')}</div>`;
  const piles=`<div class="pilebar">${[[1,'덱'],[64,'엑스트라'],[16,'묘지'],[32,'제외']].map(([l,t])=>`<button class="mini" data-pile="${player},${l}">${t} ${count(l)}</button>`).join('')}</div>`;
  const h=player===0?`<div class="live-hand" aria-label="내 패">${(z[2]?.cards??[]).map((c,i)=>card(c,player,2,i)).join('')}</div>`:`<div class="opponent-hand">상대 패 ${count(2)}장</div>`;
  const extra=`<div class="field-spell"><span>필드</span>${card(z[8]?.cards?.[5],player,8,5)}</div>`;
  return `<section class="live-field ${player===1?'opponent':''}"><div class="field-caption"><b>${player===1?'고스트':'나'} · ${state?.lp[player]??8000} LP</b>${piles}${extra}</div>${player===1?h+row(8,5)+row(4,5):row(4,5)+row(8,5)+h}</section>`;
}
function sharedExtra(){return '<div class="shared-extra"><span>엑스트라 몬스터 존</span>'+[5,6].map(i=>{const own=state?.zones[0][4].cards[i],other=state?.zones[1][4].cards[11-i];return own?card(own,0,4,i):other?card(other,1,4,11-i):card(null,0,4,i);}).join('')+'</div>';}
const choiceButton=(c,short=false)=>`<button class="pick" data-choice="${esc(c.id)}" ${busy?'disabled':''}>${esc(short?c.shortLabel??c.label:c.label)}</button>`;
function selectionPanel(s){
  if(s.mode==='counter'){
    const chosen=counters.reduce((total,n)=>total+(Number.isFinite(n)?n:0),0);
    return `<div class="decision-group"><h3>카운터 분배</h3><p id="counterRemaining" class="selection-progress">${chosen}/${s.total}개 선택 · 종류 ${s.counterType}</p><div class="counter-choices">${s.options.map(o=>`<label class="counter-option ${selectedCard===sourceKey(o.source)?'focused':''}"><span>${esc(o.label)}</span><input type="number" min="0" max="${o.cap}" step="1" inputmode="numeric" data-counter="${o.id}" value="${Number.isFinite(counters[o.id])?counters[o.id]:0}" aria-label="${esc(o.label)}에서 제거할 카운터"></label>`).join('')}</div><button class="primary confirm-choice" id="confirm" ${busy||chosen!==s.total?'disabled':''}>분배 완료</button></div>`;
  }
  const title=s.mode==='sum'?`합계 ${s.selectMax?'이상':'일치'} · 목표 ${s.amount}`:s.mode==='sort'?'카드를 누른 순서대로 정렬':s.mode==='card'?`선언할 카드 선택 · ${s.options.length}장`:s.mode==='race'?'종족 선택':s.mode==='attribute'?'속성 선택':`선택 대상 · ${s.min}~${s.max}개`;
  const required=s.mode==='sum'&&s.mandatory.length?`<p class="required-cards">필수 소재: ${s.mandatory.map(c=>`${esc(c.label)} (${c.values.join(' 또는 ')})`).join(', ')}</p>`:'';
  const matches=s.mode==='card'?s.options.filter(o=>o.search.includes(normalize(announcementQuery))):s.options;
  const search=s.mode==='card'?`<input class="announcement-search" type="search" id="announcementSearch" placeholder="카드명 또는 번호 검색" aria-label="선언 카드 검색" value="${esc(announcementQuery)}"><small>${matches.length}장 중 최대 40장 표시</small>`:'';
  const chosenCard=s.mode==='card'&&selection.length?`<p class="required-cards">선택: ${esc(s.options.find(o=>o.id===selection[0])?.label??'')}</p>`:'';
  const options=s.mode==='card'?matches.slice(0,40):matches;
  const amount=s.tribute?selection.reduce((n,id)=>n+(s.options.find(o=>o.id===id)?.value??0),0):selection.length;
  const insufficient=s.mode!=='sum'&&(amount<s.min||selection.length>s.max);
  return `<div class="decision-group"><h3>${title}</h3><p class="selection-progress">${selectionProgress(s,selection)}</p>${required}${search}${chosenCard}<div class="choices">${options.map(o=>`<button class="pick ${selection.includes(o.id)?'selected':''}" data-select="${o.id}" aria-pressed="${selection.includes(o.id)}">${selection.includes(o.id)?`${selection.indexOf(o.id)+1}. `:''}${esc(o.label)}</button>`).join('')||'<p>조건에 맞는 카드가 없습니다.</p>'}</div><button class="primary confirm-choice" id="confirm" ${busy||insufficient?'disabled':''}>${s.mode==='sort'?'순서 확정':'선택 완료'}</button></div>`;
}
function availableCards(prompt){
  const grouped=new Map();
  for(const c of prompt.choices){
    const key=sourceKey(c.source);if(!key)continue;
    const current=grouped.get(key)??[];current.push(c);grouped.set(key,current);
  }
  if(!grouped.size)return '';
  return `<div class="decision-group"><h3>행동할 수 있는 카드</h3><div class="choices">${[...grouped].map(([key,choices])=>`<button class="pick card-shortcut ${selectedCard===key?'selected':''}" data-focus="${esc(key)}" aria-pressed="${selectedCard===key}"><strong>${esc(state?.zones?.[choices[0].source.controller]?.[choices[0].source.location]?.cards?.[choices[0].source.sequence]?.name??choices[0].card)}</strong><small>${esc([...new Set(choices.map(c=>c.shortLabel?.split(' · ')[0]??c.kind))].join(' · '))}</small></button>`).join('')}</div></div>`;
}
function panel(){
  const draftControl=sessionMode==='ghost-create'?`<button class="primary ghost-draft-action" id="makeGhostDraft">고스트 초안 편집 · ${recordedSteps.length}개 행동</button>`:'';
  if(error)return `<h2>듀얼이 중단되었습니다</h2><p role="alert">${esc(error)}</p>${draftControl}<button class="action" id="restart">다시 시작</button>`;
  if(loading)return `<h2>준비 중</h2><p>${esc(loading)}</p>`;
  if(state?.ended)return `<h2>${state.winner===2?'무승부':state.winner===0?'승리':'패배'}</h2>${draftControl}<button class="primary" id="restart">다시 시작</button>`;
  const p=state?.prompt;if(!p)return '<p>듀얼 처리 중...</p>';
  if(p.player===1)return `<h2>${sessionMode==='duel'?'고스트 차례':'연습 상대 차례'}</h2><p>${esc(state.ghostBlocked??(state.paused?'자동 진행 일시정지':'상대가 차례를 넘기는 중...'))}</p>${draftControl}`;
  let html=`<div class="decision-intro"><h2>${esc(p.title)}</h2><p>${esc(promptHelp(p))}</p></div>${inputError?`<p role="alert" class="input-error">${esc(inputError)}</p>`:''}`;
  if(draftControl)html+=draftControl;
  if(p.blocked)return html+`<p role="alert">${esc(p.blocked)}</p><p>이 선택은 현재 화면에서 지원하지 않습니다.</p>`;
  if(p.context)html+=`<details class="context-card"><summary>${esc(p.context.name)} · 카드 효과 보기</summary><p>${esc(p.context.desc||'이 카드의 한국어 효과 본문은 수록되지 않았습니다.')}</p></details>`;
  const [player,location,sequence]=selectedCard?.split(',').map(Number)??[];
  const selected=state?.zones?.[player]?.[location]?.cards?.[sequence];
  const cardActions=selectedCard?actionsFor(selectedCard):[];
  const target=selectedCard?targetFor(selectedCard):null;
  if(selected){
    html+=`<div class="focused-card"><div><strong>${esc(selected.name??'뒷면 카드')}</strong><small>${cardActions.length}개 행동 가능</small></div><button class="mini" id="inspectCard">카드 정보</button><button class="mini" id="clearCard">닫기</button></div>`;
    if(cardActions.length)html+=`<div class="choices">${cardActions.map(c=>choiceButton(c,true)).join('')}</div>`;
    if(target&&p.selection?.mode!=='counter')html+=`<button class="pick ${selection.includes(target.id)?'selected':''}" data-select="${target.id}">${selection.includes(target.id)?'선택 해제':'이 카드 선택'}</button>`;
    else if(target)html+='<p class="muted">아래에서 이 카드의 카운터 수량을 지정하세요.</p>';
    if(!cardActions.length&&!target)html+='<p class="muted">이 카드로 지금 할 수 있는 행동이 없습니다.</p>';
  }
  if(p.selection)html+=selectionPanel(p.selection);
  const global=p.choices.filter(c=>!c.source);
  if(global.length)html+=`<div class="decision-group"><h3>페이즈 · 기타 선택</h3><div class="choices">${global.map(choiceButton).join('')}</div></div>`;
  if(!p.selection)html+=availableCards(p);
  return html;
}
function send(input){if(busy||error)return;if(sessionMode==='ghost-create'){const step=recordDecision(state?.prompt,input);if(step)recordedSteps.push(step);}busy=true;inputError='';worker.postMessage({type:'respond',revision:state.revision,...input});renderDuel();}
function toggleSelection(id){selection=selection.includes(id)?selection.filter(x=>x!==id):[...selection,id];inputError='';renderDuel();}
function focusCard(key){selectedCard=key;const target=targetFor(key);if(target&&myPrompt()?.selection?.mode!=='counter'){toggleSelection(target.id);}else renderDuel();root.querySelector('.decision')?.scrollTo(0,0);}
function renderDuel(){
  const decisionScroll=root.querySelector('.decision')?.scrollTop??0;
  const boardScroll=root.querySelector('.live-board')?.scrollTop??0;
  const choiceScrolls=[...root.querySelectorAll('.decision .choices')].map(list=>list.scrollTop);
  const board=sessionMode==='duel'?`${field(1)}${sharedExtra()}${field(0)}`:`<div class="solo-note">${sessionMode==='ghost-create'?'고스트 생성 · 내 전개를 기록 중':'전개 연습 · 상대 없이 진행'}</div>${field(0)}`;
  const activeName=state?.active===0?'나':sessionMode==='duel'?'고스트':'연습 상대';
  root.innerHTML=portrait()+`<main class="screen live-duel"><header class="topbar"><strong>Ghost Duel</strong><span>${state?`${state.turn}턴 · ${activeName} · ${phaseName[state.phase]??''}`:'YGOPro Core'}</span><div class="top-right">${themeToggle()}<button class="mini" id="pause" ${!state||error?'disabled':''}>${state?.paused?'자동 진행':'일시정지'}</button>${state?.paused?'<button class="mini" id="step">한 행동</button>':''}<button class="mini" id="exit">종료</button></div></header><div class="live-layout"><div class="live-board ${sessionMode==='duel'?'':'solo'}">${board}</div><aside class="decision" aria-live="polite">${panel()}</aside></div><footer class="live-log">${esc(state?.logs.at(-1)??'카드를 눌러 행동을 선택하세요.')}</footer></main><dialog id="details"><div id="detailContent"></div><button class="action" id="closeDetail">닫기</button></dialog>`;
  root.querySelector('.decision').scrollTop=decisionScroll;
  root.querySelector('.live-board').scrollTop=boardScroll;
  root.querySelectorAll('.decision .choices').forEach((list,index)=>{list.scrollTop=choiceScrolls[index]??0;});
  document.getElementById('exit').onclick=stop;
  document.getElementById('restart')?.addEventListener('click',start);
  document.getElementById('makeGhostDraft')?.addEventListener('click',editRecordedDraft);
  document.getElementById('pause').onclick=()=>worker.postMessage({type:'pause'});
  document.getElementById('step')?.addEventListener('click',()=>worker.postMessage({type:'step'}));
  document.getElementById('clearCard')?.addEventListener('click',()=>{selectedCard=null;renderDuel();});
  root.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>focusCard(b.dataset.focus));
  root.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>send({choice:b.dataset.choice}));
  root.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>toggleSelection(Number(b.dataset.select)));
  document.getElementById('announcementSearch')?.addEventListener('input',e=>{
    announcementQuery=e.target.value;
    const caret=e.target.selectionStart,scroll=root.querySelector('.decision')?.scrollTop??0;
    renderDuel();
    const input=document.getElementById('announcementSearch');input.focus();input.setSelectionRange(caret,caret);
    root.querySelector('.decision').scrollTop=scroll;
  });
  root.querySelectorAll('[data-counter]').forEach(b=>b.oninput=()=>{
    const s=state.prompt.selection;
    counters[Number(b.dataset.counter)]=b.value===''?NaN:Number(b.value);
    const counts=s.options.map((_,i)=>counters[i]??0),valid=counts.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=s.options[i].cap);
    const chosen=counts.reduce((sum,n)=>sum+(Number.isFinite(n)?n:0),0);
    document.getElementById('counterRemaining').textContent=`${chosen}/${s.total}개 선택`;
    document.getElementById('confirm').disabled=busy||!valid||chosen!==s.total;
    document.querySelector('.input-error')?.remove();inputError='';
  });
  document.getElementById('confirm')?.addEventListener('click',()=>{
    const s=state.prompt.selection;
    if(s.mode==='counter'){send({counters:s.options.map((_,i)=>counters[i]??0)});return;}
    const amount=s.tribute?selection.reduce((a,id)=>a+s.options.find(o=>o.id===id).value,0):selection.length;
    if(s.mode!=='sum'&&(amount<s.min||selection.length>s.max)){document.getElementById('confirm').textContent='선택 수를 확인하세요';return;}
    send({indices:selection});
  });
  const show=cards=>{document.getElementById('detailContent').innerHTML=cards.length?cards.map(cardInfoHtml).join(''):'<p>공개된 카드가 없습니다.</p>';document.getElementById('details').showModal();};
  document.getElementById('inspectCard')?.addEventListener('click',()=>{const [p,l,i]=selectedCard.split(',').map(Number),c=state?.zones[p][l].cards[i];if(c)show([{...c,zoneLabel:zoneLabel(p,l,i)}]);});
  root.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{const key=b.dataset.card,[p,l,i]=key.split(',').map(Number),c=state?.zones[p][l].cards[i];if(myPrompt()&&c&&!c.hidden)focusCard(key);else if(c)show([{...c,zoneLabel:zoneLabel(p,l,i)}]);});
  root.querySelectorAll('[data-pile]').forEach(b=>b.onclick=()=>{
    const [p,l]=b.dataset.pile.split(','),cards=state?.zones[p][l].cards??[];
    document.getElementById('detailContent').innerHTML=cards.length?`<h3>${esc(({16:'묘지',32:'제외',64:'엑스트라'})[l]??'카드 목록')}</h3><div class="pile-cards">${cards.map((c,i)=>c?`<button class="pick ${actionsFor(`${p},${l},${i}`).length?'actionable':''}" data-pile-card="${p},${l},${i}">${esc(c.name??'뒷면 카드')}</button>`:'').join('')}</div>`:'<p>공개된 카드가 없습니다.</p>';
    document.getElementById('details').showModal();
    root.querySelectorAll('[data-pile-card]').forEach(item=>item.onclick=()=>{const key=item.dataset.pileCard,[owner,location,sequence]=key.split(',').map(Number),c=state?.zones[owner]?.[location]?.cards?.[sequence];document.getElementById('details').close();if(myPrompt()&&(actionsFor(key).length||targetFor(key)))focusCard(key);else if(c)show([{...c,zoneLabel:zoneLabel(owner,location,sequence)}]);});
  });
  document.getElementById('closeDetail').onclick=()=>document.getElementById('details').close();
}
try{const index=await json('./ghosts/index.json');ghosts=await Promise.all(index.map(e=>json(e.file)));try{const saved=JSON.parse(localStorage.getItem(SAVED_GHOSTS_KEY)||'[]');if(Array.isArray(saved))for(const g of saved){try{if(typeof g.id==='string'&&g.id!=='sample')ghosts.push(exportGhost(g));}catch{}}}catch{}ghostId=ghosts[0]?.id;const deck=await json('./decks/starter.json');deck.id='starter';decks=[deck];try{const saved=JSON.parse(localStorage.getItem(SAVED_DECKS_KEY)||'[]');if(Array.isArray(saved))for(const d of saved){try{if(typeof d.id==='string'&&d.id!=='starter')decks.push({...parseDeck(JSON.stringify(d),d.name),id:d.id});}catch{}}}catch{}deckId=deck.id;renderSetup();}catch(e){error=e.message;renderSetup();}
