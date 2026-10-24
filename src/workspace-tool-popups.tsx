import React,{useEffect,useRef,useState} from 'react';
import {embeddedWorkspaceToolHref,initialWorkspaceTools,readWorkspacePopupVisit,rememberWorkspacePopupVisit,workspaceToolLabels,type WorkspaceTool} from './workspace-tools';
import {usePopupDrag} from './use-popup-drag';
import './workspace-tool-popups.css';

const toolOrder:WorkspaceTool[]=['ai-mingyu','glossary'];
function browserStorage(kind:'localStorage'|'sessionStorage'){try{return window[kind];}catch{return undefined;}}
function firstVisitTools(){return initialWorkspaceTools(window.location.search,window.location.hash,window.self!==window.top,readWorkspacePopupVisit(browserStorage('localStorage'))||readWorkspacePopupVisit(browserStorage('sessionStorage')));}

export function useWorkspaceToolPopups(){
 const [open,setOpen]=useState<WorkspaceTool[]>(firstVisitTools),[active,setActive]=useState<WorkspaceTool>('ai-mingyu');
 const [focusSerial,setFocusSerial]=useState(0),openers=useRef<Partial<Record<WorkspaceTool,HTMLElement>>>({});
 useEffect(()=>{if(firstVisitTools().length){if(!rememberWorkspacePopupVisit(browserStorage('localStorage')))rememberWorkspacePopupVisit(browserStorage('sessionStorage'));}},[]);
 function openTool(tool:WorkspaceTool){
  const focused=document.activeElement;if(focused instanceof HTMLElement&&!focused.closest('[data-workspace-tool-popup]'))openers.current[tool]=focused;
  setOpen(old=>old.includes(tool)?old:[...old,tool]);setActive(tool);setFocusSerial(n=>n+1);
 }
 function closeTool(tool:WorkspaceTool){
  setOpen(old=>old.filter(value=>value!==tool));setActive(tool==='ai-mingyu'?'glossary':'ai-mingyu');
  queueMicrotask(()=>{const trigger=openers.current[tool];if(trigger?.isConnected&&trigger!==document.body)trigger.focus({preventScroll:true});else document.querySelector<HTMLButtonElement>(`[data-workspace-tool-launch="${tool}"]`)?.focus({preventScroll:true});});
 }
 return {openTool,layer:<WorkspaceToolPopups open={open} active={active} focusSerial={focusSerial} onOpen={openTool} onClose={closeTool} onActive={setActive}/>};
}

