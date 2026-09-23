import {validateDeck} from './decks.js';

export const actionsByRequest={
  SELECT_IDLECMD:['summon','special','position','set','set-spell','activate','battle','end'],
  SELECT_BATTLECMD:['activate','attack','main2','end'],
  SELECT_CHAIN:['activate','pass'],
  SELECT_EFFECTYN:['yes','no'],SELECT_YESNO:['yes','no'],
  SELECT_UNSELECT_CARD:['select','finish'],
  SELECT_OPTION:[],SELECT_POSITION:[],SELECT_CARD:[],SELECT_TRIBUTE:[],
  SELECT_PLACE:[],SELECT_DISFIELD:[],SORT_CARD:[],SORT_CHAIN:[],
  ANNOUNCE_NUMBER:[],ROCK_PAPER_SCISSORS:[]
};
export const selectionRequests=new Set(['SELECT_CARD','SELECT_TRIBUTE','SELECT_PLACE','SELECT_DISFIELD']);

export function validateStep(step) {
  if(!step||!Object.hasOwn(actionsByRequest,step.on))throw new Error('지원되는 요청 종류를 선택하세요.');
  if(step.action!==undefined&&!actionsByRequest[step.on].includes(step.action))throw new Error(`${step.on}: 사용할 수 없는 행동입니다.`);
  if(step.card!==undefined&&(!Number.isSafeInteger(step.card)||step.card<=0||step.card>0xffffffff))throw new Error('카드 번호를 확인하세요.');
  if(step.choice!==undefined&&(!Number.isSafeInteger(step.choice)||step.choice<0))throw new Error('선택 번호는 0 이상의 정수여야 합니다.');
  if(step.indices!==undefined&&(!selectionRequests.has(step.on)||!Array.isArray(step.indices)||step.indices.some(i=>!Number.isSafeInteger(i)||i<0)||new Set(step.indices).size!==step.indices.length))throw new Error('선택 대상 번호는 중복 없는 0 이상의 정수여야 합니다.');
  if(selectionRequests.has(step.on)&&step.indices===undefined)throw new Error(`${step.on}: 선택 대상 번호를 입력하세요.`);
  if(!selectionRequests.has(step.on)&&step.indices!==undefined)throw new Error(`${step.on}: 선택 대상 목록을 사용할 수 없습니다.`);
  if(step.action===undefined&&step.choice===undefined&&step.card===undefined&&step.indices===undefined&&actionsByRequest[step.on].length===0)throw new Error(`${step.on}: 선택 번호를 입력하세요.`);
  return step;
}

export function exportGhost(ghost) {
  if(!ghost||typeof ghost.name!=='string'||!ghost.name.trim())throw new Error('고스트 이름을 입력하세요.');
  const deck=validateDeck(ghost.deck);
  if(!ghost.behavior||ghost.behavior.type!=='scripted'||!Array.isArray(ghost.behavior.script)||!['basic','pause'].includes(ghost.behavior.fallback))throw new Error('고스트 행동 설정을 확인하세요.');
  const script=ghost.behavior.script.map((step,i)=>{
    try{validateStep(step);}catch(e){throw new Error(`${i+1}단계: ${e.message}`);}
    return {...step,indices:step.indices===undefined?undefined:[...step.indices]};
  });
  return {version:1,id:String(ghost.id||'custom-ghost'),name:ghost.name.trim(),description:String(ghost.description??'').trim(),deck:{name:deck.name,main:deck.main,extra:deck.extra,side:deck.side},behavior:{type:'scripted',script,fallback:ghost.behavior.fallback}};
}
