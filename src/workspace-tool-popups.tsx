import React,{useEffect,useRef,useState} from 'react';
import {openWorkspaceTool,workspaceToolHref,workspaceToolLabels,workspaceToolAvailable,shouldAutoOpenGlossary,glossaryPopupStorage,glossaryPauseUntil,GLOSSARY_AUTOSTART_CHANGED,GLOSSARY_AUTOSTART_PAUSE_KEY,type WorkspaceTool} from './workspace-tools';
import GlossaryAutoOpenControl from './glossary-auto-open-control';
import './workspace-tool-popups.css';

// Cards, shortcuts and the sidebar share a synchronous window launcher.
// Initial deep links offer a link instead of attempting an automatic popup.
export function useWorkspaceToolPopups(){
 const [notice,setNotice]=useState<{tool:WorkspaceTool;blocked:boolean;automatic?:boolean}|null>(null);
 const autoAttempted=useRef(false);
 const link=useRef<HTMLAnchorElement>(null),opener=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(notice?.blocked&&!notice.automatic)link.current?.focus({preventScroll:true});},[notice]);
 useEffect(()=>{
  if(autoAttempted.current)return;autoAttempted.current=true;
  if(!shouldAutoOpenGlossary(window.location.search,window.location.hash,window.self!==window.top,glossaryPopupStorage()))return;
  openWorkspaceTool('glossary');
 },[]);
 useEffect(()=>{const sync=(event:Event)=>{if(event.type==='storage'&&(event as StorageEvent).key!==GLOSSARY_AUTOSTART_PAUSE_KEY&&(event as StorageEvent).key!==null)return;if(glossaryPauseUntil(glossaryPopupStorage()))setNotice(value=>value?.automatic?null:value);};window.addEventListener('storage',sync);window.addEventListener(GLOSSARY_AUTOSTART_CHANGED,sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener(GLOSSARY_AUTOSTART_CHANGED,sync);};},[]);
 function openTool(tool:WorkspaceTool,userInitiated=true){
  if(!workspaceToolAvailable(tool))return;
  if(document.activeElement instanceof HTMLElement)opener.current=document.activeElement;
  if(!userInitiated){setNotice({tool,blocked:false});return;}
  setNotice(openWorkspaceTool(tool)?null:{tool,blocked:true});
 }
 function dismiss(){setNotice(null);if(opener.current?.isConnected)opener.current.focus({preventScroll:true});}
 return {openTool,layer:notice&&workspaceToolAvailable(notice.tool)?<aside className="workspace-tool-window-notice" aria-label="도구 새 창 안내" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();dismiss();}}}>
  <p role="status">{notice.blocked?'사전 새 창이 차단되었습니다. 아래 버튼을 눌러 열어 주세요.':`${workspaceToolLabels[notice.tool]}는 별도 창에서 볼 수 있습니다.`}</p>
  <button type="button" onClick={()=>openTool(notice.tool)}>법학어학사전 새 창 열기 ↗</button>
  <a ref={link} href={workspaceToolHref[notice.tool]} target="_blank" rel="noopener noreferrer" onClick={()=>setNotice(null)}>새 탭으로 열기 ↗</a>
  {notice.tool==='glossary'&&<GlossaryAutoOpenControl onPaused={()=>setNotice(null)}/>}
  <button type="button" onClick={dismiss} aria-label="새 창 안내 닫기">닫기 ×</button>
 </aside>:null};
}
