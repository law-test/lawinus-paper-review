import React,{useEffect,useMemo,useRef,useState} from 'react';
import PdfPane from './pdf-viewer';
import type {PdfFitMode} from './pdf-viewer-model';
import {evidenceHighlights,sha256Text,sourceNotes,textEvidenceParts,verifiedEvidence,verifiedTextEvidence,type DocumentVerification,type EvidenceDocument,type EvidenceNote} from './source-evidence';

type Source={id:string;title:string;kind:string;pages?:number|null};
type Props={source:Source;href:string;text:string;byteHash:string;error:string;notes:EvidenceNote[];selectedNoteId:string|null;onNoteChange:(id:string|null)=>void;page:number;onPageChange:(page:number)=>void;evidence:EvidenceDocument|null;evidenceState:'loading'|'ready'|'error';onClose:()=>void;onRetry:()=>void};
export default function SourceReader({source,href,text,byteHash,error,notes,selectedNoteId,onNoteChange,page,onPageChange,evidence,evidenceState,onClose,onRetry}:Props){
 const linkedNotes=useMemo(()=>sourceNotes(notes,source.id),[notes,source.id]);
 const note=linkedNotes.find(n=>n.id===selectedNoteId);
 const [noteHash,setNoteHash]=useState(''),[textHash,setTextHash]=useState('');
 const [verification,setVerification]=useState<DocumentVerification>('checking');
 const [zoom,setZoom]=useState(1),[fit,setFit]=useState<PdfFitMode>('width'),[navigation,setNavigation]=useState(0),[showTextHighlights,setShowTextHighlights]=useState(true);
 const [navigationFocus,setNavigationFocus]=useState<{page:number;x:number;y:number}|undefined>();
 const dialog=useRef<HTMLElement>(null),originalText=useRef<HTMLPreElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{let stopped=false;setNoteHash('');if(note)void sha256Text(note.text).then(hash=>{if(!stopped)setNoteHash(hash);}).catch(()=>{});return()=>{stopped=true;};},[note]);
 useEffect(()=>{let stopped=false;setTextHash('');if(source.kind==='text'&&text)void sha256Text(text).then(hash=>{if(!stopped)setTextHash(hash);}).catch(()=>{});return()=>{stopped=true;};},[source.kind,text]);
 const entries=useMemo(()=>verifiedEvidence(evidence,note,source,noteHash),[evidence,note,source,noteHash]);
 const expectedHash=entries[0]?.sourceSha256;
 const highlights=useMemo(()=>evidenceHighlights(entries),[entries]);
 const pageSizes=useMemo(()=>[...new Map(entries.filter(e=>e.kind==='pdf').map(e=>[e.page!,{page:e.page!,width:e.pageWidth!,height:e.pageHeight!}])).values()],[entries]);
 const textEntries=verifiedTextEvidence(entries,text,byteHash,textHash);
 const confirmed=source.kind==='pdf'?verification==='verified'&&highlights.length>0:textEntries.length>0;
 // A different note or PDF must never retain the former selection's success state.
 useEffect(()=>{setVerification('checking');},[source.id,expectedHash]);
 useEffect(()=>{setShowTextHighlights(true);},[source.id,selectedNoteId]);
 useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;closeButton.current?.focus();return()=>{previous?.focus({preventScroll:true});};},[]);
 function navigate(next:number,focus=false){const entry=focus?entries.find(e=>e.kind==='pdf'&&e.page===next):undefined,rect=entry?.rects?.[0];setNavigationFocus(entry&&rect?{page:next,x:rect[0]/entry.pageWidth!,y:rect[1]/entry.pageHeight!}:undefined);onPageChange(next);setNavigation(v=>v+1);}
 function chooseNote(id:string){const next=linkedNotes.find(n=>n.id===id);onNoteChange(next?.id||null);const target=next?.sourceRefs.find(r=>r.sourceId===source.id)?.targetPage;if(target)navigate(target);}
 function findEvidence(){
  if(source.kind==='pdf'&&entries[0]?.page){navigate(entries[0].page,true);return;}
  originalText.current?.querySelector('mark')?.scrollIntoView({block:'center',behavior:'smooth'});
 }
 let message=linkedNotes.length?'각주를 선택하면 해당 인용 구절을 확인할 수 있습니다.':'이 자료에 연결된 각주가 없어 인용 구절을 표시하지 않습니다. 원전은 그대로 읽을 수 있습니다.';
 if(note){
  if(evidenceState==='loading'||!noteHash)message='인용 구절 정보를 확인하고 있습니다…';
  else if(evidenceState==='error')message='인용 구절 정보를 불러오지 못했습니다. 원전은 그대로 읽을 수 있습니다.';
  else if(!entries.length)message='이 각주의 인용 구절은 아직 표시되지 않았습니다. 인용면에서 원문을 확인해 주세요.';
  else if(source.kind==='pdf'&&verification==='mismatch'||source.kind==='text'&&byteHash&&expectedHash!==byteHash)message='원전 파일이 확인된 자료와 달라 강조 표시를 보류했습니다.';
  else if(source.kind==='pdf'&&verification==='unavailable')message='원전 파일을 대조하지 못해 강조 표시를 보류했습니다.';
  else if(source.kind==='text'&&textHash&&entries.some(e=>e.textSha256!==textHash))message='원전의 표시 문장이 달라 강조 표시를 보류했습니다.';
  else if(source.kind==='text'&&textHash&&!textEntries.length)message='인용 구절의 위치를 대조하지 못해 강조 표시를 보류했습니다.';
  else if(!confirmed)message='원전 파일과 인용 구절을 대조하고 있습니다…';
  else message='선택한 각주의 인용 구절을 노란색으로 표시합니다.';
 }
 function trapKeys(event:React.KeyboardEvent){
  if(event.key==='Escape'){event.stopPropagation();onClose();return;}

 }
 const parts=textEvidenceParts(text,showTextHighlights?textEntries:[]);
 return <div className="source-inline-reader" role="region" aria-label="인용 원전" onKeyDown={trapKeys}>
  <section className="source-dialog" ref={dialog}>
   <header><h2>{source.title}</h2><div>{href&&<a href={href+(source.kind==='pdf'?'#page='+page:'')} target="_blank" rel="noopener noreferrer">원문 별도 창 ↗</a>}<button ref={closeButton} onClick={onClose} aria-label="원전 닫기">닫기 ×</button></div></header>
   <section className="source-evidence-panel" aria-label="인용 구절">
    <div className="source-evidence-actions"><label>인용 각주 <select disabled={!linkedNotes.length} value={note?.id||''} onChange={e=>chooseNote(e.target.value)}><option value="">{linkedNotes.length?'각주 선택':'연결된 각주 없음'}</option>{linkedNotes.map(n=><option key={n.id} value={n.id}>각주 {n.number}{evidence?.entries.some(e=>e.sourceId===source.id&&e.noteId===n.id&&e.status==='verified')?' · 표시 구절 있음':''}</option>)}</select></label>{confirmed&&<button onClick={findEvidence}>인용 구절로 이동</button>}{confirmed&&source.kind==='text'&&<button aria-pressed={showTextHighlights} onClick={()=>setShowTextHighlights(!showTextHighlights)}>{showTextHighlights?'강조 숨기기':'강조 보기'}</button>}</div>
    <p className={'evidence-status'+(confirmed?' verified':'')} role="status"><span aria-hidden="true" className="evidence-swatch"/>{message}</p>
    {note&&<details className="evidence-context"><summary>각주 {note.number} · 논문에서 인용한 맥락</summary><p className="evidence-note-text">{note.text}</p>{note.bodyContexts?.map(context=><p key={context.id} className="evidence-body-context">{context.text.replace(/\[\^(\d+)\]/g,(_m,n)=>` [각주 ${n}]`)}<small>원고 PDF {context.page}쪽</small></p>)}</details>}
    {confirmed&&source.kind==='pdf'&&<div className="evidence-page-links">{[...new Map(entries.filter(e=>e.page).map(e=>[e.page,e])).values()].map(e=><button key={e.page} onClick={()=>navigate(e.page!,true)}>{e.printedPage?`${e.printedPage}면`:`PDF ${e.page}쪽`} · 인용 구절</button>)}</div>}
   </section>
   {error?<p className="source-error" role="alert">{error} <button onClick={onRetry}>다시 열기</button></p>:!href?<p className="source-error">원전을 불러오는 중입니다…</p>:source.kind==='pdf'?<PdfPane id={source.id} url={href} page={page} total={source.pages||1} fitMode={fit} zoom={zoom} onFitModeChange={setFit} onZoomChange={value=>{setFit(null);setZoom(value);}} onZoomResolved={setZoom} quickTools onPageChange={onPageChange} label="인용 원전" highlights={highlights} sourceChecksum={expectedHash} onDocumentVerification={setVerification} navigationToken={navigation} navigationFocus={navigationFocus} pageSizes={pageSizes}/>:<pre ref={originalText} className="source-original-text">{text?parts.map(part=>part.highlighted?<mark key={part.start}>{part.text}</mark>:<React.Fragment key={part.start}>{part.text}</React.Fragment>):'원문을 불러오는 중입니다…'}</pre>}
  </section>
 </div>;
}
