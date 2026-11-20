import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {privateResource,type Session} from './reader-api';
import {alternateFolios,citationGroups,citedEdition,labelKey,lookupLabels,pageDescription,pageLabels,printedLabels,printedSpreads,type AlternateFolio,type CitationGroup} from './printed-pages';
import './reference-pages.css';

export type ReferencePage={page:number;width:number;height:number;label?:string;spread?:string[];alternate?:AlternateFolio};
export type ReferenceManifest={sourceId:string;pageCount:number;pages:ReferencePage[];availability:'complete'|'excerpt'};
export type ReferenceHighlight={x:number;y:number;w:number;h:number};
export type ReferencePagesProps={
  session:Session;
  sourceId:string;
  initialPage:number;
  explicitPage?:number;
  citationPages?:number[];
  noteNumber?:number;
  highlightPage?:number;
  highlights?:ReferenceHighlight[];
  focusCitation:boolean;
  focusKey?:string|number;
  renderPage:(page:number,canonicalId:string,onReady:()=>void)=>React.ReactNode;
};

const manifests=new WeakMap<Session,Map<string,ReferenceManifest>>();

function readManifest(value:unknown):ReferenceManifest{
  const data=value as Partial<ReferenceManifest>;
  if(!data||typeof data.sourceId!=='string'||!data.sourceId||!Number.isInteger(data.pageCount)||Number(data.pageCount)<1||!Array.isArray(data.pages))throw Error('원전 쪽 정보를 확인하지 못했습니다.');
  const labels=printedLabels(data.sourceId),spreads=printedSpreads(data.sourceId),alternate=alternateFolios(data.sourceId);
  const numbers=new Set<number>();
  const pages=data.pages.map(item=>{
    if(!item||!Number.isInteger(item.page)||item.page<1||numbers.has(item.page)||!Number.isFinite(item.width)||item.width<=0||!Number.isFinite(item.height)||item.height<=0)throw Error('원전 쪽 정보를 확인하지 못했습니다.');
    numbers.add(item.page);
    const spread=spreads[item.page];
    const label=spread?.[0] ?? labels.get(item.page) ?? (typeof item.label==='string'?item.label.trim():undefined);
    return {page:item.page,width:item.width,height:item.height,label,spread,alternate:alternate.get(item.page)};
  }).sort((a,b)=>a.page-b.page);
  if(!pages.length)throw Error('열람할 원전 쪽이 없습니다.');
  return {sourceId:data.sourceId,pageCount:Number(data.pageCount),pages,availability:data.availability==='complete'?'complete':'excerpt'};
}

export function useReferenceManifest(session:Session,sourceId:string){
  const [state,setState]=useState<{sourceId:string;session:Session;data?:ReferenceManifest;error?:string}>();
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    let cache=manifests.get(session);
    if(!cache){cache=new Map();manifests.set(session,cache);}
    const saved=cache.get(sourceId);
    if(saved){setState({sourceId,session,data:saved});return;}
    setState({sourceId,session});
    privateResource(session,new URLSearchParams({metadata:'reference',source:sourceId}),controller.signal)
      .then(response=>response.json()).then(readManifest).then(data=>{
        if(controller.signal.aborted)return;
        cache!.set(sourceId,data);
        if(cache!.size>24)cache!.delete(cache!.keys().next().value!);
        setState({sourceId,session,data});
      }).catch(error=>{if(!controller.signal.aborted)setState({sourceId,session,error:error instanceof Error?error.message:'원전 쪽 정보를 불러오지 못했습니다.'});});
    return()=>controller.abort();
  },[session,sourceId,attempt]);
  const current=state?.sourceId===sourceId&&state.session===session?state:undefined;
  const retry=useCallback(()=>setAttempt(n=>n+1),[]);
  return {data:current?.data,loading:!current?.data&&!current?.error,error:current?.error,retry};
}

const pageReady=()=>{};
function closestPage(pages:ReferencePage[],requested:number){
  return pages.reduce((best,item)=>Math.abs(item.page-requested)<Math.abs(best.page-requested)?item:best,pages[0]);
}

