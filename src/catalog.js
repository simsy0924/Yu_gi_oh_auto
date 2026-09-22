import {validateDeck} from './decks.js';
let pending;
async function readBundle(path) {
  const response=await fetch(new URL(path,document.baseURI));
  if(!response.ok)throw new Error('카드 목록을 불러오지 못했습니다. 다시 시도해 주세요.');
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
}
export function loadCatalog() {
  pending??=Promise.all([readBundle('./engine/cards.json.gz'),readBundle('./engine/ko.json.gz')]).then(([cards,ko])=>{
    for(const [id,c] of Object.entries(cards)) {
      c.englishName=c.name;
      if(ko[id])Object.assign(c,ko[id]);
      c.searchName=normalize(c.name+' '+c.englishName+' '+c.code);
    }
    return cards;
  }).catch(error=>{pending=null;throw error;});
  return pending;
}
export const normalize=text=>String(text).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
export const isExtra=card=>!!(card.type&(0x40|0x2000|0x800000|0x4000000));
export const deckable=card=>!(card.type&0x4000)&&!!(card.type&7);
export function cardKind(card) {
  return [[0x4000000,'링크'],[0x800000,'엑시즈'],[0x2000,'싱크로'],[0x40,'융합'],[0x2,'마법'],[0x4,'함정'],[0x1,'몬스터']].find(([bit])=>card.type&bit)?.[1]??'카드';
}
export function addCard(deck,card,part,cards) {
  if(!deckable(card))throw new Error('덱에 넣을 수 없는 카드입니다.');
  if(part!=='side')part=isExtra(card)?'extra':'main';
  if(deck[part].length>=({main:60,extra:15,side:15})[part])throw new Error(`${{main:'메인',extra:'엑스트라',side:'사이드'}[part]} 덱의 최대 매수입니다.`);
  const identity=c=>cards[c]?.alias||c;
  const copies=[...deck.main,...deck.extra,...deck.side].filter(code=>identity(code)===(card.alias||card.code)).length;
  if(copies>=3)throw new Error('메인·엑스트라·사이드를 합쳐 동일 카드는 최대 3장입니다.');
  deck[part].push(card.code);return part;
}
export function exportDeck(deck,cards) {
  validateDeck(deck,cards);
  return {version:1,name:deck.name.trim()||'내 덱',main:[...deck.main],extra:[...deck.extra],side:[...deck.side]};
}
