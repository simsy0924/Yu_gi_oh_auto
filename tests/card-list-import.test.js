import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addNamedCards} from '../src/catalog.js';

const makeDeck=()=>({name:'시험 덱',main:[],extra:[],side:[]});

test('exact Korean and English names add repeated copies and auto-sort extra deck cards',()=>{
  const cards={
    1:{code:1,type:0x21,name:'푸른 용',englishName:'Blue Dragon'},
    2:{code:2,type:0x2001,name:'조율 싱크론',englishName:'Tuning Synchron'}
  };
  const deck=makeDeck();
  const result=addNamedCards(deck,'푸른 용\n푸른 용\nblue   dragon\n조율 싱크론','main',cards);

  assert.deepEqual(result.added,[1,1,1,2]);
  assert.deepEqual(result.issues,[]);
  assert.deepEqual(deck.main,[1,1,1]);
  assert.deepEqual(deck.extra,[2]);
});

test('only exact names match; ambiguous names and existing copy limits are reported by line',()=>{
  const cards={
    1:{code:1,type:0x21,name:'빛나는 용',englishName:'Shining Dragon'},
    2:{code:2,type:0x21,name:'이름 겹침',englishName:'Twin Name'},
    3:{code:3,type:0x21,name:'이름 겹침',englishName:'Twin Name'}
  };
  const deck=makeDeck();
  const result=addNamedCards(deck,'빛나는 용\n빛나는 용\n빛나는 용\nShining\n이름 겹침\nShining Dragon','main',cards);

  assert.deepEqual(deck.main,[1,1,1]);
  assert.deepEqual(result.issues.map(issue=>issue.line),[4,5,6]);
  assert.match(result.issues[0].reason,/정확히 일치/);
  assert.match(result.issues[1].reason,/여러 종류/);
  assert.match(result.issues[2].reason,/3장/);
});

test('cards with the same alias resolve to the canonical card ID',()=>{
  const cards={
    100:{code:100,type:0x21,name:'동일 카드',englishName:'Same Card'},
    101:{code:101,alias:100,type:0x21,name:'동일 카드',englishName:'Same Card'}
  };
  const deck=makeDeck();
  const result=addNamedCards(deck,'동일 카드','main',cards);

  assert.deepEqual(result.added,[100]);
  assert.deepEqual(deck.main,[100]);
});

test('a temporary Korean card name imports with or without its marker',()=>{
  const cards={
    1:{code:1,type:0x21,name:'임시 카드명 (임시 번역)',englishName:'Temporary Card Name'}
  };
  const deck=makeDeck();
  const result=addNamedCards(deck,'임시 카드명\n임시 카드명 (임시 번역)','main',cards);

  assert.deepEqual(result.added,[1,1]);
  assert.deepEqual(result.issues,[]);
});

test('the side tab sends every matched card to the side deck',()=>{
  const cards={
    1:{code:1,type:0x21,name:'몬스터',englishName:'Monster'},
    2:{code:2,type:0x2001,name:'싱크로',englishName:'Synchro'}
  };
  const deck=makeDeck();
  const result=addNamedCards(deck,'몬스터\n싱크로','side',cards);

  assert.deepEqual(result.added,[1,2]);
  assert.deepEqual(deck.main,[]);
  assert.deepEqual(deck.extra,[]);
  assert.deepEqual(deck.side,[1,2]);
});
