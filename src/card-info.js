import {attributes,races,cardStatKind} from './catalog.js';

const types=[
  [1,'몬스터'],[2,'마법'],[4,'함정'],[0x10,'일반'],[0x20,'효과'],[0x40,'융합'],
  [0x80,'의식'],[0x100,'함정 몬스터'],[0x200,'스피릿'],[0x400,'유니온'],
  [0x800,'듀얼'],[0x1000,'튜너'],[0x2000,'싱크로'],[0x4000,'토큰'],
  [0x10000,'속공'],[0x20000,'지속'],[0x40000,'장착'],[0x80000,'필드'],
  [0x100000,'카운터 함정'],[0x200000,'리버스'],[0x400000,'툰'],
  [0x800000,'엑시즈'],[0x1000000,'펜듈럼'],[0x2000000,'특수 소환'],[0x4000000,'링크']
];
export const linkArrows=mask=>[[64,'↖'],[128,'↑'],[256,'↗'],[8,'←'],[32,'→'],[1,'↙'],[2,'↓'],[4,'↘']].filter(([bit])=>mask&bit).map(([,arrow])=>arrow).join(' ');
const named=(entries,value)=>entries.find(([bit])=>Number(bit)===Number(value))?.[1]??'미상';
export function cardFacts(c){
  if(!c||c.hidden)return [];
  const facts=[['카드 번호',c.code],['종류',types.filter(([bit])=>c.type&bit).map(([,label])=>label).join(' · ')||'미상']];
  if(c.zoneLabel)facts.push(['현재 위치',c.zoneLabel]);
  if(c.zoneLabel&&c.position!=null&&/[존]/.test(c.zoneLabel))facts.push(['표시 형식',(c.position&8)?'뒷면 수비':(c.position&4)?'앞면 수비':(c.position&2)?'뒷면 공격':'앞면 공격']);
  if(c.type&1){
    facts.push(['속성',named(attributes,c.attribute)],['종족',named(races,c.race)]);
    const stat=cardStatKind(c),level=stat==='link'?(c.link?.rating||c.level):c.level;
    facts.push([stat==='link'?'링크':stat==='rank'?'랭크':'레벨',level]);
    facts.push(['공격력',c.attack??'?']);
    if(c.originalAttack!=null&&c.originalAttack!==c.attack)facts.push(['원래 공격력',c.originalAttack]);
    if(stat==='link')facts.push(['링크 마커',linkArrows(c.link_marker??c.link?.marker??0)||'없음']);
    else {facts.push(['수비력',c.defense??'?']);if(c.originalDefense!=null&&c.originalDefense!==c.defense)facts.push(['원래 수비력',c.originalDefense]);}
    if(c.type&0x1000000)facts.push(['펜듈럼 스케일',`${c.lscale??'?'} / ${c.rscale??'?'}`]);
    if(c.type&0x800000&&c.overlayCards?.length)facts.push(['엑시즈 소재',`${c.overlayCards.length}장`]);
  }
  for(const [type,number] of Object.entries(c.counters??{}))if(number>0)facts.push([`카운터 ${type}`,`${number}개`]);
  return facts;
}
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function cardInfoHtml(c){
  if(!c||c.hidden)return '<p>공개된 카드 정보가 없습니다.</p>';
  const descriptionTitle=(c.type&0x10)&&!(c.type&0x20)?'카드 설명':'카드 효과';
  return `<article class="card-info"><h3>${esc(c.name??c.code)}</h3><dl class="card-facts">${cardFacts(c).map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><h4>${descriptionTitle}</h4><p class="card-description">${esc(c.desc||'효과 텍스트가 없습니다.')}</p></article>`;
}
