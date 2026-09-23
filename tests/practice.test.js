import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {deckWithStartingHand,randomStartingHand} from '../src/practice.js';

const cards=JSON.parse(gunzipSync(readFileSync('public/engine/cards.json.gz')));
const deck=JSON.parse(readFileSync('public/decks/starter.json'));

test('custom hand cards are added to a valid deck by replacing unused cards',()=>{
  const newCard=Object.values(cards).find(card=>card.code&&!((card.type&0x4000)||(card.type&0x40)||(card.type&0x2000)||(card.type&0x800000)||(card.type&0x4000000))&&(card.type&7)&&!deck.main.includes(card.code));
  assert.ok(newCard);
  const hand=[newCard.code,newCard.code],result=deckWithStartingHand(deck,hand,cards);
  assert.equal(result.main.length,deck.main.length);
  assert.equal(result.main.filter(code=>code===newCard.code).length,2);
  assert.equal(deck.main.includes(newCard.code),false);
});

test('custom hands reject empty, oversized and extra deck card lists',()=>{
  assert.throws(()=>deckWithStartingHand(deck,[],cards),/1~5장/);
  assert.throws(()=>deckWithStartingHand(deck,Array(6).fill(deck.main[0]),cards),/1~5장/);
  const extra=Object.values(cards).find(card=>card.code&&(card.type&0x40));
  assert.throws(()=>deckWithStartingHand(deck,[extra.code],cards),/시작 패/);
});

test('random starts can be limited to cards of one kind',()=>{
  const hand=randomStartingHand(deck,cards,{kind:'몬스터',random:()=>0.25});
  assert.equal(hand.length,5);
  assert.ok(hand.every(code=>cards[code].type&1));
  assert.throws(()=>randomStartingHand({main:[]},cards),/5장 이상/);
});
