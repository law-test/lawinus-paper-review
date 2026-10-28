import ReaderControls from './reader-controls';
import React,{useEffect,useRef,useState} from 'react';
import type {SharedEdit} from './shared-edits';
import './web-manuscript.css';
import {proposalLabel,type ProposalIndicator} from './proposal-indicators';
import './proposal-indicators.css';
import {useBodyReadingPosition} from './body-reading-hook';
import {LegalText} from './legal-links';
import SourceText,{type SourceSegment} from './source-text';

export type ManuscriptParagraph={id:string;text:string;page:number;printed:string|number|null;kind:string;heading:boolean;order:number;rects:{page:number;rect:number[]}[]};
type Note={id:string;number:number;page:number;text:string};
// Keep every server head for optimistic revisions/history; only changed text affects reading display.
export function effectiveManuscriptEdits<T extends {text:string}>(paragraphs:Pick<ManuscriptParagraph,'id'|'text'>[],notes:Pick<Note,'id'|'text'>[],heads:Record<string,T>):Record<string,T>{
  const originals=new Map([...paragraphs,...notes].map(item=>[item.id,item.text]));
  return Object.fromEntries(Object.entries(heads).filter(([id,edit])=>!originals.has(id)||edit.text!==originals.get(id)));
}
export function manuscriptModeAfterRefresh(current:'pdf'|'body',userChoseView:boolean,overrideCount:number):'pdf'|'body'{
  return !userChoseView&&overrideCount>0?'body':current;
}
export function citationContextWasEdited(noteId:string,paragraphs:Pick<ManuscriptParagraph,'id'|'text'>[],overrides:Record<string,unknown>):boolean{
  const marker=`[^${Number(noteId.slice(3))}]`;
  return !!overrides[noteId]||paragraphs.some(p=>!!overrides[p.id]&&p.text.includes(marker));
}
export function InlineNoteText({text,onNote,contextId}:{text:string;onNote:(id:string)=>void;contextId?:string}){
  return <LegalText text={text} onNote={onNote} contextId={contextId}/>;
}

export default function WebManuscript({extraControls,controlsHost,paragraphs,overrides,notes,page,zoom,selected,onPageChange,onParagraph,onNote,onReference,proposalIndicators={},onProposal,persistenceKey,navigationToken,onNavigationHandled}:{extraControls?:React.ReactNode;controlsHost?:HTMLElement|null;paragraphs:ManuscriptParagraph[];overrides:Record<string,SharedEdit>;notes:Note[];page:number;zoom:number;selected:string;onPageChange:(page:number)=>void;onParagraph:(id:string)=>void;onNote:(id:string)=>void;onReference:(noteId:string,segment:SourceSegment)=>void;proposalIndicators?:Record<string,ProposalIndicator>;onProposal?:(proposalId:string)=>void;persistenceKey?:string;navigationToken?:number;onNavigationHandled?:(token:number)=>void}){
  const host=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;top:number;moved:boolean}|null>(null),suppressClick=useRef(false);
  const reportPage=useBodyReadingPosition(host,page,zoom,persistenceKey,onPageChange,navigationToken,onNavigationHandled,overrides);
  const [hand,setHand]=useState(true);
  const groups=new Map<number,ManuscriptParagraph[]>();
  for(const p of paragraphs){const group=groups.get(p.page)||[];group.push(p);groups.set(p.page,group);}
  useEffect(()=>{const cancel=()=>{drag.current=null;suppressClick.current=false;};window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',cancel);return()=>{window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',cancel);};},[]);
  return <div className="web-manuscript-reader">{extraControls&&<div className="manuscript-control-dock">{extraControls}</div>}<ReaderControls host={controlsHost}><div className="manuscript-tools"><span>본문</span><button className={hand?'selected':''} onClick={()=>setHand(true)}>✋ 이동</button><button className={!hand?'selected':''} onClick={()=>setHand(false)}>글자 선택</button></div></ReaderControls>
    <div className={'web-manuscript'+(hand?' hand-mode':'')} ref={host} onScroll={reportPage} style={{'--manuscript-zoom':zoom} as React.CSSProperties}
      onPointerDown={e=>{suppressClick.current=false;if(!hand||e.pointerType==='touch'||e.button!==0||(e.target as HTMLElement).closest('button,a'))return;drag.current={x:e.clientX,y:e.clientY,top:e.currentTarget.scrollTop,moved:false};}}
      onPointerMove={e=>{const d=drag.current;if(!d)return;if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>5){d.moved=true;e.currentTarget.setPointerCapture(e.pointerId);}if(d.moved){e.currentTarget.scrollTop=d.top-(e.clientY-d.y);e.preventDefault();}}}
      onPointerUp={e=>{suppressClick.current=!!drag.current?.moved;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
      onPointerCancel={()=>{suppressClick.current=!!drag.current?.moved;drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
      onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}}>
      {Array.from(groups).map(([n,items])=><section className="manuscript-page" key={n} data-manuscript-page={n}><div className="manuscript-page-label">PDF {n}쪽{items[0].printed?` · 인쇄 ${items[0].printed}면`:''}</div>
        {items.map(p=>{const indicator=proposalIndicators[p.id],deleted=!!overrides[p.id]&&overrides[p.id].text.trim()==='';const open=()=>indicator&&onProposal?onProposal(indicator.primaryProposalId):onParagraph(p.id);return <div key={p.id} hidden={deleted&&!indicator} data-paragraph={p.id} className={'manuscript-paragraph'+(p.heading?' manuscript-heading':'')+(p.kind==='table_row'?' manuscript-table-row':'')+(selected===p.id?' active':'')+(overrides[p.id]?' amended':'')+(indicator?' has-proposal proposal-'+indicator.tone:'')} role="button" tabIndex={0} title="클릭하면 수정안" aria-label={(indicator?proposalLabel(indicator)+' · ':'')+'문단 수정안 열기: '+(overrides[p.id]?.text??p.text).replace(/\[\^\d+\]/g,'').slice(0,55)} onClick={()=>{if(window.getSelection()?.isCollapsed===false)return;open();}} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open();}}}>
          {indicator&&<span className="manuscript-proposal-label"><button className={'proposal-badge proposal-'+indicator.tone} onClick={e=>{e.stopPropagation();open();}}>{proposalLabel(indicator)}</button></span>}
          {deleted?<span className="manuscript-deleted-label">현재 본문에서 삭제된 문단</span>:<InlineNoteText text={overrides[p.id]?.text??p.text} onNote={onNote} contextId={p.id}/>}
        </div>;})}
        {notes.some(note=>note.page===n)&&<div className="manuscript-footnotes">{notes.filter(note=>note.page===n).map(note=><div key={note.id} hidden={!!overrides[note.id]&&overrides[note.id].text.trim()===''} className="manuscript-footnote-row"><button type="button" title={`각주 ${note.number} 상세정보`} onClick={()=>onNote(note.id)}><sup>{note.number})</sup></button> <SourceText noteId={note.id} text={overrides[note.id]?.text??note.text} onReference={segment=>onReference(note.id,segment)}/></div>)}</div>}
      </section>)}
    </div>
  </div>;
}
