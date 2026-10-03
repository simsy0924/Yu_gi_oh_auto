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

test('spectator view hides both hands and Extra Decks',()=>{
  for(const player of [0,1]){
    assert.equal(isHiddenZoneForViewer(player,1,2),true);
    assert.equal(isHiddenZoneForViewer(player,2,2),true);
    assert.equal(isHiddenZoneForViewer(player,64,2),true);
    assert.equal(isHiddenZoneForViewer(player,4,2),false);
  }
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

test('the acting player can read names selected from their own Deck while opponent Deck cards stay hidden',()=>{
  const view=promptForViewer({player:1,type:'SELECT_UNSELECT_CARD',choices:[
    {id:'0',label:'선택 · Jet Synchron · 덱 1',shortLabel:'소재 선택',card:9742784,cardName:'Jet Synchron',kind:'select',source:{controller:1,location:1,sequence:0},response:{secret:true}},
    {id:'1',label:'선택 · 상대 덱 카드',shortLabel:'소재 선택',card:123,cardName:'비공개 카드',kind:'select',source:{controller:0,location:1,sequence:0},response:{secret:true}}
  ],selection:{mode:'toggle',selectedCount:0,canFinish:false,options:[
    {id:'0',label:'선택 · Jet Synchron · 덱 1',card:9742784,cardName:'Jet Synchron',source:{controller:1,location:1,sequence:0}},
    {id:'1',label:'선택 · 상대 덱 카드',card:123,cardName:'비공개 카드',source:{controller:0,location:1,sequence:0}}
  ]}},1);
  assert.equal(view.choices[0].label,'선택 · Jet Synchron · 덱 1');
  assert.equal(view.choices[0].cardName,'Jet Synchron');
  assert.equal(view.choices[1].label,'비공개 카드 행동 1');
  assert.equal('cardName' in view.choices[1],false);
  assert.equal(view.selection.options[0].label,'선택 · Jet Synchron · 덱 1');
  assert.equal(view.selection.options[0].cardName,'Jet Synchron');
  assert.equal(view.selection.options[1].label,'비공개 카드 2');
  assert.equal('cardName' in view.selection.options[1],false);
});

test('a card already revealed to the viewer stays named in choices from the opposing hand',()=>{
  const prompt={player:0,type:'SELECT_CARD',title:'카드 선택',choices:[
    {id:'0',label:'선택 · 공개 카드 · 패 1',card:456,cardName:'공개 카드',source:{controller:1,location:2,sequence:0},response:{secret:true}}
  ],selection:{mode:'card',options:[
    {id:0,label:'공개 카드 · 패 1',card:456,cardName:'공개 카드',source:{controller:1,location:2,sequence:0}}
  ]}};
  const knownCards=[{code:456,controller:1,location:2,sequence:0}];
  const view=promptForViewer(prompt,0,knownCards);
  assert.equal(view.choices[0].label,'선택 · 공개 카드 · 패 1');
  assert.equal(view.selection.options[0].label,'공개 카드 · 패 1');
  assert.equal('response' in view.choices[0],false);
  assert.equal('card' in view.choices[0],false);
});
