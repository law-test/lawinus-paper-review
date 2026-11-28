import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import rawIndex from './review-index.json';
import {editionId} from './edition';
import {folioLabel} from './thesis-folios';
import './review-history.css';

type Example = {id:string;title:string;beforePage:string;afterPage:string};
type Issue = {id:string;reviewer:string;number:number;title:string;summary:string;examples:Example[]};
export type Anchor = {page:number;y:number;x:number;line:number;exampleIds:string[]};
type ReviewIndex = {edition:string;issues:Issue[];anchors:Anchor[];extraExamples?:Example[]};
type Run = {text:string;u:boolean};
type Detail = {id:string;before:Run[];after:Run[];reason:string[]};
export type ActiveRevision = {id:string;anchor:Anchor};

const index:ReviewIndex=rawIndex;
const issues=index.edition===editionId?index.issues:[];
const reviewers=[...new Set(issues.map(issue=>issue.reviewer))];
const examples=new Map<string,Example>();
const groupByExample=new Map<string,Issue>();
const pageAnchors=new Map<number,Anchor[]>();
const locations=new Map<string,Anchor[]>();
const details=new Map<string,Detail>();

for(const issue of issues){
  for(const sample of issue.examples){
    examples.set(sample.id,sample);
    groupByExample.set(sample.id,issue);
  }
}
if(index.edition===editionId){
  for(const sample of index.extraExamples||[])examples.set(sample.id,sample);
  for(const anchor of index.anchors){
    const rows=pageAnchors.get(anchor.page)||[];
    rows.push(anchor);
    pageAnchors.set(anchor.page,rows);
    for(const id of anchor.exampleIds){
      const parts=locations.get(id)||[];
      parts.push(anchor);
      locations.set(id,parts);
    }
  }
}
for(const list of pageAnchors.values())list.sort((a,b)=>a.y-b.y||a.x-b.x);
const firstAnchor=(id:string)=>locations.get(id)?.[0];
const shortTitle=(s:string)=>s.replace(/^\d+\.\s*/u,'');
const issueTitle=(s:string)=>s.replace(/^수정사항\s*\d+\.\s*/u,'');
const sessionKey='paper:review-seen:'+editionId;
let memorySeen=false;
export function showChecklistOnArrival(){
  if(!issues.length||memorySeen||location.hash)return false;
  try{return sessionStorage.getItem(sessionKey)!=='1';}catch{return true;}
}
function cacheVisit(){
  memorySeen=true;
  try{sessionStorage.setItem(sessionKey,'1');}catch{}
}
export const reviewAvailable=issues.length>0;
export function ChecklistButton({onClick,open}:{onClick:()=>void;open:boolean}){
  return reviewAvailable?<button type="button" className="review-launch" aria-haspopup="dialog" aria-expanded={open} onClick={onClick}>심사 체크리스트</button>:null;
}

export function ReviewChecklist({initialIssue,onClose,onRead}:{initialIssue?:string;onClose:()=>void;onRead:(id:string,anchor:Anchor)=>void}){
  const dialog=useRef<HTMLDialogElement>(null),scroll=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null);
  const [selected,select]=useState(initialIssue);
  const group=issues.find(q=>q.id===selected);
  const keep=useRef({top:0,id:''});
  useLayoutEffect(()=>{
    const el=dialog.current;if(!el)return;
    el.showModal();
    cacheVisit();
    const title=el.querySelector<HTMLElement>('[data-review-focus]');
    title?.focus({preventScroll:true});
    return()=>{if(el.open)el.close();};
  },[]);
  useLayoutEffect(()=>{
    const view=scroll.current;if(!view)return;
    if(group){view.scrollTop=0;heading.current?.focus({preventScroll:true});}
    else if(keep.current.id){
      view.scrollTop=keep.current.top;
      view.querySelector<HTMLElement>('[data-review-issue="'+keep.current.id+'"]')?.focus({preventScroll:true});
    }
  },[group]);
  function enter(issue:Issue){
    keep.current={top:scroll.current?.scrollTop||0,id:issue.id};
    select(issue.id);
  }
  function read(example:Example){
    const anchor=firstAnchor(example.id);
    if(!anchor)return;
    if(dialog.current?.open)dialog.current.close();
    onRead(example.id,anchor);
  }
  return <dialog className="review-dialog" ref={dialog} aria-labelledby="review-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{
    if(e.target!==e.currentTarget)return;
    const b=e.currentTarget.getBoundingClientRect();
    if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)onClose();
  }}>
    <header className="review-modal-header"><div><p>박사학위논문 · 2차 심사</p><h2 tabIndex={-1} data-review-focus id="review-title">심사 체크리스트</h2></div><button type="button" className="review-dismiss" onClick={onClose}>닫기</button></header>
    {group?<div className="review-navigation"><button type="button" onClick={()=>select(undefined)}>← 전체 지적사항</button><span>{group.reviewer} 교수님</span></div>:
    <nav className="review-navigation" aria-label="심사위원별 지적사항">{reviewers.map((name,i)=><button key={name} type="button" onClick={()=>{
      const el=document.getElementById('review-prof-'+i);el?.scrollIntoView({block:'start'});el?.focus({preventScroll:true});
    }}>{name}</button>)}</nav>}
    <div className="review-modal-scroll" ref={scroll}>
      {group?<section className="review-issue-detail" data-current-issue={group.id}>
        <p className="review-kicker">수정사항 {group.number}</p><h3 ref={heading} tabIndex={-1}>{issueTitle(group.title)}</h3><p className="review-summary">{group.summary}</p>
        <h4>논문 수정 문단</h4><ol className="review-examples">{group.examples.map(example=><li key={example.id}><button type="button" data-review-example={example.id} onClick={()=>read(example)}><span>{shortTitle(example.title)}</span><small>{example.afterPage} →</small></button></li>)}</ol>
      </section>:reviewers.map((name,i)=><section className="review-professor" key={name}>
        <h3 id={'review-prof-'+i} tabIndex={-1}>{name} 교수님</h3><ol className="review-index-list">{issues.filter(q=>q.reviewer===name).map(q=><li key={q.id}>
          <button className="review-issue-link" type="button" data-review-issue={q.id} onClick={()=>read(q.examples[0])}><span>{q.number}.</span>{issueTitle(q.title)}</button>
          <button className="review-case-list" type="button" data-review-cases={q.id} aria-label={name+' 교수님 수정사항 '+q.number+'의 수정 사례 '+q.examples.length+'개 보기'} onClick={()=>enter(q)}>사례 {q.examples.length}개</button>
        </li>)}</ol></section>)}
    </div>
  </dialog>;
}

