import createCore,{OcgDuelMode as D,OcgMessageType as M,OcgProcessResult as P,OcgResponseType as R,OcgQueryFlags as Q} from 'ocgcore-wasm';
import {validateDeck} from './decks.js';
import {makePrompt,requestTypes,selectionResponse} from './prompts.js';
export class DuelSession {
  static async create({cards,scripts,wasmBinary,you,ghost,seed=[1,2,3,4]}) {
    validateDeck(you,cards);validateDeck(ghost.deck,cards);
    const s=new DuelSession();Object.assign(s,{cards,scripts,lp:[8000,8000],turn:0,phase:0,active:0,logs:[],prompt:null,ended:false,issue:null});
    s.core=await createCore({sync:true,wasmBinary});
    const team={startingLP:8000,startingDrawCount:5,drawCountPerTurn:1};
    s.handle=s.core.createDuel({flags:D.MODE_MR5,seed:seed.map(BigInt),team1:team,team2:team,
      cardReader:code=>cards[code]?{...cards[code],race:BigInt(cards[code].race)}:null,
      scriptReader:name=>scripts[name]??null,
      errorHandler:(type,text)=>{if(type===0)s.issue=`카드 효과 실행 오류: ${text}`;s.log(text);}});
    if(!s.handle)throw new Error('듀얼 엔진을 초기화하지 못했습니다.');
    try {
      for(const name of ['constant.lua','utility.lua'])if(!s.core.loadScript(s.handle,name,scripts[name]))throw new Error(`${name} 로드 실패`);
      let rng=Number(seed[0])>>>0;const random=()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/4294967296;};
      [you,ghost.deck].forEach((source,team)=>{const deck={...source,main:[...source.main]};for(let i=deck.main.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck.main[i],deck.main[j]]=[deck.main[j],deck.main[i]];}for(const [part,location] of [['main',1],['extra',64]])for(const code of deck[part]??[])s.core.duelNewCard(s.handle,{code,team,duelist:0,controller:team,location,position:8,sequence:0});});
      s.core.startDuel(s.handle);s.advance();return s;
    }catch(e){s.destroy();throw e;}
  }
  log(text){this.logs.push(text);if(this.logs.length>40)this.logs.shift();}
  advance() {
    for(let tick=0;tick<10000;tick++) {
      const status=this.core.duelProcess(this.handle),messages=this.core.duelGetMessage(this.handle);
      for(const m of messages) {
        if(!m)throw new Error('코어 메시지를 해석할 수 없습니다.');
        if(m.type===M.RETRY)throw new Error('코어가 선택을 거부했습니다. 듀얼을 다시 시작하세요.');
        if(requestTypes.has(m.type))this.prompt=makePrompt(m,this.cards);
        if(m.type===M.NEW_TURN){this.turn++;this.active=m.player;this.log(`${this.turn}턴 · ${m.player===0?'YOU':'GHOST'}`);}
        if(m.type===M.NEW_PHASE)this.phase=m.phase;
        if(m.type===M.DAMAGE||m.type===M.PAY_LPCOST)this.lp[m.player]=Math.max(0,this.lp[m.player]-m.amount);
        if(m.type===M.RECOVER)this.lp[m.player]+=m.amount;
        if(m.type===M.LPUPDATE)this.lp[m.player]=m.lp;
        if(m.type===M.WIN){this.ended=true;this.winner=m.player;this.reason=m.reason;this.log(m.player===2?'무승부':`${m.player===0?'YOU':'GHOST'} 승리`);}
        if(m.type===M.CHAINING)this.log(`체인 ${m.chain_size} · ${this.cards[m.code]?.name??m.code}`);
      }
      if(this.issue)throw new Error(this.issue);
      if(status===P.END||this.ended){this.ended=true;this.prompt=null;return;}
      if(status===P.WAITING){if(this.prompt?.type==='SELECT_CHAIN' && this.prompt.choices.length===1 && this.prompt.choices[0].kind==='pass'){this.core.duelSetResponse(this.handle,{type:R.SELECT_CHAIN,index:null});this.prompt=null;continue;}if(!this.prompt)throw new Error('코어 입력 요청이 누락되었습니다.');return;}
    }
    throw new Error('듀얼 처리 횟수를 초과했습니다.');
  }
  respond(input) {
    if(this.ended||!this.prompt)throw new Error('현재 선택할 수 없습니다.');
    let response;
    if(input.indices)response=selectionResponse(this.prompt,input.indices);
    else response=this.prompt.choices.find(c=>c.id===String(input.choice))?.response;
    if(!response)throw new Error('유효하지 않은 행동입니다.');
    this.core.duelSetResponse(this.handle,response);this.prompt=null;this.advance();
  }
  snapshot() {
    const zones={};
    for(const controller of [0,1]) {
      zones[controller]={};
      for(const location of [1,2,4,8,16,32,64]) {
        const hidden=location===1||(controller===1&&(location===2||location===64));
        if(hidden){zones[controller][location]={count:this.core.duelQueryCount(this.handle,controller,location)};continue;}
        const list=this.core.duelQueryLocation(this.handle,{controller,location,flags:Q.CODE|Q.POSITION|Q.ATTACK|Q.DEFENSE|Q.LINK|Q.OVERLAY_CARD});
        zones[controller][location]={cards:list.map((c,sequence)=>{
          if(!c)return null;
          if(controller===1&&(c.position&10))return {sequence,position:c.position,hidden:true};
          const db=this.cards[c.code]??{};
          return {...c,sequence,name:db.name??String(c.code),desc:db.desc??'',link_marker:db.link_marker??0};
        })};
      }
    }
    return {zones,lp:this.lp,turn:this.turn,phase:this.phase,active:this.active,logs:this.logs,prompt:this.prompt,ended:this.ended,winner:this.winner};
  }
  destroy(){if(this.handle){this.core.destroyDuel(this.handle);this.handle=null;}}
}
