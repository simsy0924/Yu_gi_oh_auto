import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deckCardInfoText} from '../src/card-info.js';

test('deck card text includes Korean card facts, complete effects, all zones and copy counts',()=>{
  const effect='① 이 카드가 일반 소환에 성공했을 때 발동할 수 있다.\n② 이 카드를 싱크로 소재로 사용할 수 있다.';
  const cards={
    101:{code:101,name:'레볼루션 싱크론',type:0x1021,attribute:1,race:8192,level:3,attack:900,defense:1400,desc:effect},
    201:{code:201,name:'정크 워리어',type:0x2021,attribute:1,race:1,level:5,attack:2300,defense:1300,desc:'싱크로 소환 성공 시 발동한다.'},
    301:{code:301,name:'스타라이트 로드',type:4,desc:'자신 필드의 카드를 파괴하는 효과를 무효로 한다.'}
  };
  const text=deckCardInfoText({name:'싱크론 덱',main:[101,101],extra:[201],side:[301]},cards);
  assert.ok(text.includes('덱 이름: 싱크론 덱'));
  assert.ok(text.includes('메인 덱 (2장)'));
  assert.ok(text.includes('카드 번호: 101'));
  assert.ok(text.includes('속성: 땅'));
  assert.ok(text.includes('종족: 드래곤족'));
  assert.ok(text.includes('레벨: 3'));
  assert.ok(text.includes('공격력: 900'));
  assert.ok(text.includes('카드 효과:\n'+effect));
  assert.ok(text.includes('매수: 2장'));
  assert.ok(text.includes('엑스트라 덱 (1장)'));
  assert.ok(text.includes('사이드 덱 (1장)'));
  assert.ok(text.includes(cards[301].desc));
  assert.equal((text.match(/레볼루션 싱크론/g)||[]).length,1);
});

test('link and Xyz cards export their distinct stats, and missing IDs remain visible',()=>{
  const cards={
    401:{code:401,name:'링크 몬스터',type:0x4000001,level:2,link:{rating:2},link_marker:192,attack:1200,defense:0,desc:'링크 효과'},
    402:{code:402,name:'랭크 몬스터',type:0x800021,level:4,attack:2000,defense:1800,desc:'엑시즈 효과'}
  };
  const text=deckCardInfoText({main:[401,402,999]},cards);
  assert.ok(text.includes('링크: 2'));
  assert.ok(text.includes('링크 마커: ↖ ↑'));
  assert.ok(!text.includes('수비력: 0'));
  assert.ok(text.includes('랭크: 4'));
  assert.ok(text.includes('카드 번호: 999'));
  assert.ok(text.includes('데이터베이스에 없습니다'));
});
