const help={
  SELECT_IDLECMD:'빛나는 패·필드 카드를 눌러 소환, 세트, 효과 발동을 고르세요. 행동할 카드가 없다면 턴 종료를 누르세요.',
  SELECT_BATTLECMD:'빛나는 몬스터로 공격하거나, 효과를 발동하세요. 공격을 마치려면 메인 페이즈 2 또는 턴 종료를 누르세요.',
  SELECT_CHAIN:'체인할 카드를 누른 다음 효과를 선택하세요. 대응하지 않으려면 체인하지 않음을 누르세요.',
  SELECT_EFFECTYN:'이 효과를 사용할지 결정하세요. 카드 효과를 먼저 확인할 수 있습니다.',
  SELECT_YESNO:'진행할지 결정하세요. 카드 효과를 먼저 확인할 수 있습니다.',
  SELECT_OPTION:'효과 중 하나를 고르세요. 카드 효과를 읽고 선택하는 것이 좋습니다.',
  SELECT_POSITION:'공격 표시 또는 수비 표시를 고르세요.',
  SELECT_CARD:'조건에 맞는 카드를 고른 뒤 선택 완료를 누르세요.',
  SELECT_TRIBUTE:'릴리스할 카드를 골라 필요한 수량을 맞추세요.',
  SELECT_PLACE:'카드를 놓을 존을 고르세요.',
  SELECT_DISFIELD:'사용하지 못하게 할 존을 고르세요.',
  SELECT_UNSELECT_CARD:'소재를 하나씩 선택하거나 해제하세요. 준비되면 선택 완료를 누르세요.',
  SELECT_SUM:'소재의 수치를 합쳐 목표를 맞추세요. 필수 소재는 이미 포함되어 있습니다.',
  SELECT_COUNTER:'카드마다 제거할 카운터 수를 입력해 합계를 맞추세요.',
  SORT_CARD:'카드를 원하는 순서대로 하나씩 누른 후 순서를 확정하세요.',
  SORT_CHAIN:'체인 효과를 원하는 순서대로 하나씩 누른 후 순서를 확정하세요.',
  ANNOUNCE_RACE:'선언할 종족을 필요한 개수만큼 고르세요.',
  ANNOUNCE_ATTRIB:'선언할 속성을 필요한 개수만큼 고르세요.',
  ANNOUNCE_CARD:'카드명이나 번호로 검색해 선언할 카드를 고르세요.',
  ANNOUNCE_NUMBER:'선언할 숫자를 누르세요.',
  ROCK_PAPER_SCISSORS:'가위·바위·보 중 하나를 선택하세요.'
};
export function promptHelp(prompt){return help[prompt?.type]??'현재 선택할 수 있는 행동을 확인하세요.';}
export function selectionProgress(s,ids){
  if(s.mode==='sort')return `${ids.length}/${s.options.length}장 순서 지정`;
  if(s.mode==='sum')return `목표 ${s.amount} · 추가 소재 ${ids.length}장 선택`;
  if(s.tribute){const amount=ids.reduce((n,id)=>n+(s.options.find(o=>o.id===id)?.value??0),0);return `릴리스 수치 ${amount} / 필요 ${s.min}~${s.max}`;}
  return `${ids.length}/${s.min===s.max?s.min:`${s.min}~${s.max}`}개 선택`;
}
