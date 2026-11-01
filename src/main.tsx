import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import PdfPane from './pdf-viewer';
import type {PdfTarget} from './pdf-viewer-model';
import {LegalLinkProvider,LegalText,useLegalLinks} from './legal-links';
import SourceText,{type SourceSegment} from './source-text';
import {citationPdfTargets} from './citation-link-model';
import SourceReader from './source-reader';
import {parseEvidenceDocument,sha256Bytes,sourceNoteId,sourceNotes,type EvidenceDocument} from './source-evidence';
import catalog from './paragraph-catalog.json';
import toc from './thesis-toc-data.json';
import lawData from './legal-pdf-targets.json';
import citationPages from './citation-pages.json';
import './examiner.css';
import './pdf-base.css';
type Obj=Record<string,any>;
const publicManifest='./editions/human80/manifest.json';
const pdf='./editions/human80/manuscript.pdf';
const signedCache=new Map<string,{url:string;expires:number}>();
let configPromise:Promise<Obj>|null=null;
async function sourceUrl(source:Obj){
 const old=signedCache.get(source.id);if(old&&old.expires>Date.now())return old.url;
 const cfg=await(configPromise??=fetch('./config.json').then(r=>{if(!r.ok)throw Error('연결 설정을 불러오지 못했습니다.');return r.json();}));
 const endpoint=cfg.supabaseUrl+'/storage/v1/object/sign/'+cfg.storageBucket+'/'+source.storagePath;
 const response=await fetch(endpoint,{method:'POST',headers:{apikey:cfg.supabasePublishableKey,Authorization:'Bearer '+cfg.supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600})});
 if(!response.ok)throw Error('원전을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
 const result=await response.json(),path=result.signedURL||result.signedUrl;
 if(!path)throw Error('원전 주소를 확인하지 못했습니다.');
 const url=path.startsWith('http')?path:cfg.supabaseUrl+'/storage/v1'+path;
 signedCache.set(source.id,{url,expires:Date.now()+3300000});return url;
}
function App(){
 const [manifest,setManifest]=useState<Obj|null>(null),[error,setError]=useState('');
 const [page,setPage]=useState(20),[mode,setMode]=useState<'pdf'|'text'>('pdf'),[tocOpen,setTocOpen]=useState(true),[query,setQuery]=useState('');
 const [noteId,setNoteId]=useState<string|null>(null),[source,setSource]=useState<Obj|null>(null),[sourcePage,setSourcePage]=useState(1),[sourceHref,setSourceHref]=useState(''),[sourceText,setSourceText]=useState(''),[sourceError,setSourceError]=useState(''),[nav,setNav]=useState(0);
 const [sourceNote,setSourceNote]=useState<string|null>(null),[sourceByteHash,setSourceByteHash]=useState(''),[libraryOpen,setLibraryOpen]=useState(false),[libraryQuery,setLibraryQuery]=useState('');
 const [evidence,setEvidence]=useState<EvidenceDocument|null>(null),[evidenceState,setEvidenceState]=useState<'loading'|'ready'|'error'>('loading');
 const sourceRequest=useRef(0);
 const openLaw=useLegalLinks();
 useEffect(()=>{fetch(publicManifest).then(r=>{if(!r.ok)throw Error('원고 정보를 불러오지 못했습니다.');return r.json();}).then(setManifest).catch(e=>setError(e.message));},[]);
 useEffect(()=>{let stopped=false;fetch('./editions/human80/source-evidence.json').then(r=>{if(!r.ok)throw Error('unavailable');return r.json();}).then(parseEvidenceDocument).then(value=>{if(!stopped){setEvidence(value);setEvidenceState('ready');}}).catch(()=>{if(!stopped)setEvidenceState('error');});return()=>{stopped=true;};},[]);
 const note=manifest?.notes.find((n:Obj)=>n.id===noteId);
 const targets=useMemo(()=>manifest?[...manifest.notes.flatMap((n:Obj)=>n.clickTargets.map((t:Obj)=>({...t,noteId:n.id,number:n.number}))),...citationPdfTargets(),...lawData.targets] as PdfTarget[]:[],[manifest]);
 const paragraphs=catalog.paragraphs.filter(p=>query?p.text.includes(query):p.page===page);
 const entries=toc.entries.filter(x=>!query||x.title.includes(query));
 function go(p:number){setPage(Math.max(1,Math.min(266,p)));setNav(v=>v+1);if(window.innerWidth<900)setTocOpen(false);}
 async function openSource(id:string,p=1,requestedNote:string|null=noteId){
  const item=manifest?.sources.find((s:Obj)=>s.id===id);if(!item)return;
  const request=++sourceRequest.current;
  setSource(item);setSourceNote(sourceNoteId(manifest!.notes,id,requestedNote));setSourcePage(p);setSourceHref('');setSourceText('');setSourceByteHash('');setSourceError('');
  try{const url=await sourceUrl(item);if(request!==sourceRequest.current)return;setSourceHref(url);if(item.kind!=='pdf'){const r=await fetch(url);if(!r.ok)throw Error('원문을 불러오지 못했습니다.');const bytes=new Uint8Array(await r.arrayBuffer()),hash=await sha256Bytes(bytes);if(request!==sourceRequest.current)return;const value=new TextDecoder().decode(bytes);let text=value;try{const j=JSON.parse(value);text=j.text||j.content||j.body||j.fullText||JSON.stringify(j,null,2);}catch{}setSourceByteHash(hash);setSourceText(typeof text==='string'?text:JSON.stringify(text,null,2));}}catch(e:any){if(request===sourceRequest.current)setSourceError(e.message);}
 }
 function closeSource(){sourceRequest.current++;setSource(null);setSourceNote(null);setSourceHref('');setSourceText('');setSourceByteHash('');}
 function reference(segment:SourceSegment,contextNote:string|null=noteId){if(segment.sourceId)void openSource(segment.sourceId,segment.page,contextNote);else if(segment.href)window.open(segment.href,'_blank','noopener,noreferrer');}
 function selectTarget(id:string,target?:PdfTarget){if(target?.legalId){const m=(lawData.mentions as Obj)[target.legalId];if(m)openLaw(m);return;}if(target?.sourceId){setNoteId(target.noteId);void openSource(target.sourceId,target.sourcePage||1,target.noteId);return;}setNoteId(id);}
 if(error)return <main className="load-state" role="alert">{error}</main>;
 if(!manifest)return <main className="load-state">원고를 불러오는 중입니다…</main>;
 return <div className="examiner-app">
  <header className="examiner-header"><div><p>박사학위논문 · 김민규</p><h1>{manifest.meta.title}</h1><span>{manifest.meta.subtitle}</span></div><nav aria-label="원고 열람"><button onClick={()=>setTocOpen(!tocOpen)} aria-expanded={tocOpen}>목차</button><button onClick={()=>setLibraryOpen(!libraryOpen)} aria-expanded={libraryOpen}>참고문헌·원전</button><button onClick={()=>setMode(mode==='pdf'?'text':'pdf')}>{mode==='pdf'?'텍스트로 읽기':'PDF로 읽기'}</button><a href={pdf} download="박사논문_심사용.pdf">PDF 내려받기</a><a href="./editions/human80/original.hwp" download="박사논문_원본.hwp">한글 원본</a></nav></header>
  {libraryOpen&&<section className="source-library" aria-label="참고문헌·원전"><header><h2>참고문헌·원전</h2><button onClick={()=>setLibraryOpen(false)} aria-label="원전 목록 닫기">닫기 ×</button></header><label>자료 검색<input type="search" placeholder="저자, 자료명 또는 사건번호" value={libraryQuery} onChange={e=>setLibraryQuery(e.target.value)}/></label><div className="source-library-list">{manifest.sources.filter((s:Obj)=>!libraryQuery||s.title.toLocaleLowerCase().includes(libraryQuery.toLocaleLowerCase())).map((s:Obj)=>{const linked=sourceNotes(manifest.notes,s.id),count=evidence?.entries.filter(e=>e.sourceId===s.id&&e.status==='verified').length||0;return <button key={s.id} onClick={()=>void openSource(s.id,1,null)}><span>{s.title}</span><small>{linked.length}개 각주에서 인용{count?' · 표시 구절 있음':''}</small></button>;})}</div></section>}
  <div className={'reader-layout'+(tocOpen?' with-toc':'')+(note?' with-note':'')}>
   {tocOpen&&<aside className="toc-pane"><label>목차·본문 검색<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="검색어"/></label><div className="toc-list">{entries.map(e=><button key={e.id} className={'level-'+e.level} onClick={()=>go(e.page)}><span>{e.title}</span><small>{e.printedPage??e.page}</small></button>)}</div>{query&&<section className="search-results"><h2>본문 검색 · {paragraphs.length}개</h2>{paragraphs.slice(0,100).map(p=><button key={p.id} onClick={()=>{go(p.page);setQuery('');}}>{p.text.slice(0,130)}<small>PDF {p.page}쪽</small></button>)}</section>}</aside>}
   <main className="manuscript-pane" aria-label="심사용 원고">
    {mode==='pdf'?<PdfPane id="human80" url={pdf} page={page} total={266} fitMode="width" quickTools pageSizes={manifest.pages} targets={targets} highlights={note?.noteHighlights||[]} onPageChange={setPage} onTarget={selectTarget} label="심사용 원고" persistenceKey="examiner-human80" navigationToken={nav}/>:<div className="text-reader"><div className="text-navigation"><button disabled={page<=1} onClick={()=>go(page-1)}>이전</button><label>PDF <input type="number" min="1" max="266" value={page} onChange={e=>go(Number(e.target.value)||1)}/> / 266쪽</label><button disabled={page>=266} onClick={()=>go(page+1)}>다음</button></div>{paragraphs.map(p=><section key={p.id} className={p.heading?'manuscript-heading':'manuscript-paragraph'}><LegalText text={p.text} contextId={'paragraph:'+p.id} onNote={setNoteId}/></section>)}<section className="page-notes">{manifest.notes.filter((n:Obj)=>n.page===page).map((n:Obj)=><p key={n.id}><button onClick={()=>setNoteId(n.id)}>{n.number})</button> <SourceText noteId={n.id} text={n.text} onReference={segment=>reference(segment,n.id)}/></p>)}</section></div>}
   </main>
   {note&&<aside className="note-pane" aria-label={'각주 '+note.number}><header><h2>각주 {note.number}</h2><button onClick={()=>setNoteId(null)} aria-label="각주 닫기">닫기 ×</button></header><div className="note-text"><SourceText noteId={note.id} text={note.text} onReference={segment=>reference(segment,note.id)}/></div><button className="locate-note" onClick={()=>go(note.page)}>원고 PDF {note.page}쪽 보기</button>{note.sourceRefs.length>0&&<section><h3>인용 원전</h3>{note.sourceRefs.map((ref:Obj)=>{const s=manifest.sources.find((x:Obj)=>x.id===ref.sourceId);const pages=((citationPages as Obj)[note.id]?.[ref.sourceId]?.pages||[]);return s&&<div className="source-card" key={s.id}><button onClick={()=>void openSource(s.id,ref.targetPage||1,note.id)}>{s.title}</button>{pages.length>0&&<div className="cited-pages">{pages.map((p:Obj)=><button key={p.page+'-'+p.printed} onClick={()=>void openSource(s.id,p.page,note.id)}>{p.printed}면</button>)}</div>}</div>;})}</section>}{note.crossRefs.length>0&&<div className="cross-notes">함께 인용한 각주 {[...new Set<string>(note.crossRefs)].map(id=><button key={id} onClick={()=>setNoteId(id)}>{Number(id.slice(3))}</button>)}</div>}</aside>}
  </div>
  {source&&<SourceReader key={source.id} source={{id:source.id,title:source.title,kind:source.kind,pages:source.pages}} href={sourceHref} text={sourceText} byteHash={sourceByteHash} error={sourceError} notes={manifest.notes} selectedNoteId={sourceNote} onNoteChange={setSourceNote} page={sourcePage} onPageChange={setSourcePage} evidence={evidence} evidenceState={evidenceState} onClose={closeSource} onRetry={()=>void openSource(source.id,sourcePage,sourceNote)}/>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<LegalLinkProvider><App/></LegalLinkProvider>);
