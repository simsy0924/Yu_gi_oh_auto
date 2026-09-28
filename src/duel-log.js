function cardName(code,cards){return cards?.[code]?.name??String(code??'카드');}

function optionName(option,cards,index){
  return option?.label??option?.name??(option?.card?cardName(option.card,cards):`선택 ${index+1}`);
}

export function describeDecision(prompt,input,cards={}) {
  const title=prompt?.title??prompt?.type??'행동';
  if(Array.isArray(input?.indices)){
    const options=prompt?.selection?.options??[];
    const selected=input.indices.map(id=>options.find(option=>String(option.id)===String(id))).filter(Boolean);
    const names=selected.map((option,index)=>optionName(option,cards,index));
    return `${title} · ${names.join(', ')||'선택 없음'}`;
  }
  if(Array.isArray(input?.counters)){
    const options=prompt?.selection?.options??[];
    const amounts=options.map((option,index)=>input.counters[index]?`${optionName(option,cards,index)} ${input.counters[index]}개`:null).filter(Boolean);
    return `${title} · ${amounts.join(', ')||'분배 완료'}`;
  }
  if(input?.choice!==undefined){
    const choice=prompt?.choices?.find(option=>option.id===String(input.choice));
    if(!choice)return title;
    const action=choice.shortLabel?.trim()||choice.label||choice.kind||'행동';
    if(choice.card)return `${cardName(choice.card,cards)} · ${action}`;
    if(['yes','no'].includes(choice.kind))return `${title} · ${action}`;
    if(prompt?.type==='SELECT_OPTION'&&prompt.context?.name)return `${prompt.context.name} · ${title}: ${action}`;
    return action;
  }
  return title;
}
