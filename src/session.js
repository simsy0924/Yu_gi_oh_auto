import createCore,{OcgDuelMode as D,OcgMessageType as M,OcgProcessResult as P,OcgResponseType as R,OcgQueryFlags as Q} from 'ocgcore-wasm';
import {validateDeck} from './decks.js';
import {makePrompt,requestTypes,selectionResponse,counterResponse} from './prompts.js';
import {isHiddenZoneForViewer,promptForViewer} from './duel-visibility.js';
import {describeChain} from './duel-log.js';

function coreCompatibleChainScript(scripts){
  const source=scripts['chain.lua'];
  const marker='return Duel.GetChainInfo(ch or 0,info)';
  if(typeof source!=='string'||!source.includes(marker))throw new Error('체인 스크립트가 예상한 형식과 다릅니다.');
  const unsupported=['CHAININFO_TRIGGERING_LINK','CHAININFO_TRIGGERING_LSCALE','CHAININFO_TRIGGERING_RSCALE'];
  const guard=`if ${unsupported.map(flag=>`info==${flag}`).join(' or ')} then return nil end\n\t\t${marker}`;
  return source.replace(marker,guard);
}

function viewerPlayer(corePlayer,userCorePlayer){
  if(corePlayer===0||corePlayer===1)return corePlayer===userCorePlayer?0:1;
  return corePlayer;
}

function viewerMessage(value,userCorePlayer,key=''){
  if((key==='player'||key==='controller'||key==='team')&&Number.isInteger(value))return viewerPlayer(value,userCorePlayer);
  if(Array.isArray(value))return value.map(item=>viewerMessage(item,userCorePlayer));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,viewerMessage(item,userCorePlayer,name)]));
  return value;
}

