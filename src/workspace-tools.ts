export type WorkspaceTool='ai-mingyu'|'glossary';
import {AI_MINGYU_ENABLED,AI_MINGYU_LABEL} from './ai-mingyu-availability.ts';
export function workspaceToolAvailable(tool:WorkspaceTool){return tool!=='ai-mingyu'||AI_MINGYU_ENABLED;}
export const workspaceToolHref:Record<WorkspaceTool,string>={
 'ai-mingyu':'./?view=ai-mingyu&chat=1',
 glossary:'./?view=glossary&dictionary=1',
};
export const workspaceToolLabels:Record<WorkspaceTool,string>={'ai-mingyu':AI_MINGYU_LABEL,glossary:'법학어학사전'};
export const WORKSPACE_POPUPS_SEEN_KEY='lawinus.workspace-tool-popups.seen.v1';
export const GLOSSARY_AUTOSTART_PAUSE_KEY='lawinus.glossary-autostart.pause-until.v1';
export const GLOSSARY_AUTOSTART_CHANGED='lawinus:glossary-autostart-changed';
export const GLOSSARY_PAUSE_MS=7*24*60*60*1000;
type PopupStorage=Pick<Storage,'getItem'|'setItem'>;
export function glossaryPopupStorage():PopupStorage|undefined{try{return window.localStorage;}catch{return undefined;}}
export function glossaryPauseUntil(storage:Pick<Storage,'getItem'>|undefined,now=Date.now()):number{
 try{const raw=storage?.getItem(GLOSSARY_AUTOSTART_PAUSE_KEY);if(!raw||!/^\d+$/.test(raw))return 0;const until=Number(raw);return Number.isSafeInteger(until)&&until>now&&until<=now+GLOSSARY_PAUSE_MS?until:0;}catch{return 0;}
}
export function pauseGlossaryForWeek(storage:PopupStorage|undefined,now=Date.now()):number{
 const until=now+GLOSSARY_PAUSE_MS;if(!storage||!Number.isSafeInteger(until)||now<=0)return 0;
 try{storage.setItem(GLOSSARY_AUTOSTART_PAUSE_KEY,String(until));return glossaryPauseUntil(storage,now)===until?until:0;}catch{return 0;}
}
export function shouldAutoOpenGlossary(search:string,hash:string,embedded:boolean,storage:Pick<Storage,'getItem'>|undefined,now=Date.now()){
 return !embedded&&ordinaryWorkspaceEntry(search,hash)&&!glossaryPauseUntil(storage,now);
}
export function initialWorkspaceTools(search:string,hash:string,embedded:boolean,seen:boolean):WorkspaceTool[]{
 return [];
}
export function embeddedWorkspaceToolHref(tool:WorkspaceTool){return workspaceToolHref[tool]+'&embedded=1';}
export function readWorkspacePopupVisit(storage:Pick<Storage,'getItem'>|undefined){try{return storage?.getItem(WORKSPACE_POPUPS_SEEN_KEY)==='1';}catch{return false;}}
export function rememberWorkspacePopupVisit(storage:Pick<Storage,'setItem'>|undefined){try{storage?.setItem(WORKSPACE_POPUPS_SEEN_KEY,'1');return !!storage;}catch{return false;}}

// Release cache-busters are ordinary entry URLs; explicit links retain their intent.
export function ordinaryWorkspaceEntry(search:string,hash=''){
 return !hash&&[...new URLSearchParams(search).keys()].every(key=>key==='v');
}
export function standaloneWorkspaceTool(search:string):WorkspaceTool|null{
 const query=new URLSearchParams(search);
 if(query.get('chat')==='1')return 'ai-mingyu';
 return query.get('view')==='glossary'&&query.get('dictionary')==='1'?'glossary':null;
}

type ToolWindow={focus:()=>void;closed?:boolean;opener?:unknown};
type ToolBrowser={location:{href:string};innerWidth:number;open:(url:string,target:string,features?:string)=>ToolWindow|null};
const toolWindows=new WeakMap<ToolBrowser,Partial<Record<WorkspaceTool,ToolWindow>>>();
export function openWorkspaceTool(tool:WorkspaceTool,browser:ToolBrowser=window){
 if(!workspaceToolAvailable(tool))return false;
 const windows=toolWindows.get(browser)??{};toolWindows.set(browser,windows);
 const previous=windows[tool];
 try{if(previous&&!previous.closed){previous.focus();return true;}}catch{/* A closed or detached browsing context is reopened below. */}
 delete windows[tool];
 try{
  const url=new URL(workspaceToolHref[tool],browser.location.href),target=tool==='glossary'?'lawinus-glossary':'ai-mingyu-chat';
  const opened=browser.innerWidth<700?browser.open(url.href,target):browser.open(url.href,target,`popup,width=${tool==='glossary'?940:660},height=840,resizable=yes,scrollbars=yes`);
  if(!opened)return false;
  windows[tool]=opened;
  try{opened.opener=null;}catch{/* The same-origin tool may have been isolated by browser policy. */}
  try{opened.focus();}catch{/* A successful new tab may not allow programmatic focus. */}
  return true;
 }catch{return false;}
}

type LinkClick={button:number;metaKey:boolean;ctrlKey:boolean;shiftKey:boolean;altKey:boolean;preventDefault:()=>void};
// Modified clicks and a blocked popup keep the anchor's ordinary new-tab behavior.
export function launchWorkspaceTool(event:LinkClick,tool:WorkspaceTool,open=openWorkspaceTool){
 if(!workspaceToolAvailable(tool)){event.preventDefault();return;}
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 if(open(tool))event.preventDefault();
}
