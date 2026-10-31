import {useManuscriptEditionId} from './manuscript-edition-context';
import {manuscriptNoteLabel} from './manuscript-format';
import React,{createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {getLegalMentions,getLegalMentionDetails} from './legal-link-model';
import {usePopupDrag} from './use-popup-drag';
import './legal-links.css';

export type LegalMention=ReturnType<typeof getLegalMentions>[number];
type OpenLegal=(mention:LegalMention)=>void;
const LegalContext=createContext<OpenLegal>(()=>{});
export const useLegalLinks=()=>useContext(LegalContext);
const statusLabels={current:'현행 조문',proposal:'논문의 개정·신설안',historical:'과거 법령 인용',foreign:'외국 법령',unresolved:'인용 법령 확인'};

function LegalDialog({mention,onClose,opener}:{mention:LegalMention;onClose:()=>void;opener:HTMLElement|null}){
 const dialog=useRef<HTMLDialogElement>(null);
 const drag=usePopupDrag({elementRef:dialog,boundary:'header'});
 const detail=getLegalMentionDetails(mention);
 const articleText=mention.status==='current'?(mention.articleText||detail.article?.text):undefined;
 useEffect(()=>{
  const element=dialog.current!;element.showModal();
  return()=>{element.close();if(opener?.isConnected)opener.focus({preventScroll:true});};
 },[]);
 return <dialog ref={dialog} className={`legal-dialog${articleText?' legal-dialog-article':''}`} data-dragging={drag.dragging||undefined} style={{transform:`translate(${drag.offset.x}px,${drag.offset.y}px)`}} aria-labelledby="legal-dialog-title" onKeyDown={event=>{if(event.key==='Escape'||event.key==='Tab')event.stopPropagation();}} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}}}>
  <div className="legal-dialog-heading" {...drag.handleProps} aria-label="조문 확인창 이동"><div><span>{statusLabels[mention.status]}</span><h2 id="legal-dialog-title">{detail.title}</h2></div><button type="button" onClick={onClose} aria-label="조문 확인 닫기">닫기 ×</button></div>
  <div className="legal-dialog-body">
   {mention.reason&&<p className="legal-context-note">{mention.reason}</p>}
   <a className="legal-primary-source" href={mention.href} target="_blank" rel="noopener noreferrer">{mention.status==='current'?'해당 조문 공식 원문 열기':mention.status==='proposal'?'개정·신설안 관련 근거 확인':mention.status==='historical'?'법령 연혁·인용 조문 확인':mention.status==='foreign'?'외국 법령 원문 확인':'법령명과 조문 찾아보기'} ↗</a>
   {articleText&&<section className="legal-article-preview"><h3>조문 내용</h3><div>{articleText}</div><small>{detail.effectiveLabel?`${detail.effectiveLabel} · `:''}확인일 {detail.verifiedOn}. 공식 원문에서 시행일과 개정 내용을 함께 확인할 수 있습니다.</small></section>}
   {mention.related.length>0&&<section className="legal-related"><h3>{mention.status==='foreign'?'함께 확인할 공식 자료':'함께 확인할 법령'}</h3><ul>{mention.related.map(link=><li key={link.href+link.label}><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a></li>)}</ul></section>}
   {detail.relatedNote&&<p className="legal-related-note">{detail.relatedNote}</p>}
  </div>
 </dialog>;
}

export function LegalLinkProvider({children}:{children:React.ReactNode}){
 const [selection,setSelection]=useState<{mention:LegalMention;opener:HTMLElement|null}|null>(null);
 const open:OpenLegal=mention=>setSelection({mention,opener:document.activeElement instanceof HTMLElement?document.activeElement:null});
 return <LegalContext.Provider value={open}>{children}{selection&&<LegalDialog key={selection.mention.href+selection.mention.label} mention={selection.mention} opener={selection.opener} onClose={()=>setSelection(null)}/>}</LegalContext.Provider>;
}

export function LegalCitation({mention,children}:{mention:LegalMention;children?:React.ReactNode}){
 const open=useLegalLinks();
 return <a className="legal-inline-link" href={mention.href} aria-haspopup="dialog" title={`${mention.lawName||'법령'} ${mention.label} · 조문과 관련 법령 확인`} onClick={event=>{event.stopPropagation();if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();open(mention);}}>{children??mention.label}</a>;
}

export function LegalText({text,contextId,defaultLawId,onNote}:{text:string;contextId?:string;defaultLawId?:string;onNote?:(id:string)=>void}){
 const edition=useManuscriptEditionId();
 const mentions=useMemo(()=>getLegalMentions(text,{contextId,defaultLawId,edition}),[text,contextId,defaultLawId,edition]);
 const plain=(value:string,key:number)=>onNote?<React.Fragment key={'plain'+key}>{value.split(/(\[\^\d+\])/g).map((part,i)=>/^\[\^\d+\]$/.test(part)?<button key={i} className="manuscript-note-marker" title="각주 원전 열기" onClick={event=>{event.stopPropagation();onNote('fn-'+part.slice(2,-1).padStart(3,'0'));}}>{manuscriptNoteLabel(part.slice(2,-1),edition)}</button>:part)}</React.Fragment>:value;
 const parts:React.ReactNode[]=[];let cursor=0;
 for(const mention of mentions){if(mention.start<cursor||mention.end<=mention.start||mention.end>text.length)continue;if(mention.start>cursor)parts.push(plain(text.slice(cursor,mention.start),cursor));parts.push(<LegalCitation key={mention.start} mention={mention}>{text.slice(mention.start,mention.end)}</LegalCitation>);cursor=mention.end;}
 if(cursor<text.length)parts.push(plain(text.slice(cursor),cursor));
 return <>{parts}</>;
}
