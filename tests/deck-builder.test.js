import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {addCard,exportDeck} from '../src/catalog.js';
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
