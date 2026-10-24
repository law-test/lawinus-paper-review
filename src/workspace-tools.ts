export type WorkspaceTool='ai-mingyu'|'glossary';
export const workspaceToolHref:Record<WorkspaceTool,string>={
 'ai-mingyu':'./?view=ai-mingyu&chat=1',
 glossary:'./?view=glossary&dictionary=1',
};
export const workspaceToolLabels:Record<WorkspaceTool,string>={'ai-mingyu':'AI민규',glossary:'법학어학사전'};
export const WORKSPACE_POPUPS_SEEN_KEY='lawinus.workspace-tool-popups.seen.v1';
export function initialWorkspaceTools(search:string,hash:string,embedded:boolean,seen:boolean):WorkspaceTool[]{
 return !embedded&&!seen&&ordinaryWorkspaceEntry(search,hash)&&!standaloneWorkspaceTool(search)?['ai-mingyu','glossary']:[];
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

type ToolBrowser={location:{href:string};innerWidth:number;open:(url:string,target:string,features?:string)=>{focus:()=>void}|null};
export function openWorkspaceTool(tool:WorkspaceTool,browser:ToolBrowser=window){
 const url=new URL(workspaceToolHref[tool],browser.location.href);
 const small=browser.innerWidth<700;
 const opened=small?browser.open(url.href,'_blank'):browser.open(url.href,tool==='glossary'?'lawinus-glossary':'ai-mingyu-chat',`popup,width=${tool==='glossary'?940:660},height=840,resizable=yes,scrollbars=yes`);
 if(!opened)return false;
 try{opened.focus();}catch{/* The new window may already have moved into a browser tab. */}
 return true;
}

type LinkClick={button:number;metaKey:boolean;ctrlKey:boolean;shiftKey:boolean;altKey:boolean;preventDefault:()=>void};
// Modified clicks and a blocked popup keep the anchor's ordinary new-tab behavior.
export function launchWorkspaceTool(event:LinkClick,tool:WorkspaceTool,open=openWorkspaceTool){
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 if(open(tool))event.preventDefault();
}
