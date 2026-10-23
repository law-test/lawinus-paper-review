import React,{useEffect,useRef,useState} from 'react';
import {type ReadingView,withReadingFocus} from './reading-view';

type Props={view:ReadingView;onChange:(view:ReadingView)=>void;sidebar:boolean;metadata:boolean;onSidebar:(show:boolean)=>void;onMetadata:(show:boolean)=>void;document:'thesis'|'source';onDocument:(document:'thesis'|'source')=>void};

export default function ReadingControls({view,onChange,sidebar,metadata,onSidebar,onMetadata,document:currentDocument,onDocument}:Props){
  const [open,setOpen]=useState(false);
  const menu=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const close=()=>{setOpen(false);trigger.current?.focus({preventScroll:true});};
  useEffect(()=>{if(!open)return;const pointer=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))setOpen(false);};const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();}};window.addEventListener('pointerdown',pointer);window.addEventListener('keydown',key);return()=>{window.removeEventListener('pointerdown',pointer);window.removeEventListener('keydown',key);};},[open]);
  const choices:[string,boolean,(show:boolean)=>void][]=[
    ['머리말',view.header,show=>onChange({...view,header:show})],
    ['보기 도구',view.tools,show=>onChange({...view,tools:show})],
    ['하단 각주 목록',view.footnotes,show=>onChange({...view,footnotes:show})],
    ['목차',sidebar,onSidebar],
    ['각주 상세정보',metadata,onMetadata],
  ];
  return <div className="reading-view-menu" ref={menu}>
    <button className="reading-view-trigger" ref={trigger} aria-expanded={open} aria-controls="reading-view-options" onClick={()=>setOpen(!open)}>보기</button>
    {open&&<div className="reading-view-options" id="reading-view-options" role="dialog" aria-label="화면 보기 설정">
      <button className="reading-focus-toggle" aria-pressed={view.focus} onClick={()=>{onChange(withReadingFocus(view,!view.focus));close();}}>{view.focus?'일반 보기로 돌아가기':'원문만 보기'}</button>
      <fieldset className="reading-surface-options"><legend>화면에 표시</legend>{choices.map(([label,checked,change])=><label key={label}><input type="checkbox" checked={!view.focus&&checked} disabled={view.focus} onChange={event=>change(event.target.checked)}/>{label}</label>)}</fieldset>
      <div className="reading-document-switch" aria-label="열람할 문서">{[['thesis','논문'],['source','참고문헌']].map(([id,label])=><button key={id} aria-pressed={currentDocument===id} onClick={()=>{onDocument(id as 'thesis'|'source');close();}}>{label}</button>)}</div>
    </div>}
  </div>;
}
