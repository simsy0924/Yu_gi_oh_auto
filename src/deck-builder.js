import {validateDeck,parseDeck} from './decks.js';
import {loadCatalog,deckable,cardKind,cardStatKind,searchCards,races,attributes,kinds,addCard,exportDeck} from './catalog.js';
import {cardInfoHtml} from './card-info.js';
const DRAFT_KEY='ghost-duel.builder.draft.v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parts={main:'메인',extra:'엑스트라',side:'사이드'};
export async function openDeckBuilder(root,{source,onSave,onClose}) {
  let active=true,cards,rows=[],part='main',filters={query:'',effect:'',kind:'',race:'',attribute:'',statKind:'',statValue:''},page=0,sourceId=source?.id??null;
  let draft=source?{name:source.name,main:[...source.main],extra:[...source.extra],side:[...source.side]}:{name:'내 덱',main:[],extra:[],side:[]};
  if(!source)try{
    const saved=JSON.parse(localStorage.getItem(DRAFT_KEY));
    if(saved&&typeof saved.deck?.name==='string'&&['main','extra','side'].every(p=>Array.isArray(saved.deck[p])&&saved.deck[p].length<=({main:60,extra:15,side:15})[p]&&saved.deck[p].every(Number.isSafeInteger))) {draft=saved.deck;sourceId=typeof saved.sourceId==='string'?saved.sourceId:null;}
  }catch{}
  root.innerHTML=`<main class="screen deck-builder"><header class="builder-header"><div><h1>덱 만들기</h1><small>카드를 골라 넣고 JSON으로 내보내세요</small></div><button class="action" id="builderClose">덱 선택으로</button></header><p id="catalogLoading" role="status">카드 목록을 불러오는 중...</p></main>`;
  root.querySelector('#builderClose').onclick=()=>{active=false;onClose();};
  try{cards=await loadCatalog();if(!active)return;rows=Object.values(cards).filter(deckable).sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.code-b.code);}
  catch(e){if(active)root.querySelector('#catalogLoading').textContent=e.message;return;}
  root.innerHTML=`<main class="screen deck-builder"><header class="builder-header"><h1>덱 만들기</h1><label class="deck-name">덱 이름<input id="builderName" maxlength="80" value="${esc(draft.name)}"></label><div class="builder-tools"><button class="action" id="builderNew">새 덱</button><button class="action" id="builderClose">덱 선택으로</button></div></header><div class="builder-layout"><section class="card-search" aria-label="카드 검색"><div class="search-controls"><input id="cardSearch" type="search" placeholder="카드명 · 카드 번호" aria-label="카드명 또는 번호"><select id="cardFilter" aria-label="카드 종류"><option value="">모든 카드</option>${kinds.map(([name])=>`<option value="${name}">${name}</option>`).join('')}</select><button class="mini clear-filters" id="clearFilters" type="button" aria-label="검색 조건 초기화">초기화</button></div><div class="search-filters"><label>효과 텍스트<input id="effectSearch" type="search" placeholder="효과에 적힌 단어"></label><label>종족<select id="raceFilter"><option value="">전체</option>${races.map(([bit,name])=>`<option value="${bit}">${name}</option>`).join('')}</select></label><label>속성<select id="attributeFilter"><option value="">전체</option>${attributes.map(([bit,name])=>`<option value="${bit}">${name}</option>`).join('')}</select></label><label>수치 종류<select id="statKindFilter"><option value="">전체</option><option value="level">레벨</option><option value="rank">랭크</option><option value="link">링크</option></select></label><label>수치<input id="statValueFilter" type="number" min="1" max="99" step="1" inputmode="numeric" placeholder="전체"></label></div><p class="builder-help">메인/엑스트라는 자동 분류돼요. 사이드 탭에서는 사이드에 추가돼요.</p><div id="searchResults" class="search-results"></div><div class="search-paging" id="searchPaging"></div></section><section class="deck-workspace" aria-label="편집 중인 덱"><nav class="deck-tabs" id="deckTabs"></nav><div id="deckContents" class="deck-contents"></div><details class="builder-detail" open><summary>카드 정보</summary><div id="builderDetail">이름을 눌러 카드 효과를 확인하세요.</div></details></section></div><footer class="builder-footer"><div><p id="builderStatus" role="status"></p><small id="draftStatus">작성 내용은 이 기기에 자동 저장됩니다. 금제 검사는 적용하지 않습니다.</small></div><button class="action" id="builderUse">저장하고 사용</button><button class="primary" id="builderExport">JSON 내보내기</button></footer></main>`;
  const $=id=>root.querySelector('#'+id);
  const count=code=>[...draft.main,...draft.extra,...draft.side].filter(c=>(cards[c]?.alias||c)===(cards[code]?.alias||code)).length;
  const message=text=>{$('builderStatus').textContent=text;};
  const validate=()=>{try{validateDeck(draft,cards);return '';}catch(e){return e.message;}};
  function persist(){try{localStorage.setItem(DRAFT_KEY,JSON.stringify({sourceId,deck:draft}));}catch{$('draftStatus').textContent='기기 저장 공간에 쓸 수 없습니다. 완성한 덱을 JSON으로 내보내 주세요.';}}
  function inspect(code){$('builderDetail').innerHTML=cards[code]?cardInfoHtml(cards[code]):'카드 DB에 없는 번호입니다.';}
  function renderDeck(){
    $('deckTabs').innerHTML=Object.entries(parts).map(([p,name])=>`<button class="deck-tab ${p===part?'active':''}" data-part="${p}" aria-pressed="${p===part}">${name} ${draft[p].length}/${p==='main'?'40~60':'15'}</button>`).join('');
    const grouped=new Map();draft[part].forEach(code=>grouped.set(code,(grouped.get(code)||0)+1));
    $('deckContents').innerHTML=grouped.size?[...grouped].map(([code,n])=>`<div class="deck-entry"><button class="card-name" data-inspect="${code}">${esc(cards[code]?.name??code)}<small>${cards[code]?cardKind(cards[code]):'미수록'} · ${code}</small></button><button class="count-control" data-remove="${code}" aria-label="${esc(cards[code]?.name??code)} 한 장 빼기">−</button><b>${n}</b><button class="count-control" data-add="${code}" aria-label="${esc(cards[code]?.name??code)} 한 장 추가" ${count(code)>=3?'disabled':''}>+</button></div>`).join(''):'<p class="empty-deck">왼쪽 검색 결과의 + 버튼으로 카드를 추가하세요.</p>';
    const issue=validate();message(issue||'듀얼에 사용할 수 있는 덱입니다.');$('builderUse').disabled=!!issue;$('builderExport').disabled=!!issue;
  }
  function renderSearch(){
    const results=searchCards(rows,filters);
    const pages=Math.max(1,Math.ceil(results.length/40));page=Math.min(page,pages-1);
    $('searchResults').innerHTML=results.slice(page*40,(page+1)*40).map(c=>`<div class="search-card"><button class="card-name" data-inspect="${c.code}">${esc(c.name)}<small>${cardKind(c)} · ${c.code}${c.type&1?` · ${cardStatKind(c)==='link'?'LINK':cardStatKind(c)==='rank'?'랭크':'레벨'} ${c.level} · ATK ${c.attack}`:''}</small></button><span class="copy-count">${count(c.code)}/3</span><button class="count-control" data-add="${c.code}" aria-label="${esc(c.name)} 추가" ${count(c.code)>=3?'disabled':''}>+</button></div>`).join('')||'<p>검색 결과가 없습니다.</p>';
    $('searchPaging').innerHTML=`<button class="mini" id="searchPrev" ${page===0?'disabled':''}>이전</button><span>${results.length.toLocaleString()}장 · ${page+1}/${pages}</span><button class="mini" id="searchNext" ${page===pages-1?'disabled':''}>다음</button>`;
    $('searchPrev').onclick=()=>{page--;renderSearch();$('searchResults').scrollTop=0;};$('searchNext').onclick=()=>{page++;renderSearch();$('searchResults').scrollTop=0;};
  }
  function redraw(){const scroll=$('deckContents').scrollTop,searchScroll=$('searchResults').scrollTop;renderDeck();renderSearch();$('deckContents').scrollTop=scroll;$('searchResults').scrollTop=searchScroll;persist();}
  function edit(event){
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.inspect){inspect(Number(b.dataset.inspect));return;}
    if(b.dataset.part){part=b.dataset.part;renderDeck();return;}
    if(b.dataset.remove){const code=Number(b.dataset.remove),i=draft[part].indexOf(code);if(i>=0)draft[part].splice(i,1);redraw();return;}
    if(b.dataset.add)try{const c=cards[Number(b.dataset.add)];if(!c)throw new Error('카드 DB에 없는 카드입니다.');const target=addCard(draft,c,part,cards);if(part!=='side')part=target;inspect(c.code);redraw();}catch(e){message(e.message);}
  }
  $('searchResults').onclick=edit;$('deckContents').onclick=edit;$('deckTabs').onclick=edit;
  $('builderName').oninput=e=>{draft.name=e.target.value;persist();};
  for(const [id,key] of [['cardSearch','query'],['effectSearch','effect'],['cardFilter','kind'],['raceFilter','race'],['attributeFilter','attribute'],['statKindFilter','statKind'],['statValueFilter','statValue']]) {
    $(id).addEventListener(id.endsWith('Filter')&&id!=='statValueFilter'?'change':'input',e=>{filters[key]=e.target.value;page=0;renderSearch();});
  }
  $('clearFilters').onclick=()=>{filters={query:'',effect:'',kind:'',race:'',attribute:'',statKind:'',statValue:''};for(const id of ['cardSearch','effectSearch','cardFilter','raceFilter','attributeFilter','statKindFilter','statValueFilter'])$(id).value='';page=0;renderSearch();};
  $('builderClose').onclick=()=>{persist();active=false;onClose();};
  $('builderNew').onclick=()=>{if([...draft.main,...draft.extra,...draft.side].length&&!confirm('작성 중인 덱을 비우고 새 덱을 만들까요?'))return;draft={name:'내 덱',main:[],extra:[],side:[]};sourceId=null;part='main';$('builderName').value=draft.name;redraw();};
  $('builderUse').onclick=()=>{try{validateDeck(draft,cards);sourceId=sourceId&&sourceId!=='starter'?sourceId:crypto.randomUUID();persist();onSave({...exportDeck(draft,cards),id:sourceId});active=false;}catch(e){message(e.message);}};
  $('builderExport').onclick=()=>{
    try{validateDeck(draft,cards);const data=exportDeck(draft,cards);const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));a.href=url;a.download=(data.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').trim()||'deck')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('JSON을 내보냈습니다. 덱 불러오기에서 다시 사용할 수 있어요.');}catch(e){message(e.message);}
  };
  redraw();
}