type Marker = {anchor:Anchor;ids:string[]};
// Group buttons only when their physical touch targets would overlap at this zoom.
function markerRows(anchors:Anchor[],height:number){
  const rows:Marker[]=[];
  for(const a of anchors){
    const prev=rows.at(-1);
    if(prev&&Math.abs(prev.anchor.y-a.y)*height<23){
      for(const id of a.exampleIds)if(!prev.ids.includes(id))prev.ids.push(id);
    }else rows.push({anchor:a,ids:[...a.exampleIds]});
  }
  return rows;
}
export function RevisionMarkers({page,active,onPick}:{page:number;active:ActiveRevision|null;onPick:(id:string,anchor:Anchor,related:string[])=>void}){
  const rail=useRef<HTMLDivElement>(null);
  const [height,setHeight]=useState(0);
  useLayoutEffect(()=>{
    const el=rail.current;if(!el)return;
    const update=()=>setHeight(el.getBoundingClientRect().height);
    update();
    const ro=new ResizeObserver(update);ro.observe(el);return()=>ro.disconnect();
  },[]);
  const anchors=pageAnchors.get(page);
  if(!anchors?.length)return null;
  return <div className="revision-rail" ref={rail}>{markerRows(anchors,height||10000).map(({anchor,ids})=>{
    const selected=active?.anchor.page===page&&ids.includes(active.id)&&anchors.some(a=>a===active.anchor&&Math.abs(a.y-anchor.y)*(height||10000)<23);
    const id=selected?active!.id:ids[0],title=examples.get(id)?.title||'수정 문단';
    return <button type="button" className="revision-marker" key={anchor.line+':'+anchor.y+':'+anchor.x}
      data-review-examples={ids.join(' ')} data-review-y={anchor.y} aria-pressed={!!selected}
      title={'수정이력 추적 · '+shortTitle(title)} aria-label={'수정이력 추적 · '+shortTitle(title)+(ids.length>1?' 외 '+(ids.length-1)+'개 항목':'')}
      style={{top:anchor.y*100+'%'}} onClick={()=>onPick(id,selected?active!.anchor:anchor,ids)}>
      <span className="revision-marker-text">수정이력 추적</span><span className="revision-marker-short" aria-hidden="true">이력</span>{ids.length>1&&<sup>{ids.length}</sup>}
    </button>;
  })}</div>;
}

