import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import KuBrand from './ku-brand';
import {Catalog,Citation,Note,Session,ReaderError,visit,expiration,privateResource,readSession,storeSession} from './reader-api';
import {PageLayer,LegalInfo,NoteText,inlineLinks,usePageMetadata,type PageTarget} from './page-text';
import ContentsSearch from './contents-search';
import {getPageImage} from './visible-page-cache';
import './reader.css';

function Photo({session,query,label,active=true,onReady}:{session:Session;query:string;label:string;active?:boolean;onReady?:()=>void}){
  const [picture,setPicture]=useState<{query:string;url:string;token:string}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!active)return;
    const item=getPageImage(session,query);let alive=true;
    let image='',timer=0;
    setError('');
    item.promise.then(blob=>{
      if(!alive)return;
      image=URL.createObjectURL(blob);setPicture({query,url:image,token:session.token});
    }).catch(e=>{
      if(!alive)return;
      setError(e instanceof ReaderError?e.message:'열람 이미지를 불러오지 못했습니다.');
      if(e instanceof ReaderError&&e.status===429)timer=window.setTimeout(()=>setRetry(n=>n+1),e.wait*1000);
    });
    return()=>{alive=false;item.release();window.clearTimeout(timer);if(image)URL.revokeObjectURL(image);};
  },[session,query,active,retry]);
  if(!active)return null;
  if(error)return <div className="image-status" role="status">{error} <button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>;
  return picture&&picture.token===session.token&&picture.query===query?<img src={picture.url} alt={label} draggable={false} onLoad={onReady}/>:<div className="image-status" role="status">쪽을 불러오는 중…</div>;
}

function DocumentPane({session,start,count,notes,onPage,onTarget,textAllowed}:{textAllowed:boolean;session:Session;start:number;count:number;notes:Note[];onPage:(page:number)=>void;onTarget:(t:PageTarget,page:number)=>void}){
  const host=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState<number[]>([start]);
  const [zoom,setZoom]=useState(100);
  const positions=useMemo(()=>Array.from({length:count},(_,i)=>i+1),[count]);
  const noteMap=useMemo(()=>{const map=new Map<number,Note[]>();for(const n of notes){const row=map.get(n.page)||[];row.push(n);map.set(n.page,row);}return map;},[notes]);
  useLayoutEffect(()=>{
    const scroll=host.current!;
    const items=Array.from(scroll.querySelectorAll<HTMLElement>('.paper-page'));
    const jump=(page:number)=>{const item=items[Math.max(0,Math.min(count-1,page-1))];if(item){scroll.scrollTop=item.offsetTop;onPage(Number(item.dataset.page));}};
    const navigate=(event:Event)=>{const page=Number((event as CustomEvent).detail?.page);if(Number.isInteger(page))jump(page);};
    const update=()=>{
      const top=scroll.scrollTop+Math.min(120,scroll.clientHeight*.18);
      let lo=0,hi=items.length-1;
      while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(items[mid].offsetTop<=top)lo=mid;else hi=mid-1;}
      onPage(lo+1);
    };
    const observer=new IntersectionObserver(entries=>{
      setVisible(prev=>{const next=new Set(prev);for(const entry of entries){const page=Number((entry.target as HTMLElement).dataset.page);if(entry.isIntersecting)next.add(page);else next.delete(page);}return [...next];});
    },{root:scroll,rootMargin:'80% 0px'});
    for(const item of items)observer.observe(item);
    jump(start);scroll.addEventListener('scroll',update,{passive:true});window.addEventListener('paper:navigate',navigate);
    return()=>{observer.disconnect();scroll.removeEventListener('scroll',update);window.removeEventListener('paper:navigate',navigate);};
  },[count,start,onPage]);
  return <main className="manuscript-pane" aria-label="논문 본문"><div className="paper-actions"><strong>논문</strong><label>확대 <select value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[85,100,125,150,200].map(v=><option key={v} value={v}>{v}%</option>)}</select></label></div>
    <div className="paper-scroll" ref={host} tabIndex={0} aria-label="논문 연속 스크롤">{positions.map(page=><article className="paper-page" key={page} data-page={page} style={{width:zoom+'%'}} aria-label={'논문 '+page+'쪽'}>
      <Photo session={session} label={'논문 '+page+'쪽'} query={'edition=1103_85&page='+page} active={visible.includes(page)}/>
      {visible.includes(page)&&<PageLayer session={session} textAllowed={textAllowed} query={'metadata=page&page='+page} label={'논문 '+page+'쪽 글자'}
        fallback={(noteMap.get(page)||[]).flatMap(n=>(n.markers||[]).map(m=>({...m,kind:'note' as const,number:n.number,label:'각주 '+n.number})))}
        onTarget={t=>onTarget(t,page)}/>}
    </article>)}</div></main>;
}

