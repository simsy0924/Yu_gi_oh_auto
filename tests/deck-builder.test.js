import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {addCard,exportDeck,searchCards,cardStatKind} from '../src/catalog.js';
import {parseDeck} from '../src/decks.js';
const cards=JSON.parse(gunzipSync(readFileSync('public/engine/cards.json.gz')));
const starter=JSON.parse(readFileSync('public/decks/starter.json'));
test('a built deck exports into the existing import format without losing name or zones',()=>{
  const draft={name:'검색으로 만든 덱',main:[],extra:[],side:[]};
  for(const code of starter.main)addCard(draft,cards[code],'main',cards);
  const link=Object.values(cards).find(c=>c.type&0x4000000);
  addCard(draft,link,'main',cards);addCard(draft,link,'side',cards);
  const loaded=parseDeck(JSON.stringify(exportDeck(draft,cards)),'download.json');
  assert.equal(loaded.name,draft.name);assert.deepEqual(loaded.main,starter.main);
  assert.deepEqual(loaded.extra,[link.code]);assert.deepEqual(loaded.side,[link.code]);
  addCard(draft,link,'side',cards);assert.throws(()=>addCard(draft,link,'extra',cards),/3장/);
});
test('incomplete drafts cannot be exported; tokens cannot be added',()=>{
  const draft={name:'작성 중',main:[],extra:[],side:[]};
  assert.throws(()=>exportDeck(draft,cards),/40~60/);
  const token=Object.values(cards).find(c=>c.type&0x4000);
  assert.throws(()=>addCard(draft,token,'main',cards));
});
test('combined type, race, attribute, level and effect filters find only matching monsters',()=>{
  const sample=[
    {code:1,type:0x21,race:'8192',attribute:32,level:4,name:'검은 용',englishName:'Dark Dragon',desc:'묘지에서 특수 소환한다.',englishDesc:'Special Summon from the GY.'},
    {code:2,type:0x41,race:'8192',attribute:32,level:4,name:'검은 융합룡',desc:'묘지에서 특수 소환한다.'},
    {code:3,type:0x800021,race:'8192',attribute:32,level:4,name:'검은 엑시즈룡',desc:'묘지에서 특수 소환한다.'},
    {code:4,type:0x4000021,race:'8192',attribute:32,level:4,name:'검은 링크룡',desc:'묘지에서 특수 소환한다.'},
    {code:5,type:0x21,race:'8192',attribute:16,level:4,name:'빛의 용',desc:'묘지에서 특수 소환한다.'},
    {code:6,type:0x10002,race:'0',attribute:0,level:0,name:'검은 마법',desc:'묘지에서 특수 소환한다.'}
  ];
  assert.deepEqual(searchCards(sample,{query:'dark 1',effect:'special summon',kind:'효과',race:'8192',attribute:'32',statKind:'level',statValue:'4'}).map(c=>c.code),[1]);
  assert.deepEqual(searchCards(sample,{effect:'묘지에서 특수',kind:'융합',statKind:'level',statValue:'4'}).map(c=>c.code),[2]);
  assert.deepEqual(searchCards(sample,{kind:'엑시즈',statKind:'rank',statValue:'4'}).map(c=>c.code),[3]);
  assert.deepEqual(searchCards(sample,{kind:'링크',statKind:'link',statValue:'4'}).map(c=>c.code),[4]);
  assert.deepEqual(searchCards(sample,{statKind:'rank',statValue:'4'}).map(c=>c.code),[3]);
  assert.deepEqual(searchCards(sample,{kind:'마법',effect:'묘지'}).map(c=>c.code),[6]);
  assert.deepEqual(searchCards(sample,{statValue:'4'}).map(c=>c.code),[1,2,3,4,5]);
  assert.deepEqual(searchCards(sample,{statValue:'0'}),[]);
});
test('the bundled card data exposes levels, ranks and link ratings separately',()=>{
  for(const [bit,kind] of [[0x2000,'level'],[0x800000,'rank'],[0x4000000,'link']]) {
    const card=Object.values(cards).find(c=>(c.type&bit)&&c.level>0);
    assert.equal(cardStatKind(card),kind);
    assert.ok(searchCards([card],{statKind:kind,statValue:String(card.level)}).includes(card));
  }
});
