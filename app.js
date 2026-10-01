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
const orientationQuery=window.matchMedia('(orientation: portrait)');
const orientationGuard=document.createElement('div');
orientationGuard.className='portrait orientation-guard';
orientationGuard.setAttribute('role','dialog');
orientationGuard.setAttribute('aria-modal','true');
orientationGuard.setAttribute('aria-labelledby','orientationTitle');
orientationGuard.innerHTML='<strong id="orientationTitle">Ghost Duel은 가로 화면 전용입니다</strong><span>세로 화면에서는 조작을 막고 가로 화면 잠금을 다시 시도합니다.</span><button class="primary" id="portraitLandscape" type="button">가로 전체 화면으로 실행</button><small id="orientationStatus" aria-live="polite">자동 전환이 안 되면 기기를 가로로 돌려 주세요.</small>';
document.body.append(orientationGuard);
let orientationLockInProgress=false;
async function restoreLandscapeLock(){
  if(orientationLockInProgress||!orientationQuery.matches||!document.fullscreenElement||!screen.orientation?.lock)return;
  orientationLockInProgress=true;
  try{await screen.orientation.lock('landscape');}
  catch{
    const note=document.getElementById('orientationStatus');
    if(note)note.textContent='가로 잠금을 복구하지 못했습니다. 아래 버튼을 다시 누르거나 기기를 가로로 돌려 주세요.';
  }finally{orientationLockInProgress=false;}
}
function syncOrientationGuard(retryLandscapeLock=false){
  const portrait=orientationQuery.matches;
  root.inert=portrait;
  root.setAttribute('aria-hidden',String(portrait));
  orientationGuard.setAttribute('aria-hidden',String(!portrait));
  if(portrait&&retryLandscapeLock)void restoreLandscapeLock();
}
function syncFullscreenButton(){
  const button=document.getElementById('fullscreen');
  if(button){
    const active=!!document.fullscreenElement;
    button.textContent=active?'전체 화면 종료':'전체 화면';
    button.setAttribute('aria-pressed',String(active));
    button.title=active?'전체 화면을 종료합니다.':'브라우저 UI를 숨겨 전체 화면으로 전환합니다.';
  }
  syncOrientationGuard(true);
}
document.addEventListener('fullscreenchange',syncFullscreenButton);
window.addEventListener('orientationchange',()=>syncOrientationGuard(true));
orientationQuery.addEventListener?.('change',()=>syncOrientationGuard(true));
screen.orientation?.addEventListener?.('change',()=>syncOrientationGuard(true));
syncOrientationGuard();
const fullscreenButton=()=>matchMedia('(display-mode: fullscreen)').matches?'':`<button class="mini" id="fullscreen" type="button" aria-pressed="${!!document.fullscreenElement}" ${document.fullscreenEnabled===false?'disabled':''}>${document.fullscreenElement?'전체 화면 종료':'전체 화면'}</button>`;
function bindFullscreenButton(){
  const button=document.getElementById('fullscreen');
  if(!button)return;
  button.onclick=async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else{
        await document.documentElement.requestFullscreen();
        if(screen.orientation?.lock){
          orientationLockInProgress=true;
          try{await screen.orientation.lock('landscape');}
          finally{orientationLockInProgress=false;}
        }
      }
    }catch{
      button.title='현재 브라우저에서 전체 화면 또는 가로 화면 잠금을 사용할 수 없습니다.';
    }
    syncFullscreenButton();
  };
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ghosts=[],decks=[],ghostId,deckId,worker=null,state=null,selection=[],counters=[],announcementQuery='',inputError='',selectedCard=null,busy=false,error='',loading='',actionNotice='',actionNoticeTimer=null,lastShownConfirmationId=0;
let setupMode='duel',sessionMode='duel',sessionDeck=null,sessionGhost=null,currentScenario=null,recordedSteps=[],recordedActionFlags=[],scenarioCaptured=false;
const CLAUDE_BRIDGE_LOCAL='http://127.0.0.1:3210';
const CLAUDE_MCP_ENDPOINT_KEY='ghost-duel.claude-mcp-endpoint.v1';
let claudeMcpEndpoint=localStorage.getItem(CLAUDE_MCP_ENDPOINT_KEY)??'';
let claudeBridgeClientId=null,claudeBridgeCursor=0,claudePollTimer=null,claudePollBusy=false,claudeRelayChain=Promise.resolve(),lastClaudeState=null,claudeRelaySocket=null,claudePairingCode=null,claudeReconnectTimer=null,claudeReconnectAttempt=0,claudeBridgeStatus='MCP 서버 연결을 확인해 주세요.';
function clearActionNotice(){clearTimeout(actionNoticeTimer);actionNoticeTimer=null;actionNotice='';}
function showActionNotice(message){
  actionNotice=message;
  clearTimeout(actionNoticeTimer);
  actionNoticeTimer=setTimeout(()=>{actionNotice='';actionNoticeTimer=null;if(state)renderDuel();},3200);
}
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
document.addEventListener('click',async event=>{
  const button=event.target.closest?.('#portraitLandscape');
  if(!button)return;
  const note=document.getElementById('orientationStatus');
  button.disabled=true;
  orientationLockInProgress=true;
  try{
    if(!screen.orientation?.lock)throw new Error('orientation lock unavailable');
    if(!document.fullscreenElement)await document.documentElement.requestFullscreen();
    await screen.orientation.lock('landscape');
    if(note)note.textContent='가로 전체 화면으로 전환 중입니다.';
  }catch{
    if(document.fullscreenElement)try{await document.exitFullscreen();}catch{}
    if(note)note.textContent='가로 전체 화면을 잠글 수 없습니다. 기기를 가로로 돌려 주세요.';
  }finally{
    orientationLockInProgress=false;
    button.disabled=false;
    syncOrientationGuard();
  }
});
applyTheme(theme);

