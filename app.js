import {openDeckBuilder} from './src/deck-builder.js';
import {openGhostBuilder} from './src/ghost-builder.js';
import {parseDeck} from './src/decks.js';
import {exportGhost} from './src/ghosts.js';
const root=document.getElementById('app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ghosts=[],decks=[],ghostId,deckId,worker=null,state=null,selection=[],busy=false,error='',loading='';
const portrait=()=>'<div class="portrait"><strong>가로 화면으로 돌려주세요</strong><span>Ghost Duel은 모바일 가로 화면에 맞춰져 있습니다.</span></div>';
const choiceItem=(x,selected)=>`<button class="item ${x.id===selected?'active':''}" data-id="${esc(x.id)}"><div class="thumb"></div><div><strong>${esc(x.name)}</strong><small>${esc(x.description??`${x.main?.length??0}장 / 엑스트라 ${x.extra?.length??0}장`)}</small></div></button>`;
async function json(url){const r=await fetch(url);if(!r.ok)throw new Error(`${url} 로드 실패`);return r.json();}
const SAVED_DECKS_KEY='ghost-duel.decks.v1';
const SAVED_GHOSTS_KEY='ghost-duel.ghosts.v1';
function persistDecks(){try{localStorage.setItem(SAVED_DECKS_KEY,JSON.stringify(decks.filter(d=>d.id!=='starter')));return true;}catch{return false;}}
function persistGhosts(){try{localStorage.setItem(SAVED_GHOSTS_KEY,JSON.stringify(ghosts.filter(g=>g.id!=='sample')));return true;}catch{return false;}}
function builder(source){openDeckBuilder(root,{source,onClose:renderSetup,onSave:deck=>{const i=decks.findIndex(d=>d.id===deck.id);if(i>=0)decks[i]=deck;else decks.push(deck);deckId=deck.id;error=persistDecks()?'':'기기 저장에 실패했습니다. 덱 편집에서 JSON으로 내보내 주세요.';renderSetup();}});}
function ghostBuilder(source){openGhostBuilder(root,{source,decks,selectedDeck:decks.find(d=>d.id===deckId),onClose:renderSetup,onSave:ghost=>{if(ghost.id==='sample')ghost.id=crypto.randomUUID();const i=ghosts.findIndex(g=>g.id===ghost.id);if(i>=0)ghosts[i]=ghost;else ghosts.push(ghost);ghostId=ghost.id;error=persistGhosts()?'':'기기 저장에 실패했습니다. 고스트 편집에서 JSON으로 내보내 주세요.';renderSetup();}});}
function renderSetup(){
  root.innerHTML=portrait()+`<main class="screen setup"><header><div class="brand"><div class="brand-mark">GD</div><div><h1>Ghost Duel</h1><p>고스트와 연습하는 1인용 듀얼 · YGOPro Core</p></div></div><a href="https://github.com/simsy0924/Yu_gi_oh_auto" target="_blank" rel="noreferrer">소스 / 라이선스</a></header><section class="setup-grid"><div class="picker"><div class="deck-picker-heading"><h2>고스트 선택</h2><button class="mini" id="newGhost">행동 만들기 / 이어서</button><button class="mini" id="editGhost">선택 고스트 편집</button></div><div class="list" id="ghostList">${ghosts.map(x=>choiceItem(x,ghostId)).join('')}</div><label class="import">고스트 JSON 불러오기<input id="ghostFile" type="file" accept=".json"></label></div><div class="picker"><div class="deck-picker-heading"><h2>내 덱 선택</h2><button class="mini" id="newDeck">덱 만들기 / 이어서</button><button class="mini" id="editDeck">선택 덱 편집</button></div><div class="list" id="deckList">${decks.map(x=>choiceItem(x,deckId)).join('')}</div><label class="import">YDK / JSON 덱 불러오기<input id="deckFile" type="file" accept=".ydk,.json"></label></div></section><footer class="setup-footer"><div class="selection"><span role="alert">${esc(error)}</span><p>기본 덱으로 바로 시작할 수 있어요. 금제 검사는 적용하지 않습니다.</p></div><button class="primary" id="start" ${!ghosts.length||!decks.length?'disabled':''}>DUEL START</button></footer></main>`;
  document.getElementById('ghostList').onclick=e=>{const b=e.target.closest('[data-id]');if(b){ghostId=b.dataset.id;renderSetup();}};
  document.getElementById('deckList').onclick=e=>{const b=e.target.closest('[data-id]');if(b){deckId=b.dataset.id;renderSetup();}};
  document.getElementById('deckFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const d=parseDeck(await file.text(),file.name);d.id=crypto.randomUUID();decks.push(d);deckId=d.id;error=persistDecks()?'':'기기 저장에 실패했습니다.';}catch(e){error=e.message;}renderSetup();};
  document.getElementById('ghostFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const g=JSON.parse(await file.text());g.deck=parseDeck(JSON.stringify(g.deck));if(g.behavior?.type==='basic')g.behavior={type:'scripted',script:[],fallback:'basic'};g.id=crypto.randomUUID();const imported=exportGhost(g);ghosts.push(imported);ghostId=imported.id;error=persistGhosts()?'':'기기 저장에 실패했습니다. 고스트 JSON을 보관해 주세요.';}catch(e){error=e.message;}renderSetup();};
  document.getElementById('start').onclick=start;
  document.getElementById('newDeck').onclick=()=>builder();
  document.getElementById('editDeck').onclick=()=>builder(decks.find(d=>d.id===deckId));
  document.getElementById('newGhost').onclick=()=>ghostBuilder();
  document.getElementById('editGhost').onclick=()=>ghostBuilder(ghosts.find(g=>g.id===ghostId));
}
function start(){
  error='';loading='엔진 준비 중...';state=null;busy=true;selection=[];
  worker?.terminate();worker=new Worker(new URL('./src/engine.worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data:m})=>{
    if(m.type==='state'){state=m.state;loading='';busy=false;selection=[];}
    if(m.type==='loading')loading=m.message;
    if(m.type==='error'){error=m.message;loading='';busy=false;}
    renderDuel();
  };
  worker.onerror=e=>{error=e.message||'듀얼 엔진 실행 실패';loading='';busy=false;renderDuel();};
  worker.postMessage({type:'start',you:decks.find(d=>d.id===deckId),ghost:ghosts.find(g=>g.id===ghostId),base:new URL('.',location.href).href,seed:Array.from(crypto.getRandomValues(new Uint32Array(4)))});
  renderDuel();
}
function stop(){worker?.terminate();worker=null;state=null;error='';renderSetup();}
const phaseName={1:'드로우',2:'스탠바이',4:'메인 1',8:'배틀 시작',16:'배틀',32:'데미지',64:'데미지 계산',128:'배틀 종료',256:'메인 2',512:'엔드'};
function card(c,player,location,sequence){
  if(!c)return `<div class="slot empty">${location===4?'M':'S'}${sequence+1}</div>`;
  return `<button class="slot ${player===1?'rot':''} ${location===4&&(c.position&12)?'defense':''}" data-card="${player},${location},${sequence}" title="${esc(c.name??'뒷면 카드')}">${c.hidden?'<span class="back">GD</span>':`<span>${esc(c.name)}</span><small>${location===4?`${c.attack??'?'} / ${c.defense??'?'}`:''}</small>${c.link_marker?`<small>LINK ${esc(c.link?.rating??'')} · ${linkArrows(c.link_marker)}</small>`:''}`}</button>`;
}
function linkArrows(mask){return [[64,'↖'],[128,'↑'],[256,'↗'],[8,'←'],[32,'→'],[1,'↙'],[2,'↓'],[4,'↘']].filter(([n])=>mask&n).map(([,s])=>s).join('');}
function field(player){
  const z=state?.zones[player]??{};
  const count=l=>z[l]?.count??z[l]?.cards?.filter(Boolean).length??0;
  const row=(l,count)=>`<div class="field-row">${Array.from({length:count},(_,i)=>card(z[l]?.cards?.[i],player,l,i)).join('')}</div>`;
  const piles=`<div class="pilebar">${[[1,'DECK'],[64,'EXTRA'],[16,'GY'],[32,'BAN']].map(([l,t])=>`<button class="mini" data-pile="${player},${l}">${t} ${count(l)}</button>`).join('')}</div>`;
  const h=player===0?`<div class="live-hand">${(z[2]?.cards??[]).map((c,i)=>card(c,player,2,i)).join('')}</div>`:`<div class="opponent-hand">GHOST 패 ${count(2)}장</div>`;
  const extra=`<div class="field-spell"><span>FIELD</span>${card(z[8]?.cards?.[5],player,8,5)}</div>`;
  return `<section class="live-field ${player===1?'opponent':''}"><div class="field-caption"><b>${player===1?'GHOST':'YOU'} · ${state?.lp[player]??8000} LP</b>${piles}${extra}</div>${player===1?h+row(8,5)+row(4,5):row(4,5)+row(8,5)+h}</section>`;
}
function sharedExtra(){return '<div class="shared-extra"><span>EXTRA MONSTER ZONES</span>'+[5,6].map(i=>{const own=state?.zones[0][4].cards[i],other=state?.zones[1][4].cards[11-i];return own?card(own,0,4,i):other?card(other,1,4,11-i):card(null,0,4,i);}).join('')+'</div>';}
function panel(){
  if(error)return `<h2>듀얼이 중단되었습니다</h2><p role="alert">${esc(error)}</p><button class="action" id="restart">다시 시작</button>`;
  if(loading)return `<h2>준비 중</h2><p>${esc(loading)}</p>`;
  if(state?.ended)return `<h2>${state.winner===2?'무승부':state.winner===0?'승리':'패배'}</h2><button class="primary" id="restart">다시 시작</button>`;
  const p=state?.prompt;if(!p)return '<p>듀얼 처리 중...</p>';
  if(p.player===1)return `<h2>GHOST</h2><p>${esc(state.ghostBlocked??(state.paused?'고스트 일시정지':p.title))}</p>${state.ghostBlocked?'<p>고스트 JSON의 행동 또는 지원되는 덱을 확인하세요.</p>':''}`;
  let html=`<h2>${esc(p.title)}</h2>`;
  if(p.blocked)return html+`<p role="alert">${esc(p.blocked)}</p><p>현재 버전은 이 선택을 처리할 수 없습니다. 다른 덱으로 다시 시작해 주세요.</p>`;
  if(p.selection){const s=p.selection;html+=`<p>${s.ordered?'선택한 순서대로':`${s.min}~${s.max}장/존 선택`} · 현재 ${selection.length}</p><div class="choices">${s.options.map(o=>`<button class="pick ${selection.includes(o.id)?'selected':''}" data-select="${o.id}">${selection.includes(o.id)?`${selection.indexOf(o.id)+1}. `:''}${esc(o.label)}</button>`).join('')}</div><button class="action" id="confirm">선택 완료</button>`;}
  html+=`<div class="choices">${p.choices.map(c=>`<button class="pick" data-choice="${c.id}" ${busy?'disabled':''}>${esc(c.label)}</button>`).join('')}</div>`;
  return html;
}
function send(input){if(busy||error)return;busy=true;worker.postMessage({type:'respond',revision:state.revision,...input});renderDuel();}
function renderDuel(){
  root.innerHTML=portrait()+`<main class="screen live-duel"><header class="topbar"><strong>Ghost Duel</strong><span>${state?`${state.turn}턴 · ${state.active===0?'YOU':'GHOST'} · ${phaseName[state.phase]??''}`:'YGOPro Core'}</span><div class="top-right"><button class="mini" id="pause" ${!state||error?'disabled':''}>${state?.paused?'고스트 자동 진행':'고스트 일시정지'}</button>${state?.paused?'<button class="mini" id="step">한 행동 진행</button>':''}<button class="mini" id="exit">종료</button></div></header><div class="live-layout"><div class="live-board">${field(1)}${sharedExtra()}${field(0)}</div><aside class="decision" aria-live="polite">${panel()}</aside></div><footer class="live-log">${esc(state?.logs.at(-1)??'카드 효과와 룰은 YGOPro Core에서 처리합니다.')}</footer></main><dialog id="details"><div id="detailContent"></div><button class="action" id="closeDetail">닫기</button></dialog>`;
  document.getElementById('exit').onclick=stop;
  document.getElementById('restart')?.addEventListener('click',start);
  document.getElementById('pause').onclick=()=>worker.postMessage({type:'pause'});
  document.getElementById('step')?.addEventListener('click',()=>worker.postMessage({type:'step'}));
  root.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>send({choice:b.dataset.choice}));
  root.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.select);selection=selection.includes(id)?selection.filter(x=>x!==id):[...selection,id];renderDuel();});
  document.getElementById('confirm')?.addEventListener('click',()=>{
    const s=state.prompt.selection,amount=s.tribute?selection.reduce((a,id)=>a+s.options.find(o=>o.id===id).value,0):selection.length;
    if(amount<s.min||selection.length>s.max){document.getElementById('confirm').textContent='선택 수를 확인하세요';return;}send({indices:selection});
  });
  const show=cards=>{document.getElementById('detailContent').innerHTML=cards.length?cards.map(c=>`<h3>${esc(c.name??'뒷면 카드')}</h3><p class="card-description">${esc(c.desc??'공개되지 않은 카드입니다.')}</p>`).join(''):'<p>공개된 카드가 없습니다.</p>';document.getElementById('details').showModal();};
  root.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{const [p,l,i]=b.dataset.card.split(',');const c=state?.zones[p][l].cards[i];if(c)show([c]);});
  root.querySelectorAll('[data-pile]').forEach(b=>b.onclick=()=>{const [p,l]=b.dataset.pile.split(',');show((state?.zones[p][l].cards??[]).filter(Boolean));});
  document.getElementById('closeDetail').onclick=()=>document.getElementById('details').close();
}
try{const index=await json('./ghosts/index.json');ghosts=await Promise.all(index.map(e=>json(e.file)));try{const saved=JSON.parse(localStorage.getItem(SAVED_GHOSTS_KEY)||'[]');if(Array.isArray(saved))for(const g of saved){try{if(typeof g.id==='string'&&g.id!=='sample')ghosts.push(exportGhost(g));}catch{}}}catch{}ghostId=ghosts[0]?.id;const deck=await json('./decks/starter.json');deck.id='starter';decks=[deck];try{const saved=JSON.parse(localStorage.getItem(SAVED_DECKS_KEY)||'[]');if(Array.isArray(saved))for(const d of saved){try{if(typeof d.id==='string'&&d.id!=='starter')decks.push({...parseDeck(JSON.stringify(d),d.name),id:d.id});}catch{}}}catch{}deckId=deck.id;renderSetup();}catch(e){error=e.message;renderSetup();}
