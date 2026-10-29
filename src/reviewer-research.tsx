import React from 'react';
import research from './reviewer-research.json';
const volumeLabel=(value:string|null|undefined)=>value?(/권|집/.test(value)?value:`제${value}권`):'';

export default function ReviewerResearch(){
 const {professor,works,books,sources}=research;
 return <details className="reviewer-research">
  <summary><strong>김규완 교수</strong> · 연구실적과 심사 대비</summary>
  <div className="reviewer-research-body">
   <p>{professor.institution} · {professor.field}<br/>{professor.education.join(' / ')}</p>
   <p>심사위원 변경을 반영했습니다. 아래 20개 질문은 공개 연구주제와 인간80 심사본을 연결해 준비한 연습질문입니다. 실제 심사위원의 질문이나 평가기준을 뜻하지 않습니다.</p>
   <ul>{professor.verifiedCareer.map(career=><li key={career}>{career}</li>)}</ul>
   <p className="reviewer-scope">논문·논문집 28건, 도서 계열 7건의 공개 서지를 수집하고, 공개된 일부 논문의 초록을 확인했습니다. 전문을 읽거나 개별 인용면을 확인한 목록은 아닙니다. 저장소의 판본·학술발표 기록은 이 수치에 더하지 않았습니다.</p>
   <h3>논문과 연결되는 최근 연구</h3>
   {works.filter(work=>work.year===2026).map(work=><article className="reviewer-work" key={work.id}>
    <a href={work.url} target="_blank" rel="noopener noreferrer">{work.title} ↗</a>
    <p>{[work.authors,work.journal,volumeLabel(work.volume),work.issue?`제${work.issue}호`:'',work.date,work.pages?`${work.pages}면`:''].filter(Boolean).join(' · ')}</p>
    <p>{work.topicSummary}</p><p>심사 대비: {work.relevance}</p>
   </article>)}
   <details><summary>논문·논문집 전체 목록 28건</summary><ol className="reviewer-work-list">{works.map(work=><li key={work.id}>
    <a href={work.url} target="_blank" rel="noopener noreferrer">{work.title} ↗</a>
    <p>{[work.authors,work.journal,volumeLabel(work.volume),work.issue?`제${work.issue}호`:'',work.year,work.pages?`${work.pages}면`:''].filter(Boolean).join(' · ')}</p>
    <small>{work.verificationScope}</small>
   </li>)}</ol></details>
   <details><summary>저서·공저·공역 7계열</summary><ul className="reviewer-work-list">{books.map(book=><li key={book.title}>
    <a href={book.url} target="_blank" rel="noopener noreferrer">{book.title} ↗</a>
    <p>{[book.year,book.publisher,book.role].filter(Boolean).join(' · ')}</p><small>{book.verificationScope}</small>
   </li>)}</ul></details>
   <p className="reviewer-scope">오래된 교수소개에 적힌 학회 직함은 현재 직함으로 단정하지 않았습니다. 도서의 제시 판본도 최신판을 뜻하지 않습니다. 확인일: {research.asOf}.</p>
   <div className="reviewer-source-links">{sources.filter(source=>['profile','faculty','scholar','society'].includes(source.id)).map(source=><a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>)}</div>
  </div>
 </details>;
}