function ReferenceDocument({manifest,initialPage,explicitPage,citationPages=[],noteNumber,highlightPage=initialPage,highlights=[],focusCitation,focusKey,renderPage}:Omit<ReferencePagesProps,'session'|'sourceId'>&{manifest:ReferenceManifest}){
  const pages=manifest.pages,host=useRef<HTMLDivElement>(null),controls=useRef<HTMLElement>(null);
  const scrollRoot=useRef<HTMLElement|null>(null),items=useRef<HTMLElement[]>([]);
  const [active,setActive]=useState<number[]>([]);
  const [current,setCurrent]=useState(()=>closestPage(pages,initialPage).page);
  const [chosenLabel,setChosenLabel]=useState<{page:number;label:string}|null>(null);
  const [preferAlternate,setPreferAlternate]=useState(false);
  const [draft,setDraft]=useState<string|null>(null);
  const [inputError,setInputError]=useState(''),[ambiguous,setAmbiguous]=useState<ReferencePage[]>([]);
  const inputBox=useRef<HTMLInputElement>(null);
  const [stickyTop,setStickyTop]=useState(0);
  const visible=useRef(new Set<number>()),scrollFrame=useRef(0);
  const readingAnchor=useRef<{index:number;fraction:number}|null>(null);
  const activeSet=useMemo(()=>new Set(active),[active]);
  const pageByNumber=useMemo(()=>new Map(pages.map(p=>[p.page,p])),[pages]);
  const byLabel=useMemo(()=>{
    const index=new Map<string,ReferencePage[]>();
    for(const item of pages){
      for(const key of new Set(lookupLabels(item).map(labelKey))){
        const matches=index.get(key);
        if(matches)matches.push(item);else index.set(key,[item]);
      }
    }
    return index;
  },[pages]);
  const currentIndex=Math.max(0,pages.findIndex(p=>p.page===current));
  const currentPage=pages[currentIndex];
  const activeLabel=chosenLabel?.page===current?chosenLabel.label:(preferAlternate?currentPage.alternate?.label:undefined)??currentPage.label;
  const input=draft??activeLabel??'';
  const hasRomanOrOther=useMemo(()=>[...byLabel.keys()].some(key=>!/^[0-9]+$/.test(key)),[byLabel]);
  const alternate=useMemo(()=>pages.find(page=>page.alternate)?.alternate,[pages]);
  const groups=useMemo(()=>citationGroups(manifest.sourceId,noteNumber,pages),[manifest.sourceId,noteNumber,pages]);
  const landing=explicitPage??groups[0]?.start??initialPage;
  const landingLabel=landing===groups[0]?.start?groups[0]?.printedStart:undefined;
  const showGroups=groups.length>1||groups.some(group=>group.start!==initialPage||group.start!==group.end||group.printedStart!==group.printedEnd);
  const insideGroup=(group:CitationGroup)=>{
    if(current<group.start||current>group.end)return false;
    if(pageLabels(pages[currentIndex]).length>1&&group.printedStart&&group.printedEnd&&activeLabel){
      const printed=Number(activeLabel);
      return printed>=Number(group.printedStart)&&printed<=Number(group.printedEnd);
    }
    return true;
  };
  const groupName=(group:CitationGroup)=>{
    const first=pageByNumber.get(group.start)!,last=pageByNumber.get(group.end);
    const start=group.printedStart??first.label;
    if(!start)return '인용면 · 수록 '+group.start+'번째 면';
    const end=group.printedEnd??(group.printedStart&&group.start===group.end?group.printedStart:last?.label);
    return start+(end&&end!==start?'–'+end:'')+'쪽';
  };

  const activate=useCallback(()=>{
    const next=new Set<number>();
    for(const index of visible.current)for(let i=Math.max(0,index-1);i<=Math.min(pages.length-1,index+1);i++)next.add(pages[i].page);
    const sorted=[...next].sort((a,b)=>a-b);
    setActive(previous=>previous.length===sorted.length&&previous.every((p,i)=>p===sorted[i])?previous:sorted);
  },[pages]);

  const jump=useCallback((requested:number,evidence=false,preferred?:string,keepSeries=false)=>{
    const root=scrollRoot.current;if(!root)return;
    const target=closestPage(pages,requested),index=pages.indexOf(target),item=items.current[index];if(!item)return;
    const picture=item.querySelector<HTMLElement>('.source-image');
    const mark=evidence&&target.page===highlightPage?highlights[0]:undefined;
    const imageRegion=(picture||item).getBoundingClientRect();
    const region=(mark?picture||item:item).getBoundingClientRect(),rootBox=root.getBoundingClientRect();
    const top=region.top-rootBox.top+root.scrollTop+(mark?region.height*mark.y:0);
    const heading=root.querySelector('h2');
    const headingSpace=heading&&getComputedStyle(heading).position==='sticky'?heading.getBoundingClientRect().height:0;
    root.scrollTop=Math.max(0,top-headingSpace-(controls.current?.offsetHeight||0)-12);
    readingAnchor.current={index,fraction:mark?.y??(region.top-imageRegion.top)/imageRegion.height};
    if(!keepSeries)setPreferAlternate(Boolean(preferred&&target.alternate?.label===preferred));
    setCurrent(target.page);setChosenLabel(preferred?{page:target.page,label:preferred}:null);setDraft(null);setInputError('');setAmbiguous([]);
    // No image load handler moves the reader: page sizes are known before fetch.
    visible.current=new Set([index]);activate();
  },[pages,highlightPage,highlights,activate]);

  useLayoutEffect(()=>{
    const node=host.current,root=node?.closest<HTMLElement>('.source-dialog');if(!node||!root)return;
    scrollRoot.current=root;
    root.classList.add('has-reference-pages');
    const rows=Array.from(node.querySelectorAll<HTMLElement>('[data-reference-page]'));items.current=rows;
    visible.current.clear();setActive([]);readingAnchor.current=null;
    let lastWidth=root.clientWidth;
    const measureHeader=()=>{
      const heading=root.querySelector('h2');
      setStickyTop(heading&&getComputedStyle(heading).position==='sticky'?Math.max(0,heading.getBoundingClientRect().height-parseFloat(getComputedStyle(root).paddingTop||'0')):0);
    };
    const readingTop=()=>{
      const heading=root.querySelector('h2');
      const headingSpace=heading&&getComputedStyle(heading).position==='sticky'?heading.getBoundingClientRect().height:0;
      return root.getBoundingClientRect().top+headingSpace+(controls.current?.offsetHeight||0)+12;
    };
    const updateCurrent=()=>{
      scrollFrame.current=0;
      const top=readingTop();
      if(!rows.length||rows[0].getBoundingClientRect().top>root.getBoundingClientRect().bottom)return;
      let low=0,high=rows.length-1;
      // Include the caption's leading gap: a sliver of the previous page above
      // the sticky controls must not change the number after an explicit jump.
      while(low<high){const mid=Math.ceil((low+high)/2);if(rows[mid].getBoundingClientRect().top<=top+32)low=mid;else high=mid-1;}
      const image=rows[low].querySelector<HTMLElement>('.source-image')?.getBoundingClientRect();
      if(image?.height)readingAnchor.current={index:low,fraction:(top-image.top)/image.height};
      const number=pages[low].page;
      setCurrent(number);setChosenLabel(value=>value?.page===number?value:null);
      if(document.activeElement!==inputBox.current&&!controls.current?.contains(document.activeElement)){
        setDraft(null);setAmbiguous([]);setInputError('');
      }
    };
    const onScroll=()=>{if(!scrollFrame.current)scrollFrame.current=requestAnimationFrame(updateCurrent);};
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){const index=Number((entry.target as HTMLElement).dataset.referenceIndex);if(entry.isIntersecting)visible.current.add(index);else visible.current.delete(index);}
      activate();
    },{root,rootMargin:'0px',threshold:0});
    for(const row of rows)observer.observe(row);
    const resize=new ResizeObserver(()=>{
      measureHeader();
      if(root.clientWidth!==lastWidth){
        lastWidth=root.clientWidth;
        const anchor=readingAnchor.current;
        const image=anchor&&rows[anchor.index]?.querySelector<HTMLElement>('.source-image')?.getBoundingClientRect();
        if(anchor&&image)root.scrollTop+=image.top+anchor.fraction*image.height-readingTop();
      }
      onScroll();
    });
    resize.observe(root);if(controls.current)resize.observe(controls.current);const heading=root.querySelector('h2');if(heading)resize.observe(heading);
    measureHeader();root.addEventListener('scroll',onScroll,{passive:true});
    return()=>{observer.disconnect();resize.disconnect();root.removeEventListener('scroll',onScroll);root.classList.remove('has-reference-pages');cancelAnimationFrame(scrollFrame.current);scrollFrame.current=0;scrollRoot.current=null;items.current=[];};
  },[pages,activate]);

  // Only an explicit citation/source change initiates focus. Scrolling or a late
  // image response never re-enters this effect; callback props may change freely.
  const jumpRef=useRef(jump);jumpRef.current=jump;
  useLayoutEffect(()=>{if(focusCitation)jumpRef.current(landing,true,landingLabel);},[manifest.sourceId,landing,landingLabel,focusCitation,focusKey]);

  const submit=(event:React.FormEvent)=>{
    event.preventDefault();
    const key=labelKey(input),matches=byLabel.get(key)||[];
    setAmbiguous([]);
    if(!key){setInputError('이동할 인쇄 쪽번호를 입력해 주세요.');return;}
    if(!matches.length){setInputError('이 자료에서 해당 인쇄 쪽번호를 찾을 수 없습니다.');return;}
    if(matches.length>1){setInputError('같은 인쇄 쪽번호가 여러 곳에 있습니다. 이동할 면을 선택하세요.');setAmbiguous(matches);return;}
    jump(matches[0].page,false,lookupLabels(matches[0]).find(label=>labelKey(label)===key));
  };
  return <div className="reference-pages" ref={host} data-reference-source={manifest.sourceId}>
    <nav className="reference-page-controls" ref={controls} aria-label="원전 쪽 이동" style={{top:stickyTop}}>
      <button type="button" onClick={()=>jump(pages[currentIndex-1].page,false,undefined,true)} disabled={currentIndex===0}>이전 쪽</button>
      {byLabel.size>0&&<form onSubmit={submit}>
        <label>인쇄 쪽 <input ref={inputBox} aria-label="원전 인쇄 쪽" inputMode={hasRomanOrOther?'text':'numeric'} autoComplete="off" placeholder="쪽번호" value={input} onChange={e=>{setDraft(e.target.value);setInputError('');setAmbiguous([]);}}/></label>
        <button type="submit">이동</button>
      </form>}
      <button type="button" onClick={()=>jump(pages[currentIndex+1].page,false,undefined,true)} disabled={currentIndex===pages.length-1}>다음 쪽</button>
      <button type="button" onClick={()=>jump(landing,true,landingLabel)}>{groups.length||citationPages.length?'인용면 복귀':'첫 화면으로'}</button>
      {showGroups&&<div className="reference-citation-pages" role="group" aria-label="인용 구간 바로가기">
        <span>인용면</span>{groups.map(group=><button type="button" key={group.start+'/'+group.end+'/'+groupName(group)} data-citation-start={group.start} onClick={()=>jump(group.start,false,group.printedStart)} aria-pressed={insideGroup(group)}>{groupName(group)}</button>)}
      </div>}
      {inputError&&<div className="reference-page-message" role="status">{inputError}
        {ambiguous.map(p=><button key={p.page} type="button" onClick={()=>jump(p.page,false,lookupLabels(p).find(label=>labelKey(label)===labelKey(input)))}>{p.alternate?pageDescription(p):'수록 '+p.page+'번째 면'}</button>)}
      </div>}
    </nav>
    {alternate&&<p className="reference-page-guide">{alternate.primaryName} 쪽번호와 {alternate.name} 쪽번호로 모두 이동할 수 있습니다.</p>}
    {(!byLabel.size||manifest.availability==='excerpt')&&<p className="reference-page-guide">{!byLabel.size?'인쇄 쪽번호가 확인되지 않은 자료입니다. 이전·다음 쪽이나 스크롤로 이동할 수 있습니다.':'확보된 원문 범위에서 이동할 수 있습니다.'}</p>}
    <div className="reference-page-stack">{pages.map((page,index)=><figure className="reference-page" key={page.page} data-reference-page={page.page} data-reference-index={index} aria-label={'원전 '+pageDescription(page)}>
      <figcaption>{pageDescription(page)}</figcaption>
      <div className="source-image" style={{aspectRatio:`${page.width} / ${page.height}`}}>
        {activeSet.has(page.page)?renderPage(page.page,manifest.sourceId,pageReady):<div className="reference-page-placeholder" aria-hidden="true"/>}
        {page.page===highlightPage&&highlights.map((rect,i)=><mark key={i} style={{left:rect.x*100+'%',top:rect.y*100+'%',width:rect.w*100+'%',height:rect.h*100+'%'}}/>)}
      </div>
    </figure>)}</div>
  </div>;
}

export default function ReferencePages(props:ReferencePagesProps){
  const edition=citedEdition(props.sourceId,props.noteNumber);
  const {data,error,retry}=useReferenceManifest(props.session,edition);
  if(error)return <p className="reference-page-message" role="status">{error} <button type="button" onClick={retry}>다시 시도</button></p>;
  if(!data)return <p className="reference-page-message" role="status">원전 쪽 정보를 불러오는 중…</p>;
  // A reflowed author copy has different page breaks and highlight coordinates
  // from the published edition. Only the latter's citation map can position it.
  const selection=edition===props.sourceId?props:{...props,initialPage:data.pages[0].page,explicitPage:undefined,citationPages:[],highlights:[],highlightPage:undefined};
  return <ReferenceDocument key={data.sourceId} {...selection} manifest={data}/>;
}
