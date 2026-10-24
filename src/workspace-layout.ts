export type WorkspaceLayout={schema:1;orientation:'columns'|'rows';rowSplit:number;stackedSourceEnd:number;headerHeight:number|null;footerHeight:number|null;metadataSplit:number;sidebarMenuHeight:number|null};
export const DEFAULT_WORKSPACE_LAYOUT:WorkspaceLayout={schema:1,orientation:'columns',rowSplit:50,stackedSourceEnd:72,headerHeight:null,footerHeight:null,metadataSplit:52,sidebarMenuHeight:null};
export const WORKSPACE_LAYOUT_KEY='lawinus.workspace-layout.v1';
const number=(value:unknown,fallback:number,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
const optional=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?number(value,min,min,max):null;
export function validateWorkspaceLayout(value:unknown):WorkspaceLayout{
 const v=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 if(v.schema!==1)return {...DEFAULT_WORKSPACE_LAYOUT};
 return {schema:1,orientation:v.orientation==='rows'?'rows':'columns',rowSplit:number(v.rowSplit,50,25,75),stackedSourceEnd:number(v.stackedSourceEnd,72,50,82),headerHeight:optional(v.headerHeight,44,400),footerHeight:optional(v.footerHeight,44,300),metadataSplit:number(v.metadataSplit,52,20,80),sidebarMenuHeight:optional(v.sidebarMenuHeight,88,650)};
}
export function readWorkspaceLayout(storage?:Pick<Storage,'getItem'>):WorkspaceLayout{
 try{const raw=storage?.getItem(WORKSPACE_LAYOUT_KEY);if(raw&&raw.length<8192)return validateWorkspaceLayout(JSON.parse(raw));}catch{}
 return {...DEFAULT_WORKSPACE_LAYOUT};
}
export function saveWorkspaceLayout(storage:Pick<Storage,'setItem'>,layout:WorkspaceLayout){try{storage.setItem(WORKSPACE_LAYOUT_KEY,JSON.stringify(validateWorkspaceLayout(layout)));return true;}catch{return false;}}
export function boundedPanelHeight(requested:number|null,available:number,min:number,maximumRatio:number,fallback:number){
 const total=Number.isFinite(available)?Math.max(0,available):0,max=Math.max(min,Math.min(total*maximumRatio,total-120));
 return number(requested,Math.min(max,Math.max(min,fallback)),min,max);
}
export function stackedDocumentRows(split:number){const n=number(split,50,25,75);return `minmax(0,${n}fr) 8px minmax(0,${100-n}fr)`;}
export function stackedDocumentColumns(sourceEnd:number,metadata:boolean){const n=number(sourceEnd,72,50,82);return metadata?`minmax(0,${n}fr) 6px minmax(0,${100-n}fr)`:'minmax(0,1fr)';}
