import {actionsByRequest,selectionRequests,exportGhost} from './ghosts.js';
import {loadCatalog} from './catalog.js';

const DRAFT_KEY='ghost-duel.ghost-draft.v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={SELECT_IDLECMD:'메인 페이즈',SELECT_BATTLECMD:'배틀 페이즈',SELECT_CHAIN:'체인',SELECT_EFFECTYN:'효과 확인',SELECT_YESNO:'예/아니요',SELECT_UNSELECT_CARD:'소재 선택',SELECT_OPTION:'효과 옵션',SELECT_POSITION:'표시 형식',SELECT_CARD:'카드 선택',SELECT_TRIBUTE:'릴리스',SELECT_PLACE:'존 선택',SELECT_DISFIELD:'사용 불가 존',SORT_CARD:'카드 순서',SORT_CHAIN:'체인 순서',ANNOUNCE_NUMBER:'숫자 선언',ROCK_PAPER_SCISSORS:'가위바위보'};
const actions={summon:'일반 소환',special:'특수 소환',position:'표시 변경',set:'몬스터 세트','set-spell':'마법·함정 세트',activate:'효과 발동',battle:'배틀 페이즈',end:'턴 종료',attack:'공격',main2:'메인 페이즈 2',pass:'체인하지 않음',yes:'예',no:'아니요',select:'선택',finish:'선택 완료'};
const copyDeck=d=>({name:d.name,main:[...d.main],extra:[...d.extra??[]],side:[...d.side??[]]});
const empty=(deck)=>({version:1,id:crypto.randomUUID(),name:'새 고스트',description:'',deck:copyDeck(deck),behavior:{type:'scripted',script:[],fallback:'basic'}});
const filename=name=>(name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').trim()||'ghost')+'.json';

export function openGhostBuilder(root,{source,decks,selectedDeck,onClose,onSave}) {
  let cardNames={};
  let deckSelection=source?'source':selectedDeck?.id;
  let draft=source?{...source,deck:copyDeck(source.deck),behavior:{type:'scripted',fallback:source.behavior?.fallback??'basic',script:(source.behavior?.script??[]).map(s=>({...s}))}}:empty(selectedDeck);
  if(!source)try{
    const saved=JSON.parse(localStorage.getItem(DRAFT_KEY));
    if(saved?.ghost?.behavior?.type==='scripted'&&Array.isArray(saved.ghost.behavior.script)&&saved.ghost.deck){draft=saved.ghost;deckSelection=saved.deckSelection??selectedDeck?.id;}
  }catch{}
  root.innerHTML=`<main class="screen ghost-builder"><header class="builder-header"><div><h1>고스트 행동 만들기</h1><small>듀얼 중 요청을 순서대로 기다려 실행합니다</small></div><div class="builder-tools"><button class="action" id="ghostNew">새 고스트</button><button class="action" id="ghostClose">선택 화면으로</button></div></header><div class="ghost-layout"><section class="ghost-settings"><h2>고스트 설정</h2><label>이름<input id="ghostName" maxlength="80" value="${esc(draft.name)}"></label><label>설명<input id="ghostDescription" maxlength="160" value="${esc(draft.description)}"></label><label>사용할 덱<select id="ghostDeck">${source?'<option value="source">현재 고스트의 덱</option>':''}${decks.map(d=>`<option value="${esc(d.id)}">${esc(d.name)} (${d.main.length}장)</option>`).join('')}</select></label><label>정해진 행동이 없을 때<select id="ghostFallback"><option value="basic">기본 행동으로 진행</option><option value="pause">고스트 중단</option></select></label><p class="builder-help">행동은 위에서 아래로 실행됩니다. 다음 단계의 요청이 나올 때까지 기본 행동을 하거나 중단합니다. 현재 상황에서 지정한 행동을 할 수 없으면 듀얼이 멈춥니다.</p><p class="builder-help">카드 번호와 선택 번호는 필요한 단계에만 입력하세요. 선택 번호는 코어가 보여 주는 버튼의 0부터 시작하는 순서입니다.</p></section><section class="ghost-steps"><div class="ghost-steps-heading"><h2>행동 순서 <span id="ghostStepCount"></span></h2><button class="mini" id="ghostAdd">+ 행동 추가</button></div><div id="ghostStepList" class="ghost-step-list"></div></section></div><footer class="builder-footer"><div><p id="ghostStatus" role="status"></p><small id="ghostDraftStatus">작성 내용은 이 기기에 자동 저장됩니다. JSON을 내보내면 다른 기기에서 불러올 수 있습니다.</small></div><button class="action" id="ghostSave">저장하고 사용</button><button class="primary" id="ghostExport">JSON 내보내기</button></footer></main>`;
  const $=id=>root.querySelector('#'+id);
  $('ghostDeck').value=deckSelection;
  if(!$('ghostDeck').value){deckSelection=selectedDeck.id;$('ghostDeck').value=deckSelection;draft.deck=copyDeck(selectedDeck);}
  $('ghostFallback').value=draft.behavior.fallback;
  function persist(){try{localStorage.setItem(DRAFT_KEY,JSON.stringify({ghost:draft,deckSelection}));}catch{$('ghostDraftStatus').textContent='기기 저장에 실패했습니다. 완성한 고스트를 JSON으로 내보내 주세요.';}}
  const status=message=>{$('ghostStatus').textContent=message;};
  function refresh(){try{exportGhost(draft);status('듀얼에 사용할 수 있는 고스트입니다.');}catch(e){status(e.message);}persist();}
  function renderSteps(){
    const script=draft.behavior.script;
    $('ghostStepCount').textContent=`${script.length}개`;
    $('ghostStepList').innerHTML=script.map((step,i)=>{
      const on=Object.hasOwn(names,step.on)?step.on:'SELECT_IDLECMD';
      const selecting=selectionRequests.has(on),options=actionsByRequest[on];
      return `<article class="ghost-step" data-step="${i}"><div class="ghost-step-head"><strong>${i+1}단계</strong><div><button class="mini" data-move="-1" aria-label="${i+1}단계 위로" ${i===0?'disabled':''}>↑</button><button class="mini" data-move="1" aria-label="${i+1}단계 아래로" ${i===script.length-1?'disabled':''}>↓</button><button class="mini" data-remove aria-label="${i+1}단계 삭제">삭제</button></div></div><div class="ghost-step-fields"><label>요청 종류<select data-field="on">${Object.entries(names).map(([key,label])=>`<option value="${key}" ${key===on?'selected':''}>${label} (${key})</option>`).join('')}</select></label>${selecting?`<label>선택 대상 번호 (쉼표로 구분)<input data-field="indices" inputmode="numeric" placeholder="예: 0, 2" value="${esc(step.indices?.join(', ')??'')}"></label>`:`<label>행동<select data-field="action"><option value="">첫 번째 가능한 선택</option>${options.map(a=>`<option value="${a}" ${step.action===a?'selected':''}>${actions[a]}</option>`).join('')}</select></label><label>카드 번호 (선택)<input data-field="card" type="number" min="1" step="1" list="ghostCards" placeholder="카드 번호" value="${esc(step.card??'')}"></label><label>선택 번호 (선택)<input data-field="choice" type="number" min="0" step="1" placeholder="0부터 시작" value="${esc(step.choice??'')}"></label>`}</div></article>`;
    }).join('')||'<p class="empty-deck">행동을 추가하세요. 행동이 없으면 기본 행동만 실행합니다.</p>';
    const ids=[...new Set([...draft.deck.main,...draft.deck.extra,...draft.deck.side])];
    $('ghostStepList').insertAdjacentHTML('beforeend',`<datalist id="ghostCards">${ids.map(code=>`<option value="${code}" label="${esc(cardNames[code]?.name??'')}"></option>`).join('')}</datalist>`);
    refresh();
  }
  $('ghostName').oninput=e=>{draft.name=e.target.value;refresh();};
  $('ghostDescription').oninput=e=>{draft.description=e.target.value;persist();};
  $('ghostDeck').onchange=e=>{deckSelection=e.target.value;const deck=deckSelection==='source'?source.deck:decks.find(d=>d.id===deckSelection);draft.deck=copyDeck(deck);renderSteps();};
  $('ghostFallback').onchange=e=>{draft.behavior.fallback=e.target.value;refresh();};
  $('ghostAdd').onclick=()=>{draft.behavior.script.push({on:'SELECT_IDLECMD',action:'summon'});renderSteps();$('ghostStepList').scrollTop=$('ghostStepList').scrollHeight;};
  $('ghostStepList').onclick=e=>{
    const button=e.target.closest('button'),row=button?.closest('[data-step]');if(!row)return;
    const i=Number(row.dataset.step),script=draft.behavior.script;
    if(button.hasAttribute('data-remove'))script.splice(i,1);
    else if(button.hasAttribute('data-move')){const j=i+Number(button.dataset.move);if(j<0||j>=script.length)return;[script[i],script[j]]=[script[j],script[i]];}
    else return;
    renderSteps();
  };
  function update(e){
    const field=e.target.dataset.field,row=e.target.closest('[data-step]');if(!field||!row)return;
    const step=draft.behavior.script[Number(row.dataset.step)],value=e.target.value;
    if(field==='on'){
      Object.keys(step).forEach(key=>delete step[key]);step.on=value;
      if(selectionRequests.has(value))step.indices=[0];else if(actionsByRequest[value].length)step.action=actionsByRequest[value][0];else step.choice=0;
      renderSteps();return;
    }
    if(field==='indices'){
      if(value.trim()){step.indices=value.split(',').map(s=>s.trim()===''?NaN:Number(s.trim()));}else delete step.indices;
    }else if(value==='')delete step[field];
    else step[field]=['card','choice'].includes(field)?Number(value):value;
    refresh();
  }
  $('ghostStepList').oninput=update;
  $('ghostStepList').onchange=update;
  $('ghostClose').onclick=()=>{persist();onClose();};
  $('ghostNew').onclick=()=>{if(draft.behavior.script.length&&!confirm('작성 중인 고스트를 비우고 새로 만들까요?'))return;draft=empty(decks.find(d=>d.id===deckSelection)??selectedDeck);deckSelection=selectedDeck.id;$('ghostDeck').value=deckSelection;$('ghostName').value=draft.name;$('ghostDescription').value='';$('ghostFallback').value='basic';renderSteps();};
  function ready(){try{return exportGhost(draft);}catch(e){status(e.message);return null;}}
  $('ghostSave').onclick=()=>{const ghost=ready();if(ghost)onSave(ghost);};
  $('ghostExport').onclick=()=>{
    const ghost=ready();if(!ghost)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(ghost,null,2)+'\n'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=filename(ghost.name);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    status('JSON을 내보냈습니다. 고스트 JSON 불러오기에서 사용할 수 있어요.');
  };
  renderSteps();
  loadCatalog().then(cards=>{cardNames=cards;root.querySelectorAll('#ghostCards option').forEach(option=>{option.label=cards[option.value]?.name??'';});}).catch(()=>{});
}
