import React,{useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import PaneResizer from './pane-resizer';
import registry from './source-translations.json';
import {validateTranslation,translationNoteText,type TranslationDocument,type TranslationEntry} from './translation-model';
import {readTranslationView,writeTranslationView,translationPositionKey,parseTranslationPosition,restoredTranslationPosition,type TranslationPosition,type TranslationMode,type TranslationView} from './translation-reading';
import './parallel-source-reader.css';

export const translationEntries=registry.sources as TranslationEntry[];
const cache=new Map<string,Promise<TranslationDocument>>();
function loadTranslation(entry:TranslationEntry){
  let pending=cache.get(entry.file);
  if(!pending){pending=fetch(new URL('./translations/'+entry.file,document.baseURI),{credentials:'omit'}).then(async r=>{if(!r.ok)throw Error('번역을 불러오지 못했습니다.');return validateTranslation(await r.json(),entry);}).catch(e=>{cache.delete(entry.file);throw e;});cache.set(entry.file,pending);}
  return pending;
}
function storage(){try{return window.localStorage;}catch{return undefined;}}

/** Keep each text scrollport at its own block; hidden/empty layouts never replace its bookmark. */
export function useTranslationPosition(host:RefObject<HTMLDivElement|null>,key:string,side:'original'|'translation',total:number,loaded:boolean,page:number,onPageChange:(page:number)=>void,syncPage:boolean,navigationToken=0,preserveNavigation?:RefObject<number|null>){
  const current=useRef({page,onPageChange,syncPage,navigationToken});current.current={page,onPageChange,syncPage,navigationToken};
  const [shownPage,setShownPage]=useState(page),snapshot=useRef<TranslationPosition|null>(null),ready=useRef(false),pending=useRef<number|null>(null),lastProp=useRef(page),lastToken=useRef(0),ownTop=useRef<number|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const visible=(el:HTMLElement)=>el.clientWidth>0&&el.clientHeight>0;
  const blocks=(el:HTMLElement)=>Array.from(el.querySelectorAll<HTMLElement>('[data-reading-block]'));
  function write(){if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}if(snapshot.current)try{storage()?.setItem(translationPositionKey(key,side),JSON.stringify(snapshot.current));}catch{}}
  function capture(report=true){const el=host.current;if(!el||!ready.current||!visible(el)||pending.current!==null)return;
    const bounds=el.getBoundingClientRect(),rows=blocks(el),block=rows.find(row=>row.getBoundingClientRect().bottom>bounds.top)||rows.at(-1);if(!block)return;
    const b=block.getBoundingClientRect(),n=Number(block.dataset.readingPage);
    snapshot.current={version:1,block:block.dataset.readingBlock!,page:n,fraction:Math.max(0,Math.min(1,(bounds.top-b.top)/Math.max(1,b.height))),top:el.scrollTop,left:el.scrollLeft,width:el.clientWidth,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight};
    setShownPage(n);if(report&&current.current.syncPage&&n!==current.current.page)current.current.onPageChange(n);
  }
  function restore(){const el=host.current;if(!loaded||!el||!visible(el))return;const rows=blocks(el);if(!rows.length)return;
    const target=pending.current;let block:HTMLElement|undefined;
    if(target!==null)block=rows.find(row=>Number(row.dataset.readingPage)===target);
    else if(snapshot.current)block=rows.find(row=>row.dataset.readingBlock===snapshot.current!.block);
    if(!block)block=rows.find(row=>Number(row.dataset.readingPage)===current.current.page)||rows[0];
    const top=block.getBoundingClientRect().top-el.getBoundingClientRect().top+el.scrollTop;
    if(target===null&&snapshot.current&&snapshot.current.block===block.dataset.readingBlock){const next=restoredTranslationPosition(snapshot.current,{width:el.clientWidth,height:el.clientHeight,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,blockTop:top,blockHeight:block.getBoundingClientRect().height});el.scrollTop=next.top;el.scrollLeft=next.left;}
    else{el.scrollTop=top;el.scrollLeft=0;}
    ownTop.current=el.scrollTop;pending.current=null;ready.current=true;capture(false);
  }
  useLayoutEffect(()=>{
    ready.current=false;snapshot.current=null;
    try{snapshot.current=parseTranslationPosition(storage()?.getItem(translationPositionKey(key,side))??null,total);}catch{}
    if(current.current.navigationToken>0||(current.current.syncPage&&snapshot.current&&snapshot.current.page!==current.current.page))pending.current=current.current.page;
    if(snapshot.current)setShownPage(snapshot.current.page);
    return()=>write();
  },[key,side,total]);
  useLayoutEffect(()=>{
    const explicit=navigationToken>0&&navigationToken!==lastToken.current;
    const changed=page!==lastProp.current;lastProp.current=page;
    if(explicit){lastToken.current=navigationToken;if(preserveNavigation?.current!==page||snapshot.current?.page!==page)pending.current=page;if(preserveNavigation)preserveNavigation.current=null;}
    else if(changed&&syncPage&&snapshot.current?.page!==page)pending.current=page;
    restore();
  },[loaded,page,navigationToken,syncPage]);
  useLayoutEffect(()=>{const el=host.current;if(!el||!loaded)return;
    const observer=new ResizeObserver(restore);observer.observe(el);if(el.firstElementChild)observer.observe(el.firstElementChild);
    restore();return()=>observer.disconnect();
  },[loaded]);
  useEffect(()=>{const flush=()=>{capture(false);write();},hide=()=>{if(document.hidden)flush();};window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hide);return()=>{write();window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hide);};},[key,side]);
  return {page:shownPage,alignPage:(target:number)=>{if(snapshot.current?.page!==target)pending.current=target;restore();},flush:()=>{capture(false);write();},onScroll:()=>{const el=host.current,ours=ownTop.current!==null&&el&&Math.abs(el.scrollTop-ownTop.current)<.5;ownTop.current=null;capture(!ours);if(timer.current===null)timer.current=setTimeout(write,120);}};
}

