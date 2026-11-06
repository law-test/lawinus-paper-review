import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import KuBrand from './ku-brand';
import {Catalog,Citation,Note,Session,ReaderError,enter,expiration,privateResource,readSession,storeSession} from './reader-api';
import './reader.css';

function Photo({session,query,label,active=true}:{session:Session;query:string;label:string;active?:boolean}){
  const [picture,setPicture]=useState<{query:string;url:string}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();
    let image='',timer=0;
    setError('');
    privateResource(session,new URLSearchParams(query),controller.signal).then(async r=>{
      if(!r.headers.get('Content-Type')?.startsWith('image/'))throw Error('열람 이미지를 확인하지 못했습니다.');
      return r.blob();
    }).then(blob=>{
      if(controller.signal.aborted)return;
      image=URL.createObjectURL(blob);setPicture({query,url:image});
    }).catch(e=>{
      if(controller.signal.aborted)return;
      setError(e instanceof ReaderError?e.message:'열람 이미지를 불러오지 못했습니다.');
      if(e instanceof ReaderError&&e.status===429)timer=window.setTimeout(()=>setRetry(n=>n+1),e.wait*1000);
    });
    return()=>{controller.abort();window.clearTimeout(timer);if(image)URL.revokeObjectURL(image);};
  },[session,query,active,retry]);
  if(!active)return null;
  if(error)return <div className="image-status" role="status">{error} <button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>;
  return picture&&picture.query===query?<img src={picture.url} alt={label} draggable={false}/>:<div className="image-status" role="status">쪽을 불러오는 중…</div>;
}

function Gate({ready}:{ready:(s:Session)=>void}){
  const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(busy||!code.trim())return;
    setBusy(true);setError('');
    try{const s=await enter(code.trim());setCode('');ready(s);}catch(e){setError(e instanceof Error?e.message:'입장할 수 없습니다.');}finally{setBusy(false);}
  };
  return <div className="examiner-app gate"><header className="examiner-header"><KuBrand/><span>박사학위논문 심사 열람</span></header><main className="gate-main"><form onSubmit={submit}>
    <h1>심사위원 열람</h1><label htmlFor="review-code">입장 코드</label><input id="review-code" type="password" autoCapitalize="off" autoComplete="off" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)} required/>
    {error&&<p role="alert">{error}</p>}<button type="submit" disabled={busy||!code.trim()}>{busy?'확인 중…':'입장'}</button>
  </form></main></div>;
}

function DocumentPane({session,start,count,notes,onPage,onNote}:{session:Session;start:number;count:number;notes:Note[];onPage:(page:number)=>void;onNote:(n:Note)=>void}){
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
      {visible.includes(page)&&(noteMap.get(page)||[]).flatMap(n=>(n.markers||[]).map((m,i)=><button type="button" className="footnote-target" key={n.number+'-'+i} style={{left:m.x*100+'%',top:m.y*100+'%',width:m.w*100+'%',height:m.h*100+'%'}} onClick={()=>onNote(n)} aria-label={'각주 '+n.number+' 보기'} />))}
    </article>)}</div></main>;
}

