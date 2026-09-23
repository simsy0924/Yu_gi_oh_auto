import {OcgMessageType as M,OcgResponseType as R,SelectIdleCMDAction as I,SelectBattleCMDAction as B,ocgPositionParse} from 'ocgcore-wasm';
export const requestTypes=new Set(Object.entries(M).filter(([k])=>/^(SELECT_|SORT_|ANNOUNCE_|ROCK_PAPER_SCISSORS)/.test(k)).map(([,v])=>v));
export function fieldPlaces(mask, player) {
  const places=[];
  for(let relative=0;relative<2;relative++) for(const [location,offset,count] of [[4,0,7],[8,8,8]]) for(let sequence=0;sequence<count;sequence++) {
    if(!((mask>>>(relative*16+offset+sequence))&1)) places.push({player:player^relative,location,sequence});
  }
  return places;
}
export function makePrompt(m,cards) {
  const title=M[m.type]??String(m.type), type=R[title];
  const p={type:title,player:m.player,title:'행동을 선택하세요',choices:[],selection:null};
  const name=c=>cards[c.code]?.name??String(c.code);
  const description=d=>{const n=BigInt(d??0),c=cards[Number(n>>20n)];return c?.strings[Number(n&0xfffffn)]||'';};
  const label=c=>`${name(c)}${c.location?` · ${({'2':'패','4':'몬스터','8':'마법·함정','16':'묘지','32':'제외','64':'엑스트라'})[c.location]??'덱'} ${c.sequence+1}`:''}${c.description?` ${description(c.description)}`:''}`;
  const source=c=>c&&Number.isInteger(c.controller)&&Number.isInteger(c.location)&&Number.isInteger(c.sequence)?{controller:c.controller,location:c.location,sequence:c.sequence}:null;
  const add=(label,response,kind='',card=null,from=null)=>p.choices.push({id:String(p.choices.length),label,response,kind,card,source:source(from)});
  const command=(list,action,kind,verb)=>(list??[]).forEach((c,index)=>add(`${verb} · ${label(c)}`,{type,action,index},kind,c.code,c));
  switch(m.type) {
    case M.SELECT_IDLECMD:
      command(m.summons,I.SELECT_SUMMON,'summon','일반 소환'); command(m.special_summons,I.SELECT_SPECIAL_SUMMON,'special','특수 소환');
      command(m.pos_changes,I.SELECT_POS_CHANGE,'position','표시 형식 변경'); command(m.monster_sets,I.SELECT_MONSTER_SET,'set','몬스터 세트');
      command(m.spell_sets,I.SELECT_SPELL_SET,'set-spell','마법·함정 세트'); command(m.activates,I.SELECT_ACTIVATE,'activate','효과 발동');
      if(m.to_bp)add('배틀 페이즈',{type,action:I.TO_BP,index:null},'battle');
      if(m.to_ep)add('턴 종료',{type,action:I.TO_EP,index:null},'end');
      if(m.shuffle)add('패 다시 섞기',{type,action:I.SHUFFLE,index:null},'shuffle');break;
    case M.SELECT_BATTLECMD:
      command(m.chains,B.SELECT_CHAIN,'activate','효과 발동'); command(m.attacks,B.SELECT_BATTLE,'attack','공격');
      if(m.to_m2)add('메인 페이즈 2',{type,action:B.TO_M2,index:null},'main2');
      if(m.to_ep)add('턴 종료',{type,action:B.TO_EP,index:null},'end'); break;
    case M.SELECT_CHAIN:
      p.title='체인할 효과를 선택하세요'; m.selects.forEach((c,index)=>add(label(c),{type,index},'activate',c.code,c));
      if(!m.forced)add('체인하지 않음',{type,index:null},'pass'); break;
    case M.SELECT_EFFECTYN: case M.SELECT_YESNO:
      p.title=`${m.code?name(m)+' · ':''}${description(m.description)||'효과를 적용할까요?'}`;
      add('예',{type,yes:true},'yes');add('아니요',{type,yes:false},'no');break;
    case M.SELECT_OPTION:
      p.title='효과 선택';m.options.forEach((d,index)=>add(description(d)||`선택 ${index+1}`,{type,index}));break;
    case M.SELECT_POSITION:
      p.title='표시 형식 선택';for(const position of ocgPositionParse(m.positions))add(({1:'공격 표시',2:'뒷면 공격',4:'수비 표시',8:'뒷면 수비'})[position],{type,position});break;
    case M.SELECT_CARD: case M.SELECT_TRIBUTE:
      p.title=m.type===M.SELECT_TRIBUTE?'릴리스할 카드 선택':'카드 선택';
      p.selection={options:m.selects.map((c,index)=>({id:index,label:label(c),card:c.code,value:c.release_param??1,source:source(c)})),min:m.min,max:m.max,tribute:m.type===M.SELECT_TRIBUTE};
      if(m.can_cancel)add('취소',{type,indicies:null},'cancel');break;
    case M.SELECT_PLACE: case M.SELECT_DISFIELD:
      p.title='존 선택';p.selection={options:fieldPlaces(m.field_mask,m.player).map((place,id)=>({id,label:`${place.player===0?'내':'상대'} ${place.location===4?'몬스터':'마법·함정'} 존 ${place.sequence+1}`,place})),min:m.count,max:m.count};break;
    case M.SELECT_UNSELECT_CARD:
      p.title='소재 선택 / 선택 해제';[...m.select_cards,...m.unselect_cards].forEach((c,index)=>add(`${index<m.select_cards.length?'선택':'해제'} · ${label(c)}`,{type,index},index<m.select_cards.length?'select':'unselect',c.code,c));
      if(m.can_finish||m.can_cancel)add(m.can_finish?'선택 완료':'취소',{type,index:null},m.can_finish?'finish':'cancel');break;
    case M.SORT_CARD: case M.SORT_CHAIN:
      p.title='카드 / 체인 순서';add('기본 순서 유지',{type:R.SORT_CARD,order:null});break;
    case M.ANNOUNCE_NUMBER:
      p.title='숫자 선언';m.options.forEach((n,value)=>add(String(n),{type,value}));break;
    case M.ROCK_PAPER_SCISSORS:
      [1,2,3].forEach(value=>add(['','가위','바위','보'][value],{type,value}));break;
    default:p.blocked=`아직 화면에서 지원하지 않는 선택입니다: ${title}`;
  }
  return p;
}
export function selectionResponse(p, ids) {
  const s=p.selection;if(!s||!Array.isArray(ids)||new Set(ids).size!==ids.length)throw new Error('선택을 확인하세요.');
  const selected=ids.map(id=>s.options.find(o=>o.id===id));if(selected.some(x=>!x))throw new Error('유효하지 않은 선택입니다.');
  const amount=s.tribute?selected.reduce((n,c)=>n+c.value,0):ids.length;
  if(amount<s.min||ids.length>s.max)throw new Error(`선택 조건을 확인하세요 (${s.min}~${s.max}).`);
  const type=R[p.type];
  if(p.type==='SELECT_PLACE'||p.type==='SELECT_DISFIELD')return {type,places:selected.map(o=>o.place)};
  if(s.ordered) {const order=Array(ids.length);ids.forEach((id,rank)=>order[id]=rank);return {type:R.SORT_CARD,order};}
  return {type,indicies:ids};
}
const basicActions={
  SELECT_IDLECMD:['activate','special','summon','set-spell','set','position','battle','end'],
  SELECT_BATTLECMD:['activate','attack','main2','end'],
  SELECT_CHAIN:['pass','activate'],
  SELECT_EFFECTYN:['yes','no'],SELECT_YESNO:['yes','no'],
  SELECT_UNSELECT_CARD:['select','finish','unselect','cancel']
};
// Every response still comes from the core's legal choices. Priority rules are checked afresh on each request.
export function ghostChoice(p, behavior={}, cursor=0) {
  const match=step=>{
    if(!step||step.on!==p.type)return null;
    if(step.card!==undefined&&p.selection&&['SELECT_CARD','SELECT_TRIBUTE'].includes(p.type)){
      const target=p.selection.options.find(o=>o.card===step.card);
      if(!target)return null;
      const ids=[target.id];let amount=p.selection.tribute?target.value:1;
      for(const o of p.selection.options){
        if(amount>=p.selection.min)break;
        if(o.id!==target.id){ids.push(o.id);amount+=p.selection.tribute?o.value:1;}
      }
      try{selectionResponse(p,ids);return {indices:ids};}catch{return null;}
    }
    if(step.indices!==undefined && p.selection){try{selectionResponse(p,step.indices);return {indices:step.indices};}catch{return null;}}
    const c=p.choices.find(c=>(step.action===undefined||c.kind===step.action)&&(step.card===undefined||c.card===step.card)&&(step.choice===undefined||c.id===String(step.choice)));
    return c?{choice:c.id}:null;
  };
  if(behavior.mode==='priority'){
    for(const rule of behavior.script??[]){const decision=match(rule);if(decision)return {...decision,cursor};}
  }else{
    const step=behavior.script?.[cursor];
    if(step?.on===p.type){const decision=match(step);return decision?{...decision,cursor:cursor+1}:{blocked:'고스트의 다음 JSON 행동을 현재 상황에서 실행할 수 없습니다.'};}
  }
  if(behavior.fallback==='pause')return {blocked:'이 상황에 대응할 고스트 행동이 없습니다.'};
  if(p.blocked)return {blocked:p.blocked};
  for(const kind of basicActions[p.type]??[]) {
    const c=p.choices.find(c=>c.kind===kind);if(c)return {choice:c.id,cursor};
  }
  if(p.selection) {
    const ids=[];let amount=0;
    for(const o of p.selection.options) {if(amount>=p.selection.min)break;ids.push(o.id);amount+=p.selection.tribute?o.value:1;}
    selectionResponse(p,ids);return {indices:ids,cursor};
  }
  if(p.choices.length)return {choice:p.choices[0].id,cursor};
  return {blocked:'고스트가 선택할 수 있는 행동이 없습니다.'};
}
