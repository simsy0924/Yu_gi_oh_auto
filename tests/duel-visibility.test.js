import test from 'node:test';
import assert from 'node:assert/strict';
import {isHiddenZoneForViewer,promptForViewer} from '../src/duel-visibility.js';

test('viewer can see their hand while opposing hand and both decks stay hidden',()=>{
  assert.equal(isHiddenZoneForViewer(1,2,1),false);
  assert.equal(isHiddenZoneForViewer(0,2,1),true);
  assert.equal(isHiddenZoneForViewer(0,1,1),true);
  assert.equal(isHiddenZoneForViewer(1,1,1),true);
  assert.equal(isHiddenZoneForViewer(0,64,1),true);
});

test('prompt for the other player contains no actions or card identities',()=>{
  const view=promptForViewer({player:0,type:'SELECT_CARD',title:'카드 선택',choices:[{id:'0',label:'사용자 패 카드',card:123,response:{secret:true}}],selection:{options:[{id:0,label:'기밀',card:123,source:{controller:0,location:2,sequence:0}}]}},1);
  assert.deepEqual(view,{player:0,type:'WAITING_FOR_PLAYER',title:'사용자 선택 대기 중',choices:[],selection:null});
});

test('legal choices omit engine responses and hide opponent hand labels',()=>{
  const view=promptForViewer({player:1,type:'SELECT_CARD',title:'카드 선택',choices:[
    {id:'0',label:'내 카드',shortLabel:'내 카드',card:123,response:{secret:true},source:{controller:1,location:2,sequence:0}},
    {id:'1',label:'상대 패의 비공개 카드',shortLabel:'비공개',card:456,response:{secret:true},source:{controller:0,location:2,sequence:0}}
  ],selection:{mode:'card',options:[{id:0,label:'내 패 카드',card:123,source:{controller:1,location:2,sequence:0}},{id:1,label:'상대 패의 비공개 카드',card:456,source:{controller:0,location:2,sequence:0}}]}},1);
  assert.equal(view.choices[0].label,'내 카드');
  assert.equal('response' in view.choices[0],false);
  assert.equal('card' in view.choices[0],false);
  assert.equal(view.choices[1].label,'비공개 카드 행동 1');
  assert.equal(view.selection.options[0].label,'내 패 카드');
  assert.equal(view.selection.options[1].label,'비공개 카드 2');
  assert.equal('card' in view.selection.options[1],false);
});
