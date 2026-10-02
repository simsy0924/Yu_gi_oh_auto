export function isHiddenZoneForViewer(controller,location,viewer) {
  return location===1||((location===2||location===64)&&(viewer===2||controller!==viewer));
}

function visibleOption(option,viewer,index) {
  const {card,cardName,...rest}=option;
  const hidden=option.source&&option.source.controller!==viewer&&isHiddenZoneForViewer(option.source.controller,option.source.location,viewer);
  return hidden?{...rest,label:`비공개 카드 ${index+1}`}:{...rest,...(cardName?{cardName}:{})};
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
    const {response,card,cardName,...safeChoice}=choice;
    const hidden=choice.source&&choice.source.controller!==viewer&&isHiddenZoneForViewer(choice.source.controller,choice.source.location,viewer);
    return hidden?{...safeChoice,label:`비공개 카드 행동 ${choice.id}`,shortLabel:'비공개 카드 행동'}:{...safeChoice,...(cardName?{cardName}:{})};
  });
  const visibleSelection=selection?{
    ...selection,
    options:(selection.options??[]).map((option,index)=>visibleOption(option,viewer,index)),
    ...(selection.mandatory?{mandatory:selection.mandatory.map((option,index)=>visibleOption(option,viewer,index))}:{})
  }:null;
  return {...rest,choices:visibleChoices,selection:visibleSelection};
}
