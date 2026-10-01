export function isHiddenZoneForViewer(controller,location,viewer) {
  return location===1||(controller!==viewer&&(location===2||location===64));
}

function visibleOption(option,viewer,index) {
  const {card,...rest}=option;
  const hidden=option.source&&isHiddenZoneForViewer(option.source.controller,option.source.location,viewer);
  return hidden?{...rest,label:`비공개 카드 ${index+1}`}:{...rest};
}

export function promptForViewer(prompt,viewer) {
  if(!prompt)return null;
  if(prompt.player!==viewer)return {
    player:prompt.player,
    type:'WAITING_FOR_PLAYER',
    title:viewer===1?'사용자 선택 대기 중':'상대 선택 대기 중',
    choices:[],
    selection:null
  };

  const {choices=[],selection,...rest}=prompt;
  const visibleChoices=choices.map(choice=>{
    const {response,card,...safeChoice}=choice;
    const hidden=choice.source&&isHiddenZoneForViewer(choice.source.controller,choice.source.location,viewer);
    return hidden?{...safeChoice,label:`비공개 카드 행동 ${choice.id}`,shortLabel:'비공개 카드 행동'}:safeChoice;
  });
  const visibleSelection=selection?{
    ...selection,
    options:(selection.options??[]).map((option,index)=>visibleOption(option,viewer,index)),
    ...(selection.mandatory?{mandatory:selection.mandatory.map((option,index)=>visibleOption(option,viewer,index))}:{})
  }:null;
  return {...rest,choices:visibleChoices,selection:visibleSelection};
}