function Workspace({session,catalog,notes}:{session:Session;catalog:Catalog;notes:Note[]}){
  const initial=Math.max(1,Math.min(catalog.bodyStartPage||1,catalog.pageCount));
  const [legal,setLegal]=useState<PageTarget|null>(null);
  const [page,setPage]=useState(initial),[pageInput,setPageInput]=useState(String(initial)),[toc,setToc]=useState(false),[query,setQuery]=useState(''),[list,setList]=useState(false),[own,setOwn]=useState<{page:number;number?:number;id?:string}|null>(null),[preview,setPreview]=useState<number|undefined>();
  const sources=useMemo(()=>new Map(catalog.sources.map(s=>[s.id,s])),[catalog]);
  const pageNotes=useMemo(()=>notes.filter(n=>n.page===page),[notes,page]);
  const options=useMemo(()=>pageNotes.flatMap(n=>n.sources.filter(s=>sources.has(s.id)).map(s=>({note:n,citation:s}))),[pageNotes,sources]);
  const chosen=own?.page===page?own:null;
  const entry=chosen?options.find(item=>item.note.number===chosen.number&&item.citation.id===chosen.id):options[0];
  const sourceId=chosen?.id||entry?.citation.id;
  const selectedNote=entry?.note||notes.find(n=>chosen?.number===n.number);
  const noteMetadata=usePageMetadata(session,'metadata=page&page='+(selectedNote?.page||page),Boolean(selectedNote),catalog.textLayersEnabled===true);
  const noteLinks=useMemo(()=>selectedNote?inlineLinks(selectedNote.text,selectedNote.number,noteMetadata.data?.targets||[]):[],[selectedNote,noteMetadata.data]);
  const citation:Citation|undefined=entry?.citation||selectedNote?.sources.find(s=>s.id===sourceId);
  const source=sourceId?sources.get(sourceId):null;
  const previews=citation?.previewPages?.length?citation.previewPages:citation?.image&&citation.page?[citation.page]:[];
  const previewPage=preview&&previews.includes(preview)?preview:previews[0];
  const sourceScroll=useRef<HTMLElement>(null);
  const focusEvidence=useCallback(()=>{
    const pane=sourceScroll.current;if(!pane)return;
    const mark=pane.querySelector<HTMLElement>('.source-image mark,blockquote mark');
    if(!mark)return;
    const heading=pane.querySelector('h2')?.getBoundingClientRect().height||0;
    const goal=mark.getBoundingClientRect().top-pane.getBoundingClientRect().top+pane.scrollTop-heading-24;
    pane.scrollTop=Math.max(0,goal);
  },[]);
  useLayoutEffect(()=>{
    const pane=sourceScroll.current;if(!pane)return;
    pane.scrollTop=0;
    const img=pane.querySelector<HTMLImageElement>('.source-image img');
    if(!img||img.complete&&img.naturalWidth>0)focusEvidence();
  },[sourceId,selectedNote?.number,previewPage,focusEvidence]);
  const readingPage=useRef(initial);
  const change=useCallback((p:number)=>{if(readingPage.current===p)return;readingPage.current=p;setPage(p);setPageInput(String(p));setPreview(undefined);setOwn(previous=>previous?.page===p?previous:null);},[]);
  useEffect(()=>{window.dispatchEvent(new CustomEvent('paper:page',{detail:{page}}));},[page]);
  const jump=(p:number)=>window.dispatchEvent(new CustomEvent('paper:navigate',{detail:{page:Math.max(1,Math.min(p,catalog.pageCount))}}));
  const chooseNote=(n:Note)=>{setList(false);setOwn({page,number:n.number,id:n.sources[0]?.id});setPreview(undefined);};
  function targetAction(t:PageTarget,fromPage:number){
    if(t.kind==='law'||t.kind==='case'){setLegal(t);return;}
    const n=notes.find(item=>item.number===t.number);
    if(!n)return;
    const dest=t.targetPage||(t.kind==='cross'?n.page:fromPage);
    if(t.kind==='cross'||page!==dest)jump(dest);
    const linked=t.sourceId&&n.sources.some(c=>c.id===t.sourceId)?t.sourceId:n.sources[0]?.id;
    setList(false);setOwn({page:dest,number:n.number,id:linked});setPreview(undefined);
  }
  const chooseSource=(id:string)=>{const n=pageNotes.find(n=>n.sources.some(c=>c.id===id))||notes.find(n=>n.sources.some(c=>c.id===id));setList(false);setOwn({page,number:n?.number,id});setPreview(undefined);};
  return <div className="examiner-app"><header className="examiner-header"><KuBrand/><div className="paper-heading"><small>박사학위논문 · {catalog.author}</small><h1>{catalog.title}</h1>{catalog.subtitle&&<p>{catalog.subtitle}</p>}</div><nav><span className="reader-tools-slot"/><button type="button" onClick={()=>setToc(v=>!v)} aria-expanded={toc}>목차·검색</button><button type="button" onClick={()=>setList(v=>!v)} aria-expanded={list}>참고문헌</button></nav></header>
    <section className="page-controls"><button disabled={page===1} onClick={()=>jump(page-1)}>이전</button><form onSubmit={e=>{e.preventDefault();const n=Number(pageInput);if(Number.isInteger(n)&&n>0)jump(n);}}><input aria-label="논문 쪽" value={pageInput} onChange={e=>setPageInput(e.target.value)} inputMode="numeric"/> / {catalog.pageCount}쪽 <button>이동</button></form><button disabled={page===catalog.pageCount} onClick={()=>jump(page+1)}>다음</button></section>
    <div className="reader-layout">{toc&&<ContentsSearch session={session} catalog={catalog} notes={catalog.searchEnabled===true?notes:pageNotes} go={(p,n)=>{setToc(false);jump(p);if(n){setList(false);setOwn({page:p,number:n.number,id:n.sources[0]?.id});setPreview(undefined);}}}/>}
      <DocumentPane session={session} textAllowed={catalog.textLayersEnabled===true} start={initial} count={catalog.pageCount} notes={notes} onPage={change} onTarget={targetAction}/>
      <aside className="reference-pane" aria-label="참고문헌"><div className="reference-toolbar"><strong>참고문헌·원전</strong><div>{options.length>0&&<select aria-label="이 쪽의 인용자료" value={entry?entry.note.number+'/'+entry.citation.id:''} onChange={e=>{const opt=options.find(o=>o.note.number+'/'+o.citation.id===e.target.value);if(opt){setList(false);setOwn({page,number:opt.note.number,id:opt.citation.id});setPreview(undefined);}}}><option value="" disabled>이 쪽의 인용자료</option>{options.map((o,i)=><option key={i} value={o.note.number+'/'+o.citation.id}>각주 {o.note.number} · {sources.get(o.citation.id)?.title}</option>)}</select>}
        <button onClick={()=>{setList(v=>!v);setOwn(null);}}>{list?'본문 따라가기':'자료 목록'}</button></div></div>
      {list?<section className="source-library"><h2>자료 목록</h2><label>자료 검색<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>{catalog.sources.filter(s=>s.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(s=><button key={s.id} onClick={()=>chooseSource(s.id)}>{s.title}</button>)}</section>:
      <section className="source-dialog" ref={sourceScroll}><h2>{source?.title||(selectedNote?'각주 '+selectedNote.number:'이 쪽의 인용자료')}</h2>
        {selectedNote&&<details key={selectedNote.number} open={!previewPage&&!citation?.excerpt}><summary>각주 {selectedNote.number} 원문</summary><p><NoteText text={selectedNote.text} links={noteLinks} onTarget={t=>targetAction(t,page)}/></p></details>}
        {citation?.label&&citation.label!==source?.title&&<p className="citation-location">{citation.label}</p>}
        {citation?.excerpt&&<blockquote>{citation.verified?<mark>{citation.excerpt}</mark>:citation.excerpt}</blockquote>}
        {previewPage&&sourceId&&<><h3>확인된 인용면</h3><div className="preview-pages">{previews.map(p=><button aria-pressed={p===previewPage} key={p} onClick={()=>setPreview(p)}>자료 {p}쪽</button>)}</div><div className="source-image"><Photo session={session} label="인용면" query={new URLSearchParams({source:sourceId,page:String(previewPage)}).toString()} onReady={focusEvidence}/><PageLayer session={session} active={catalog.textLayersEnabled===true} textAllowed={catalog.textLayersEnabled===true} query={new URLSearchParams({source:sourceId,textPage:String(previewPage)}).toString()} label={'원전 '+previewPage+'쪽 글자'} onTarget={t=>targetAction(t,page)}/>{previewPage===citation?.page&&citation.highlights?.map((r,i)=><mark key={i} style={{left:r.x*100+"%",top:r.y*100+"%",width:r.w*100+"%",height:r.h*100+"%"}}/>)}</div></>}
        {!source&&!selectedNote&&<p>이 쪽에 연결된 인용자료가 없습니다.</p>}
        {source&&(!citation||(!citation.excerpt&&!previewPage))&&<p>현재 자료의 서지와 연결 각주를 표시합니다.</p>}
      </section>}
      {!list&&pageNotes.length>0&&<div className="note-list" aria-label="이 쪽의 각주">{pageNotes.map(n=><button key={n.number} onClick={()=>chooseNote(n)} aria-pressed={selectedNote?.number===n.number}>각주 {n.number}</button>)}</div>}
    </aside></div>{legal&&<LegalInfo target={legal} close={()=>setLegal(null)}/>}</div>;
}

function ReadingSession({session}:{session:Session}){
  const [data,setData]=useState<{catalog:Catalog;notes:Note[]}|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const c=new AbortController();setError('');
    Promise.all(['catalog','citations'].map(k=>privateResource(session,new URLSearchParams({metadata:k}),c.signal).then(r=>r.json()))).then(([catalog,citations])=>{if(!c.signal.aborted)setData({catalog,notes:citations.notes});}).catch(e=>{if(!c.signal.aborted)setError(e.message);});
    return()=>c.abort();},[session,attempt]);
  if(!data)return <Loading error={error} retry={()=>setAttempt(a=>a+1)}/>;
  return <Workspace session={session} catalog={data.catalog} notes={data.notes}/>;
}

