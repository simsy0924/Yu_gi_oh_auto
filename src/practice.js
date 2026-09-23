import {validateDeck} from './decks.js';
import {isExtra} from './catalog.js';

const copyDeck=deck=>({id:deck.id,name:deck.name,main:[...deck.main],extra:[...deck.extra??[]],side:[...deck.side??[]]});

export function randomStartingHand(deck,cards,{kind='',size=5,random=Math.random}={}) {
  const bit=({몬스터:1,마법:2,함정:4})[kind];
  const pool=deck.main.filter(code=>cards[code]&&(!bit||(cards[code].type&bit)));
  if(pool.length<size)throw new Error(`${kind||'덱'} 카드가 ${size}장 이상 있어야 무작위 시작 패를 만들 수 있습니다.`);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,size);
}

export function deckWithStartingHand(deck,hand,cards) {
  if(!Array.isArray(hand)||hand.length<1||hand.length>5)throw new Error('고정 시작 패는 1~5장으로 구성하세요.');
  const result=copyDeck(deck),required=new Map();
  for(const code of hand){
    const card=cards[code];
    if(!card||!(card.type&7)||isExtra(card)||card.type&0x4000)throw new Error(`${code} 카드는 시작 패에 넣을 수 없습니다.`);
    required.set(code,(required.get(code)??0)+1);
    if(required.get(code)>3)throw new Error('같은 카드는 시작 패에 최대 3장까지 넣을 수 있습니다.');
  }
  for(const [code,count] of required){
    const identity=card=>cards[card]?.alias||card;
    while(result.main.filter(item=>item===code).length<count){
      const groupCount=[...result.main,...result.extra,...result.side].filter(item=>identity(item)===identity(code)).length;
      let donor=-1;
      for(let i=result.main.length-1;i>=0;i--){
        const candidate=result.main[i];
        if(groupCount>=3&&identity(candidate)!==identity(code))continue;
        if(result.main.filter(item=>item===candidate).length>(required.get(candidate)??0)){donor=i;break;}
      }
      if(donor<0)throw new Error('덱에서 교체할 카드를 찾지 못했습니다.');
      result.main.splice(donor,1);
      result.main.push(code);
    }
  }
  validateDeck(result,cards);
  return result;
}
