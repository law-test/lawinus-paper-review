import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {privateResource,type Session} from './reader-api';
import {officialURL,type PageTarget} from './page-text';
import {caseDestination} from './citation-links';
import './case-pane.css';

export type CaseRecord={caseNumber:string;title:string;header?:string;sourceLabel?:string;scope?:string;officialUrl?:string;available:boolean;format?:'text'|'pages';content?:{heading:boolean;text:string}[];sourceId?:string;message?:string;notice?:string};
type Block={heading:boolean;text:string;part?:'order'|'reasons'};

function judgmentBlocks(content:NonNullable<CaseRecord['content']>):Block[]{
  return content.flatMap(block=>{
    // Official records can join a bracketed heading to the preceding line of text.
    const pieces=block.text.split(/(【\s*주\s*문\s*】|【\s*이\s*유\s*】)/u);
    return pieces.filter(text=>text.length>0).map(text=>{
      const label=text.replace(/[【】\s]/gu,'');
      const part=label==='주문'?'order':label==='이유'?'reasons':undefined;
      return {text,heading:Boolean(part)||block.heading,part};
    });
  });
}

function originalParagraph(text:string){
  // The source marks numbered grounds with a nonbreaking space; ordinary dates use regular spaces.
  const groups=text.split(/(?<!\S)(?=(?:[1-9]\d*|[가-하])\.\u00a0)/u);
  return groups.length===1?text:groups.map((group,index)=><span className="case-paragraph-line" key={index}>{group}</span>);
}

export default function CasePane({session,target,number:catalogNumber,onClose,renderReference,focusKey=0,focusJudgment=true}:{
  session:Session;target?:PageTarget;number?:string;onClose?:()=>void;
  renderReference?:(sourceId:string)=>React.ReactNode;focusKey?:number;focusJudgment?:boolean
}){
  const number=catalogNumber||target?.caseNumber||(target?.label||target?.title||'').match(/\d{2,4}[가-힣]{1,5}\d{1,8}/)?.[0]||'';
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
  const blocks=useMemo(()=>judgmentBlocks(record?.caseNumber===number?record.content||[]:[]),[record,number]);
  useLayoutEffect(()=>{
    if(!focusJudgment||record?.caseNumber!==number||!blocks.some(block=>block.part==='order'))return;
    const frame=requestAnimationFrame(()=>{
      const host=pane.current?.closest<HTMLElement>('.source-dialog');
      const heading=pane.current?.querySelector<HTMLElement>('[data-judgment-start]');
      if(host&&heading)host.scrollTop+=heading.getBoundingClientRect().top-host.getBoundingClientRect().top-6;
    });
    return ()=>cancelAnimationFrame(frame);
  },[number,record,blocks,focusKey,focusJudgment]);
  const url=officialURL(caseDestination(number))||officialURL(record?.officialUrl)||officialURL(target?.url);
  const urlLabel=url?.includes('/precSc.do')?'공식 판례 검색':url?.includes('peruse_status')?'법원 판결서 열람 안내':'공식 사이트에서도 보기';
  return <section className={onClose?'source-dialog case-pane':'case-pane embedded-case'} ref={pane} aria-label={'판례 원문 '+number}>
    <div className="case-pane-actions"><strong>판례 원문</strong>{onClose&&<button type="button" onClick={onClose}>인용자료로 돌아가기</button>}</div>
    {onClose&&<h2>{record?.title||number||target?.title}</h2>}
    <p className="case-identification">{record?.header||number}</p>
    {record?.sourceLabel&&<p className="case-source">{record.sourceLabel}{record.scope&&' · '+record.scope}</p>}
    {record?.notice&&<p className="case-source">{record.notice}</p>}
    {url&&<a className="case-official-link" href={url} target="_blank" rel="noopener noreferrer">{urlLabel} ↗</a>}
    {error?<p className="case-status" role="status">{error} <button type="button" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button></p>:!record?<p className="case-status" role="status">판결문을 불러오는 중…</p>:!record.available?<p className="case-status" role="status">{record.message||'이 판례의 공개 원문은 현재 연결되어 있지 않습니다.'}</p>:record.format==='pages'&&record.sourceId?renderReference?.(record.sourceId):
      <div className="case-original-text">{blocks.map((block,index)=>block.heading?
        <h3 key={index} data-judgment-start={block.part==='order'?'':undefined} data-judgment-reasons={block.part==='reasons'?'':undefined}>{block.text}</h3>:
        <p key={index}>{originalParagraph(block.text)}</p>)}</div>}
  </section>;
}