function Loading({error,retry}:{error:string;retry:()=>void}){
  return <div className="examiner-app"><header className="examiner-header"><KuBrand/><div className="paper-heading"><small>박사학위논문 · 김민규</small><h1>주택임차보증금반환채권의 행사 및 반환보장상의 법적 쟁점에 관한 연구</h1></div></header><section className="page-controls">논문 19 / 255쪽</section><div className="reader-layout"><main className="reader-pending"><strong>논문</strong><p role="status">{error||'논문을 불러오는 중…'}</p>{error&&<button onClick={retry}>다시 시도</button>}</main><aside className="reference-pane"><div className="reference-toolbar"><strong>참고문헌·원전</strong></div></aside></div></div>;
}

function App(){
  const [session,setSession]=useState<Session|null>(readSession);
  const [error,setError]=useState('');
  const pending=useRef<Promise<void>|null>(null), retryTimer=useRef<number>(0);
  const refresh=useCallback(()=>{
    if(pending.current)return;
    clearTimeout(retryTimer.current);
    setError('');
    pending.current=visit().then(s=>{storeSession(s);setSession(s);}).catch(e=>{
      const wait=e instanceof ReaderError&&e.status===429?e.wait:12;
      setError(e instanceof ReaderError?e.message:'열람 연결을 시작하지 못했습니다.');
      retryTimer.current=window.setTimeout(refresh,wait*1000);
    }).finally(()=>{pending.current=null;});
  },[]);
  useEffect(()=>{
    if(!session)refresh();
    const timer=session?window.setTimeout(refresh,Math.max(0,expiration(session.expiresAt)-Date.now()-30000)):0;
    window.addEventListener('paper:expired',refresh);
    return()=>{window.clearTimeout(timer);window.removeEventListener('paper:expired',refresh);};
  },[session,refresh]);
  useEffect(()=>()=>clearTimeout(retryTimer.current),[]);
  return session?<ReadingSession session={session}/>:<Loading error={error} retry={refresh}/>;
}
createRoot(document.getElementById('root')!).render(<App/>);
