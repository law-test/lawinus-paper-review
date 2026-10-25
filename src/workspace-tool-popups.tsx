import React,{useEffect,useRef,useState} from 'react';
import {openWorkspaceTool,workspaceToolHref,workspaceToolLabels,workspaceToolAvailable,type WorkspaceTool} from './workspace-tools';
import './workspace-tool-popups.css';

// Cards, shortcuts and the sidebar share a synchronous window launcher.
// Initial deep links offer a link instead of attempting an automatic popup.
export function useWorkspaceToolPopups(){
 const [notice,setNotice]=useState<{tool:WorkspaceTool;blocked:boolean}|null>(null);
 const link=useRef<HTMLAnchorElement>(null),opener=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(notice?.blocked)link.current?.focus({preventScroll:true});},[notice]);
 function openTool(tool:WorkspaceTool,userInitiated=true){
  if(!workspaceToolAvailable(tool))return;
  if(document.activeElement instanceof HTMLElement)opener.current=document.activeElement;
  if(!userInitiated){setNotice({tool,blocked:false});return;}
  setNotice(openWorkspaceTool(tool)?null:{tool,blocked:true});
 }
 function dismiss(){setNotice(null);if(opener.current?.isConnected)opener.current.focus({preventScroll:true});}
 return {openTool,layer:notice&&workspaceToolAvailable(notice.tool)?<aside className="workspace-tool-window-notice" aria-label="도구 새 창 안내" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();dismiss();}}}>
  <p role="status">{notice.blocked?'새 창이 차단되었습니다. 아래 링크로 새 탭을 열 수 있습니다.':`${workspaceToolLabels[notice.tool]}는 별도 창에서 볼 수 있습니다.`}</p>
  <a ref={link} href={workspaceToolHref[notice.tool]} target="_blank" rel="noopener noreferrer" onClick={()=>setNotice(null)}>{workspaceToolLabels[notice.tool]} 새 탭으로 열기 ↗</a>
  <button type="button" onClick={dismiss} aria-label="새 창 안내 닫기">닫기 ×</button>
 </aside>:null};
}
