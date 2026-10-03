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

function normalizeEffectText(value){
  return String(value??'').replace(/\r\n?/g,'\n').replace(/<br\s*\/?>/gi,'\n').trim();
}
function parseEffectSections(value){
  const text=normalizeEffectText(value), parsed={structured:false,raw:text,pendulum:'',monster:'',flavor:''};
  const heading=/(?:【|\[)\s*(Pendulum|Monster|Flavor(?:\s+Text)?|펜듈럼|몬스터|플레이버(?:\s*텍스트)?|ペンデュラム|モンスター|フレーバーテキスト)(?:\s*(?:Effect|효과))?\s*(?:】|\])/giu;
  let current='',firstSection='',prefix='',cursor=0,match;
  const append=(section,part)=>{
    const clean=part.trim();
    if(clean)parsed[section]=[parsed[section],clean].filter(Boolean).join('\n');
  };
  while((match=heading.exec(text))){
    if(current)append(current,text.slice(cursor,match.index));
    else prefix=text.slice(0,match.index).trim();
    const label=match[1].toLowerCase().replace(/\s+/g,' ').trim();
    current=/^(?:pendulum|펜듈럼|ペンデュラム)$/i.test(label)
      ?'pendulum'
      :/^(?:flavor|플레이버|フレーバー)/i.test(label)
        ?'flavor'
        :'monster';
    if(!firstSection)firstSection=current;
    parsed.structured=true;
    cursor=heading.lastIndex;
  }
  if(!parsed.structured)return parsed;
  append(current,text.slice(cursor));
  if(prefix&&firstSection)parsed[firstSection]=[prefix,parsed[firstSection]].filter(Boolean).join('\n');
  return parsed;
}
function cardEffectSections(c){
  const isNormal=!!((c.type&0x10)&&!(c.type&0x20));
  const descriptionTitle=isNormal?'카드 설명':'카드 효과';
  if(!(c.type&0x1000000))return [{title:descriptionTitle,text:normalizeEffectText(c.desc)||'효과 텍스트가 없습니다.'}];

  const translated=parseEffectSections(c.desc),original=parseEffectSections(c.englishDesc);
  const hasEnglishSource=!!normalizeEffectText(c.englishDesc);
  const descriptionIsEnglish=hasEnglishSource&&normalizeEffectText(c.desc)===normalizeEffectText(c.englishDesc);
  const sections=[];
  const localizedPendulum=normalizeEffectText(c.pendulumEffect)||(!descriptionIsEnglish?translated.pendulum:'');
  const pendulum=localizedPendulum||original.pendulum;
  sections.push({
    title:localizedPendulum?'펜듈럼 효과':original.pendulum?'펜듈럼 효과 (영문 원문)':'펜듈럼 효과',
    text:pendulum||'펜듈럼 효과 텍스트를 찾을 수 없습니다.'
  });

  let body='',bodyTitle=isNormal?'카드 설명':'몬스터 효과';
  if(!descriptionIsEnglish&&translated.monster){
    body=translated.monster;
  }else if(!descriptionIsEnglish&&translated.flavor){
    body=translated.flavor;
    bodyTitle='카드 설명';
  }else if(!descriptionIsEnglish&&!translated.structured&&translated.raw){
    body=translated.raw;
  }else if(original.monster){
    body=original.monster;
    bodyTitle='몬스터 효과 (영문 원문)';
  }else if(original.flavor){
    body=original.flavor;
    bodyTitle='카드 설명 (영문 원문)';
  }else if(!descriptionIsEnglish&&!translated.structured&&translated.raw){
    body=translated.raw;
  }else if(original.raw&&!original.structured){
    body=original.raw;
    bodyTitle=isNormal?'카드 설명 (영문 원문)':'카드 효과 (영문 원문, 구분 정보 없음)';
  }

  if(body)sections.push({title:bodyTitle,text:body});
  else if(translated.structured||original.structured){
    sections.push({
      title:isNormal?'카드 설명':'몬스터 효과',
      text:isNormal?'카드 설명 텍스트를 찾을 수 없습니다.':'몬스터 효과 텍스트를 찾을 수 없습니다.'
    });
  }else{
    sections.push({title:descriptionTitle,text:'효과 텍스트가 없습니다.'});
  }
  return sections;
}

function cardInfoText(c,copies=1){
  const lines=[c.name??c.code];
  if(copies>1)lines.push(`매수: ${copies}장`);
  lines.push(...cardFacts(c).map(([key,value])=>`${key}: ${value}`));
  for(const section of cardEffectSections(c))lines.push(`${section.title}:`,section.text);
  return lines.join('\n');
}
export function deckCardInfoText(deck,cards){
  const parts=[['main','메인 덱'],['extra','엑스트라 덱'],['side','사이드 덱']];
  const output=[`덱 이름: ${deck?.name?.trim()||'내 덱'}`];
  for(const [part,label] of parts){
    const list=Array.isArray(deck?.[part])?deck[part]:[];
    const grouped=new Map();
    for(const code of list)grouped.set(code,(grouped.get(code)||0)+1);
    const entries=[...grouped].map(([code,copies])=>{
      const card=cards?.[code];
      return card?cardInfoText(card,copies):`카드 번호: ${code}\n카드 정보: 데이터베이스에 없습니다.`;
    });
    output.push(`${label} (${list.length}장)\n${entries.length?entries.join('\n\n'):'등록된 카드가 없습니다.'}`);
  }
  return `${output.join('\n\n')}\n`;
}

export function cardInfoHtml(c){
  if(!c||c.hidden)return '<p>공개된 카드 정보가 없습니다.</p>';
  const facts=cardFacts(c).map(([key,value])=>'<div><dt>'+esc(key)+'</dt><dd>'+esc(value)+'</dd></div>').join('');
  const effects=cardEffectSections(c).map(section=>'<h4>'+esc(section.title)+'</h4><p class="card-description">'+esc(section.text)+'</p>').join('');
  return '<article class="card-info"><h3>'+esc(c.name??c.code)+'</h3><dl class="card-facts">'+facts+'</dl>'+effects+'</article>';
}
