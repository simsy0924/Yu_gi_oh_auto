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
      c.englishDesc=c.desc;
      if(ko[id])Object.assign(c,ko[id]);
      c.searchName=normalize(c.name+' '+c.englishName+' '+c.code);
      c.searchEffect=normalize(c.desc+' '+c.englishDesc);
    }
    return cards;
  }).catch(error=>{pending=null;throw error;});
  return pending;
}
export const normalize=text=>String(text).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
export const isExtra=card=>!!(card.type&(0x40|0x2000|0x800000|0x4000000));
export const deckable=card=>!(card.type&0x4000)&&!!(card.type&7);
export const races=[
  [1,'전사족'],[2,'마법사족'],[4,'천사족'],[8,'악마족'],[16,'언데드족'],[32,'기계족'],
  [64,'물족'],[128,'화염족'],[256,'암석족'],[512,'비행야수족'],[1024,'식물족'],
  [2048,'곤충족'],[4096,'번개족'],[8192,'드래곤족'],[16384,'야수족'],[32768,'야수전사족'],
  [65536,'공룡족'],[131072,'어류족'],[262144,'해룡족'],[524288,'파충류족'],
  [1048576,'사이킥족'],[2097152,'환신야수족'],[4194304,'창조신족'],
  [8388608,'환룡족'],[16777216,'사이버스족'],[33554432,'환상마족'],
  [67108864,'사이보그족'],[134217728,'마법기사족'],[268435456,'하이 드래곤족'],
  [536870912,'오메가사이킥족'],[1073741824,'천계전사족'],[2147483648,'갤럭시족']
];
export const attributes=[[1,'땅'],[2,'물'],[4,'화염'],[8,'바람'],[16,'빛'],[32,'어둠'],[64,'신']];
export const kinds=[['몬스터',1],['일반',0x10],['효과',0x20],['의식',0x80],['융합',0x40],['싱크로',0x2000],['엑시즈',0x800000],['링크',0x4000000],['펜듈럼',0x1000000],['튜너',0x1000],['마법',2],['함정',4]];
export function cardStatKind(card) {
  return card.type&0x4000000?'link':card.type&0x800000?'rank':card.type&1?'level':'';
}
export function searchCards(cards,{query='',effect='',kind='',race='',attribute='',statKind='',statValue=''}={}) {
  const nameWords=query.trim().split(/\s+/).map(normalize).filter(Boolean);
  const effectWords=effect.trim().split(/\s+/).map(normalize).filter(Boolean);
  const number=statValue===''?null:Number(statValue);
  const kindBit=kinds.find(([name])=>name===kind)?.[1];
  return cards.filter(c=>
    (!kind||(!!kindBit&&!!(c.type&kindBit)&&(['몬스터','마법','함정'].includes(kind)||!!(c.type&1))))&&
    (!race||(!!(c.type&1)&&Number(c.race)===Number(race)))&&
    (!attribute||(!!(c.type&1)&&c.attribute===Number(attribute)))&&
    (!statKind||cardStatKind(c)===statKind)&&
    (number===null||(Number.isInteger(number)&&number>0&&!!cardStatKind(c)&&c.level===number))&&
    nameWords.every(w=>(c.searchName??normalize(c.name+' '+(c.englishName??'')+' '+c.code)).includes(w))&&
    effectWords.every(w=>(c.searchEffect??normalize(c.desc+' '+(c.englishDesc??''))).includes(w))
  );
}
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
