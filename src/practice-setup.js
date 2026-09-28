import {loadCatalog,searchCards,kinds,cardKind} from './catalog.js';
import {deckWithStartingHand,randomStartingHand,startingHandChoices} from './practice.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const themeToggle=()=>{const label=document.documentElement.dataset.theme==='light'?'다크 모드':'라이트 모드';return `<button class="mini theme-toggle" type="button" aria-label="${label}로 전환" title="${label}로 전환">${label}</button>`;};

export async function openPracticeSetup(root,{deck,mode,onClose,onStart}) {
  let active=true,cards,rows=[],hand=[],handMode='random',randomKind='',query='',kind='';
  root.innerHTML=`<main class="screen practice-builder"><header class="builder-header"><div><h1>${mode==='ghost-create'?'고스트 생성':'전개 연습'} 설정</h1><small>${esc(deck.name)} · 메인 덱 ${deck.main.length}장</small></div><div class="builder-tools">${themeToggle()}<button class="action" id="practiceClose">취소</button></div></header><p class="practice-loading" id="practiceLoading" role="status">카드 목록을 불러오는 중...</p></main>`;
  root.querySelector('#practiceClose').onclick=()=>{active=false;onClose();};
  try{cards=await loadCatalog();if(!active)return;rows=startingHandChoices(deck,cards);}
  catch(e){if(active)root.querySelector('#practiceLoading').textContent=e.message;return;}
  root.innerHTML=`<main class="screen practice-builder"><header class="builder-header"><div><h1>${mode==='ghost-create'?'고스트 생성':'전개 연습'} 설정</h1><small>${esc(deck.name)} · 메인 덱 ${deck.main.length}장</small></div><div class="builder-tools">${themeToggle()}<button class="action" id="practiceClose">취소</button></div></header><nav class="practice-modes"><button class="deck-tab active" data-hand-mode="random">무작위 시작 패</button><button class="deck-tab" data-hand-mode="fixed">시작 패 지정</button></nav><section class="practice-options"><div id="randomOptions"><h2>덱에서 무작위로 시작</h2><p>선택한 종류의 카드 중에서 시작 패 ${5}장을 뽑습니다.</p><label>무작위 대상<select id="randomKind"><option value="">덱 전체</option><option value="몬스터">몬스터</option><option value="마법">마법</option><option value="함정">함정</option></select></label></div><div id="fixedOptions" hidden><h2>원하는 카드와 매수 지정</h2><p>선택한 덱의 메인 덱 카드만 표시합니다. 덱에 든 매수 안에서 시작 패를 1~5장 고르세요.</p><div class="practice-picker"><section class="practice-search"><div class="search-controls"><input id="practiceSearch" type="search" placeholder="덱 카드명 또는 번호" aria-label="덱 카드명 또는 번호"><select id="practiceKind" aria-label="카드 종류"><option value="">모든 카드</option>${kinds.map(([name])=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select></div><div class="search-paging" id="practiceSummary"></div><div class="search-results" id="practiceResults"></div></section><section class="practice-hand"><h2>지정한 시작 패 <span id="handCount">0/5</span></h2><div id="practiceHand"></div></section></div></div></section><footer class="builder-footer"><div><p id="practiceStatus" role="status"></p><small>${mode==='ghost-create'?'연습 중 선택한 행동으로 고스트 초안을 만듭니다.':'선택한 덱 카드와 매수 그대로 시작 패를 고정합니다.'}</small></div><button class="primary" id="practiceStart">${mode==='ghost-create'?'기록 시작':'연습 시작'}</button></footer></main>`;
  const $=id=>root.querySelector('#'+id);
  $('practiceClose').onclick=()=>{active=false;onClose();};
  function status(message){$('practiceStatus').textContent=message;}
  function renderResults(){
    const results=searchCards(rows,{query,kind});
    $('practiceSummary').textContent=`${results.length}종 · 메인 덱 ${deck.main.length}장`;
    $('practiceResults').innerHTML=results.map(c=>{
      const selected=hand.filter(code=>code===c.code).length;
      const disabled=hand.length>=5||selected>=c.deckCopies;
      return `<div class="search-card"><span class="card-name">${esc(c.name)}<small>${cardKind(c)} · 덱 ${c.deckCopies}장</small></span><button class="count-control" data-add="${c.code}" aria-label="${esc(c.name)} 시작 패에 추가" ${disabled?'disabled':''}>+</button></div>`;
    }).join('')||'<p class="empty-deck">선택한 덱에서 찾을 수 있는 카드가 없습니다.</p>';
  }

  function renderHand(){
    $('handCount').textContent=`${hand.length}/5`;
    const grouped=new Map();hand.forEach(code=>grouped.set(code,(grouped.get(code)??0)+1));
    $('practiceHand').innerHTML=grouped.size?[...grouped].map(([code,count])=>{
      const available=rows.find(card=>card.code===code)?.deckCopies??0;
      return `<div class="deck-entry"><span class="card-name">${esc(cards[code]?.name??code)}<small>${cardKind(cards[code]??{})} · 덱 ${available}장</small></span><button class="count-control" data-remove="${code}" aria-label="${esc(cards[code]?.name??code)} 시작 패에서 빼기">−</button><b>${count}/${available}</b></div>`;
    }).join(''):'<p class="empty-deck">왼쪽 덱 목록에서 카드를 고르세요.</p>';
    $('practiceResults').querySelectorAll('[data-add]').forEach(button=>{
      const code=Number(button.dataset.add),available=rows.find(card=>card.code===code)?.deckCopies??0;
      button.disabled=hand.length>=5||hand.filter(item=>item===code).length>=available;
    });
  }

  root.querySelector('.practice-modes').onclick=e=>{
    const button=e.target.closest('[data-hand-mode]');if(!button)return;
    handMode=button.dataset.handMode;
    root.querySelectorAll('[data-hand-mode]').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));});
    $('randomOptions').hidden=handMode!=='random';$('fixedOptions').hidden=handMode!=='fixed';status('');
  };
  $('practiceResults').onclick=e=>{const button=e.target.closest('[data-add]');if(!button)return;const code=Number(button.dataset.add),available=rows.find(card=>card.code===code)?.deckCopies??0;if(hand.length>=5)return;if(hand.filter(item=>item===code).length>=available){status('덱에 포함된 매수를 넘겨 시작 패에 넣을 수 없습니다.');return;}hand.push(code);renderHand();status('');};
  $('practiceHand').onclick=e=>{const button=e.target.closest('[data-remove]');if(!button)return;const code=Number(button.dataset.remove),index=hand.indexOf(code);if(index>=0)hand.splice(index,1);renderHand();status('');};
  $('practiceSearch').oninput=e=>{query=e.target.value;renderResults();};$('practiceKind').onchange=e=>{kind=e.target.value;renderResults();};$('randomKind').onchange=e=>{randomKind=e.target.value;};
  $('practiceStart').onclick=()=>{
    try{
      let startingHand=null,scenarioDeck=deck;
      if(handMode==='fixed'){
        scenarioDeck=deckWithStartingHand(deck,hand,cards);startingHand=[...hand];
      }else if(randomKind)startingHand=randomStartingHand(deck,cards,{kind:randomKind});
      active=false;onStart({deck:scenarioDeck,startingHand,handNames:(startingHand??[]).map(code=>cards[code]?.name??String(code)),fixed:handMode==='fixed'});
    }catch(e){status(e.message);}
  };
  renderResults();renderHand();
}
