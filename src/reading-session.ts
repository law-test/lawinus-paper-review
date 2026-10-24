import type {ReadingView,ReadingSurface} from './reading-view';
export type DocumentReading={page:number;zoom:number;fitMode?:'width'|'page'};
export type ReadingSession={schema:1;datasetId:string;thesis:DocumentReading;sources:Record<string,DocumentReading>;sourceId:string;textTranslation:string;activeNote:string;manuscriptMode:'pdf'|'body';mobilePane:'contents'|'thesis'|'source'|'metadata';tab:string;paragraphId:string;proposalId:string;readingView:ReadingView;sidebarOpen:boolean;metadataOpen:boolean};
export type ReadingCatalog={pageCount:number;sources:{id:string;pages?:number}[];noteIds:string[];paragraphIds:string[];proposalIds:string[];defaultSourceId?:string;defaultSourcePage?:number;defaultSidebarOpen?:boolean;textTranslations?:{sourceId:string;kind:string;noteIds?:string[]}[]};
type ReadingStorage=Pick<Storage,'getItem'|'setItem'>;
const record=(value:unknown):Record<string,unknown>|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
const integer=(value:unknown,fallback:number,total:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(1,Math.min(Math.max(1,Math.floor(total)),Math.floor(value))):fallback;
const zoom=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(.7,Math.min(2,value)):1;
function readingView(value:unknown):ReadingView {
 const v=record(value),surfaces=record(v?.focusSurfaces),view:ReadingView={focus:v?.focus===true,header:v?.header!==false,tools:v?.tools!==false,footnotes:v?.footnotes!==false};
 if(surfaces){view.focusSurfaces={};for(const key of ['header','tools','footnotes','sidebar','metadata'] as ReadingSurface[])if(typeof surfaces[key]==='boolean')view.focusSurfaces[key]=surfaces[key];}
 return view;
}
export function readingSessionKey(datasetId:string){return `lawinus.reading-session.v1:${encodeURIComponent(datasetId)}`;}
export function readingDocument(value:unknown,total:number,fallbackPage=1):DocumentReading {
 const v=record(value),fitMode=v?.fitMode==='width'||v?.fitMode==='page'?v.fitMode:undefined;
 return {page:integer(v?.page,integer(fallbackPage,1,total),total),zoom:fitMode&&typeof v?.zoom==='number'&&Number.isFinite(v.zoom)?Math.max(.01,Math.min(2,v.zoom)):zoom(v?.zoom),...(fitMode?{fitMode}:{})};
}
export function defaultReadingSession(datasetId:string,catalog:ReadingCatalog):ReadingSession {
 const source=catalog.sources.find(s=>s.id===catalog.defaultSourceId),sourceId=source?.id||'';
 return {schema:1,datasetId,thesis:readingDocument({page:20},catalog.pageCount),sources:source?{[sourceId]:readingDocument({page:catalog.defaultSourcePage},source.pages||1)}:{},sourceId,textTranslation:'',activeNote:catalog.noteIds.includes('fn-001')?'fn-001':catalog.noteIds[0]||'',manuscriptMode:'pdf',mobilePane:'thesis',tab:'source',paragraphId:'',proposalId:'',readingView:readingView(undefined),sidebarOpen:catalog.defaultSidebarOpen??true,metadataOpen:true};
}
export function validateReadingSession(value:unknown,datasetId:string,catalog:ReadingCatalog):ReadingSession|undefined {
 const v=record(value);if(v?.schema!==1||v.datasetId!==datasetId)return;
 const fallback=defaultReadingSession(datasetId,catalog),storedSources=record(v.sources),sources:Record<string,DocumentReading>={};
 for(const source of catalog.sources){if(storedSources&&Object.prototype.hasOwnProperty.call(storedSources,source.id)&&record(storedSources[source.id]))sources[source.id]=readingDocument(storedSources[source.id],source.pages||1);}
 // An unavailable citation intentionally clears the source; keep that choice on reload.
 const sourceId=typeof v.sourceId==='string'&&(v.sourceId===''||catalog.sources.some(s=>s.id===v.sourceId))?v.sourceId:fallback.sourceId;
 if(sourceId&&!sources[sourceId])sources[sourceId]=fallback.sources[sourceId]||readingDocument(undefined,catalog.sources.find(s=>s.id===sourceId)?.pages||1);
 const pane=['contents','thesis','source','metadata'].includes(String(v.mobilePane))?v.mobilePane as ReadingSession['mobilePane']:'thesis';
 const activeNote=typeof v.activeNote==='string'&&catalog.noteIds.includes(v.activeNote)?v.activeNote:fallback.activeNote;
 const textTranslation=typeof v.textTranslation==='string'&&catalog.textTranslations?.some(t=>t.sourceId===v.textTranslation&&t.kind==='text'&&t.noteIds?.includes(activeNote))?v.textTranslation:'';
 const tab=['source','library','memos','revision','profile','faq'].includes(String(v.tab))?String(v.tab):'source';
 return {schema:1,datasetId,thesis:readingDocument(v.thesis,catalog.pageCount,20),sources,sourceId,textTranslation,
  activeNote,
  manuscriptMode:v.manuscriptMode==='body'?'body':'pdf',mobilePane:pane==='source'&&!sourceId&&!textTranslation?'thesis':pane,tab,
  paragraphId:typeof v.paragraphId==='string'&&catalog.paragraphIds.includes(v.paragraphId)?v.paragraphId:'',
  proposalId:typeof v.proposalId==='string'&&catalog.proposalIds.includes(v.proposalId)?v.proposalId:'',readingView:readingView(v.readingView),sidebarOpen:typeof v.sidebarOpen==='boolean'?v.sidebarOpen:fallback.sidebarOpen,metadataOpen:typeof v.metadataOpen==='boolean'?v.metadataOpen:true};
}
export function readReadingSession(storage:ReadingStorage,datasetId:string,catalog:ReadingCatalog):{session:ReadingSession;restored:boolean} {
 try{const raw=storage.getItem(readingSessionKey(datasetId));if(raw&&raw.length<=256*1024){const session=validateReadingSession(JSON.parse(raw),datasetId,catalog);if(session)return {session,restored:true};}}catch{}
 return {session:defaultReadingSession(datasetId,catalog),restored:false};
}
export function saveReadingSession(storage:ReadingStorage,session:ReadingSession):boolean {
 try{storage.setItem(readingSessionKey(session.datasetId),JSON.stringify(session));return true;}catch{return false;}
}
export function sourceReadingPosition(saved:Record<string,DocumentReading>,sourceId:string,total:number,fallbackPage=1,explicitPage?:number):DocumentReading {
 const previous=saved[sourceId];return readingDocument({page:explicitPage??previous?.page??fallbackPage,zoom:previous?.zoom??1,fitMode:previous?.fitMode},total,fallbackPage);
}