const choiceItem=(x,selected,kind)=>{
  const typeLabel=kind==='deck'?'덱':'고스트';
  const builtInId=kind==='deck'?'starter':'sample';
  const removeButton=x.id===builtInId?'':`<button class="mini delete-entry" type="button" data-delete-${kind}="${esc(x.id)}" aria-label="${esc(x.name)} ${typeLabel} 삭제" title="${typeLabel} 삭제">삭제</button>`;
  return `<div class="saved-entry"><button class="item ${x.id===selected?'active':''}" data-id="${esc(x.id)}"><div class="thumb"></div><div><strong>${esc(x.name)}</strong><small>${esc(x.description??`${x.main?.length??0}장 / 엑스트라 ${x.extra?.length??0}장`)}</small></div></button>${removeButton}</div>`;
};
async function json(url){const r=await fetch(url);if(!r.ok)throw new Error(`${url} 로드 실패`);return r.json();}
function claudeBridgeBase(){
  const raw=claudeMcpEndpoint.trim()||CLAUDE_BRIDGE_LOCAL;
  const url=new URL(raw);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('MCP 주소는 http(s)://호스트 또는 http(s)://호스트/mcp 형식이어야 합니다.');
  if(url.pathname.endsWith('/mcp'))url.pathname=url.pathname.slice(0,-4)||'/';
  if(url.pathname!=='/')throw new Error('MCP 주소에는 호스트 뒤에 /mcp 경로만 사용할 수 있습니다.');
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.protocol!=='https:')throw new Error('원격 MCP 주소에는 공개 HTTPS를 사용하세요.');
  return url.origin.replace(/\/$/,'');
}
function remoteClaudeBridge(){return !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(claudeBridgeBase());}
function claudeRelayUrl(){const url=new URL(claudeBridgeBase());url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/relay';return url.href;}
function saveClaudeMcpEndpoint(value){claudeMcpEndpoint=value.trim();try{localStorage.setItem(CLAUDE_MCP_ENDPOINT_KEY,claudeMcpEndpoint);}catch{}}
async function claudeBridgeRequest(path,options={}){
  const response=await fetch(`${claudeBridgeBase()}${path}`,{cache:'no-store',...options});
  const body=response.status===204?null:await response.json().catch(()=>null);
  if(!response.ok)throw new Error(body?.error??`MCP 서버 요청 실패 (${response.status})`);
  return body;
}
async function checkClaudeBridge(){
  claudeBridgeStatus='Claude MCP 서버 확인 중...';
  if(setupMode==='claude')renderSetup();
  try{
    const health=await claudeBridgeRequest('/health');
    claudeBridgeStatus=remoteClaudeBridge()?'원격 MCP 서버 연결됨 · Claude 계정에 /mcp 주소를 커넥터로 등록하세요.':health.gameConnected?'MCP 서버에 기존 듀얼 탭이 연결되어 있습니다.':'로컬 MCP 서버 연결됨 · Claude Code/Desktop에서 사용할 수 있습니다.';
  }catch(error){
    claudeBridgeStatus=`MCP 서버에 연결할 수 없습니다: ${error.message}`;
  }
  if(setupMode==='claude')renderSetup();
}
function relayClaudeState(remoteState,actionResult=null){
  if(!remoteState)return;
  lastClaudeState=remoteState;
  if(claudePairingCode){
    if(claudeRelaySocket?.readyState===WebSocket.OPEN)claudeRelaySocket.send(JSON.stringify({type:'state',state:remoteState,...(actionResult?{actionResult}:{})}));
    return;
  }
  if(!claudeBridgeClientId)return;
  const clientId=claudeBridgeClientId;
  claudeRelayChain=claudeRelayChain.then(async()=>{
    const response=await fetch(`${claudeBridgeBase()}/state`,{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,state:remoteState,...(actionResult?{actionResult}:{})})});
    if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error??`MCP 상태 전송 실패 (${response.status})`);}
  }).catch(error=>{claudeBridgeStatus=`MCP 연결이 끊겼습니다: ${error.message}`;});
}
async function pollClaudeActions(){
  if(!claudeBridgeClientId||claudePollBusy)return;
  claudePollBusy=true;
  try{
    const response=await fetch(`${claudeBridgeBase()}/action?clientId=${encodeURIComponent(claudeBridgeClientId)}&after=${claudeBridgeCursor}`,{cache:'no-store'});
    if(response.status===200){
      const action=await response.json();claudeBridgeCursor=Math.max(claudeBridgeCursor,action.sequence);
      if(worker&&sessionMode==='claude')worker.postMessage({type:'remote-action',requestId:action.id,revision:action.revision,...action.input});
      else relayClaudeState(lastClaudeState,{requestId:action.id,ok:false,error:'Claude 대전 탭이 더 이상 활성 상태가 아닙니다.'});
    }else if(!response.ok&&response.status!==204){const body=await response.json().catch(()=>null);throw new Error(body?.error??`MCP 행동 요청 실패 (${response.status})`);}
  }catch(error){claudeBridgeStatus=`MCP 연결이 끊겼습니다: ${error.message}`;}
  finally{claudePollBusy=false;if(claudeBridgeClientId)claudePollTimer=setTimeout(pollClaudeActions,350);}
}
function handleRemoteRelayMessage(socket,event){
  let message;try{message=JSON.parse(event.data);}catch{return;}
  if(message.type==='joined'){
    claudeReconnectAttempt=0;claudeBridgeStatus='원격 MCP 듀얼 연결됨';
    if(lastClaudeState)socket.send(JSON.stringify({type:'state',state:lastClaudeState}));
    return;
  }
  if(message.type==='action'){
    if(worker&&sessionMode==='claude')worker.postMessage({type:'remote-action',requestId:message.id,revision:message.revision,...message.input});
    else if(lastClaudeState)socket.send(JSON.stringify({type:'state',state:lastClaudeState,actionResult:{requestId:message.id,ok:false,error:'Claude 대전 탭이 아직 준비되지 않았습니다.'}}));
    return;
  }
  if(message.type==='error')claudeBridgeStatus=`원격 MCP 오류: ${message.message}`;
}
function scheduleClaudeRelayReconnect(){
  if(!claudePairingCode||claudeReconnectTimer)return;
  const delay=Math.min(10000,500*2**Math.min(claudeReconnectAttempt++,5));
  claudeReconnectTimer=setTimeout(()=>{claudeReconnectTimer=null;void openClaudeRelay(claudePairingCode,false).catch(()=>scheduleClaudeRelayReconnect());},delay);
}
function openClaudeRelay(pairingCode,initial=true){
  return new Promise((resolve,reject)=>{
    let settled=false;
    let socket;
    try{socket=new WebSocket(claudeRelayUrl());}catch(error){reject(error);return;}
    claudeRelaySocket=socket;
    const timeout=setTimeout(()=>{if(!settled){settled=true;socket.close();reject(new Error('원격 듀얼 연결 시간 초과'));}},10000);
    socket.onopen=()=>socket.send(JSON.stringify({type:'join',pairingCode}));
    socket.onmessage=event=>{
      let wasJoined=false;try{wasJoined=JSON.parse(event.data).type==='joined';}catch{return;}
      handleRemoteRelayMessage(socket,event);
      if(wasJoined&&!settled){settled=true;clearTimeout(timeout);resolve();}
    };
    socket.onerror=()=>{if(!settled){settled=true;clearTimeout(timeout);reject(new Error('원격 WebSocket 연결에 실패했습니다.'));}};
    socket.onclose=()=>{
      if(claudeRelaySocket===socket)claudeRelaySocket=null;
      if(!settled){settled=true;clearTimeout(timeout);reject(new Error('원격 듀얼 연결이 종료되었습니다.'));}
      else if(claudePairingCode)scheduleClaudeRelayReconnect();
      if(claudePairingCode)claudeBridgeStatus='원격 서버 재연결 중...';
    };
  });
}
async function connectClaudeBridge(){
  clearTimeout(claudeReconnectTimer);claudeReconnectTimer=null;
  if(remoteClaudeBridge()){
    disconnectClaudeBridge();
    const pairingCode=crypto.randomUUID();claudePairingCode=pairingCode;claudeBridgeStatus='원격 듀얼 연결 중...';
    await openClaudeRelay(pairingCode);
    return;
  }
  if(claudeBridgeClientId){
    clearTimeout(claudePollTimer);const previous=claudeBridgeClientId;claudeBridgeClientId=null;
    await claudeBridgeRequest('/disconnect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:previous})}).catch(()=>{});
  }
  const clientId=crypto.randomUUID();
  await claudeBridgeRequest('/connect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId})});
  claudeBridgeClientId=clientId;claudeBridgeCursor=0;claudeRelayChain=Promise.resolve();lastClaudeState=null;claudeBridgeStatus='Claude MCP 연결됨';
  clearTimeout(claudePollTimer);void pollClaudeActions();
}
function disconnectClaudeBridge(){
  clearTimeout(claudePollTimer);clearTimeout(claudeReconnectTimer);claudeReconnectTimer=null;
  const clientId=claudeBridgeClientId,pairingCode=claudePairingCode,socket=claudeRelaySocket;
  claudeBridgeClientId=null;claudePairingCode=null;claudeRelaySocket=null;claudeBridgeCursor=0;lastClaudeState=null;
  if(clientId)fetch(`${claudeBridgeBase()}/disconnect`,{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({clientId})}).catch(()=>{});
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type:'leave',pairingCode}));socket.close();}
}
window.addEventListener('pagehide',()=>{if(!claudePairingCode)disconnectClaudeBridge();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&claudePairingCode&&!claudeRelaySocket)scheduleClaudeRelayReconnect();});
const SAVED_DECKS_KEY='ghost-duel.decks.v1';
const SAVED_GHOSTS_KEY='ghost-duel.ghosts.v1';
function persistDecks(){try{localStorage.setItem(SAVED_DECKS_KEY,JSON.stringify(decks.filter(d=>d.id!=='starter')));return true;}catch{return false;}}
function persistGhosts(){try{localStorage.setItem(SAVED_GHOSTS_KEY,JSON.stringify(ghosts.filter(g=>g.id!=='sample')));return true;}catch{return false;}}
function clearDeletedDraft(key,matches){try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(matches(saved))localStorage.removeItem(key);}catch{}}
function deleteDeck(id){
  const deck=decks.find(item=>item.id===id);
  if(!deck||deck.id==='starter'||!confirm(`"${deck.name}" 덱을 삭제할까요?\n삭제한 덱은 복구할 수 없습니다.`))return;
  decks=decks.filter(item=>item.id!==id);
  if(deckId===id)deckId=decks[0]?.id??null;
  clearDeletedDraft('ghost-duel.builder.draft.v1',saved=>saved?.sourceId===id);
  error=persistDecks()?'':'기기 저장에 실패했습니다.';
  renderSetup();
}
function deleteGhost(id){
  const ghost=ghosts.find(item=>item.id===id);
  if(!ghost||ghost.id==='sample'||!confirm(`"${ghost.name}" 고스트를 삭제할까요?\n삭제한 고스트는 복구할 수 없습니다.`))return;
  ghosts=ghosts.filter(item=>item.id!==id);
  if(ghostId===id)ghostId=ghosts[0]?.id;
  clearDeletedDraft('ghost-duel.ghost-draft.v1',saved=>saved?.ghost?.id===id);
  error=persistGhosts()?'':'기기 저장에 실패했습니다.';
  renderSetup();
}
function builder(source){openDeckBuilder(root,{source,onClose:renderSetup,onSave:deck=>{const i=decks.findIndex(d=>d.id===deck.id);if(i>=0)decks[i]=deck;else decks.push(deck);deckId=deck.id;error=persistDecks()?'':'기기 저장에 실패했습니다. 덱 편집에서 JSON으로 내보내 주세요.';renderSetup();}});}
function saveGhost(ghost){if(ghost.id==='sample')ghost.id=crypto.randomUUID();const i=ghosts.findIndex(g=>g.id===ghost.id);if(i>=0)ghosts[i]=ghost;else ghosts.push(ghost);ghostId=ghost.id;error=persistGhosts()?'':'기기 저장에 실패했습니다. 고스트 편집에서 JSON으로 내보내 주세요.';renderSetup();}
function ghostBuilder(source){openGhostBuilder(root,{source,decks,selectedDeck:decks.find(d=>d.id===deckId),onClose:renderSetup,onSave:saveGhost});}
function renderSetup(){
  const deckPicker=`<div class="picker"><div class="deck-picker-heading"><h2>내 덱 선택</h2><button class="mini" id="newDeck">덱 만들기 / 이어서</button><button class="mini" id="editDeck">선택 덱 편집</button></div><div class="list" id="deckList">${decks.map(x=>choiceItem(x,deckId,'deck')).join('')}</div><label class="import">YDK / JSON 덱 불러오기<input id="deckFile" type="file" accept=".ydk,.json"></label></div>`;
  const claudeMode=setupMode==='claude';
  const multiplayerMode=setupMode==='duel'||claudeMode;
  const ghostPicker=`<div class="picker ${claudeMode?'claude-picker':''}"><div class="deck-picker-heading"><h2>${claudeMode?'Claude가 사용할 덱':'고스트 선택'}</h2><button class="mini" id="newGhost">행동 만들기 / 이어서</button><button class="mini" id="editGhost">선택 고스트 편집</button></div>${claudeMode?'<p class="scenario-hint">목록의 덱만 Claude가 사용합니다. 고스트 행동 기록은 대전에 사용하지 않습니다.</p>':''}<div class="list" id="ghostList">${ghosts.map(x=>choiceItem(x,ghostId,'ghost')).join('')}</div><label class="import">${claudeMode?'상대 덱':'고스트'} JSON 불러오기<input id="ghostFile" type="file" accept=".json"></label>${claudeMode?`<div class="claude-server-settings"><label for="claudeMcpEndpoint">원격 MCP 서버 주소</label><input id="claudeMcpEndpoint" type="url" inputmode="url" autocomplete="url" placeholder="https://your-server.example/mcp" value="${esc(claudeMcpEndpoint)}"><small>모바일에서는 공개 HTTPS 주소를 입력하고 Claude 계정에 같은 주소의 /mcp 커넥터를 등록하세요. 비워 두면 localhost 연결을 사용합니다.</small></div><div class="scenario-summary"><b>Claude MCP 상태</b><small id="claudeBridgeStatus" role="status">${esc(claudeBridgeStatus)}</small><button class="mini" id="checkClaudeBridge" type="button">연결 확인</button></div><p class="scenario-hint">원격 서버는 듀얼 화면의 player 1 시점 정보만 전달합니다. 연결 코드가 있어야 해당 듀얼 상태를 읽고 행동을 제출할 수 있습니다.</p>`:''}</div>`;
  const scenarioInfo=`<section class="picker scenario-card"><h2>${setupMode==='practice'?'전개 연습':'고스트 생성'} · 상황</h2><p>${setupMode==='practice'?'상대를 두지 않고 혼자 전개합니다. 덱에서 무작위 시작 패를 뽑거나 카드를 골라 시작 패를 고정할 수 있어요.':'혼자 전개하면서 선택한 행동을 기록하고, 기록을 바탕으로 고스트 초안을 만듭니다.'}</p><div class="scenario-summary">선택 덱 <b>${esc(decks.find(d=>d.id===deckId)?.name??'없음')}</b><small>${decks.find(d=>d.id===deckId)?.main.length??0}장 · 시작 패는 다음 화면에서 설정</small></div><p class="scenario-hint">덱 목록에서 덱을 바꾸거나, 직접 편집·불러오기 할 수 있습니다.</p></section>`;
  const modes=[['duel','고스트 듀얼'],['claude','Claude 대전'],['practice','전개 연습'],['ghost-create','고스트 생성']];
  const footerText=setupMode==='duel'?'기본 덱으로 바로 시작할 수 있어요. 금제 검사는 적용하지 않습니다.':claudeMode?'모바일 Claude는 원격 HTTPS MCP 서버가 필요합니다. 주소를 입력하고 Claude 계정에 /mcp 커넥터를 먼저 등록하세요.':setupMode==='practice'?'시작 패 설정에서 덱 전체 또는 카드 종류별 무작위 패를 고를 수 있어요.':'전개 기록은 편집 가능한 고스트 초안으로 변환합니다.';
  const startText=setupMode==='duel'?'듀얼 시작':claudeMode?'Claude와 듀얼 시작':setupMode==='practice'?'시작 패 설정':'상황 설정';
  root.innerHTML=`<main class="screen setup"><header><div class="brand"><div class="brand-mark">GD</div><div><h1>Ghost Duel</h1><p>고스트 듀얼 · Claude 대전 · 혼자 전개 연습 · 고스트 생성</p></div></div><div class="setup-head-tools">${themeToggle()}${fullscreenButton()}<a href="https://github.com/simsy0924/Yu_gi_oh_auto" target="_blank" rel="noreferrer">소스 / 라이선스</a></div></header><nav class="setup-modes" aria-label="플레이 모드">${modes.map(([id,label])=>`<button class="deck-tab ${setupMode===id?'active':''}" data-mode="${id}" aria-pressed="${setupMode===id}">${label}</button>`).join('')}</nav><section class="setup-grid ${multiplayerMode?'':'solo-setup'}">${multiplayerMode?ghostPicker+deckPicker:deckPicker+scenarioInfo}</section><footer class="setup-footer"><div class="selection"><span role="alert">${esc(error)}</span><p>${footerText}</p></div><button class="primary" id="start" ${!decks.length||((setupMode==='duel'||claudeMode)&&!ghosts.length)?'disabled':''}>${startText}</button></footer></main>`;
  bindFullscreenButton();
  root.querySelector('.setup-modes').onclick=e=>{const button=e.target.closest('[data-mode]');if(button){setupMode=button.dataset.mode;error='';renderSetup();if(setupMode==='claude')void checkClaudeBridge();}};
  document.getElementById('ghostList')?.addEventListener('click',e=>{
    const remove=e.target.closest('[data-delete-ghost]');
    if(remove){deleteGhost(remove.dataset.deleteGhost);return;}
    const b=e.target.closest('[data-id]');if(b){ghostId=b.dataset.id;renderSetup();}
  });
  document.getElementById('deckList').addEventListener('click',e=>{
    const remove=e.target.closest('[data-delete-deck]');
    if(remove){deleteDeck(remove.dataset.deleteDeck);return;}
    const b=e.target.closest('[data-id]');if(b){deckId=b.dataset.id;renderSetup();}
  });
  document.getElementById('deckFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const d=parseDeck(await file.text(),file.name);d.id=crypto.randomUUID();decks.push(d);deckId=d.id;error=persistDecks()?'':'기기 저장에 실패했습니다.';}catch(e){error=e.message;}renderSetup();};
  document.getElementById('ghostFile')?.addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;const g=JSON.parse(await file.text());g.deck=parseDeck(JSON.stringify(g.deck));if(g.behavior?.type==='basic')g.behavior={type:'scripted',script:[],fallback:'basic'};g.id=crypto.randomUUID();const imported=exportGhost(g);ghosts.push(imported);ghostId=imported.id;error=persistGhosts()?'':'기기 저장에 실패했습니다. 고스트 JSON을 보관해 주세요.';}catch(e){error=e.message;}renderSetup();});
  document.getElementById('claudeMcpEndpoint')?.addEventListener('change',e=>saveClaudeMcpEndpoint(e.target.value));
  document.getElementById('checkClaudeBridge')?.addEventListener('click',()=>{const field=document.getElementById('claudeMcpEndpoint');if(field)saveClaudeMcpEndpoint(field.value);void checkClaudeBridge();});
  document.getElementById('start').onclick=()=>{
    if(setupMode==='duel'||claudeMode)void launchDuel(setupMode,{deck:decks.find(d=>d.id===deckId),startingHand:null,handNames:[]});
    else openPracticeSetup(root,{deck:decks.find(d=>d.id===deckId),mode:setupMode,onClose:renderSetup,onStart:scenario=>launchDuel(setupMode,scenario)});
  };
  document.getElementById('newDeck').onclick=()=>builder();
  document.getElementById('editDeck').onclick=()=>builder(decks.find(d=>d.id===deckId));
  document.getElementById('newGhost')?.addEventListener('click',()=>ghostBuilder());
  document.getElementById('editGhost')?.addEventListener('click',()=>ghostBuilder(ghosts.find(g=>g.id===ghostId)));
}
async function launchDuel(mode='duel',scenario=null){
  if(mode==='claude'){
    try{await connectClaudeBridge();}
    catch(e){error=`Claude MCP 연결에 실패했습니다: ${e.message}`;claudeBridgeStatus='연결 실패 · MCP 서버 주소와 relay 상태를 확인하세요.';disconnectClaudeBridge();renderSetup();return;}
  }else disconnectClaudeBridge();
  sessionMode=mode;currentScenario=scenario;sessionDeck=scenario?.deck??decks.find(d=>d.id===deckId);const selectedOpponent=mode==='duel'||mode==='claude'?ghosts.find(g=>g.id===ghostId):null;sessionGhost=mode==='duel'?selectedOpponent:mode==='claude'?{deck:selectedOpponent?.deck}:null;recordedSteps=[];recordedActionFlags=[];scenarioCaptured=false;
  clearActionNotice();error='';loading='엔진 준비 중...';state=null;busy=true;selection=[];counters=[];announcementQuery='';inputError='';selectedCard=null;lastShownConfirmationId=0;
  worker?.terminate();worker=new Worker(new URL('./src/engine.worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data:m})=>{
    if(m.type==='state'){
      if(m.undone){clearActionNotice();if(sessionMode==='ghost-create'&&recordedActionFlags.pop())recordedSteps.pop();}
      if(m.actionNotice&&sessionMode==='duel')showActionNotice(m.actionNotice);
      root.querySelector('.decision')?.scrollTo(0,0);state=m.state;
      if(sessionMode==='claude'&&m.claudeState)relayClaudeState(m.claudeState,m.actionResult??null);
      if(sessionMode==='ghost-create'&&!scenarioCaptured&&state.zones?.[0]?.[2]?.cards){currentScenario={...currentScenario,startingHand:state.zones[0][2].cards.map(card=>card.code),handNames:state.zones[0][2].cards.map(card=>card.name)};scenarioCaptured=true;}
      loading='';busy=false;selection=[];counters=[];announcementQuery='';inputError=m.undoError?`되돌리기 실패: ${m.undoError}`:'';selectedCard=null;
    }
    if(m.type==='loading')loading=m.message;
    if(m.type==='input-error'){if(sessionMode==='ghost-create'&&recordedActionFlags.pop())recordedSteps.pop();inputError=m.message;busy=false;}
    if(m.type==='action-result'&&sessionMode==='claude'&&m.actionResult){relayClaudeState(m.claudeState??null,m.actionResult);}
    if(m.type==='error'){error=m.message;loading='';busy=false;}
    renderDuel();
  };
  worker.onerror=e=>{error=e.message||'듀얼 엔진 실행 실패';loading='';busy=false;renderDuel();};
  worker.postMessage({type:'start',mode:sessionMode,you:sessionDeck,ghost:sessionGhost,startingHand:scenario?.startingHand,base:new URL('.',location.href).href,seed:Array.from(crypto.getRandomValues(new Uint32Array(4)))});
  renderDuel();
}
function start(){void launchDuel(sessionMode,currentScenario);}
function stop(){worker?.terminate();worker=null;state=null;error='';selectedCard=null;clearActionNotice();disconnectClaudeBridge();sessionMode='duel';currentScenario=null;renderSetup();}
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
  const opponentName=sessionMode==='duel'?'고스트':sessionMode==='claude'?'Claude':sessionMode==='ghost-create'?'상대':'연습 상대';
  const h=player===0?`<div class="live-hand" aria-label="내 패">${(z[2]?.cards??[]).map((c,i)=>card(c,player,2,i)).join('')}</div>`:`<div class="opponent-hand">상대 패 ${count(2)}장</div>`;
  const extra=`<div class="field-spell"><span>필드</span>${card(z[8]?.cards?.[5],player,8,5)}</div>`;
  return `<section class="live-field ${player===1?'opponent':''}"><div class="field-caption"><b>${player===1?opponentName:'나'} · ${state?.lp[player]??8000} LP</b>${piles}${extra}</div>${player===1?h+row(8,5)+row(4,5):row(4,5)+row(8,5)+h}</section>`;
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
  if(p.player===1){const opponentTurn=sessionMode==='duel'?'고스트 차례':sessionMode==='claude'?'Claude 차례':sessionMode==='ghost-create'?'상대 차례':'연습 상대 차례';return `<h2>${opponentTurn}</h2>${inputError?`<p role="alert" class="input-error">${esc(inputError)}</p>`:''}<p>${esc(state.ghostBlocked??(state.paused?'자동 진행 일시정지':'상대가 차례를 넘기는 중...'))}</p>${sessionMode==='claude'?`<p class="muted">Claude 대화에서 <code>get_duel_state</code>와 <code>duel_action</code>을 사용하면 이어서 진행됩니다.</p>`:''}${draftControl}`;}
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
function send(input){if(busy||error)return;if(sessionMode==='ghost-create'){const step=recordDecision(state?.prompt,input);recordedActionFlags.push(!!step);if(step)recordedSteps.push(step);}busy=true;inputError='';worker.postMessage({type:'respond',revision:state.revision,...input});renderDuel();}
function undo(){if(busy||error||!state?.undoAvailable)return;busy=true;loading='이전 상태로 되돌리는 중...';inputError='';worker.postMessage({type:'undo'});renderDuel();}
function toggleSelection(id){selection=selection.includes(id)?selection.filter(x=>x!==id):[...selection,id];inputError='';renderDuel();}
function focusCard(key){selectedCard=key;const target=targetFor(key);if(target&&myPrompt()?.selection?.mode!=='counter'){toggleSelection(target.id);}else renderDuel();root.querySelector('.decision')?.scrollTo(0,0);}
function renderDuel(){
  const decisionScroll=root.querySelector('.decision')?.scrollTop??0;
  const boardScroll=root.querySelector('.live-board')?.scrollTop??0;
  const choiceScrolls=[...root.querySelectorAll('.decision .choices')].map(list=>list.scrollTop);
  const oldLogList=root.querySelector('#duelLog .duel-log-list');
  const logWasOpen=root.querySelector('#duelLog')?.open??false;
  const logScroll=oldLogList?.scrollTop??0;
  const logWasAtBottom=!oldLogList||oldLogList.scrollHeight-oldLogList.scrollTop-oldLogList.clientHeight<24;
  const liveDuel=['duel','claude'].includes(sessionMode);
  const board=liveDuel?`${field(1)}${sharedExtra()}${field(0)}`:`<div class="solo-note">${sessionMode==='ghost-create'?'고스트 생성 · 내 전개를 기록 중':'전개 연습 · 상대 턴 자동 진행'}</div>${field(1)}${sharedExtra()}${field(0)}`;
  const activeName=state?.active===0?'나':sessionMode==='duel'?'고스트':sessionMode==='claude'?'Claude':sessionMode==='ghost-create'?'상대':'연습 상대';
  const claudePairingBanner=sessionMode==='claude'&&claudePairingCode?`<section class="claude-pairing-banner"><div><strong>Claude 모바일 연결 코드</strong><code>${esc(claudePairingCode)}</code><small>코드를 Claude 대화에 붙여넣으세요. 이 코드는 듀얼 상태를 읽고 행동하는 권한입니다.</small></div><button class="mini" id="copyClaudePairing" type="button">연결 정보 복사</button></section>`:'';
  root.innerHTML=`<main class="screen live-duel ${claudePairingBanner?'claude-live':''}"><header class="topbar"><strong>Ghost Duel</strong><span>${state?`${state.turn}턴 · ${activeName} · ${phaseName[state.phase]??''}`:'YGOPro Core'}</span><div class="top-right">${themeToggle()}${fullscreenButton()}${state?.confirmation?.cards?.length?'<button class="mini" id="openConfirmation" type="button">확인 카드</button>':''}<button class="mini" id="openDuelLog" type="button" aria-label="듀얼 로그 열기">로그</button><button class="mini" id="undo" ${!state?.undoAvailable||busy||error?'disabled':''}>되돌리기</button>${sessionMode==='claude'?'':`<button class="mini" id="pause" ${!state||busy||error?'disabled':''}>${state?.paused?'자동 진행':'일시정지'}</button>${state?.paused?'<button class="mini" id="step" '+(busy?'disabled':'')+'>한 행동</button>':''}`}<button class="mini" id="exit">종료</button></div></header>${claudePairingBanner}${actionNotice&&sessionMode==='duel'?`<div class="action-toast" role="status" aria-live="polite"><strong>고스트 행동</strong><span>${esc(actionNotice)}</span></div>`:''}<div class="live-layout"><div class="live-board ${liveDuel?'':'solo'}">${board}</div><aside class="decision" aria-live="polite">${panel()}</aside></div><footer class="live-log">${esc(state?.logs.at(-1)??'카드를 눌러 행동을 선택하세요.')}</footer></main><dialog id="duelLog" class="duel-log-dialog" aria-labelledby="duelLogTitle"><header><strong id="duelLogTitle">듀얼 로그</strong><button class="mini" id="closeDuelLog" type="button">닫기</button></header><ol class="duel-log-list">${(state?.logs??[]).map(line=>`<li>${esc(line)}</li>`).join('')||'<li class="duel-log-empty">아직 기록이 없습니다.</li>'}</ol></dialog><dialog id="details"><div id="detailContent"></div><button class="action" id="closeDetail">닫기</button></dialog>`;
  const duelLog=document.getElementById('duelLog');
  if(logWasOpen){duelLog.showModal();const list=duelLog.querySelector('.duel-log-list');list.scrollTop=logWasAtBottom?list.scrollHeight:logScroll;}
  root.querySelector('.decision').scrollTop=decisionScroll;
  root.querySelector('.live-board').scrollTop=boardScroll;
  root.querySelectorAll('.decision .choices').forEach((list,index)=>{list.scrollTop=choiceScrolls[index]??0;});
  document.getElementById('exit').onclick=stop;
  document.getElementById('copyClaudePairing')?.addEventListener('click',async()=>{
    const text=`이 Ghost Duel에서 Claude로 듀얼해줘. 내 턴에는 내가 행동하고 네 턴에는 get_duel_state로 공개 정보와 합법 선택지를 확인한 뒤, 합법 선택지 중 하나만 골라 duel_action으로 제출해. 연결 코드: ${claudePairingCode}`;
    try{await navigator.clipboard.writeText(text);const button=document.getElementById('copyClaudePairing');if(button)button.textContent='복사 완료';}
    catch{claudeBridgeStatus='복사할 수 없습니다. 화면의 연결 코드를 길게 눌러 복사하세요.';}
  });
  bindFullscreenButton();
  document.getElementById('openDuelLog').onclick=()=>{duelLog.showModal();const list=duelLog.querySelector('.duel-log-list');list.scrollTop=list.scrollHeight;};
  document.getElementById('closeDuelLog').onclick=()=>duelLog.close();
  document.getElementById('restart')?.addEventListener('click',start);
  document.getElementById('makeGhostDraft')?.addEventListener('click',editRecordedDraft);
  document.getElementById('undo').onclick=undo;
  document.getElementById('pause')?.addEventListener('click',()=>worker.postMessage({type:'pause'}));
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
  const confirmedCards=()=>state?.confirmation?.cards?.map(c=>({...c,zoneLabel:zoneLabel(c.controller,c.location,c.sequence)}))??[];
  document.getElementById('openConfirmation')?.addEventListener('click',()=>show(confirmedCards()));
  if(state?.confirmation?.id&&state.confirmation.id!==lastShownConfirmationId){
    lastShownConfirmationId=state.confirmation.id;
    show(confirmedCards());
  }
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