function isDetail(value:unknown,id:string):value is Detail{
  if(!value||typeof value!=='object')return false;
  const d=value as Detail;
  const runs=(v:Run[])=>Array.isArray(v)&&v.every(x=>x&&typeof x.text==='string'&&typeof x.u==='boolean');
  return d.id===id&&runs(d.before)&&runs(d.after)&&Array.isArray(d.reason)&&d.reason.every(s=>typeof s==='string');
}
function Quote({runs}:{runs:Run[]}){
  if(!runs.some(run=>run.text.trim()))return <p className="revision-absent">이 위치에 대응하는 문단이 없습니다.</p>;
  return <div className="revision-quote">{runs.map((run,i)=>run.u?<u key={i}>{run.text}</u>:<React.Fragment key={i}>{run.text}</React.Fragment>)}</div>;
}
export function RevisionPanel({active,related,onRead,onClose,onIssue}:{active:ActiveRevision;related:string[];onRead:(id:string,anchor:Anchor)=>void;onClose:()=>void;onIssue:(id?:string)=>void}){
  const sample=examples.get(active.id)!,group=groupByExample.get(active.id);
  const nextIssue = group ? issues[issues.indexOf(group) + 1] : undefined;
  const nextExample = nextIssue?.examples[0];
  const nextAnchor = nextExample && firstAnchor(nextExample.id);
  const nextLabel = nextIssue
    ? '다음 수정사항 · ' + nextIssue.reviewer + ' 교수님 수정사항 ' + nextIssue.number
    : '마지막 수정사항';
  const nextButton = group && <button className="revision-next" type="button" data-review-next={nextIssue?.id || ''}
    disabled={!nextAnchor} aria-label={nextLabel} title={nextLabel}
    onClick={()=>{if(nextExample && nextAnchor)onRead(nextExample.id,nextAnchor);}}>
    {nextIssue ? '다음 수정사항' : '마지막 수정사항'} <span aria-hidden="true">→</span>
  </button>;
  const [state,setState]=useState<{id:string;data?:Detail;error?:boolean}>({id:''});
  const [attempt,setAttempt]=useState(0);
  const root=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{const el=root.current;if(el){el.scrollTop=0;el.focus({preventScroll:true});}},[active]);
  useEffect(()=>{
    if(details.has(active.id))return;
    const ctrl=new AbortController(),id=active.id;
    async function fetchDetail(){
      try{
        const r=await fetch(new URL('./review-60/'+encodeURIComponent(id)+'.json',document.baseURI),{signal:ctrl.signal});
        if(!r.ok)throw new Error();
        const value:unknown=await r.json();
        if(!isDetail(value,id))throw new Error();
        if(!ctrl.signal.aborted){details.set(id,value);setState({id,data:value});}
      }catch{if(!ctrl.signal.aborted)setState({id,error:true});}
    }
    void fetchDetail();
    return()=>ctrl.abort();
  },[active.id,attempt]);
  const data=details.get(active.id)||(state.id===active.id?state.data:undefined);
  const error=state.id===active.id&&state.error;
  const points=locations.get(active.id)||[];
  return <section ref={root} className="revision-panel" data-review-active={active.id} tabIndex={-1} aria-label="수정이력 추적">
    <div className="revision-panel-nav">{group?<button type="button" onClick={()=>onIssue(group.id)}>{group.reviewer} 교수님 · 수정사항 {group.number}</button>:<span>원고 수정</span>}<button type="button" className="revision-close" onClick={onClose}>참고자료로 돌아가기</button>{nextButton}</div>
    {group && <p className="revision-issue-title" data-review-issue-title={group.id}>{issueTitle(group.title)}</p>}
    <h2>{shortTitle(sample.title)}</h2>
    {related.length>1&&<div className="revision-related"><h3>이 위치의 다른 수정이력</h3>{related.filter(id=>id!==active.id).map(id=>{
      const dest=(locations.get(id)||[]).filter(a=>a.page===active.anchor.page).sort((a,b)=>Math.abs(a.y-active.anchor.y)-Math.abs(b.y-active.anchor.y))[0]||firstAnchor(id);
      const g=groupByExample.get(id);
      return dest?<button type="button" key={id} data-review-switch={id} onClick={()=>onRead(id,dest)}>{g?g.reviewer+' '+g.number+' · ':''}{shortTitle(examples.get(id)!.title)}</button>:null;
    })}</div>}
    {points.length>1&&<details className="revision-locations"><summary>본문 위치 {points.length}곳</summary>{points.map((a,i)=><button type="button" key={i} data-review-location={i} aria-label={'본문 '+folioLabel(a.page)+'쪽 '+(i+1)+'번째 수정 위치'} aria-pressed={active.anchor===a} onClick={()=>onRead(active.id,a)}>{folioLabel(a.page)}쪽 · {i+1}</button>)}</details>}
    {data?<><nav className="revision-jumps" aria-label="수정이력 안에서 이동">{[['before','수정 전'],['after','수정 후'],['why','수정 이유']].map(([name,label])=><button type="button" key={name} onClick={()=>{
      const pane=root.current,el=pane?.querySelector<HTMLElement>('[data-revision-part="'+name+'"]');
      if(pane&&el){pane.scrollTop+=el.getBoundingClientRect().top-pane.getBoundingClientRect().top-9;el.focus({preventScroll:true});}
    }}>{label}</button>)}</nav><section><h3 tabIndex={-1} data-revision-part="before">수정 전 <small>15차 제출본 · {sample.beforePage}</small></h3><Quote runs={data.before}/></section>
      <section><h3 tabIndex={-1} data-revision-part="after">수정 후 <small>60차 원고 · {sample.afterPage}</small></h3><Quote runs={data.after}/></section>
      <section className="revision-reason"><h3 tabIndex={-1} data-revision-part="why">수정 이유</h3>{data.reason.map((text,i)=><p key={i}>{text}</p>)}</section></>:
      error?<div role="status">수정이력을 불러오지 못했습니다. <button type="button" onClick={()=>{setState({id:''});setAttempt(n=>n+1);}}>다시 시도</button></div>:<p role="status">수정이력을 불러오는 중…</p>}
  </section>;
}

