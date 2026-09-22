const root=document.getElementById("app");

const ghostPacks=[
  {id:"sample",name:"Sample Ghost",desc:"기본 고스트 패키지",tag:"DEMO"},
  {id:"empty",name:"Empty Slot",desc:"고스트 패키지를 추가할 자리",tag:"—"}
];
const myDecks=[
  {id:"deck1",name:"My Deck",desc:"내 덱 데이터 자리",tag:"40"},
  {id:"deck2",name:"Test Deck",desc:"테스트용 덱 슬롯",tag:"40"}
];

let selectedGhost="sample";
let selectedDeck="deck1";

const hand=n=>Array.from({length:n},()=>'<div class="cardback"></div>').join("");
const zones=ghost=>Array.from({length:5},()=>'<button class="zone '+(ghost?'rot':'')+'"></button>').join("");
const piles=ghost=>'<div class="pile-stack">'+
  '<div class="pile '+(ghost?'rot':'')+'"><span>GY</span><b>0</b></div>'+
  '<div class="pile '+(ghost?'rot':'')+'"><span>EXTRA</span><b>15</b></div>'+
  '</div>';

function renderSetup(){
  root.innerHTML=`
    <div class="portrait"><div class="rotate">↻</div><strong>가로 화면으로 돌려주세요</strong><span>Ghost Duel은 모바일 가로 화면을 기준으로 만들고 있습니다.</span></div>
    <main class="screen setup">
      <header>
        <div class="brand"><div class="brand-mark">GD</div><div><h1>Ghost Duel</h1><p>고스트와 연습하는 1인용 듀얼</p></div></div>
      </header>
      <section class="setup-grid">
        <div class="picker"><h2>고스트 선택</h2><div class="list" id="ghostList"></div></div>
        <div class="picker"><h2>내 덱 선택</h2><div class="list" id="deckList"></div></div>
      </section>
      <footer class="setup-footer">
        <div class="selection">Ghost: <b id="ghostPicked"></b> / Deck: <b id="deckPicked"></b></div>
        <button class="primary" id="startBtn">DUEL START</button>
      </footer>
    </main>`;
  const ghostList=document.getElementById("ghostList");
  const deckList=document.getElementById("deckList");

  ghostList.innerHTML=ghostPacks.map(x=>`
    <button class="item ghost ${x.id===selectedGhost?"active":""}" data-id="${x.id}">
      <div class="thumb"></div><div><strong>${x.name}</strong><small>${x.desc}</small></div><span class="badge">${x.tag}</span>
    </button>`).join("");

  deckList.innerHTML=myDecks.map(x=>`
    <button class="item ${x.id===selectedDeck?"active":""}" data-id="${x.id}">
      <div class="thumb"></div><div><strong>${x.name}</strong><small>${x.desc}</small></div><span class="badge">${x.tag}</span>
    </button>`).join("");

  ghostList.onclick=e=>{const b=e.target.closest(".item");if(!b)return;selectedGhost=b.dataset.id;renderSetup()};
  deckList.onclick=e=>{const b=e.target.closest(".item");if(!b)return;selectedDeck=b.dataset.id;renderSetup()};
  document.getElementById("ghostPicked").textContent=ghostPacks.find(x=>x.id===selectedGhost).name;
  document.getElementById("deckPicked").textContent=myDecks.find(x=>x.id===selectedDeck).name;
  document.getElementById("startBtn").onclick=renderDuel;
}

function renderDuel(){
  const ghost=ghostPacks.find(x=>x.id===selectedGhost);
  root.innerHTML=`
    <div class="portrait"><div class="rotate">↻</div><strong>가로 화면으로 돌려주세요</strong><span>Ghost Duel은 모바일 가로 화면을 기준으로 만들고 있습니다.</span></div>
    <main class="screen duel">
      <header class="topbar">
        <div class="top-left"><div class="ghost-name"><span>GHOST</span> · ${ghost.name}</div></div>
        <div class="top-center"><button class="status">WAITING FOR ENGINE</button></div>
        <div class="top-right"><button class="mini" id="exitTop">종료</button></div>
      </header>
      <section class="board-wrap">
        <aside class="hud"><div class="who ghost">GHOST</div><div class="lp">8000</div></aside>
        <div class="board">
          <section class="player-field ghost-side">
            <div class="hand top">${hand(5)}</div>
            ${piles(true)}
            <div class="zones"><div class="zone-row">${zones(true)}</div><div class="zone-row">${zones(true)}</div></div>
            <div class="pile-stack"><div class="pile rot"><span>DECK</span><b>40</b></div><div class="pile rot"><span>BAN</span><b>0</b></div></div>
          </section>
          <div class="center-line"><button class="extra"></button><div class="ghost-state">Ghost status: <b>idle</b></div><button class="extra"></button></div>
          <section class="player-field you-side">
            ${piles(false)}
            <div class="zones"><div class="zone-row">${zones(false)}</div><div class="zone-row">${zones(false)}</div></div>
            <div class="pile-stack"><div class="pile"><span>BAN</span><b>0</b></div><div class="pile"><span>DECK</span><b>40</b></div></div>
            <div class="hand bottom">${hand(5)}</div>
          </section>
        </div>
        <aside class="hud"><div class="who">YOU</div><div class="lp">8000</div></aside>
      </section>
      <footer class="duel-footer">
        <div class="hint">현재는 Ghost Duel UI 뼈대만 구현됨</div>
        <div class="actions"><button class="action">일시정지</button><button class="action primary-action">고스트 진행</button></div>
        <button class="action exit" id="exitBottom">듀얼 종료</button>
      </footer>
    </main>`;
  document.getElementById("exitTop").onclick=renderSetup;
  document.getElementById("exitBottom").onclick=renderSetup;
}

renderSetup();
