import React,{useEffect,useRef,useState} from 'react';
import {privateResource,type Session} from './reader-api';
import {officialURL,type PageTarget} from './page-text';
import './case-pane.css';

export type CaseRecord={caseNumber:string;title:string;header?:string;sourceLabel?:string;scope?:string;officialUrl?:string;available:boolean;format?:'text'|'pages';content?:{heading:boolean;text:string}[];sourceId?:string;message?:string;notice?:string};
export default function CasePane({session,target,onClose,renderReference}:{session:Session;target:PageTarget;onClose:()=>void;renderReference?:(sourceId:string)=>React.ReactNode}){
  const number=(target.label||target.title||'').match(/\d{2,4}[가-힣]{1,5}\d{1,8}/)?.[0]||'';
  const [record,setRecord]=useState<CaseRecord|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const pane=useRef<HTMLElement>(null);
  useEffect(()=>{
    const controller=new AbortController();setRecord(null);setError('');
    if(pane.current)pane.current.scrollTop=0;
    if(!number){setError('사건번호를 확인할 수 없습니다.');return()=>controller.abort();}
    privateResource(session,new URLSearchParams({metadata:'case',case:number}),controller.signal).then(r=>r.json()).then((data:CaseRecord)=>{
      if(controller.signal.aborted)return;
      if(data.caseNumber!==number||typeof data.available!=='boolean')throw Error('판례 정보를 확인하지 못했습니다.');
      if(data.available&&data.format==='text'&&!Array.isArray(data.content))throw Error('판결문을 확인하지 못했습니다.');
      setRecord(data);
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'판례를 불러오지 못했습니다.');});
    return()=>controller.abort();
  },[session,number,attempt]);
  const url=officialURL(record?.officialUrl)||officialURL(target.url);
  return <section className="source-dialog case-pane" ref={pane} aria-label={'판례 원문 '+number}>
    <div className="case-pane-actions"><strong>판례 원문</strong><button type="button" onClick={onClose}>인용자료로 돌아가기</button></div>
    <h2>{record?.title||number||target.title}</h2>
    <p className="case-identification">{record?.header||number}</p>
    {record?.sourceLabel&&<p className="case-source">{record.sourceLabel}{record.scope&&' · '+record.scope}</p>}
    {record?.notice&&<p className="case-source">{record.notice}</p>}
    {url&&<a className="case-official-link" href={url} target="_blank" rel="noopener noreferrer">공식 사이트에서도 보기 ↗</a>}
    {error?<p className="case-status" role="status">{error} <button type="button" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button></p>:!record?<p className="case-status" role="status">판결문을 불러오는 중…</p>:!record.available?<p className="case-status" role="status">{record.message||'이 판례의 공개 원문은 현재 연결되어 있지 않습니다.'}</p>:record.format==='pages'&&record.sourceId?renderReference?.(record.sourceId):
      <div className="case-original-text">{record.content?.map((block,index)=>block.heading?<h3 key={index}>{block.text}</h3>:<p key={index}>{block.text}</p>)}</div>}
  </section>;
}
