import {DuelSession} from './session.js';
import {ghostChoice} from './prompts.js';
import wasmUrl from 'ocgcore-wasm/lib/ocgcore.sync.wasm?url';
let session, assets,behavior,cursor=0,paused=false,timer=null,revision=0;
const post=(type,data={})=>self.postMessage({type,...data});
async function bundle(url){
  const r=await fetch(url);if(!r.ok)throw new Error(`엔진 데이터 로드 실패 (${r.status})`);
  return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
}
function publish(){
  const state=session.snapshot();state.paused=paused;state.revision=++revision;
  if(state.prompt?.player===1) {
    const decision=ghostChoice(state.prompt,behavior,cursor);state.ghostBlocked=decision.blocked;
    // Only the worker holds the opponent's available actions and hand identities.
    state.prompt={player:1,title:decision.blocked??'고스트가 생각하는 중...',type:state.prompt.type,choices:[]};
    if(!decision.blocked&&!paused&&!state.ended)timer=setTimeout(()=>actGhost(),350);
  }
  post('state',{state});
}
function actGhost(){try{clearTimeout(timer);if(!session||session.ended||session.prompt?.player!==1)return;const d=ghostChoice(session.prompt,behavior,cursor);if(d.blocked)throw new Error(d.blocked);cursor=d.cursor??cursor;session.respond(d);publish();}catch(e){post('error',{message:e.message});}}
self.onmessage=async({data:m})=>{
  try {
    if(m.type==='start') {
      clearTimeout(timer);session?.destroy();session=null;cursor=0;paused=false;behavior=m.ghost.behavior??{};
      post('loading',{message:'듀얼 엔진과 카드 데이터를 불러오는 중...'});
      assets??=Promise.all([bundle(new URL('engine/cards.json.gz',m.base)),bundle(new URL('engine/scripts.json.gz',m.base)),fetch(wasmUrl).then(r=>{if(!r.ok)throw new Error('WASM 로드 실패');return r.arrayBuffer();})]);
      const [cards,scripts,wasmBinary]=await assets;
      const ko=await bundle(new URL('engine/ko.json.gz',m.base));for(const [code,text] of Object.entries(ko))if(cards[code])Object.assign(cards[code],text);
      session=await DuelSession.create({cards,scripts,wasmBinary,you:m.you,ghost:m.ghost,seed:m.seed});publish();
    } else if(m.type==='respond') {
      if(m.revision!==revision||session?.prompt?.player!==0)return;
      clearTimeout(timer);session.respond(m);publish();
    } else if(m.type==='pause') {clearTimeout(timer);paused=!paused;publish();}
    else if(m.type==='step') {if(paused)actGhost();}
  }catch(e){clearTimeout(timer);post('error',{message:e.message});}
};
