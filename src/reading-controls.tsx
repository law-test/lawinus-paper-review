import React,{useEffect,useRef,useState} from 'react';
import {type ReadingView,readingVisibility,withReadingFocus,withReadingSurface} from './reading-view';

type Props={view:ReadingView;onChange:(view:ReadingView)=>void;sidebar:boolean;metadata:boolean;onSidebar:(show:boolean)=>void;onMetadata:(show:boolean)=>void;document:'thesis'|'source';onDocument:(document:'thesis'|'source')=>void};

export default function ReadingControls({view,onChange,sidebar,metadata,onSidebar,onMetadata,document:currentDocument,onDocument}:Props){
  const [open,setOpen]=useState(false);
  const menu=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const close=()=>{setOpen(false);trigger.current?.focus({preventScroll:true});};
  useEffect(()=>{const controls=menu.current?.querySelector<HTMLElement>('.reading-view-actions'),app=menu.current?.closest<HTMLElement>('.review-app');if(!controls||!app)return;const measure=()=>app.style.setProperty('--reading-actions-clearance',`${Math.ceil(controls.getBoundingClientRect().width)+20}px`);measure();const observer=new ResizeObserver(measure);observer.observe(controls);return()=>{observer.disconnect();app.style.removeProperty('--reading-actions-clearance');};},[]);
  useEffect(()=>{if(!open)return;const pointer=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))setOpen(false);};const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();}};window.addEventListener('pointerdown',pointer);window.addEventListener('keydown',key);return()=>{window.removeEventListener('pointerdown',pointer);window.removeEventListener('keydown',key);};},[open]);
  const visible=readingVisibility(view,sidebar,metadata);
  const choices:[string,boolean,(show:boolean)=>void][]=[
    ['상단 메뉴',visible.header,show=>onChange(withReadingSurface(view,'header',show))],
    ['보기 도구',visible.tools,show=>onChange(withReadingSurface(view,'tools',show))],
    ['하단 각주 목록',visible.footnotes,show=>onChange(withReadingSurface(view,'footnotes',show))],
    ['목차',visible.sidebar,onSidebar],
    ['각주 상세정보',visible.metadata,onMetadata],
  ];
  return <div className="reading-view-menu" ref={menu}>
    <div className="reading-view-actions">
      <button className="reading-collapse-toggle" aria-label={view.focus?'메뉴 펼치기':'메뉴 접기'} aria-expanded={!view.focus} aria-controls="workspace-header workspace-basis workspace-navigation reference-metadata" title={view.focus?'접기 전 메뉴와 도구로 돌아가기':'상단 메뉴와 도구를 접고 문서만 보기'} onClick={()=>{onChange(withReadingFocus(view,!view.focus));setOpen(false);}}><span aria-hidden="true">{view.focus?'⌄':'⌃'}</span><span className="reading-collapse-label">{view.focus?'메뉴 펼치기':'메뉴 접기'}</span><span className="reading-collapse-short" aria-hidden="true">{view.focus?'펼치기':'접기'}</span></button>
      <button className="reading-view-trigger" ref={trigger} aria-expanded={open} aria-controls="reading-view-options" onClick={()=>setOpen(!open)}>보기</button>
    </div>
    {open&&<div className="reading-view-options" id="reading-view-options" role="dialog" aria-label="화면 보기 설정">
      <button className="reading-focus-toggle" aria-pressed={view.focus} onClick={()=>{onChange(withReadingFocus(view,!view.focus));close();}}>{view.focus?'일반 보기로 돌아가기':'원문만 보기'}</button>
      <fieldset className="reading-surface-options"><legend>화면에 표시</legend>{choices.map(([label,checked,change])=><label key={label}><input type="checkbox" checked={checked} onChange={event=>change(event.target.checked)}/>{label}</label>)}</fieldset>
      <div className="reading-document-switch" aria-label="열람할 문서">{[['thesis','논문'],['source','참고문헌']].map(([id,label])=><button key={id} aria-pressed={currentDocument===id} onClick={()=>{onDocument(id as 'thesis'|'source');close();}}>{label}</button>)}</div>
    </div>}
  </div>;
}
