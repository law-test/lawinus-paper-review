import React,{useState} from 'react';
import type {MingyuAnswer,Evidence} from './ai-mingyu-client';
import {type AnswerLevel} from './ai-mingyu-level';
import {termsForAnswer} from './ai-mingyu-public-model';
export type RouteInfo={category?:string;label?:string;reason?:string;route?:string;tier?:string;model?:string;requestedModel?:string;effort?:string};
export type Turn={question:string;answer:MingyuAnswer;level?:AnswerLevel;model?:string;elapsedMs?:number;source?:'faq'|'cache'|'model';originalSource?:'faq'|'model';generatedAt?:string;evidenceDate?:string;classification?:RouteInfo;route?:RouteInfo;entryId?:string};
const sectionLabels={current_law:'현행법·판례',foreign_law:'외국법·비교제도',research_method:'자료·연구방법',author_interpretation:'필자 해석',proposal:'개정안',limitations:'연구범위·한계'};
function evidenceHref(value:string):string|null{try{const url=new URL(value,'https://paper.lawinus.org/');return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export function EvidenceLink({href,label}:{href:string;label:string}){const safe=evidenceHref(href);return safe?<a href={safe} target="_blank" rel="noopener noreferrer">{label} ↗</a>:<span>{label} · 링크 확인 필요</span>;}
const responseTime=(ms:number)=>ms<1000?`${Math.max(1,Math.round(ms))}ms`:`${(ms/1000).toFixed(1)}초`;
const portrait='./kim-min-gyu-profile.jpg?v=92e0d14c5852';
export const messageTime=(value:string)=>new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
export function MingyuAvatar(){return <img className="mingyu-avatar" src={portrait} alt="김민규 소개 사진" width="42" height="42" decoding="async"/>;}
export const sourceLabel=(source?:string,originalSource?:string)=>source==='faq'?'검토된 FAQ 즉답':source==='cache'?(originalSource==='faq'?'검토된 FAQ 재사용':'이전에 생성한 AI 답변 재사용'):'새 AI 답변';
const evidenceKind=(e:Evidence)=>e.kind==='paper'?'논문':e.kind==='footnote'?'각주':e.kind==='law'?(/판례|판결|결정례/.test(e.label)?'판례':'조문'):'자료';
const answerWarning=(answer:MingyuAnswer)=>'sourceWarning' in answer&&typeof answer.sourceWarning==='string'?answer.sourceWarning:'';
const answerEdition=(answer:MingyuAnswer)=>'edition' in answer&&typeof answer.edition==='string'?answer.edition:'지시서 v104 문안모형 · 실제 적용원고 v102';
function answerForCopy(turn:Turn){
 const lines=['AI민규 · AI 연구 도우미의 답변',`질문: ${turn.question}`,`출처: ${sourceLabel(turn.source,turn.originalSource)}`,`판본: ${answerEdition(turn.answer)}`,`법령 자료 확인일: ${turn.evidenceDate||'2026-10-24'}`];
 if(turn.model)lines.push(`사용 모델/답변 제공 방식: ${turn.model}`);if(turn.generatedAt)lines.push(`작성: ${turn.generatedAt}`);
 lines.push('',turn.answer.summary);
 for(const section of turn.answer.sections){const label=sectionLabels[section.kind]||'확인 필요';lines.push('',`[${label}]${section.title&&section.title!==label?' '+section.title:''}`,section.text);for(const id of section.citationIds){const e=turn.answer.citations.find(c=>c.id===id);if(e)lines.push(`근거 · ${evidenceKind(e)}: ${e.label}`,evidenceHref(e.href)||'링크 확인 필요',...(e.edition?[`근거 판본: ${e.edition}`]:[]));}}
 const warning=answerWarning(turn.answer);if(warning)lines.push('',warning);return lines.join('\n');
}
export function AnswerCards({turn,level=turn.level||'undergraduate'}:{turn:Turn;level?:AnswerLevel}){
 const sourceWarning=answerWarning(turn.answer),[copyState,setCopyState]=useState(''),[copying,setCopying]=useState(false);
 async function copy(){setCopying(true);setCopyState('');try{if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(answerForCopy(turn));setCopyState('법적 구분과 근거 링크를 함께 복사했습니다.');}catch{setCopyState('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인한 뒤 다시 눌러 주세요.');}finally{setCopying(false);}}
 return <><p className="mingyu-summary">{turn.answer.summary}</p>{turn.answer.sections.map((section,i)=>{
  const label=sectionLabels[section.kind]||'확인 필요',refs=section.citationIds.map(id=>turn.answer.citations.find(x=>x.id===id)).filter((e):e is Evidence=>!!e),kinds=[...new Set(refs.map(evidenceKind))].map(kind=>`${kind} ${refs.filter(e=>evidenceKind(e)===kind).length}`).join(' · ');
  return <section className={`mingyu-section ${section.kind}`} key={i}><span className="mingyu-kind">{label}</span>{section.title.trim()!==label&&<h4>{section.title}</h4>}<p>{section.text}</p>{!!refs.length&&<details className="mingyu-sources" open={level==='doctoral'}><summary>근거 {refs.length}개 <span>· {kinds}</span></summary><ul className="mingyu-evidence">{refs.map(evidence=><li key={evidence.id}><EvidenceLink href={evidence.href} label={evidence.label}/>{evidence.edition&&<small> · {evidence.edition}</small>}</li>)}</ul></details>}</section>;
 })}{level==='high-school'&&termsForAnswer(turn.answer).length>0&&<aside className="mingyu-plain-terms" aria-label="쉬운 용어 풀이"><h4>용어 풀이</h4><dl>{termsForAnswer(turn.answer).map(([term,meaning])=><React.Fragment key={term}><dt>{term}</dt><dd>{meaning}</dd></React.Fragment>)}</dl></aside>}{sourceWarning&&<p className="mingyu-caption mingyu-source-warning">{sourceWarning}</p>}<p className="mingyu-caption">{sourceLabel(turn.source,turn.originalSource)}{turn.model&&` · ${turn.model}`}{turn.elapsedMs!==undefined&&` · 서버 처리 ${responseTime(turn.elapsedMs)}`}{turn.generatedAt&&` · 작성 ${new Date(turn.generatedAt).toLocaleString('ko-KR')}`}{turn.evidenceDate&&` · 자료 기준 ${turn.evidenceDate}`}</p><div className="mingyu-answer-tools"><button type="button" onClick={()=>void copy()} disabled={copying}>{copying?'복사 중…':'근거와 함께 복사'}</button>{copyState&&<span role="status">{copyState}</span>}</div></>
}