function Workspace({session,catalog,notes,logout}:{session:Session;catalog:Catalog;notes:Note[];logout:()=>void}){
  const initial=Math.max(1,Math.min(catalog.bodyStartPage||1,catalog.pageCount));
  const [page,setPage]=useState(initial),[pageInput,setPageInput]=useState(String(initial)),[toc,setToc]=useState(false),[query,setQuery]=useState(''),[list,setList]=useState(false),[own,setOwn]=useState<{page:number;number?:number;id?:string}|null>(null),[preview,setPreview]=useState<number|undefined>();
  const sources=useMemo(()=>new Map(catalog.sources.map(s=>[s.id,s])),[catalog]);
  const pageNotes=useMemo(()=>notes.filter(n=>n.page===page),[notes,page]);
  const options=useMemo(()=>pageNotes.flatMap(n=>n.sources.filter(s=>sources.has(s.id)).map(s=>({note:n,citation:s}))),[pageNotes,sources]);
  const chosen=own?.page===page?own:null;
  const entry=chosen?options.find(item=>item.note.number===chosen.number&&item.citation.id===chosen.id):options[0];
  const sourceId=chosen?.id||entry?.citation.id;
  const selectedNote=entry?.note||notes.find(n=>chosen?.number===n.number);
  const citation:Citation|undefined=entry?.citation||selectedNote?.sources.find(s=>s.id===sourceId);
  const source=sourceId?sources.get(sourceId):null;
  const previews=citation?.previewPages?.length?citation.previewPages:citation?.image&&citation.page?[citation.page]:[];
  const previewPage=preview&&previews.includes(preview)?preview:previews[0];
  const change=useCallback((p:number)=>{setPage(p);setPageInput(String(p));setPreview(undefined);setOwn(previous=>previous?.page===p?previous:null);},[]);
  useEffect(()=>{window.dispatchEvent(new CustomEvent('paper:page',{detail:{page}}));},[page]);
  const jump=(p:number)=>window.dispatchEvent(new CustomEvent('paper:navigate',{detail:{page:Math.max(1,Math.min(p,catalog.pageCount))}}));
  const chooseNote=(n:Note)=>{setList(false);setOwn({page,number:n.number,id:n.sources[0]?.id});setPreview(undefined);};
  const chooseSource=(id:string)=>{const n=pageNotes.find(n=>n.sources.some(c=>c.id===id))||notes.find(n=>n.sources.some(c=>c.id===id));setList(false);setOwn({page,number:n?.number,id});setPreview(undefined);};
  return <div className="examiner-app"><header className="examiner-header"><KuBrand/><div className="paper-heading"><small>박사학위논문 · {catalog.author}</small><h1>{catalog.title}</h1>{catalog.subtitle&&<p>{catalog.subtitle}</p>}</div><nav><span className="reader-tools-slot"/><button type="button" onClick={()=>setToc(v=>!v)} aria-expanded={toc}>목차</button><button type="button" onClick={()=>setList(v=>!v)} aria-expanded={list}>참고문헌</button><button type="button" onClick={logout}>열람 종료</button></nav></header>
    <section className="page-controls"><button disabled={page===1} onClick={()=>jump(page-1)}>이전</button><form onSubmit={e=>{e.preventDefault();const n=Number(pageInput);if(Number.isInteger(n)&&n>0)jump(n);}}><input aria-label="논문 쪽" value={pageInput} onChange={e=>setPageInput(e.target.value)} inputMode="numeric"/> / {catalog.pageCount}쪽 <button>이동</button></form><button disabled={page===catalog.pageCount} onClick={()=>jump(page+1)}>다음</button></section>
    <div className="reader-layout">{toc&&<aside className="toc-pane"><h2>목차</h2>{catalog.toc.map((row,i)=><button key={i} style={{paddingLeft:Math.min(4,row.level||1)*9+'px'}} onClick={()=>{jump(row.page);setToc(false);}}>{row.title}<small>{row.page}쪽</small></button>)}</aside>}
      <DocumentPane session={session} start={initial} count={catalog.pageCount} notes={notes} onPage={change} onNote={chooseNote}/>
      <aside className="reference-pane" aria-label="참고문헌"><div className="reference-toolbar"><strong>참고문헌·원전</strong><div>{options.length>0&&<select aria-label="이 쪽의 인용자료" value={entry?entry.note.number+'/'+entry.citation.id:''} onChange={e=>{const opt=options.find(o=>o.note.number+'/'+o.citation.id===e.target.value);if(opt){setList(false);setOwn({page,number:opt.note.number,id:opt.citation.id});setPreview(undefined);}}}><option value="" disabled>이 쪽의 인용자료</option>{options.map((o,i)=><option key={i} value={o.note.number+'/'+o.citation.id}>각주 {o.note.number} · {sources.get(o.citation.id)?.title}</option>)}</select>}
        <button onClick={()=>{setList(v=>!v);setOwn(null);}}>{list?'본문 따라가기':'자료 목록'}</button></div></div>
      {list?<section className="source-library"><h2>자료 목록</h2><label>자료 검색<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>{catalog.sources.filter(s=>s.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(s=><button key={s.id} onClick={()=>chooseSource(s.id)}>{s.title}</button>)}</section>:
      <section className="source-dialog"><h2>{source?.title||(selectedNote?'각주 '+selectedNote.number:'이 쪽의 인용자료')}</h2>
        {selectedNote&&<details open><summary>각주 {selectedNote.number}</summary><p>{selectedNote.text}</p></details>}
        {citation?.label&&<p className="citation-location">{citation.label}</p>}
        {citation?.excerpt&&<blockquote>{citation.verified?<mark>{citation.excerpt}</mark>:citation.excerpt}</blockquote>}
        {previewPage&&sourceId&&<><h3>확인된 인용면</h3><div className="preview-pages">{previews.map(p=><button aria-pressed={p===previewPage} key={p} onClick={()=>setPreview(p)}>{p}면</button>)}</div><div className="source-image"><Photo session={session} label="인용면" query={new URLSearchParams({source:sourceId,page:String(previewPage)}).toString()}/>{previewPage===citation?.page&&citation.highlights?.map((r,i)=><mark key={i} style={{left:r.x*100+"%",top:r.y*100+"%",width:r.w*100+"%",height:r.h*100+"%"}}/>)}</div></>}
        {!source&&!selectedNote&&<p>이 쪽에 연결된 인용자료가 없습니다.</p>}
        {source&&(!citation||(!citation.excerpt&&!previewPage))&&<p>현재 자료의 서지와 연결 각주를 표시합니다.</p>}
      </section>}
      {!list&&pageNotes.length>0&&<div className="note-list" aria-label="이 쪽의 각주">{pageNotes.map(n=><button key={n.number} onClick={()=>chooseNote(n)} aria-pressed={selectedNote?.number===n.number}>각주 {n.number}</button>)}</div>}
    </aside></div></div>;
}

function ReadingSession({session,logout}:{session:Session;logout:()=>void}){
  const [data,setData]=useState<{catalog:Catalog;notes:Note[]}|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const c=new AbortController();setError('');
    Promise.all(['catalog','citations'].map(k=>privateResource(session,new URLSearchParams({metadata:k}),c.signal).then(r=>r.json()))).then(([catalog,citations])=>{if(!c.signal.aborted)setData({catalog,notes:citations.notes});}).catch(e=>{if(!c.signal.aborted)setError(e.message);});
    return()=>c.abort();},[session,attempt]);
  if(!data)return <main className="loading" role="status">{error||'열람 자료를 불러오는 중…'}{error&&<button onClick={()=>setAttempt(a=>a+1)}>다시 시도</button>}<button onClick={logout}>열람 종료</button></main>;
  return <Workspace session={session} catalog={data.catalog} notes={data.notes} logout={logout}/>;
}

function App(){
  const [session,setSession]=useState<Session|null>(readSession);
  const logout=useCallback(()=>{storeSession(null);setSession(null);},[]);
  useEffect(()=>{if(!session)return;const timer=setTimeout(logout,Math.max(0,expiration(session.expiresAt)-Date.now()));window.addEventListener('paper:expired',logout);return()=>{clearTimeout(timer);window.removeEventListener('paper:expired',logout);};},[session,logout]);
  return session?<ReadingSession session={session} logout={logout}/>:<Gate ready={s=>{storeSession(s);setSession(s);}}/>;
}
createRoot(document.getElementById('root')!).render(<App/>);
