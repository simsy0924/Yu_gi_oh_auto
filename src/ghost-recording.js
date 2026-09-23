import {actionsByRequest,exportGhost} from './ghosts.js';

export function recordDecision(prompt,input) {
  if(!prompt||prompt.player!==0)return null;
  const step={on:prompt.type};
  if(Object.hasOwn(input,'counters'))step.counters=[...input.counters];
  else if(Object.hasOwn(input,'indices')){
    const selected=input.indices.map(id=>prompt.selection?.options.find(option=>option.id===id)).filter(Boolean);
    if(prompt.type==='ANNOUNCE_CARD'&&selected.length===1&&selected[0].card)step.card=selected[0].card;
    else if(['SELECT_CARD','SELECT_TRIBUTE'].includes(prompt.type)&&selected.length===1&&selected[0].card)step.card=selected[0].card;
    else step.indices=[...input.indices];
  }else if(Object.hasOwn(input,'choice')){
    const choice=prompt.choices.find(item=>item.id===String(input.choice));
    if(!choice)return null;
    if(choice.kind&&actionsByRequest[prompt.type]?.includes(choice.kind)){
      step.action=choice.kind;
      if(choice.source&&choice.card)step.card=choice.card;
    }else step.choice=Number(input.choice);
  }else return null;
  return step;
}

export function createGhostDraft({deck,steps,handNames=[],startingHand=null,name='전개 초안'}) {
  const scenario=handNames.length?`시작 패: ${handNames.join(', ')}`:'무작위 시작 패';
  return exportGhost({
    version:1,id:globalThis.crypto?.randomUUID?.()??`draft-${Date.now()}`,name:name.slice(0,80),
    description:`전개 연습 기록 · ${scenario}`.slice(0,160),
    deck:{name:deck.name,main:[...deck.main],extra:[...deck.extra??[]],side:[...deck.side??[]]},
    ...(startingHand?.length?{startingHand:[...startingHand]}:{}),
    behavior:{type:'scripted',mode:'sequence',script:steps.map(step=>({...step})),fallback:'basic'}
  });
}
