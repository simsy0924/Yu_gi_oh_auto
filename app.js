const root=document.getElementById("app");
const hand=n=>Array.from({length:n},()=>'<div class="hand-card"></div>').join("");
const zones=(player,kind)=>Array.from({length:5},(_,i)=>'<button class="zone '+(player===2?'top-card':'')+'" aria-label="P'+player+' '+kind+' '+(i+1)+'"></button>').join("");
const piles=(player,left)=>{const top=player===2?' top-card':'';const items=left?(player===2?[["EXTRA",15],["GY",0]]:[["GY",0],["EXTRA",15]]):(player===2?[["DECK",40],["BAN",0]]:[["BAN",0],["DECK",40]]);return '<div class="pile-stack">'+items.map(([n,c])=>'<button class="pile'+top+'"><span>'+n+'</span><b>'+c+'</b></button>').join("")+'</div>'};
root.innerHTML=`
<div class="portrait"><div class="rotate">↻</div><strong>가로 화면으로 돌려주세요</strong><span>모바일 가로 화면을 기준으로 만든 듀얼 UI입니다.</span></div>
<main class="app">
<header class="topbar">
  <div class="brand"><span class="brand-badge">YG</span><div class="brand-text"><strong>Duel Sandbox</strong><small>prototype</small></div></div>
  <div class="center-controls"><button id="turn" class="control">TURN 1</button><button id="phase" class="control phase">MAIN 1</button></div>
  <div class="right-controls"><button id="priorityBtn" class="control">⇅ 우선권</button><button id="viewBtn" class="control">↻ 시점</button></div>
</header>
<section id="shell" class="duel-shell">
  <aside class="side-hud" data-player="2"><div class="player-label"><span class="dot"></span>P2</div><button class="lp">8000</button></aside>
  <div class="board">
    <section class="player-field top" data-player="2">
      <div class="hand top">${hand(5)}</div>
      ${piles(2,true)}
      <div class="zones"><div class="zone-row">${zones(2,"monster")}</div><div class="zone-row">${zones(2,"spell")}</div></div>
      ${piles(2,false)}
    </section>
    <div class="center-line"><button class="extra left"></button><div class="priority"><span>PRIORITY</span><b id="priorityText">P1</b></div><button class="extra right"></button></div>
    <section class="player-field bottom active" data-player="1">
      ${piles(1,true)}
      <div class="zones"><div class="zone-row">${zones(1,"spell")}</div><div class="zone-row">${zones(1,"monster")}</div></div>
      ${piles(1,false)}
      <div class="hand bottom">${hand(5)}</div>
    </section>
  </div>
  <aside class="side-hud active" data-player="1"><div class="player-label"><span class="dot"></span>P1</div><button class="lp">8000</button></aside>
</section>
<nav class="dock">
  <button><span>↶</span><small>Undo</small></button>
  <button><span>↷</span><small>Redo</small></button>
  <button><span>＋</span><small>Card</small></button>
  <button><span>▣</span><small>State</small></button>
  <button><span>⋯</span><small>More</small></button>
</nav>
</main>`;

let priority=1,view=1,turn=1,phase=2;
const phases=["DRAW","STANDBY","MAIN 1","BATTLE","MAIN 2","END"];
const shell=document.getElementById("shell"),priorityText=document.getElementById("priorityText"),turnBtn=document.getElementById("turn"),phaseBtn=document.getElementById("phase");

function renderPriority(){
  priorityText.textContent="P"+priority;
  document.querySelectorAll(".side-hud").forEach(x=>x.classList.toggle("active",Number(x.dataset.player)===priority));
  document.querySelectorAll(".player-field").forEach(x=>x.classList.toggle("active",Number(x.dataset.player)===priority));
}
document.getElementById("priorityBtn").onclick=()=>{priority=priority===1?2:1;renderPriority()};
document.getElementById("viewBtn").onclick=()=>{view=view===1?2:1;shell.classList.toggle("view-p2",view===2)};
turnBtn.onclick=()=>{turn++;turnBtn.textContent="TURN "+turn;phase=0;phaseBtn.textContent=phases[phase];priority=turn%2?1:2;renderPriority()};
phaseBtn.onclick=()=>{phase=(phase+1)%phases.length;phaseBtn.textContent=phases[phase]};
renderPriority();