type Props={sourceId:string;page:number;onPageChange:(page:number)=>void;onComparePage?:(page:number)=>void;children?:React.ReactNode;persistenceKey?:string;navigationToken?:number};
export default function ParallelSourceReader(props:Props){
  const entry=translationEntries.find(row=>row.sourceId===props.sourceId);
  if(!entry)return <div className="source-reader-single">{props.children}</div>;
  return <TranslationReader key={(props.persistenceKey||entry.sourceId)+entry.sourceSha256} {...props} entry={entry}/>;
}
export function TranslationReader({entry,page,onPageChange,onComparePage,children,persistenceKey,navigationToken=0}:Props&{entry:TranslationEntry}){
  const key=(persistenceKey||entry.sourceId)+':'+entry.sourceSha256;
  const [doc,setDoc]=useState<TranslationDocument|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [view,setView]=useState(()=>readTranslationView(storage(),key,typeof window!=='undefined'&&window.innerWidth<900));
  const pair=useRef<HTMLDivElement>(null),scroll=useRef<HTMLDivElement>(null),originalScroll=useRef<HTMLDivElement>(null),preserveTranslationNavigation=useRef<number|null>(null);
  const translated=useTranslationPosition(scroll,key,'translation',entry.totalPages,!!doc,page,onPageChange,view.mode==='parallel',navigationToken,preserveTranslationNavigation);
  const originalText=useTranslationPosition(originalScroll,key,'original',entry.totalPages,!!doc,page,()=>{},false,navigationToken);
  useEffect(()=>{let alive=true;setError('');loadTranslation(entry).then(d=>{if(alive)setDoc(d);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[entry,retry]);
  function changeView(next:Partial<TranslationView>){translated.flush();originalText.flush();
    if(next.mode==='parallel'&&view.mode==='translation'&&translated.page!==page){preserveTranslationNavigation.current=translated.page;(onComparePage||onPageChange)(translated.page);}
    else if(next.mode==='parallel'&&view.mode==='original')translated.alignPage(page);
    setView(previous=>{const value={...previous,...next};writeTranslationView(storage(),key,value);return value;});}
  const original=children||<div className="foreign-text-original" lang={entry.language} ref={originalScroll} onScroll={originalText.onScroll}><div>{doc?.pages.map(p=><article key={p.pdfPage}>{p.blocks.map(b=><div key={b.id} data-reading-block={b.id} data-reading-page={p.pdfPage} className={'translated-block '+b.kind}>{b.kind==='heading'?<h3>{b.original}</h3>:<p>{b.original}</p>}</div>)}</article>)}</div></div>;
  const parallel=view.mode==='parallel',vertical=view.layout==='vertical';
  return <div className="foreign-source-reader" data-translation-mode={view.mode} data-document-alignment={view.mode==='translation'||(parallel&&vertical)?'off':undefined}>
    {error&&<div className="translation-unavailable" role="alert"><p>{error}</p><button onClick={()=>setRetry(x=>x+1)}>다시 불러오기</button></div>}
    <div className="translation-controls"><div className="translation-document"><b>{entry.title}</b><span>{entry.language==='de'?'독일어':'영문'} 원문 · 한국어 번역 · {entry.scope}</span></div></div>
    <div className="translation-switchbar"><div className="translation-mode" role="group" aria-label="외국어 자료 보기">{(['original','translation','parallel'] as TranslationMode[]).map((mode,i)=><button key={mode} aria-pressed={view.mode===mode} onClick={()=>changeView({mode})}>{['원문','번역','병기'][i]}</button>)}</div>
      {parallel&&<div className="translation-layout" role="group" aria-label="병기 배치"><button aria-pressed={!vertical} onClick={()=>changeView({layout:'horizontal'})}>좌우</button><button aria-pressed={vertical} onClick={()=>changeView({layout:'vertical'})}>상하</button></div>}
    </div>
    <div className={`parallel-source ${parallel?'is-parallel':view.mode+'-only'} layout-${view.layout}`} ref={pair} style={{'--original-share':(vertical?view.splitY:view.splitX)+'%'} as React.CSSProperties}>
      <div className="parallel-original" hidden={view.mode==='translation'} aria-label="외국 문헌 원문">{original}</div>
      <PaneResizer className={'translation-divider'+(!parallel?' is-hidden':'')} label={vertical?'원문과 번역 높이 조절':'원문과 번역 너비 조절'} axis={vertical?'y':'x'} value={vertical?view.splitY:view.splitX} min={25} max={75} onChange={value=>changeView(vertical?{splitY:value}:{splitX:value})} onReset={()=>changeView(vertical?{splitY:50}:{splitX:50})} unitsPerPixel={()=>100/((vertical?pair.current?.getBoundingClientRect().height:pair.current?.getBoundingClientRect().width)||1)}/>
      <section className="translation-pane" hidden={view.mode==='original'} aria-label="한국어 번역"><div className="translation-page-heading"><b>한국어 번역</b>{entry.kind==='pdf'&&<span>PDF {translated.page}쪽 · {entry.totalPages}쪽</span>}<a href={'./translations/'+entry.file} download>번역 데이터 ↓</a></div>
        <div className="translation-scroll" ref={scroll} onScroll={translated.onScroll}><div className="translation-content">
          {!doc?(!error&&<p>번역을 불러오는 중…</p>):doc.pages.map(p=><article key={p.pdfPage} data-translation-page={p.pdfPage} className={translated.page===p.pdfPage?'current-translation-page':''}>
            <h3 className="translation-sheet-label" data-reading-block={'page-'+p.pdfPage} data-reading-page={p.pdfPage}>{entry.kind==='pdf'?`원문 ${p.printedPage||p.pdfPage}면`:entry.scope}</h3>
            {p.blocks.map(block=><div className={'translated-block '+block.kind} key={block.id} data-reading-block={block.id} data-reading-page={p.pdfPage}>{block.kind==='heading'?<h3>{block.translation}</h3>:<p>{block.translation}</p>}{typeof block.translatorNote==='string'&&<aside className="translator-notes"><b>번역 주</b><p>{block.translatorNote}</p></aside>}</div>)}
            {!!p.translatorNotes?.length&&<aside className="translator-notes" data-reading-block={'notes-'+p.pdfPage} data-reading-page={p.pdfPage}><b>번역 주</b>{p.translatorNotes.map((n,i)=><p key={i}>{translationNoteText(n)}</p>)}</aside>}
          </article>)}
        </div></div>
      </section>
    </div>
  </div>;
}