export class DuelSession {
  static async create({cards,scripts,wasmBinary,you,ghost,seed=[1,2,3,4],startingHand=null,firstPlayer=0,playerNames=['나','고스트']}) {
    validateDeck(you,cards);validateDeck(ghost.deck,cards);
    if(firstPlayer!==0&&firstPlayer!==1)throw new Error('선공 플레이어 설정이 올바르지 않습니다.');
    const chainScript=coreCompatibleChainScript(scripts);
    // ocgcore starts core player 0; assign that seat to the requested first player and remap public views.
    const s=new DuelSession();Object.assign(s,{cards,scripts,userCorePlayer:firstPlayer,playerNames,lp:[8000,8000],turn:0,phase:0,active:0,logs:[],prompt:null,ended:false,issue:null,confirmation:null,confirmationByPlayer:{0:null,1:null},confirmationSerial:0,confirmationSerialByPlayer:{0:0,1:0},knownCardsByViewer:{0:[],1:[]},publicCards:[]});
    s.core=await createCore({sync:true,wasmBinary});
    const team={startingLP:8000,startingDrawCount:5,drawCountPerTurn:1};
    const userTeam=startingHand?.length?{...team,startingDrawCount:startingHand.length}:team;
    const ghostTeam=ghost.startingHand?.length?{...team,startingDrawCount:ghost.startingHand.length}:team;
    const coreTeams=[];coreTeams[s.corePlayer(0)]=userTeam;coreTeams[s.corePlayer(1)]=ghostTeam;
    s.handle=s.core.createDuel({flags:D.MODE_MR5,seed:seed.map(BigInt),team1:coreTeams[0],team2:coreTeams[1],
      cardReader:code=>cards[code]?{...cards[code],race:BigInt(cards[code].race)}:null,
      scriptReader:name=>name==='chain.lua'?chainScript:scripts[name]??null,
      errorHandler:(type,text)=>{if(type===0)s.issue=`카드 효과 실행 오류: ${text}`;s.log(text);}});
    if(!s.handle)throw new Error('듀얼 엔진을 초기화하지 못했습니다.');
    try {
      for(const name of ['constant.lua','utility.lua'])if(!s.core.loadScript(s.handle,name,scripts[name]))throw new Error(`${name} 로드 실패`);
      let rng=Number(seed[0])>>>0;const random=()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/4294967296;};
      [[0,you,startingHand],[1,ghost.deck,ghost.startingHand]].forEach(([viewer,source,opening])=>{
        const team=s.corePlayer(viewer);
        const deck={...source,main:[...source.main]};
        if(opening?.length){
          for(const code of opening){const index=deck.main.indexOf(code);if(index<0)throw new Error(`고정 시작 패에 ${code} 카드가 덱에 없습니다.`);deck.main.splice(index,1);}
          for(const code of opening)s.core.duelNewCard(s.handle,{code,team,duelist:0,controller:team,location:1,position:8,sequence:0});
          for(const code of deck.main)s.core.duelNewCard(s.handle,{code,team,duelist:0,controller:team,location:1,position:8,sequence:1});
        }else{
          for(let i=deck.main.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck.main[i],deck.main[j]]=[deck.main[j],deck.main[i]];}
          for(const code of deck.main)s.core.duelNewCard(s.handle,{code,team,duelist:0,controller:team,location:1,position:8,sequence:0});
        }
        for(const code of deck.extra??[])s.core.duelNewCard(s.handle,{code,team,duelist:0,controller:team,location:64,position:8,sequence:0});
      });
      s.core.startDuel(s.handle);s.advance();return s;
    }catch(e){s.destroy();throw e;}
  }
  corePlayer(viewer){return viewer===0?this.userCorePlayer:1-this.userCorePlayer;}
  log(text){(this.logs??=[]).push(text);}
  rememberKnownCard(viewer,card){
    if(![0,1].includes(viewer)||!Number.isInteger(Number(card?.code))||![0,1].includes(card?.controller)||!Number.isInteger(card?.location)||!Number.isInteger(card?.sequence))return;
    this.knownCardsByViewer??={0:[],1:[]};this.knownCardsByViewer[viewer]??=[];
    const known={code:Number(card.code),controller:card.controller,location:card.location,sequence:card.sequence,...(Number.isInteger(card.position)?{position:card.position}:{})};
    const index=this.knownCardsByViewer[viewer].findIndex(item=>item.code===known.code&&item.controller===known.controller&&item.location===known.location&&item.sequence===known.sequence);
    if(index<0)this.knownCardsByViewer[viewer].push(known);else this.knownCardsByViewer[viewer][index]=known;
  }
  rememberPublicCard(card){
    if(!Number.isInteger(Number(card?.code))||![0,1].includes(card?.controller)||!Number.isInteger(card?.location)||!Number.isInteger(card?.sequence))return;
    for(const viewer of [0,1])this.rememberKnownCard(viewer,card);
    this.publicCards??=[];
    const known={code:Number(card.code),controller:card.controller,location:card.location,sequence:card.sequence,...(Number.isInteger(card.position)?{position:card.position}:{})};
    const index=this.publicCards.findIndex(item=>item.code===known.code&&item.controller===known.controller&&item.location===known.location&&item.sequence===known.sequence);
    if(index<0)this.publicCards.push(known);else this.publicCards[index]=known;
  }
  recordMovement(message){
    const {from,to}=message??{},code=Number(message?.card);
    if(!from||!to||!Number.isInteger(code))return false;
    const matches=item=>item.code===code&&item.controller===from.controller&&item.location===from.location&&item.sequence===from.sequence;
    const wasPublic=(this.publicCards??[]).some(matches);
    for(const source of this.pendingDeckSelection??[]){
      const isMoving=source.code===code&&source.controller===from.controller&&source.location===from.location&&source.sequence===from.sequence;
      if(isMoving){Object.assign(source,to);continue;}
      if(from.location===1&&source.location===1&&source.controller===from.controller&&source.sequence>from.sequence)source.sequence--;
      if(to.location===1&&source.location===1&&source.controller===to.controller&&source.sequence>=to.sequence)source.sequence++;
    }
    const move=list=>{
      const index=list.findIndex(matches),moving=index<0?null:list[index];
      if(from.location===1)for(const item of list)if(item!==moving&&item.controller===from.controller&&item.location===1&&item.sequence>from.sequence)item.sequence--;
      if(to.location===1)for(const item of list)if(item!==moving&&item.controller===to.controller&&item.location===1&&item.sequence>=to.sequence)item.sequence++;
      if(!moving)return;
      if(!Number.isInteger(to.location)||to.location===0){list.splice(index,1);return;}
      Object.assign(moving,to,{code});
    };
    this.knownCardsByViewer??={0:[],1:[]};
    for(const viewer of [0,1]){this.knownCardsByViewer[viewer]??=[];move(this.knownCardsByViewer[viewer]);}
    this.publicCards??=[];move(this.publicCards);
    return wasPublic;
  }
  clearKnownCards(controller,location){
    for(const viewer of [0,1])if(this.knownCardsByViewer?.[viewer])this.knownCardsByViewer[viewer]=this.knownCardsByViewer[viewer].filter(card=>card.controller!==controller||card.location!==location);
    if(this.publicCards)this.publicCards=this.publicCards.filter(card=>card.controller!==controller||card.location!==location);
  }
  recordConfirmation(message) {
    if(![0,1].includes(message.player)||!Array.isArray(message.cards))return;
    this.confirmationByPlayer??={0:this.confirmation??null,1:null};
    this.confirmationSerialByPlayer??={0:this.confirmationSerial??0,1:0};
    const cards=message.cards.map(card=>{
      const db=this.cards?.[card.code]??{};
      return {
        code:card.code,controller:card.controller,location:card.location,sequence:card.sequence,
        name:db.name??String(card.code),desc:db.desc??'',type:db.type??0,race:db.race??'0',
        attribute:db.attribute??0,level:db.level??0,lscale:db.lscale??0,rscale:db.rscale??0,
        link_marker:db.link_marker??0,attack:db.attack,defense:db.defense,
        originalAttack:db.attack,originalDefense:db.defense
      };
    });
    const deckReveal=message.type===M.CONFIRM_DECKTOP||message.type===M.CONFIRM_EXTRATOP;
    const publicCards=deckReveal?cards:cards.filter(card=>card.controller!==message.player);
    for(const card of cards){
      if(deckReveal||card.controller!==message.player)this.rememberPublicCard(card);
      else this.rememberKnownCard(message.player,card);
    }
    const recipients=deckReveal?[0,1]:[message.player];
    for(const viewer of recipients){
      const confirmation={id:++this.confirmationSerialByPlayer[viewer],type:M[message.type]??String(message.type),cards};
      this.confirmationByPlayer[viewer]=confirmation;
      if(viewer===0){this.confirmationSerial=this.confirmationSerialByPlayer[0];this.confirmation=confirmation;}
    }
    if(deckReveal&&publicCards.length)this.log(`${message.type===M.CONFIRM_DECKTOP?'덱 위 공개':'엑스트라 덱 위 공개'} · ${publicCards.map(card=>card.name).join(', ')}`);
    else if(publicCards.length)this.log(`카드 공개 · ${publicCards.map(card=>card.name).join(', ')}`);
  }
  advance() {
    for(let tick=0;tick<10000;tick++) {
      const status=this.core.duelProcess(this.handle),messages=this.core.duelGetMessage(this.handle);
      for(const raw of messages) {
        if(!raw)throw new Error('코어 메시지를 해석할 수 없습니다.');
        const m=viewerMessage(raw,this.userCorePlayer);
        if(m.type===M.RETRY)throw new Error('코어가 선택을 거부했습니다. 듀얼을 다시 시작하세요.');
        if(requestTypes.has(m.type))this.prompt=makePrompt(m,this.cards);
        if([M.CONFIRM_CARDS,M.CONFIRM_DECKTOP,M.CONFIRM_EXTRATOP].includes(m.type))this.recordConfirmation(m);
        if(m.type===M.MOVE){
          const selectedFromDeck=(this.pendingDeckSelection??[]).some(source=>source.code===Number(m.card)&&source.location===1&&source.controller===m.from?.controller&&source.sequence===m.from?.sequence);
          const wasPublic=this.recordMovement(m);
          if(m.from?.location===1&&m.to?.location===2&&(wasPublic||selectedFromDeck))this.log(`덱 → 패 · ${wasPublic?this.cards[m.card]?.name??'공개된 카드':'카드 1장'}`);
        }
        if(m.type===M.SHUFFLE_DECK)this.clearKnownCards(m.player,1);
        if(m.type===M.SHUFFLE_HAND)this.clearKnownCards(m.player,2);
        if(m.type===M.NEW_TURN){this.turn++;this.active=m.player;this.log(`${this.turn}턴 · ${this.playerNames[m.player]??`플레이어 ${m.player+1}`}`);}
        if(m.type===M.NEW_PHASE)this.phase=m.phase;
        if(m.type===M.DAMAGE||m.type===M.PAY_LPCOST)this.lp[m.player]=Math.max(0,this.lp[m.player]-m.amount);
        if(m.type===M.RECOVER)this.lp[m.player]+=m.amount;
        if(m.type===M.LPUPDATE)this.lp[m.player]=m.lp;
        if(m.type===M.WIN){this.ended=true;this.winner=m.player;this.reason=m.reason;this.log(m.player===2?'무승부':`${this.playerNames[m.player]??`플레이어 ${m.player+1}`} 승리`);}
        if(m.type===M.CHAINING){if(m.location===2)this.rememberPublicCard({code:m.code,controller:m.controller,location:m.location,sequence:m.sequence,position:m.position});this.log(describeChain(m,this.cards));}
      }
      if(this.issue)throw new Error(this.issue);
      if(status===P.END||this.ended){this.ended=true;this.prompt=null;return;}
      if(status===P.WAITING){if(this.prompt?.type==='SELECT_CHAIN' && this.prompt.choices.length===1 && this.prompt.choices[0].kind==='pass'){this.core.duelSetResponse(this.handle,{type:R.SELECT_CHAIN,index:null});this.prompt=null;continue;}if(!this.prompt)throw new Error('코어 입력 요청이 누락되었습니다.');return;}
    }
    throw new Error('듀얼 처리 횟수를 초과했습니다.');
  }
  respond(input) {
    if(this.ended||!this.prompt)throw new Error('현재 선택할 수 없습니다.');
    const selectedOptions=Array.isArray(input?.indices)?input.indices.map(id=>this.prompt.selection?.options?.find(option=>String(option.id)===String(id))).filter(Boolean):input?.choice!==undefined?[this.prompt.choices.find(choice=>choice.id===String(input.choice))].filter(Boolean):[];
    this.pendingDeckSelection=selectedOptions.filter(option=>option.source?.location===1).map(option=>({...option.source,code:Number(option.card)}));
    let response;
    try{
      if(Object.hasOwn(input,'counters'))response=counterResponse(this.prompt,input.counters);
      else if(Object.hasOwn(input,'indices'))response=selectionResponse(this.prompt,input.indices);
      else response=this.prompt.choices.find(c=>c.id===String(input.choice))?.response;
      if(!response)throw new Error('유효하지 않은 행동입니다.');
      if(response.places)response={...response,places:response.places.map(place=>({...place,player:this.corePlayer(place.player)}))};
      this.core.duelSetResponse(this.handle,response);this.prompt=null;this.advance();
    }finally{this.pendingDeckSelection=null;}
  }
  snapshot(viewer=0) {
    const zones={};
    for(const controller of [0,1]) {
      zones[controller]={};
      const coreController=this.corePlayer(controller),coreViewer=viewer===2?null:this.corePlayer(viewer);
      for(const location of [1,2,4,8,16,32,64]) {
        const hidden=isHiddenZoneForViewer(controller,location,viewer);
        if(hidden){
          const count=this.core.duelQueryCount(this.handle,coreController,location);
          if(location===2&&viewer!==2){
            const known=this.knownCardsByViewer?.[viewer]??[],used=new Set();
            const list=this.core.duelQueryLocation(this.handle,{controller:coreController,location,flags:Q.CODE|Q.POSITION});
            const cards=list.map((card,sequence)=>{
              if(!card)return {sequence,hidden:true};
              let index=known.findIndex((item,i)=>!used.has(i)&&item.controller===controller&&item.location===2&&item.sequence===sequence&&item.code===card.code);
              if(index<0)index=known.findIndex((item,i)=>!used.has(i)&&item.controller===controller&&item.location===2&&item.code===card.code);
              if(index<0)return {sequence,position:card.position,hidden:true};
              used.add(index);
              const db=this.cards[card.code]??{};
              return {...card,controller,sequence,name:db.name??String(card.code),desc:db.desc??'',type:db.type??0,race:db.race??'0',attribute:db.attribute??0,level:db.level??0,lscale:db.lscale??0,rscale:db.rscale??0,link_marker:db.link_marker??0,originalAttack:db.attack,originalDefense:db.defense};
            });
            zones[controller][location]={count,cards};
          }else zones[controller][location]={count};
          continue;
        }
        const list=this.core.duelQueryLocation(this.handle,{controller:coreController,location,flags:Q.CODE|Q.POSITION|Q.ATTACK|Q.DEFENSE|Q.LINK|Q.OVERLAY_CARD|Q.COUNTERS});
        zones[controller][location]={cards:list.map((c,sequence)=>{
          if(!c)return null;
          if(viewer===2?(c.position&10):coreController!==coreViewer&&(c.position&10))return {sequence,position:c.position,hidden:true};
          const db=this.cards[c.code]??{};
          return {...c,controller,sequence,name:db.name??String(c.code),desc:db.desc??'',type:db.type??0,
            race:db.race??'0',attribute:db.attribute??0,level:db.level??0,
            lscale:db.lscale??0,rscale:db.rscale??0,link_marker:db.link_marker??0,
            originalAttack:db.attack,originalDefense:db.defense};
        })};
      }
    }
    const prompt=viewer===0&&this.prompt?.player===0?this.prompt:promptForViewer(this.prompt,viewer,this.knownCardsByViewer?.[viewer]??[]);
    return {viewer,zones,lp:this.lp,turn:this.turn,phase:this.phase,active:this.active,logs:this.logs,prompt,ended:this.ended,winner:this.winner,confirmation:this.confirmationByPlayer[viewer]??(viewer===0?this.confirmation:null)};
  }
  destroy(){if(this.handle){this.core.destroyDuel(this.handle);this.handle=null;}}
}