export function WorkspaceToolPopups({open,active,focusSerial,onOpen,onClose,onActive}:{open:WorkspaceTool[];active:WorkspaceTool;focusSerial:number;onOpen:(tool:WorkspaceTool)=>void;onClose:(tool:WorkspaceTool)=>void;onActive:(tool:WorkspaceTool)=>void}){
 const [compact,setCompact]=useState(()=>window.innerWidth<950),[loaded,setLoaded]=useState<Partial<Record<WorkspaceTool,boolean>>>({});
 const panels=useRef<Partial<Record<WorkspaceTool,HTMLElement>>>({}),frameListeners=useRef<Partial<Record<WorkspaceTool,()=>void>>>({});
 const aiPanel=useRef<HTMLElement|null>(null),glossaryPanel=useRef<HTMLElement|null>(null);
 const topInset=()=>document.querySelector('.reading-view-menu')?.getBoundingClientRect().bottom??0;
 const layoutKey=open.join('|');
 const aiDrag=usePopupDrag({enabled:!compact&&open.includes('ai-mingyu'),elementRef:aiPanel,margin:8,topInset,layoutKey});
 const glossaryDrag=usePopupDrag({enabled:!compact&&open.includes('glossary'),elementRef:glossaryPanel,margin:8,topInset,layoutKey});
 const drags={'ai-mingyu':aiDrag,glossary:glossaryDrag},panelRefs={'ai-mingyu':aiPanel,glossary:glossaryPanel};
 const latest=useRef({onClose});latest.current={onClose};
 const visible=toolOrder.filter(tool=>open.includes(tool)),shown=visible.includes(active)?active:visible[0];
 useEffect(()=>{const resize=()=>setCompact(window.innerWidth<950);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 useEffect(()=>{if(shown&&!document.activeElement?.closest('.workspace-popup-tabs'))panels.current[shown]?.querySelector<HTMLButtonElement>('[data-popup-close]')?.focus({preventScroll:true});},[focusSerial]);
 useEffect(()=>{for(const tool of toolOrder)if(!open.includes(tool)){frameListeners.current[tool]?.();delete frameListeners.current[tool];setLoaded(old=>old[tool]?{...old,[tool]:false}:old);}},[open.join('|')]);
 useEffect(()=>()=>{for(const remove of Object.values(frameListeners.current))remove?.();},[]);
 function close(tool:WorkspaceTool){try{const frame=panels.current[tool]?.querySelector('iframe');frame?.contentWindow?.speechSynthesis?.cancel();}catch{/* Only same-origin standalone frames are used. */}onClose(tool);}
 function frameReady(tool:WorkspaceTool,frame:HTMLIFrameElement){
  frameListeners.current[tool]?.();setLoaded(old=>({...old,[tool]:true}));
  try{const inner=frame.contentDocument;if(!inner)return;
   const escape=(event:KeyboardEvent)=>{if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||inner.querySelector('[role="dialog"][aria-modal="true"]'))return;event.preventDefault();frame.contentWindow?.speechSynthesis?.cancel();latest.current.onClose(tool);};
   inner.addEventListener('keydown',escape);frameListeners.current[tool]=()=>inner.removeEventListener('keydown',escape);
  }catch{/* Frame navigation never grants access to a different origin. */}
 }
 if(!visible.length)return null;
 return <div className={`workspace-tool-popups${compact?' compact':''}${visible.length===1?' single':''}`} role={compact?'dialog':'region'} aria-modal={compact?false:undefined} aria-label="논문 도구 팝업">
  {compact&&<div className="workspace-popup-tabs" role="tablist" aria-label="도구 선택">{toolOrder.map(tool=><button key={tool} id={`workspace-popup-tab-${tool}`} role="tab" aria-selected={shown===tool} aria-controls={`workspace-popup-${tool}`} tabIndex={shown===tool?0:-1} onClick={()=>onOpen(tool)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'ai-mingyu':event.key==='End'?'glossary':tool==='ai-mingyu'?'glossary':'ai-mingyu';onOpen(next);document.getElementById(`workspace-popup-tab-${next}`)?.focus();}}}>{workspaceToolLabels[tool]}</button>)}</div>}
  {visible.map(tool=><section key={tool} id={`workspace-popup-${tool}`} ref={node=>{panelRefs[tool].current=node;if(node)panels.current[tool]=node;else delete panels.current[tool];}} data-workspace-tool-popup={tool} data-popup-active={shown===tool} data-popup-dragging={drags[tool].dragging} className="workspace-tool-popup" style={compact?undefined:{transform:`translate(${drags[tool].offset.x}px, ${drags[tool].offset.y}px)`}} role={compact?'tabpanel':'dialog'} aria-modal={compact?undefined:false} aria-labelledby={compact?`workspace-popup-tab-${tool}`:`workspace-popup-title-${tool}`} hidden={compact&&shown!==tool} onPointerDownCapture={()=>onActive(tool)} onFocusCapture={()=>onActive(tool)} onKeyDown={event=>{if(event.key==='Escape'&&!event.defaultPrevented&&!event.nativeEvent.isComposing){event.preventDefault();close(tool);}}}>
   <header {...(!compact?drags[tool].handleProps:{})} className="workspace-popup-header" aria-label={!compact?`${workspaceToolLabels[tool]} 창 위치 조절`:undefined} aria-keyshortcuts={!compact?'ArrowLeft ArrowRight ArrowUp ArrowDown Home':undefined} title={!compact?'제목줄을 끌어 이동 · 오른쪽 아래에서 크기 조절 · 방향키로 이동 · 두 번 누르거나 Home으로 처음 위치':undefined}><h2 id={`workspace-popup-title-${tool}`}>{workspaceToolLabels[tool]}</h2><div className="workspace-popup-actions"><button type="button" data-popup-close onClick={()=>close(tool)} aria-label={`${workspaceToolLabels[tool]} 팝업 닫기`}>닫기 ×</button></div></header>
   {!loaded[tool]&&<p className="workspace-popup-loading" role="status">{workspaceToolLabels[tool]}를 여는 중…</p>}
   <iframe src={embeddedWorkspaceToolHref(tool)} title={`${workspaceToolLabels[tool]} 도구`} onLoad={event=>frameReady(tool,event.currentTarget)} referrerPolicy="same-origin"/>
  </section>)}
 </div>;
}
