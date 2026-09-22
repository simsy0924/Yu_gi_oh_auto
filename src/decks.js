export function parseDeck(text, name='불러온 덱') {
  if (text.trim().startsWith('{')) {const deck=JSON.parse(text);return validateDeck({...deck,name:typeof deck.name==='string'?deck.name:name});}
  const deck={name,main:[],extra:[],side:[]}; let section='main';
  for(const raw of text.split(/\r?\n/)) {
    const line=raw.trim(); if(!line) continue;
    if(line==='#main') section='main'; else if(line==='#extra') section='extra';
    else if(line==='!side') section='side'; else if(line.startsWith('#')) continue;
    else if(/^\d+$/.test(line)) deck[section].push(Number(line));
    else throw new Error('YDK 또는 {main, extra, side} JSON 덱을 선택하세요.');
  }
  return validateDeck(deck);
}
export function validateDeck(deck, cards) {
  if(!deck || !Array.isArray(deck.main) || deck.main.length<40 || deck.main.length>60) throw new Error('메인 덱은 40~60장이어야 합니다.');
  for(const [part,max] of [['main',60],['extra',15],['side',15]]) {
    const list=deck[part]??[];
    if(!Array.isArray(list)||list.length>max||list.some(c=>!Number.isSafeInteger(c)||c<=0||c>0xffffffff)) throw new Error(`${part}: 카드 번호 또는 매수를 확인하세요.`);
    if(cards) for(const code of list) {
      if(!cards[code]) throw new Error(`카드 DB에 없는 번호: ${code}`);
      const extra=!!(cards[code].type & (0x40|0x2000|0x800000|0x4000000));
      if(part!=='side' && extra!==(part==='extra')) throw new Error(`덱 구역이 맞지 않습니다: ${cards[code].name}`);
    }
  }
  const counts=new Map(); for(const id of [...deck.main,...deck.extra??[],...deck.side??[]]) {
    const key=cards?.[id]?.alias||id; counts.set(key,(counts.get(key)||0)+1);
    if(counts.get(key)>3) throw new Error(`동일 카드는 최대 3장입니다: ${id}`);
  }
  return {...deck,main:[...deck.main],extra:[...deck.extra??[]],side:[...deck.side??[]]};
}
