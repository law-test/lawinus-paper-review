import React,{useMemo,useState} from 'react';
import faqData from './thesis-faq.json';
import {filterFaq,type FaqItem} from './thesis-faq-model';
import './thesis-faq.css';
import {LegalText} from './legal-links';

const items=faqData.items as FaqItem[];

function FaqQuestion({item,index,searching,onQuestion}:{item:FaqItem;index:number;searching:boolean;onQuestion?:(item:FaqItem)=>void}){
 const [expanded,setExpanded]=useState(false);
 const open=searching||expanded;
 const researchSources=item.sources.filter(source=>/질문.*설계|연구 참고/.test(source.label));
 const answerSources=item.sources.filter(source=>!researchSources.includes(source));
 return <article className="faq-item" id={item.id}>
  <h3><button type="button" className="faq-question" aria-expanded={open} aria-controls={`${item.id}-answer`} onClick={()=>setExpanded(value=>!value)} disabled={searching}>
   <span className="faq-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
   <span className="faq-question-label">{item.question}</span>
   <span className="faq-toggle" aria-hidden="true">{open?'−':'＋'}</span>
  </button></h3>
  <div id={`${item.id}-answer`} className="faq-answer" hidden={!open}>
   <span className="faq-category">{item.category}</span>
   {item.answer.map((paragraph,i)=><p key={i}><LegalText text={paragraph} contextId={`faq:${item.id}`} defaultLawId={item.defaultLawId}/></p>)}
   <div className="faq-evidence"><h4>답변의 근거</h4><ul>{answerSources.map(source=><li key={source.href+source.label}>
    <a href={source.href} target="_blank" rel="noopener noreferrer" aria-label={`${source.label} (새 창에서 열기)`}>{source.label}<span aria-hidden="true"> ↗</span></a>
   </li>)}</ul>{researchSources.length>0&&<><h4>질문의 관점에 참고한 연구</h4><ul>{researchSources.map(source=><li key={source.href+source.label}><a href={source.href} target="_blank" rel="noopener noreferrer">{source.label}<span aria-hidden="true"> ↗</span></a></li>)}</ul></>}</div>
   {onQuestion&&<button className="faq-chat-question" onClick={()=>onQuestion(item)}>이 답변을 대화창에서 보기</button>}
  </div>
 </article>;
}

export default function ThesisFaq({onQuestion}:{onQuestion?:(item:FaqItem)=>void}={}){
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('전체');
 const categories=useMemo(()=>[...new Set(items.map(item=>item.category))],[]);
 const filtered=useMemo(()=>filterFaq(items.filter(item=>category==='전체'||item.category===category),query),[query,category]);
 const searching=!!query.trim();
 return <div className="scroll-panel thesis-faq-panel">
  <div className="panel-heading"><span className="section-eyebrow">FAQ</span><h2>논문에 관한 질문과 답변</h2>
   <p>논문의 핵심 주장, 예상 반론, 미국·일본·독일의 비교법과 문헌 연구방법을 주제별로 모았습니다. 각 답변에서 논문·각주·법령·문헌 근거를 열어볼 수 있습니다.</p>
  </div>
  <label className="faq-search-label" htmlFor="thesis-faq-category">주제별 보기</label>
  <select id="thesis-faq-category" value={category} onChange={event=>setCategory(event.target.value)} style={{width:'100%',padding:'10px',marginBottom:'12px',border:'1px solid #bbc9c1',borderRadius:'6px',background:'white',font:'inherit'}}><option>전체</option>{categories.map(value=><option key={value}>{value}</option>)}</select>
  <label className="faq-search-label" htmlFor="thesis-faq-search">질문·답변·근거 검색</label>
  <div className="faq-search"><input id="thesis-faq-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="예: 면책, 배당, 신탁"/>
   {query&&<button type="button" onClick={()=>setQuery('')} aria-label="FAQ 검색 지우기">지우기</button>}
  </div>
  <p className="faq-count" role="status">{searching?`${filtered.length}개 질문 검색됨 · 검색 중에는 답변이 펼쳐집니다.`:`전체 ${items.length}개 중 ${filtered.length}개 질문 · 질문을 누르면 답변을 볼 수 있습니다.`}</p>
  <div className="faq-list">{filtered.map(item=><FaqQuestion key={item.id} item={item} index={items.indexOf(item)} searching={searching} onQuestion={onQuestion}/>)}</div>
  {!filtered.length&&<div className="faq-empty"><p>일치하는 질문이 없습니다.</p><button type="button" onClick={()=>setQuery('')}>전체 질문 보기</button></div>}
 </div>;
}
