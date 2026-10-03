function cardName(code,cards){return cards?.[code]?.name??String(code??'카드');}

function optionName(option,cards,index){
  return option?.label??option?.name??(option?.card?cardName(option.card,cards):`선택 ${index+1}`);
}

function faceDownOrUnknown(position){
  return !Number.isInteger(position)||position===0||(position&10)!==0||(position&5)===0;
}

function privateSource(option){
  const source=option?.source;
  if(source?.location===1||source?.location===2)return true;
  return (source?.location===32||source?.location===64)&&faceDownOrUnknown(source.position);
}

function actionRevealsCard(option){
  return ['summon','special','activate'].includes(option?.kind);
}

function privateChoice(option){
  if(option?.kind==='set'||option?.kind==='set-spell')return true;
  return privateSource(option)&&!actionRevealsCard(option);
}

function knownCard(option,knownCards=[]){
  const source=option?.source;
  if(!source)return false;
  return knownCards.some(card=>Number(card.code)===Number(option.card)&&card.controller===source.controller&&card.location===source.location&&card.sequence===source.sequence);
}

function publicOptionName(option,cards,index,knownCards=[]){
  if(privateSource(option)&&!knownCard(option,knownCards))return option?.source?.location===1?'덱에서 카드':'비공개 카드';
  return optionName(option,cards,index);
}

export function decisionUsesPrivateCard(prompt,input,knownCards=[]){
  if(Array.isArray(input?.indices))return input.indices.some(id=>{const option=prompt?.selection?.options?.find(option=>String(option.id)===String(id));return privateSource(option)&&!knownCard(option,knownCards);});
  if(Array.isArray(input?.counters))return (prompt?.selection?.options??[]).some((option,index)=>input.counters[index]>0&&privateSource(option)&&!knownCard(option,knownCards));
  if(input?.choice!==undefined){
    const choice=prompt?.choices?.find(option=>option.id===String(input.choice));
    return privateChoice(choice)&&!knownCard(choice,knownCards);
  }
  return false;
}

export function describeDecision(prompt,input,cards={},knownCards=[]){
  const title=prompt?.title??prompt?.type??'행동';
  if(Array.isArray(input?.indices)){
    const options=prompt?.selection?.options??[];
    const selected=input.indices.map(id=>options.find(option=>String(option.id)===String(id))).filter(Boolean);
    const names=selected.map((option,index)=>publicOptionName(option,cards,index,knownCards));
    return `${title} · ${names.join(', ')||'선택 없음'}`;
  }
  if(Array.isArray(input?.counters)){
    const options=prompt?.selection?.options??[];
    const amounts=options.map((option,index)=>input.counters[index]?`${publicOptionName(option,cards,index,knownCards)} ${input.counters[index]}개`:null).filter(Boolean);
    return `${title} · ${amounts.join(', ')||'분배 완료'}`;
  }
  if(input?.choice!==undefined){
    const choice=prompt?.choices?.find(option=>option.id===String(input.choice));
    if(!choice)return title;
    const action=choice.shortLabel?.trim()||choice.label||choice.kind||'행동';
    if(choice.kind==='set')return '몬스터 세트';
    if(choice.kind==='set-spell')return '마법·함정 세트';
    if(privateChoice(choice)&&!knownCard(choice,knownCards))return ({summon:'일반 소환',special:'특수 소환',activate:'효과 발동'}[choice.kind]??'비공개 카드 행동');
    if(choice.card)return `${cardName(choice.card,cards)} · ${action}`;
    if(['yes','no'].includes(choice.kind))return `${title} · ${action}`;
    if(prompt?.type==='SELECT_OPTION'&&prompt.context?.name)return `${prompt.context.name} · ${title}: ${action}`;
    return action;
  }
  return title;
}

export function describeChain(message,cards={}){
  const name=message?.location===2?cardName(message?.code,cards):faceDownOrUnknown(message?.position)?'세트 카드 효과':cardName(message?.code,cards);
  return `체인 ${message?.chain_size??''} · ${name}`;
}
