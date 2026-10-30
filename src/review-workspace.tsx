import React, {useEffect,useRef,useState,useMemo} from 'react';
import './review.css';
import {api as reviewApi, assetUrl as reviewAssetUrl, initializeReviewSession, exportNotes, loadReviewConfig} from './review-api';
import PdfPane from './pdf-viewer';
import {footnoteTargets} from './pdf-viewer-model';
import {citationPdfTargets} from './citation-link-model';
import SourceText,{type SourceSegment} from './source-text';
import {LegalText,useLegalLinks} from './legal-links';
import legalPdfData from './legal-pdf-targets.json';
import PaneResizer from './pane-resizer';
import ReaderToolPanel from './reader-tool-panel';
import {clampPaneSize} from './pane-size';
import {DEFAULT_WORKSPACE_LAYOUT,readWorkspaceLayout,saveWorkspaceLayout,boundedPanelHeight,stackedDocumentRows,stackedDocumentColumns,type WorkspaceLayout} from './workspace-layout';
import {moveFourPaneBoundary,fourPaneColumns,normalizeCollapsedSplit,collapsedPaneColumns,DEFAULT_COLLAPSED_SPLIT,equalDocumentCuts,readPaneLayout,savePaneLayout} from './four-pane-size';
import {buildProposalIndicators} from './proposal-indicators';
import {useDocumentAlignment} from './document-alignment';
import ReadingControls from './reading-controls';
import MemoDialog from './memo-dialog';
import {DEFAULT_READING_VIEW,readingVisibility,readingPane,withReadingSurface,type ReadingView} from './reading-view';
import {mobileReadingView} from './mobile-menu-swipe';
import ThesisContents from './thesis-contents';
import ParallelSourceReader,{translationEntries as humanTranslationEntries} from './parallel-source-reader';
import appliedTranslations from './source-translations-v120.json';
import previousTranslations from './source-translations-v121.json';
import latestTranslations from './source-translations-v122.json';
import InspectionRecord from './inspection-record';
import type {TranslationEntry} from './translation-model';
import './review-mobile.css';
import ProfileSections from './profile-sections';
import ThesisFaq from './thesis-faq';
import AiMingyu from './ai-mingyu';
import {AI_MINGYU_ENABLED,AI_MINGYU_LABEL,AI_MINGYU_PAUSED_MESSAGE} from './ai-mingyu-availability';
import LegalGlossary from './legal-glossary';
import {ordinaryWorkspaceEntry} from './workspace-tools';
import {useWorkspaceToolPopups} from './workspace-tool-popups';
import {openMingyuChatWindow} from './ai-mingyu-window';
import {reviewDeepLink,proposalAnnotation} from './thesis-faq-model';
import citationExplanations from './citation-explanations.json';
import citationPageData from './citation-pages.json';
import {citedSourceRefs, citedPages, citationStartPage, citationHighlights, citedPageLabel, type CitationMap} from './citation-model';
import CitedTextSource from './cited-text-source';
import WebManuscript,{type ManuscriptParagraph,manuscriptModeAfterRefresh,citationContextWasEdited,effectiveManuscriptEdits} from './web-manuscript';
import {MANUSCRIPT_EDITIONS,editionFromSearch,editionParagraphs,editionProposals,type ManuscriptEdition} from './manuscript-editions';
import {ManuscriptEditionProvider,type ManuscriptEditionId} from './manuscript-edition-context';
import appliedCitationPages from './citation-pages-v120.json';
import appliedCitationExplanations from './citation-explanations-v120.json';
import appliedLegalPdfData from './legal-pdf-targets-v120.json';
import previousCitationPages from './citation-pages-v121.json';
import latestCitationPages from './citation-pages-v122.json';
import previousCitationExplanations from './citation-explanations-v121.json';
import latestCitationExplanations from './citation-explanations-v122.json';
import previousLegalPdfData from './legal-pdf-targets-v121.json';
import latestLegalPdfData from './legal-pdf-targets-v122.json';
import SharedEditEditor from './shared-edit-editor';
import {RevisionComparison} from './revision-copy';
import {TextSizeControl} from './text-size-control';
import {loadSharedEdits,downloadSharedEditsExport,type SharedEdit} from './shared-edits';
import {defaultReadingSession,readReadingSession,saveReadingSession,sourceReadingPosition,type ReadingSession,type DocumentReading,type ReadingCatalog} from './reading-session';
import type {PdfTarget,PdfFitMode} from './pdf-viewer-model';
import './four-pane.css';
import './reading-controls.css';
type Obj = Record<string,any>;
type Memo = {id:string;anchorType:string;page:number|null;noteId:string|null;sourceId:string|null;x:number|null;y:number|null;text:string;quote:string;visibility:string;status:string;revision:number;displayName:string;createdAt:string;editable:boolean};
function asText(value:any):string{if(typeof value==='string')return value;if(value==null)return '';if(Array.isArray(value))return value.map(asText).join('\n');return Object.entries(value).map(([k,v])=>`${k}: ${asText(v)}`).join('\n');}
function Pager({page,total,onChange}:{page:number;total:number;onChange:(n:number)=>void}){return <div className="pager"><button aria-label="이전 쪽" disabled={page<=1} onClick={()=>onChange(page-1)}>‹</button><input aria-label="PDF 쪽수" type="number" min={1} max={total} key={page} defaultValue={page} onKeyDown={e=>{if(e.key==='Enter')onChange(Math.min(total,Math.max(1,Number(e.currentTarget.value)||1)));}} onBlur={e=>onChange(Math.min(total,Math.max(1,Number(e.currentTarget.value)||1)))}/><span>/ {total}</span><button aria-label="다음 쪽" disabled={page>=total} onClick={()=>onChange(page+1)}>›</button></div>;}

function ZoomSelect({label,zoom,fitMode,onZoom,onFit}:{label:string;zoom:number;fitMode?:PdfFitMode;onZoom:(zoom:number)=>void;onFit?:(mode:PdfFitMode)=>void}){
 const values=[70,85,100,115,130,145,160,175,200],percent=Math.round(zoom*100),selected=fitMode||String(percent);
 return <select className="document-zoom-select" aria-label={label} title={label} value={selected} onChange={event=>{const value=event.target.value;if(value==='page'||value==='width')onFit?.(value);else onZoom(Number(value)/100);}}>
  {onFit&&<><option value="page">쪽맞춤</option><option value="width">폭맞춤</option></>}
  {!fitMode&&!values.includes(percent)&&<option value={String(percent)}>{percent}%</option>}
  {values.map(value=><option key={value} value={String(value)}>{value}%</option>)}
 </select>;
}

export default function ReviewWorkspace(){
 const toolPopups=useWorkspaceToolPopups();
 const [editionId,setEditionId]=useState<ManuscriptEditionId>(()=>editionFromSearch(window.location.search));
 function changeEdition(id:ManuscriptEditionId){
  if(id===editionId)return;
  window.getSelection()?.removeAllRanges();
  const url=new URL(window.location.href);url.searchParams.set('edition',id);
  for(const key of ['view','proposal','paragraph','note','annotation'])url.searchParams.delete(key);
  window.history.replaceState(null,'',url);setEditionId(id);
 }
 return <ManuscriptEditionProvider edition={editionId}><ReviewWorkspaceEdition key={editionId} edition={MANUSCRIPT_EDITIONS[editionId]} onEdition={changeEdition} toolPopups={toolPopups}/></ManuscriptEditionProvider>;
}

export function ReviewWorkspaceEdition({edition,onEdition,toolPopups}:{edition:ManuscriptEdition;onEdition:(id:ManuscriptEditionId)=>void;toolPopups:ReturnType<typeof useWorkspaceToolPopups>}){
  const datasetId=edition.datasetId;
  const manuscript=useMemo(()=>editionParagraphs(edition.id),[edition.id]);
  const proposals=useMemo(()=>editionProposals(edition.id),[edition.id]);
  const translationEntries=edition.id==='v122'?latestTranslations.sources as TranslationEntry[]:edition.id==='v121'?previousTranslations.sources as TranslationEntry[]:edition.id==='v120'?appliedTranslations.sources as TranslationEntry[]:humanTranslationEntries;
  const proposalIndicators=useMemo(()=>buildProposalIndicators(proposals,manuscript),[proposals,manuscript]);
  const citationPageMap=(edition.id==='v122'?latestCitationPages:edition.id==='v121'?previousCitationPages:edition.id==='v120'?appliedCitationPages:citationPageData) as CitationMap;
  const legalPdfDataForEdition=edition.id==='v122'?latestLegalPdfData:edition.id==='v121'?previousLegalPdfData:edition.id==='v120'?appliedLegalPdfData:legalPdfData;
  const citationExplanationsForEdition=edition.id==='v122'?latestCitationExplanations:edition.id==='v121'?previousCitationExplanations:edition.id==='v120'?appliedCitationExplanations:citationExplanations;
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const api=(path:string,init?:RequestInit)=>reviewApi(path,init,datasetId);
  const assetUrl=(id:string)=>data?.sources?.find((item:Obj)=>item.id===id)?.assetUrl||reviewAssetUrl(id,id==='human'||id==='thesis'?datasetId:'human-1021-1559');
  const openLegal=useLegalLinks();
  const [aiWide,setAiWide]=useState(true);
  const [missingCitation,setMissingCitation]=useState<SourceSegment|null>(null);
  const [reviewer,setReviewer]=useState({name:'방문자',mode:'guest' as 'guest'|'account'}),[memoError,setMemoError]=useState('');
  const [sessionReady,setSessionReady]=useState(false),[sessionConnecting,setSessionConnecting]=useState(false);
  const [data,setData]=useState<Obj|null>(null),[profile,setProfile]=useState<Obj|null>(null),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[memos,setMemos]=useState<Memo[]>([]);
  const [page,setPage]=useState(20),[zoom,setZoom]=useState(1),[tab,setTab]=useState('source'),[outline,setOutline]=useState(true),[active,setActive]=useState('fn-001'),[sourceId,setSourceId]=useState(''),[sourcePage,setSourcePage]=useState(1),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[placing,setPlacing]=useState<false|'thesis'|'source'>(false),[composer,setComposer]=useState<Obj|null>(null),[saving,setSaving]=useState(false),[exporting,setExporting]=useState(false),[textSource,setTextSource]=useState('');
  const [fitMode,setFitMode]=useState<PdfFitMode>(null),[sourceFitMode,setSourceFitMode]=useState<PdfFitMode>(null);
  const changeZoom=(value:number)=>{setFitMode(null);setZoom(value);};
  const changeSourceZoom=(value:number)=>{setSourceFitMode(null);setSourceZoom(value);};
  const [sidebarOpen,setSidebarOpen]=useState(()=>window.innerWidth>=1200);
  const [initialPaneLayout]=useState(()=>{try{return readPaneLayout(window.localStorage);}catch{return readPaneLayout();}});
  const [paneCuts,setPaneCuts]=useState(initialPaneLayout.cuts);
  const [workspaceLayout,setWorkspaceLayout]=useState(()=>{try{return readWorkspaceLayout(window.localStorage);}catch{return readWorkspaceLayout();}});
  const [viewportHeight,setViewportHeight]=useState(()=>window.innerHeight);
  const chromeRef=useRef<HTMLDivElement>(null),thesisPaneRef=useRef<HTMLElement>(null),metadataBodyRef=useRef<HTMLDivElement>(null),sidebarRef=useRef<HTMLElement>(null),sidebarMenuRef=useRef<HTMLDivElement>(null),sourcePaneRef=useRef<HTMLElement>(null);
  const [thesisControlsHost,setThesisControlsHost]=useState<HTMLDivElement|null>(null),[sourceControlsHost,setSourceControlsHost]=useState<HTMLDivElement|null>(null),[sourceTranslationControlsHost,setSourceTranslationControlsHost]=useState<HTMLDivElement|null>(null);
  const changeLayout=(patch:Partial<WorkspaceLayout>)=>setWorkspaceLayout(old=>({...old,...patch}));
  useEffect(()=>{try{saveWorkspaceLayout(window.localStorage,workspaceLayout);}catch{}},[workspaceLayout]);
  useEffect(()=>{const update=()=>setViewportHeight(window.visualViewport?.height||window.innerHeight);window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);return()=>{window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);};},[]);
  const [metadataOpen,setMetadataOpen]=useState(true),[collapsedSplit,setCollapsedSplit]=useState(initialPaneLayout.collapsedSplit);
  const metadataOpener=useRef<HTMLButtonElement>(null);
  const [regularReadingView,setRegularReadingView]=useState(DEFAULT_READING_VIEW);
  const [shortReadingView,setShortReadingView]=useState<ReadingView|null>(null);
  const [shortScreen,setShortScreen]=useState(()=>window.innerWidth<1200&&window.innerHeight<=500);
  const readingView=mobileReadingView(shortScreen,regularReadingView,shortReadingView);
  function setReadingView(next:React.SetStateAction<ReadingView>){if(shortScreen)setShortReadingView(old=>typeof next==='function'?next(mobileReadingView(true,regularReadingView,old)):next);else setRegularReadingView(next);}
  const [compact,setCompact]=useState(()=>window.innerWidth<1200);
  const [sidebarWidth,setSidebarWidth]=useState(208);
  const [composerError,setComposerError]=useState('');
  const [mobilePane,setMobilePane]=useState<'contents'|'thesis'|'source'|'metadata'>('thesis'),[sourceZoom,setSourceZoom]=useState(1);
  const [textTranslation,setTextTranslation]=useState('');
  const visibleSurfaces=readingVisibility(readingView,sidebarOpen,metadataOpen),shownPane=readingPane(readingView,mobilePane);
  const [shared,setShared]=useState<Record<string,SharedEdit>>({}),[sharedError,setSharedError]=useState(''),[manuscriptMode,setManuscriptMode]=useState<'pdf'|'body'>('pdf');
  const originalNotes:Obj[]=data?.notes||[];
  const effectiveShared=useMemo(()=>effectiveManuscriptEdits(manuscript,originalNotes as {id:string;text:string}[],shared),[data,shared]);
  const manuscriptViewChosen=useRef(false);
  useEffect(()=>{if(data)setManuscriptMode(current=>manuscriptModeAfterRefresh(current,manuscriptViewChosen.current,Object.keys(effectiveShared).length));},[data,effectiveShared]);
  const [paragraphId,setParagraphId]=useState(''),[proposalId,setProposalId]=useState(''),[revisionQuery,setRevisionQuery]=useState('');
  const [readingDataset,setReadingDataset]=useState('');
  const sourceReadings=useRef<Record<string,DocumentReading>>({}),readingSnapshot=useRef<ReadingSession|null>(null);
  const [thesisNavigation,setThesisNavigation]=useState(0),[sourceNavigation,setSourceNavigation]=useState(0),navigationCounter=useRef(0);
  function flushReading(){const snapshot=readingSnapshot.current;if(snapshot)try{saveReadingSession(window.localStorage,snapshot);}catch{}}
  function reportThesisPage(next:number){setPage(next);const snapshot=readingSnapshot.current;if(snapshot){readingSnapshot.current={...snapshot,thesis:{...snapshot.thesis,page:next}};flushReading();}}
  function reportSourcePage(next:number){setSourcePage(next);if(sourceId){sourceReadings.current[sourceId]={page:next,zoom:sourceZoom,...(sourceFitMode?{fitMode:sourceFitMode}:{})};const snapshot=readingSnapshot.current;if(snapshot){readingSnapshot.current={...snapshot,sources:{...snapshot.sources,[sourceId]:{page:next,zoom:sourceZoom,...(sourceFitMode?{fitMode:sourceFitMode}:{})}}};flushReading();}}}
  function navigateThesis(targetPage:number){setThesisNavigation(++navigationCounter.current);setPage(targetPage);}
  function navigateSource(targetPage:number){setSourceNavigation(++navigationCounter.current);setSourcePage(targetPage);}
  const paragraph=manuscript.find(p=>p.id===paragraphId),proposal=proposals.find(p=>p.id===proposalId)||proposals.find(p=>p.targetParagraphId===paragraphId&&!p.targetNoteId);
  const linkedAnnotation=proposalAnnotation(window.location.search,proposal);
  const sharedGeneration=useRef(0),sharedRequest=useRef(0),sharedSnapshot=useRef(0n);
  async function refreshShared(){const generation=sharedGeneration.current,request=++sharedRequest.current;try{const result=await loadSharedEdits(datasetId);if(!alive.current||result.datasetId!==datasetId||generation!==sharedGeneration.current||request!==sharedRequest.current||BigInt(result.snapshotId)<sharedSnapshot.current)return;sharedSnapshot.current=BigInt(result.snapshotId);setShared(Object.fromEntries(result.overrides.filter(e=>e.datasetId===datasetId).map(e=>[e.targetId,e])));setSharedError('');}catch{if(alive.current&&generation===sharedGeneration.current&&request===sharedRequest.current)setSharedError('공통 수정 내용을 불러오지 못했습니다. 다시 연결해 주세요.');}}
  useEffect(()=>{void refreshShared();const tick=setInterval(()=>{if(!document.hidden)void refreshShared();},10000);const wake=()=>{if(!document.hidden)void refreshShared();};window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);return()=>{clearInterval(tick);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};},[]);
  function sharedSaved(edit:SharedEdit){if(!alive.current||edit.datasetId!==datasetId)return;sharedGeneration.current++;if(BigInt(edit.id)>sharedSnapshot.current)sharedSnapshot.current=BigInt(edit.id);manuscriptViewChosen.current=true;setShared(old=>({...old,[edit.targetId]:edit}));if(edit.kind==='paragraph')setParagraphId(edit.targetId);setSharedError('');}
  function openParagraph(id:string){const p=manuscript.find(p=>p.id===id);if(!p)return;setMetadataVisibility(true);setParagraphId(id);setProposalId(proposals.find(item=>item.targetParagraphId===id&&!item.targetNoteId)?.id||'');setTab('revision');setMobilePane('metadata');}
  function selectProposal(id:string,jump=true){const item=proposals.find(p=>p.id===id);if(!item)return;setMetadataVisibility(true);setProposalId(id);setParagraphId(item.targetParagraphId&&manuscript.some(p=>p.id===item.targetParagraphId)?item.targetParagraphId:'');if(item.targetNoteId){setParagraphId('');openNote(item.targetNoteId,jump);setMobilePane('metadata');return;}if(jump)navigateThesis(item.page);setTab('revision');setMobilePane('metadata');}
  async function downloadShared(){try{await downloadSharedEditsExport(datasetId);}catch(e:any){setError(e.message);}}

  const initialDeepLinkApplied=useRef(false);
  useEffect(()=>{
    if(!data||!readingDataset||initialDeepLinkApplied.current)return;
    initialDeepLinkApplied.current=true;
    const link=reviewDeepLink(window.location.search,proposals.map(item=>item.id),(data.notes||[]).map((item:Obj)=>item.id),manuscript.map(item=>item.id));
    if(!link)return;
    if(['proposal','note','paragraph'].includes(link.view)&&!window.location.search.match(new RegExp('(?:[?&])edition='+edition.id+'(?:&|$)'))){setError('이전 판본의 위치 링크입니다. 현재 원고의 목차나 각주를 선택해 주세요.');return;}
    if(link.view==='proposal')selectProposal(link.id);
    else if(link.view==='note'){openNote(link.id,true);setTab('source');setMetadataVisibility(true);}
    else if(link.view==='paragraph'){openParagraph(link.id);setManuscriptMode('body');manuscriptViewChosen.current=true;}
    else if(link.view==='ai-mingyu'||link.view==='glossary'){toolPopups.openTool(link.view,false);return;}
    else{setTab(link.view);setMetadataVisibility(true);setMobilePane('metadata');}
    if(window.innerWidth<1200)setSidebarVisibility(false);
    setMobilePane('metadata');
  },[data,readingDataset]);

  const splitRef=useRef<HTMLDivElement>(null);
  useDocumentAlignment(splitRef,!compact&&workspaceLayout.orientation==='columns'&&manuscriptMode==='pdf'&&!!data&&workspaceLayout.thesisToolsHeight===null&&workspaceLayout.sourceToolsHeight===null&&workspaceLayout.footerHeight===null);
  const memoRequest=useRef(0);
  const refreshMemos=()=>{const request=++memoRequest.current;return api('/api/notes').then(d=>{if(!alive.current||request!==memoRequest.current)return;setMemos(d.notes);setMemoError(d.truncated?'메모가 5,000개를 넘어 화면에는 일부만 표시됩니다. 전체 내보내기를 이용해 주세요.':'');}).catch(e=>{if(alive.current&&request===memoRequest.current)setMemoError('메모를 불러오지 못했습니다. 문서는 계속 열람할 수 있습니다. '+e.message);});};
  async function connectSession(){
    setSessionReady(false);setSessionConnecting(true);setMemoError('');
    try{const d=await initializeReviewSession();if(!alive.current)return;setReviewer({name:d.user?.displayName||'방문자',mode:d.user?.mode==='account'?'account':'guest'});setSessionReady(true);await refreshMemos();}
    catch{await refreshMemos();setMemoError('개인 메모 연결을 준비하지 못했습니다. 문서와 공유 메모는 계속 열람할 수 있습니다. 다시 연결한 뒤 저장해 주세요.');}
    finally{setSessionConnecting(false);}
  }
  async function downloadNotes(format:'md'|'csv'|'json',noteDataset=datasetId){
    setExporting(true);try{await exportNotes(format,noteDataset);}catch(e:any){setError(e?.message||'메모를 내보내지 못했습니다. 다시 시도해 주세요.');}finally{setExporting(false);}
  }
  useEffect(()=>{let stopped=false;Promise.all([api('/api/manifest'),loadReviewConfig(datasetId)]).then(([manifest,config])=>{
    if(stopped)return;if(manifest.datasetId!==datasetId||manifest.meta?.pageCount!==edition.pages||manifest.notes?.length!==edition.footnotes)throw new Error('선택한 판본의 원고·각주 정보를 확인하지 못했습니다.');const available=manifest.sources||[],initialNote=manifest.notes?.find((n:Obj)=>n.id==='fn-001')||manifest.notes?.[0];
    const initialRef=initialNote?citedSourceRefs({id:initialNote.id,sourceRefs:initialNote.sourceRefs},citationPageMap,available.map((s:Obj)=>({id:s.id})))[0]:undefined;
    const catalog:ReadingCatalog={textTranslations:translationEntries,defaultThesisPage:manifest.meta?.bodyStartPage||(edition.id==='human80'?20:19),pageCount:manifest.meta?.pageCount||1,sources:available,noteIds:(manifest.notes||[]).map((n:Obj)=>n.id),paragraphIds:manuscript.map(p=>p.id),proposalIds:proposals.map(p=>p.id),defaultSidebarOpen:window.innerWidth>=1200,defaultSourceId:initialRef?.sourceId,defaultSourcePage:initialRef?citationStartPage(citationPageMap[initialNote.id]?.[initialRef.sourceId],available.find((s:Obj)=>s.id===initialRef.sourceId)?.pages):1};
    let restored:{session:ReadingSession;restored:boolean};try{restored=readReadingSession(window.localStorage,config.datasetId,catalog);}catch{restored={session:defaultReadingSession(config.datasetId,catalog),restored:false};}
    const state=restored.session,currentSource=state.sources[state.sourceId]||{page:1,zoom:1};sourceReadings.current=state.sources;
    setPage(state.thesis.page);setZoom(state.thesis.zoom);setFitMode(state.thesis.fitMode||null);setActive(state.activeNote);setTextTranslation(state.textTranslation);setSourceId(state.sourceId);setSourcePage(currentSource.page);setSourceZoom(currentSource.zoom);setSourceFitMode(currentSource.fitMode||null);
    setManuscriptMode(state.manuscriptMode);manuscriptViewChosen.current=restored.restored;setMobilePane(state.mobilePane);setTab(state.tab==='ai-mingyu'||state.tab==='glossary'?'source':state.tab);setParagraphId(state.paragraphId);setProposalId(state.proposalId);setRegularReadingView(state.readingView);setSidebarOpen(state.sidebarOpen);setMetadataOpen(state.metadataOpen);
    setReadingDataset(config.datasetId);setData(manifest);
  }).catch(e=>{if(!stopped)setLoadError(e?.message||'심사 자료를 불러오지 못했습니다.');});api('/api/profile').then(value=>{if(!stopped)setProfile(value);}).catch(e=>setError(e.message));void connectSession();return()=>{stopped=true;};},[]);
  if(readingDataset&&data){if(sourceId)sourceReadings.current[sourceId]={page:sourcePage,zoom:sourceZoom,...(sourceFitMode?{fitMode:sourceFitMode}:{})};readingSnapshot.current={schema:1,datasetId:readingDataset,thesis:{page,zoom,...(fitMode?{fitMode}:{})},sources:{...sourceReadings.current},sourceId,textTranslation,activeNote:active,manuscriptMode,mobilePane,tab,paragraphId,proposalId,readingView:regularReadingView,sidebarOpen,metadataOpen};}
  useEffect(()=>{const state=readingSnapshot.current;if(!readingDataset||!data||!state)return;try{saveReadingSession(window.localStorage,state);}catch{}},[readingDataset,data,page,zoom,fitMode,sourceId,sourcePage,sourceZoom,sourceFitMode,textTranslation,active,manuscriptMode,mobilePane,tab,paragraphId,proposalId,regularReadingView,sidebarOpen,metadataOpen]);
  useEffect(()=>{window.addEventListener('pagehide',flushReading);return()=>{flushReading();window.removeEventListener('pagehide',flushReading);};},[]);
  useEffect(()=>{try{const stored=localStorage.getItem('paper-sidebar-width');if(stored!==null)setSidebarWidth(clampPaneSize(Number(stored),176,440));}catch{}},[]);
  useEffect(()=>{try{savePaneLayout(window.localStorage,paneCuts,collapsedSplit);}catch{}},[paneCuts,collapsedSplit]);
  useEffect(()=>{try{localStorage.setItem('paper-sidebar-width',String(sidebarWidth));}catch{}},[sidebarWidth]);
  useEffect(()=>{const media=window.matchMedia('(max-width:1199px)');const update=()=>setCompact(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(()=>{const media=window.matchMedia('(max-width:1199px) and (max-height:500px)');const update=()=>{setShortScreen(media.matches);if(!media.matches)setShortReadingView(null);};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(()=>{const viewport=window.visualViewport;const update=()=>{document.documentElement.style.setProperty('--visible-height',(viewport?.height||window.innerHeight)+'px');document.documentElement.style.setProperty('--visible-top',(viewport?.offsetTop||0)+'px');document.documentElement.style.setProperty('--app-viewport-height',((viewport&&viewport.scale<=1.01?viewport.height:window.innerHeight))+'px');};update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};},[]);
  const notes:Obj[]=useMemo(()=>originalNotes.map(n=>shared[n.id]?{...n,text:shared[n.id].text}:n),[data,shared]),sources:Obj[]=data?.sources||[],note=notes.find(n=>n.id===active),originalNote=originalNotes.find(n=>n.id===active),source=sources.find(s=>s.id===sourceId);
  const noteProposal=proposals.find(p=>p.id===proposalId&&p.targetNoteId===active)||proposals.find(p=>p.targetNoteId===active);
  const paragraphTargets:PdfTarget[]=useMemo(()=>manuscript.flatMap(p=>p.rects.map(r=>({page:r.page,rect:r.rect as [number,number,number,number],noteId:p.id,number:p.order,kind:'paragraph'}))),[manuscript]);
  const sourceRefs=note?citedSourceRefs({id:note.id,sourceRefs:note.sourceRefs},citationPageMap,sources.map(s=>({id:s.id}))):[],ref=sourceRefs.find(r=>r.sourceId===sourceId);
  const citationEntry=citationPageMap[active]?.[sourceId],sourceCitedPages=citedPages(citationEntry,source?.pages);
  const relatedRef=(note?.relatedSources||[]).find((r:Obj)=>r.sourceId===sourceId),evidence=ref||relatedRef;
  useEffect(()=>{const controller=new AbortController();setTextSource('');if(source&&source.kind!=='pdf'){fetch(assetUrl(source.id),{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.text();}).then(t=>{if(controller.signal.aborted)return;try{setTextSource(asText(JSON.parse(t)));}catch{setTextSource(t);}}).catch(()=>{if(!controller.signal.aborted)setTextSource('자료를 불러오지 못했습니다.');});}return()=>controller.abort();},[sourceId,source?.kind]);
  const onPage=notes.filter(n=>[...(n.clickTargets||[]),...(n.noteHighlights||[])].some((t:Obj)=>t.page===page));
  const targets=useMemo(()=>[...footnoteTargets(originalNotes.map(n=>({id:n.id,number:n.number,clickTargets:n.clickTargets,noteHighlights:n.noteHighlights}))),...paragraphTargets,...citationPdfTargets(edition.id),...legalPdfDataForEdition.targets as PdfTarget[]],[data,paragraphTargets]);
  const highlights=note?.noteHighlights||[];
  const sourceHighlights=citationHighlights(source?{id:source.id,pages:source.pages,highlights:source.highlights}:undefined,active,citationEntry);
  const citationExplanation=(citationExplanationsForEdition as Record<string,Record<string,string>>)[active]?.[sourceId];
  const noteEdited=citationContextWasEdited(active,manuscript,effectiveShared);
  function goToThesis(targetPage:number){navigateThesis(targetPage);setMobilePane('thesis');if(window.innerWidth<1200)setSidebarOpen(false);}
  function showNavigation(){setSidebarVisibility(true);setMobilePane('contents');}
  function toggleNavigation(){setSidebarVisibility(compact?shownPane!=='contents':!visibleSurfaces.sidebar);}
  function setSidebarVisibility(show:boolean){if(readingView.focus)setReadingView(old=>withReadingSurface(old,'sidebar',show));else setSidebarOpen(show);if(compact)setMobilePane(show?'contents':'thesis');}
  function setMetadataVisibility(show:boolean){if(readingView.focus)setReadingView(old=>withReadingSurface(old,'metadata',show));else setMetadataOpen(show);if(compact)setMobilePane(show?'metadata':'source');}
  function hideNavigation(){setSidebarVisibility(false);setMobilePane('thesis');}
  function equalizeDocuments(){setPaneCuts(equalDocumentCuts);setCollapsedSplit(DEFAULT_COLLAPSED_SPLIT);changeLayout({rowSplit:50});}
  function resetWorkspaceSizes(){setWorkspaceLayout({...DEFAULT_WORKSPACE_LAYOUT});setPaneCuts(equalDocumentCuts);setCollapsedSplit(DEFAULT_COLLAPSED_SPLIT);setSidebarWidth(208);}
  function openMetadata(){setMetadataVisibility(true);setMobilePane('metadata');}
  function closeMetadata(){setMetadataVisibility(false);setMobilePane('source');requestAnimationFrame(()=>{const target=metadataOpener.current?.offsetParent?metadataOpener.current:document.querySelector<HTMLButtonElement>('.reading-view-trigger');target?.focus({preventScroll:true});});}
  function switchSource(id:string,fallbackPage=1,explicitPage?:number){
    if(sourceId)sourceReadings.current[sourceId]={page:sourcePage,zoom:sourceZoom,...(sourceFitMode?{fitMode:sourceFitMode}:{})};
    const next=sourceReadingPosition(sourceReadings.current,id,sources.find(s=>s.id===id)?.pages||1,fallbackPage,explicitPage);
    setTextTranslation('');setSourceId(id);setSourcePage(next.page);setSourceZoom(next.zoom);setSourceFitMode(next.fitMode||null);setSourceNavigation(explicitPage===undefined?0:++navigationCounter.current);
  }
  function openNote(id:string,jump=false){setMissingCitation(null);setTextTranslation('');const n=notes.find(n=>n.id===id);if(!n)return;setActive(id);setTab('source');setMobilePane('source');const r=citedSourceRefs({id:n.id,sourceRefs:n.sourceRefs},citationPageMap,sources.map(s=>({id:s.id})))[0];const target=citationStartPage(citationPageMap[id]?.[r?.sourceId],sources.find(s=>s.id===r?.sourceId)?.pages);switchSource(r?.sourceId||'',target,target);if(jump)navigateThesis(n.page);}
  function openReference(noteId:string,segment:SourceSegment){
    setMissingCitation(segment.status==='unavailable'?segment:null);
    const n=notes.find(n=>n.id===noteId);if(!n)return;
    setActive(noteId);setTextTranslation('');setTab('source');
    if(segment.status==='available'&&segment.sourceId){const translation=translationEntries.find(t=>t.sourceId===segment.sourceId&&t.kind==='text');if(translation){setTextTranslation(segment.sourceId);setMobilePane('source');return;}const source=sources.find(s=>s.id===segment.sourceId);if(!source)return;const target=segment.page||citationStartPage(citationPageMap[noteId]?.[segment.sourceId],source.pages);switchSource(segment.sourceId,target,target);setMobilePane('source');}
    else {switchSource('');setMetadataVisibility(true);setMobilePane('metadata');}
  }
  function openPdfTarget(id:string,target?:PdfTarget){
    if(target?.legalId){const mention=(legalPdfDataForEdition.mentions as Record<string,any>)[target.legalId];if(mention)openLegal(mention);return;}
    if(target?.linkId&&target.kind==='citation'){openReference(id,{start:0,end:0,sourceId:target.sourceId,page:target.sourcePage||1,title:target.title||'참고문헌',linkId:target.linkId,status:target.sourceId?'available':'unavailable',href:target.href});return;}
    if(id.startsWith('P'))openParagraph(id);else {setMissingCitation(null);openNote(id);}
  }
  function openSource(id:string){setMissingCitation(null);setMobilePane('source');const related=(note?.relatedSources||[]).find((r:Obj)=>r.sourceId===id);switchSource(id,citationStartPage(citationPageMap[active]?.[id],sources.find(s=>s.id===id)?.pages,related?.targetPage||1));}
  function openRelatedSource(id:string){setMissingCitation(null);const n=notes.find(n=>n.relatedSources?.some((r:Obj)=>r.sourceId===id));if(!n)return;const r=n.relatedSources.find((r:Obj)=>r.sourceId===id);setActive(n.id);setTab('source');setMobilePane('source');navigateThesis(n.page);switchSource(id,r.targetPage||1);}
  function newMemo(anchorType:string,extra:Obj={}){setComposerError('');setComposer({anchorType,page:anchorType==='general'?null:anchorType==='footnote'?note?.page:anchorType==='source'?sourcePage:page,noteId:anchorType==='footnote'||anchorType==='source'?active:null,sourceId:anchorType==='source'?sourceId:null,text:'',quote:window.getSelection()?.toString().slice(0,4000)||'',visibility:'private',status:'open',...extra});setPlacing(false);}
  async function saveMemo(){if(saving||!composer?.text?.trim())return;if(!sessionReady){setComposerError('메모 저장 전에 이용 정보를 연결해 주세요.');return;}setSaving(true);setComposerError('');try{const {id,revision,anchorType,page,noteId,sourceId,x,y,quote,text,visibility,status}=composer;await api(id?'/api/notes/'+id:'/api/notes',{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(id?{revision,text,quote,visibility,status}:{anchorType,page,noteId,sourceId,x,y,quote,text,visibility,status})});setComposer(null);await refreshMemos();}catch(e:any){setComposerError(e?.message||'메모를 저장하지 못했습니다. 입력 내용은 유지됩니다.');}finally{setSaving(false);}}
  async function removeMemo(m:Obj){if(saving||!window.confirm('이 메모를 삭제할까요?'))return;setSaving(true);setComposerError('');try{await api('/api/notes/'+m.id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:m.revision})});setComposer(null);await refreshMemos();}catch(e:any){setComposerError(e?.message||'메모를 삭제하지 못했습니다.');}finally{setSaving(false);}}
  const filteredNotes=useMemo(()=>notes.filter(n=>!query||[n.text,n.number,...(n.bodyContexts||[]).map((b:Obj)=>b.text)].join(' ').toLowerCase().includes(query.toLowerCase())),[notes,query]);
  const supplementalSources=sources.filter(s=>s.supplemental),filteredSupplemental=supplementalSources.filter(s=>!query||[s.title,s.reviewSummary].join(' ').toLowerCase().includes(query.toLowerCase()));
  const filteredMemos=memos.filter(m=>(filter==='all'||m.status===filter)&&(!query||[m.text,m.quote,m.displayName].join(' ').includes(query)));
  const selectMemo=(m:Memo,jump=true)=>{setComposerError('');if(jump){if(m.noteId)openNote(m.noteId,m.anchorType!=='source');if(m.anchorType==='source'&&m.sourceId){setTab('source');switchSource(m.sourceId,m.page||1,m.page||1);}else if(m.page)navigateThesis(m.page);}setComposer({...m});};
  const printedPage=data?.pages?.find((entry:Obj)=>entry.page===page)?.printedPage;
  const metadataTitle=({source:'각주 상세정보',revision:'본문 수정안',memos:'검토 메모',library:'자료 목록',profile:'김민규 소개',faq:'논문 FAQ','ai-mingyu':AI_MINGYU_LABEL,glossary:'법학어학사전'} as Record<string,string>)[tab]||'상세정보';
  const rows=!compact&&workspaceLayout.orientation==='rows';
  const headerHeight=workspaceLayout.headerHeight===null?undefined:boundedPanelHeight(workspaceLayout.headerHeight,viewportHeight,0,.4,132);
  const footerHeight=workspaceLayout.footerHeight===null?undefined:boundedPanelHeight(workspaceLayout.footerHeight,thesisPaneRef.current?.clientHeight||viewportHeight,0,.35,48);
  const menuHeight=workspaceLayout.sidebarMenuHeight===null?undefined:boundedPanelHeight(workspaceLayout.sidebarMenuHeight,sidebarRef.current?.clientHeight||viewportHeight,0,.7,250);
  const readingControls=<ReadingControls editionId={edition.id} editionChoices={[{id:'human80',label:'인간80 심사본'},{id:'v122',label:'v122 수정본'},{id:'v121',label:'v121 이전 수정본'},{id:'v120',label:'v120 이전 수정본'}]} onEdition={id=>onEdition(id as ManuscriptEditionId)} onTool={toolPopups.openTool} mobile={compact} pane={shownPane} view={readingView} onChange={next=>{if(next.focus&&!readingView.focus)setPlacing(false);setReadingView(next);}} sidebar={sidebarOpen} metadata={metadataOpen} onSidebar={setSidebarVisibility} onMetadata={setMetadataVisibility} document={shownPane==='source'?'source':'thesis'} onDocument={setMobilePane} onEqualWidth={equalizeDocuments} layout={workspaceLayout.orientation} onLayout={orientation=>changeLayout({orientation})} onResetSizes={resetWorkspaceSizes}/>;
  const restoreControls=(!visibleSurfaces.header||headerHeight===0)?readingControls:null;
  const restorePane=compact?shownPane:'thesis';
  return <div className={"review-app four-pane-app"+(AI_MINGYU_ENABLED&&tab==='ai-mingyu'&&aiWide&&visibleSurfaces.metadata?' mingyu-wide':'')+(rows?' documents-stacked':'')+" mobile-show-"+shownPane+(visibleSurfaces.metadata?" metadata-open":" metadata-collapsed")+(readingView.focus?" reading-focus":"")+(!visibleSurfaces.header?" view-hide-header":"")+(!visibleSurfaces.tools?" view-hide-tools":"")+(!visibleSurfaces.footnotes?" view-hide-footnotes":"")}>
    <div className="workspace-chrome" ref={chromeRef} data-collapsed={headerHeight===0?'true':undefined} inert={headerHeight===0} aria-hidden={headerHeight===0?true:undefined} style={headerHeight===undefined?undefined:{height:headerHeight,flexBasis:headerHeight}}><header id="workspace-header" className="app-header"><button className="sidebar-toggle" aria-label={(compact?shownPane==='contents':visibleSurfaces.sidebar)?"탐색 메뉴 닫기":"탐색 메뉴 열기"} aria-expanded={compact?shownPane==='contents':visibleSurfaces.sidebar} aria-controls="workspace-navigation" onClick={toggleNavigation}>☰</button><a className="law-logo" href={window.location.href} onClick={event=>{event.preventDefault();window.location.reload();}} aria-label="논문 사이트 새로고침" title="논문 사이트 새로고침"><img src="./korea-law-logo.svg" alt="고대법대 KU Law" width="244" height="100"/></a><div className="brand"><b>김민규</b><span>박사논문 심사실</span></div><div className="header-title"><span>고려대학교 일반대학원 · 법학과</span><h1>주택임차보증금반환채권의 행사 및 반환보장상의 법적 쟁점</h1></div><span className="access-badge">논문 심사·교정</span><span className="visitor-label" >LAWINUS</span></header>
    <div id="workspace-basis" className="basis-bar"><span><b>{edition.label}</b> {edition.date} <i/> 김민규 · 민법 · 지도교수 김제완</span><div className="basis-actions"><TextSizeControl/>{visibleSurfaces.header&&headerHeight!==0&&readingControls}</div></div></div>
    {visibleSurfaces.header&&<PaneResizer axis="y" className="chrome-divider" label="상단 메뉴와 문서 영역 높이 조절" getValue={()=>chromeRef.current?.clientHeight??headerHeight??132} value={headerHeight??chromeRef.current?.clientHeight??132} min={0} max={boundedPanelHeight(400,viewportHeight,0,.4,132)} unit="픽셀" step={16} onChange={value=>changeLayout({headerHeight:value})} onReset={()=>changeLayout({headerHeight:null})}/>}
    {error&&<div className="app-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="오류 안내 닫기">×</button></div>}
    {!data?<div className="loading-screen"><div className="law-logo"><img src="./korea-law-logo.svg" alt="고대법대 KU Law" width="244" height="100"/></div><h2>{loadError?'심사 자료를 불러오지 못했습니다.':'심사 자료를 준비하고 있습니다.'}</h2><p>{loadError}</p><button onClick={()=>location.reload()}>다시 불러오기</button></div>:<div className={'review-body'+(visibleSurfaces.sidebar?' sidebar-open':' sidebar-collapsed')} style={{'--sidebar-width':sidebarWidth+'px'} as React.CSSProperties}>
      {visibleSurfaces.sidebar&&<button className="sidebar-backdrop" aria-label="탐색 메뉴 닫기" onClick={hideNavigation}/>}
      <aside ref={sidebarRef} className="workspace-sidebar" id="workspace-navigation" aria-label="논문 탐색">
        <div ref={sidebarMenuRef} className="sidebar-controls" data-collapsed={menuHeight===0?'true':undefined} inert={menuHeight===0} aria-hidden={menuHeight===0?true:undefined} style={menuHeight===undefined?undefined:{height:menuHeight,flexBasis:menuHeight}}><div className="sidebar-heading"><b>논문 심사실</b>{restorePane==='contents'&&restoreControls}<button aria-label="탐색 메뉴 접기" onClick={hideNavigation}>‹</button></div>
        <nav className="sidebar-menu" aria-label="검토 메뉴">{[['source','↔','원전 대조'],['revision','✎','수정안'],['memos','▧','검토 메모'],['library','≡','자료 목록'],['profile','○','김민규 소개'],['faq','?','논문 FAQ'],['ai-mingyu','◇',AI_MINGYU_LABEL],['glossary','A','법학어학사전']].map(([id,icon,label])=><button key={id} className={tab===id?'active':''} disabled={id==='ai-mingyu'&&!AI_MINGYU_ENABLED} title={id==='ai-mingyu'&&!AI_MINGYU_ENABLED?AI_MINGYU_PAUSED_MESSAGE:undefined} aria-current={tab===id?'page':undefined} onClick={()=>{if(id==='ai-mingyu'&&!AI_MINGYU_ENABLED)return;if(id==='ai-mingyu'||id==='glossary'){toolPopups.openTool(id);return;}setTab(id);if(id!=='source')setMetadataVisibility(true);setMobilePane(id==='source'?'source':'metadata');setQuery('');if(window.innerWidth<1200)setSidebarOpen(false);}}><span aria-hidden="true">{icon}</span>{label}{id==='memos'&&<small>{memos.length}</small>}</button>)}</nav></div>
        <PaneResizer axis="y" className="sidebar-toc-divider" label="검토 메뉴와 목차 높이 조절" getValue={()=>sidebarMenuRef.current?.clientHeight??menuHeight??250} value={menuHeight??sidebarMenuRef.current?.clientHeight??250} min={0} max={boundedPanelHeight(650,sidebarRef.current?.clientHeight||viewportHeight,0,.7,250)} unit="픽셀" step={16} onChange={value=>changeLayout({sidebarMenuHeight:value})} onReset={()=>changeLayout({sidebarMenuHeight:null})}/>
        {menuHeight===0&&restorePane==='contents'&&<div className="inline-restore">{restoreControls}</div>}<button className="sidebar-outline-toggle" aria-expanded={outline} onClick={()=>setOutline(!outline)}>논문 목차 <span aria-hidden="true">{outline?'−':'＋'}</span></button>
        {outline&&<ThesisContents toc={edition.toc as any} page={page} pdfSha256={data.meta.pdfSha256} onNavigate={goToThesis}/>}
      </aside>
      {visibleSurfaces.sidebar&&<PaneResizer className="sidebar-divider" label="목차 화면 너비 조절" value={sidebarWidth} min={176} max={440} step={16} unit="픽셀" onChange={setSidebarWidth}/>}
      <div className="split-workspace four-pane-workspace" ref={splitRef} style={{'--document-columns':rows?stackedDocumentColumns(workspaceLayout.stackedSourceEnd,visibleSurfaces.metadata):visibleSurfaces.metadata?fourPaneColumns(paneCuts):collapsedPaneColumns(collapsedSplit),'--document-rows':stackedDocumentRows(workspaceLayout.rowSplit)} as React.CSSProperties}>
      <section ref={thesisPaneRef} className="thesis-pane" aria-label="박사논문"><ReaderToolPanel className="thesis-controls" label="논문 위 도구 영역 높이 조절" height={workspaceLayout.thesisToolsHeight} available={thesisPaneRef.current?.clientHeight||viewportHeight} onChange={height=>changeLayout({thesisToolsHeight:height})} onReset={()=>changeLayout({thesisToolsHeight:null})}><div className="pane-toolbar"><div className="manuscript-view-buttons"><button className={manuscriptMode==='pdf'?'selected':''} onClick={()=>{manuscriptViewChosen.current=true;if(manuscriptMode!=='pdf')navigateThesis(page);setManuscriptMode('pdf');}}>원본 PDF</button><button className={manuscriptMode==='body'?'selected':''} onClick={()=>{manuscriptViewChosen.current=true;if(manuscriptMode!=='body')navigateThesis(page);setManuscriptMode('body');}}>본문</button></div><button className={outline?'selected':''} onClick={()=>{showNavigation();setOutline(true);}} title="목차">☰ <span>목차</span></button><Pager page={page} total={data.meta.pageCount} onChange={navigateThesis}/><div className="toolbar-spacer"/><button disabled={zoom<=.7} onClick={()=>changeZoom(Math.max(.7,zoom-.15))} aria-label="축소">−</button><ZoomSelect label={manuscriptMode==='pdf'?'논문 배율 및 맞춤':'본문 배율'} zoom={manuscriptMode==='body'?Math.max(.7,zoom):zoom} fitMode={manuscriptMode==='pdf'?fitMode:null} onZoom={changeZoom} onFit={manuscriptMode==='pdf'?setFitMode:undefined}/><button onClick={()=>changeZoom(Math.min(2,Math.max(.7,zoom+.15)))} aria-label="확대">＋</button><button className={placing==='thesis'?'selected':'memo-tool'} onClick={()=>{if(manuscriptMode==='body')newMemo('thesis');else setPlacing(placing==='thesis'?false:'thesis');}}>▧ 메모</button></div>
        {placing==='thesis'&&<div className="placement-hint">문서에서 메모를 붙일 위치를 눌러 주세요.<button onClick={()=>setPlacing(false)}>취소</button></div>}
        
        {sharedError&&<div className="shared-edit-status" role="status">{sharedError}<button onClick={()=>void refreshShared()}>다시 연결</button></div>}
        <div ref={setThesisControlsHost}/></ReaderToolPanel>
        {manuscriptMode==='body'?<WebManuscript extraControls={restorePane==='thesis'?restoreControls:null} controlsHost={thesisControlsHost} persistenceKey={readingDataset?`${readingDataset}:body`:undefined} navigationToken={thesisNavigation} onNavigationHandled={token=>setThesisNavigation(current=>current===token?0:current)} paragraphs={manuscript} overrides={effectiveShared} notes={originalNotes as any} page={page} zoom={Math.max(.7,zoom)} selected={paragraphId} onPageChange={reportThesisPage} onParagraph={openParagraph} onNote={id=>openNote(id)} onReference={openReference} proposalIndicators={proposalIndicators} onProposal={id=>selectProposal(id,false)}/>:<PdfPane extraQuickControls={restorePane==='thesis'?restoreControls:null} url={assetUrl('thesis')} controlsHost={thesisControlsHost} persistenceKey={readingDataset?`${readingDataset}:thesis`:undefined} navigationToken={thesisNavigation} onNavigationHandled={token=>setThesisNavigation(current=>current===token?0:current)} id="thesis" page={page} total={data.meta.pageCount} pageSizes={data.pages} onPageChange={reportThesisPage} zoom={zoom} onZoomChange={changeZoom} fitMode={fitMode} onFitModeChange={setFitMode} onZoomResolved={setZoom} quickTools={compact||!visibleSurfaces.tools} highlights={highlights} targets={targets} proposalIndicators={proposalIndicators} onProposal={id=>selectProposal(id,false)} onTarget={openPdfTarget} pins={memos.filter(m=>m.anchorType==='thesis')} onPin={m=>selectMemo(m,false)} placing={placing==='thesis'} onPlace={(x,y,placedPage)=>newMemo('thesis',{x,y,page:placedPage})} label="박사논문"/>}
        {visibleSurfaces.footnotes&&<PaneResizer axis="y" className="footnotes-divider" label="문서와 하단 각주 목록 높이 조절" getValue={()=>thesisPaneRef.current?.querySelector<HTMLElement>('.page-footnotes')?.clientHeight??footerHeight??48} value={footerHeight??48} min={0} max={boundedPanelHeight(300,thesisPaneRef.current?.clientHeight||viewportHeight,0,.35,48)} unit="픽셀" step={12} unitsPerPixel={()=>-1} onChange={value=>changeLayout({footerHeight:value})} onReset={()=>changeLayout({footerHeight:null})}/>}
        <div className="page-footnotes" data-collapsed={footerHeight===0?'true':undefined} inert={footerHeight===0} aria-hidden={footerHeight===0?true:undefined} style={footerHeight===undefined?undefined:{height:footerHeight,flexBasis:footerHeight,minHeight:footerHeight,maxHeight:footerHeight}}><span>이 쪽의 각주</span>{onPage.map(n=><button className={n.id===active?'selected':''} key={n.id} onClick={()=>openNote(n.id)}>{n.number}{n.humanCorrection&&<sup>•</sup>}</button>)}{!onPage.length&&<span className="muted">연결된 각주 없음</span>}<div className="toolbar-spacer"/><span className="muted">PDF {page}쪽{printedPage?` · 인쇄 ${printedPage}면`:''}</span></div>
      </section>
      <PaneResizer axis={rows?'y':'x'} className="split-divider thesis-source-divider" label="논문과 원전 화면 경계 조절" value={rows?workspaceLayout.rowSplit:visibleSurfaces.metadata?paneCuts.thesis:collapsedSplit} min={rows?25:visibleSurfaces.metadata?22:28} max={rows?75:visibleSurfaces.metadata?paneCuts.sourceEnd-20:72} onChange={value=>rows?changeLayout({rowSplit:value}):visibleSurfaces.metadata?setPaneCuts(old=>moveFourPaneBoundary(old,'thesis',value)):setCollapsedSplit(normalizeCollapsedSplit(value))} unitsPerPixel={()=>100/Math.max(1,rows?(splitRef.current?.clientHeight||1)-8:(splitRef.current?.getBoundingClientRect().width||1)-(visibleSurfaces.metadata?12:6))} onReset={equalizeDocuments}/>
      <section ref={sourcePaneRef} className="source-viewer-pane" aria-label="참고문헌 원전"><ReaderToolPanel className="source-controls" label="원전 위 도구 영역 높이 조절" height={workspaceLayout.sourceToolsHeight} available={sourcePaneRef.current?.clientHeight||viewportHeight} onChange={height=>changeLayout({sourceToolsHeight:height})} onReset={()=>changeLayout({sourceToolsHeight:null})}><div className="pane-region-heading"><span>참고문헌 원전</span><div className="source-heading-actions"><button className="equal-width-control" onClick={equalizeDocuments} aria-label={rows?'논문과 참고문헌 화면 높이를 같게 맞추기':'논문과 참고문헌 화면 너비를 같게 맞추기'} title={rows?'논문과 참고문헌 화면 높이를 같게 맞추기':'논문과 참고문헌 화면 너비를 같게 맞추기'}>{rows?'같은 높이':'같은 폭'}</button><button ref={metadataOpener} aria-controls="reference-metadata" aria-expanded={visibleSurfaces.metadata} onClick={()=>{setTab('source');openMetadata();}}>각주 상세정보</button></div></div>
        {!textTranslation&&source?.kind==='pdf'&&<><div className="pane-toolbar source-toolbar"><Pager page={sourcePage} total={source.pages||1} onChange={navigateSource}/><div className="toolbar-spacer"/><button aria-label="참고문헌 축소" disabled={sourceZoom<=.7} onClick={()=>changeSourceZoom(Math.max(.7,sourceZoom-.15))}>−</button><ZoomSelect label="참고문헌 배율 및 맞춤" zoom={sourceZoom} fitMode={sourceFitMode} onZoom={changeSourceZoom} onFit={setSourceFitMode}/><button aria-label="참고문헌 확대" onClick={()=>changeSourceZoom(Math.min(2,Math.max(.7,sourceZoom+.15)))}>＋</button><button className={placing==='source'?'selected':''} onClick={()=>setPlacing(placing==='source'?false:'source')}>▧ 원전 메모</button></div>{source.displayMode==='excerpt'&&<div className="evidence-label">{`발췌 ${sourcePage}쪽 · 원문 PDF ${source.pageMap?.find((p:Obj)=>p.page===sourcePage)?.originalPage||'?'}쪽`}</div>}{placing==='source'&&<div className="placement-hint">원전에서 메모 위치를 눌러 주세요.<button onClick={()=>setPlacing(false)}>취소</button></div>}</>}
        <div ref={setSourceTranslationControlsHost}/><div className="source-pdf-controls" ref={setSourceControlsHost}/></ReaderToolPanel><div className="source-reader-body">

        {textTranslation?<ParallelSourceReader restoreControls={restorePane==='source'?restoreControls:null} controlsHost={sourceTranslationControlsHost} persistenceKey={readingDataset?`${readingDataset}:${textTranslation}`:undefined} sourceId={textTranslation} page={1} onPageChange={()=>{}}/>:source?<>
          {source.kind==='pdf'?<><ParallelSourceReader restoreControls={restorePane==='source'?restoreControls:null} controlsHost={sourceTranslationControlsHost} persistenceKey={readingDataset?`${readingDataset}:${sourceId}`:undefined} navigationToken={sourceNavigation} onComparePage={navigateSource} sourceId={sourceId} page={sourcePage} onPageChange={reportSourcePage}><PdfPane extraQuickControls={restorePane==='source'?restoreControls:null} url={assetUrl(sourceId)} controlsHost={sourceControlsHost} persistenceKey={readingDataset?`${readingDataset}:${sourceId}`:undefined} navigationToken={sourceNavigation} onNavigationHandled={token=>setSourceNavigation(current=>current===token?0:current)} id={sourceId} page={sourcePage} total={source.pages||1} zoom={sourceZoom} onZoomChange={changeSourceZoom} fitMode={sourceFitMode} onFitModeChange={setSourceFitMode} onZoomResolved={setSourceZoom} quickTools={compact||!visibleSurfaces.tools} onPageChange={reportSourcePage} highlights={sourceHighlights} pins={memos.filter(m=>m.anchorType==='source'&&m.sourceId===sourceId)} onPin={m=>selectMemo(m,false)} placing={placing==='source'} onPlace={(x,y,placedPage)=>newMemo('source',{x,y,page:placedPage})} label="참고문헌"/></ParallelSourceReader></>:<div className="text-source">{restorePane==='source'&&restoreControls}<button onClick={()=>newMemo('source')}>＋ 자료 메모</button><CitedTextSource key={active+'-'+sourceId} text={textSource||'자료를 불러오는 중…'} sections={citationEntry?.textSections}/></div>}</>:null}
      {!source&&!textTranslation&&<div className="empty-state">각주에서 참고문헌을 선택해 주세요.{restorePane==='source'&&<div className="inline-restore">{restoreControls}</div>}</div>}
      </div></section>
      {visibleSurfaces.metadata&&<PaneResizer className="split-divider source-metadata-divider" label="원전과 정보·수정 화면 경계 조절" value={rows?workspaceLayout.stackedSourceEnd:paneCuts.sourceEnd} min={rows?50:paneCuts.thesis+20} max={rows?82:80} onChange={value=>rows?changeLayout({stackedSourceEnd:value}):setPaneCuts(old=>moveFourPaneBoundary(old,'source',value))} unitsPerPixel={()=>100/Math.max(1,(splitRef.current?.getBoundingClientRect().width||1)-(rows?6:12))}/>}
      <section id="reference-metadata" className="reference-pane metadata-pane" aria-label="참고문헌 정보와 논문 수정"><div className="reference-heading"><span>{metadataTitle}</span><div className="metadata-heading-actions">{restorePane==='metadata'&&restoreControls}{AI_MINGYU_ENABLED&&tab==='ai-mingyu'&&<button onClick={()=>{openMingyuChatWindow();}}>새 대화창으로 열기 ↗</button>}{AI_MINGYU_ENABLED&&tab==='ai-mingyu'&&<button className="mingyu-wide-toggle" onClick={()=>setAiWide(value=>!value)}>{aiWide?'문서와 함께 보기':'답변 넓게 보기'}</button>}<button className="panel-navigation" onClick={showNavigation} aria-label="다른 검토 메뉴 열기">☰</button><button className="metadata-collapse" onClick={closeMetadata} aria-label={`${metadataTitle} 접기`}>{metadataTitle} 접기</button></div></div>
      {tab==='revision'&&<div className="revision-panel">
        {paragraph||proposal?<><div className="revision-summary"><button onClick={()=>{setParagraphId('');setProposalId('');}}>‹ 수정안 목록</button><span>PDF {paragraph?.page||proposal?.page}쪽</span>{proposal&&<span>{proposal.priority}</span>}</div>
          {linkedAnnotation&&<aside className="revision-context-note" aria-label="연결된 수정안 각주"><b>수정지시서 {edition.guideVersion} · 각주 {linkedAnnotation.number}</b><p>{linkedAnnotation.text}</p><small>기존 심사본의 같은 번호 각주와 구별합니다.</small></aside>}
          {proposal&&<><RevisionComparison before={proposal.before} after={proposal.after} reason={proposal.reason} contextId={proposal.id}/>{proposal.applyUnsupportedReason&&<p className="revision-context-note">{proposal.applyUnsupportedReason}</p>}</>}
          {paragraph&&<SharedEditEditor datasetId={datasetId} key={paragraph.id} kind="paragraph" targetId={paragraph.id} proposalId={proposal?.id} originalText={paragraph.text} proposalBeforeText={edition.id==='human80'?proposal?.before:paragraph.text} proposalDisplayText={edition.id==='human80'?proposal?.after:undefined} proposalReason={edition.id==='human80'?proposal?.reason:undefined} proposalApplyText={proposal?.applyText} proposalUnsupportedReason={proposal?.applyUnsupportedReason} current={shared[paragraph.id]} onSaved={sharedSaved} onMemo={draft=>newMemo('thesis',{page:paragraph.page,quote:draft})}/>}
        </>:<><h3>{edition.guideVersion} 수정지시서 · {proposals.length}항목</h3><p className="revision-context-note">{edition.label}의 위치에 연결됩니다. 변경 전 문안은 80차 원고 기준이며 변경 후 문안은 {edition.guideVersion}에 반영되었습니다.</p>{edition.guideVersion==='v122'&&<p className="revision-context-note">온주의 관련 해설, 지원림 제23판에서 116쪽, 이시윤·조관행 제9개정판에서 140쪽, 법원실무제요(2020) 5권에서 282쪽을 선별 검토했습니다. 전권 정독은 아닙니다. 임차권등기 말소 순서, 양도·전대, 압류·추심의 효과, 대항요건 존속 종기, 임차권등기 후 새 소액임차인의 최우선변제권 배제, 조정서의 집행력을 보완했습니다.</p>}<InspectionRecord/><input className="revision-list-filter" placeholder="본문·수정안·이유 검색" value={revisionQuery} onChange={e=>setRevisionQuery(e.target.value)}/><div className="revision-list">{proposals.filter(p=>!revisionQuery||[p.before,p.after,p.reason].join(' ').includes(revisionQuery)).map(p=><button key={p.id} onClick={()=>selectProposal(p.id)}><small>PDF {p.page}{p.page_end>p.page?`~${p.page_end}`:''}쪽 · {p.priority}</small>{p.before.slice(0,120)}{p.before.length>120?'…':''}</button>)}</div><button className="shared-export-button" onClick={()=>void downloadShared()}>공통 수정 이력 내려받기</button></>}
      </div>}
      {tab==='source'&&<div className={"source-panel"+(note?' resizable-metadata':'')} ref={metadataBodyRef} style={{'--metadata-rows':`minmax(0,${workspaceLayout.metadataSplit}fr) 8px minmax(0,${100-workspaceLayout.metadataSplit}fr)`} as React.CSSProperties} key={active}>{note?<><div className="citation-details-scroll">
        {!textTranslation&&source&&<><div className="source-caption"><div><span className="section-eyebrow">{effectiveShared[active]?'원문 연결자료':source.supplemental?'관련 자료':source.displayMode==='excerpt'?'인용면 발췌':'참고문헌'}</span><h2>{source.title}</h2></div><a href={assetUrl(sourceId)} target="_blank" rel="noreferrer" title="별도 창에서 원전 열기">↗</a></div>{source.kind==='pdf'&&<><div className="source-locators">{sourceCitedPages.map((l,i)=><button className={l.page===sourcePage?'selected':''} key={l.page} onClick={()=>{navigateSource(l.page);setMobilePane('source');}}>{citedPageLabel(l.printed)}</button>)}</div>{sourceCitedPages.length>0&&<div className="citation-highlight-key"><span><i/>인용면</span>{sourceHighlights.some(h=>h.kind==='exact-passage')&&<span><i className="exact"/>확인 문구</span>}</div>}</>}</>}
        {translationEntries.filter(t=>t.kind==='text'&&t.noteIds?.includes(active)).map(t=><div className="source-chips translation-supplement-link" key={t.sourceId}><button className={textTranslation===t.sourceId?'selected':''} onClick={()=>{setMissingCitation(null);setTextTranslation(textTranslation===t.sourceId?'':t.sourceId);setMobilePane('source');}}>{t.title} · 원전·번역</button></div>)}
        <div className="citation-card"><div className="section-eyebrow"><b>각주 {note.number}</b><button onClick={()=>goToThesis(note.page)}>논문 PDF {note.page}쪽 ↗</button><button className="push-right" onClick={()=>newMemo('footnote')}>＋ 각주 메모</button></div><p className="citation-text"><SourceText noteId={note.id} text={note.text} selectedSourceId={sourceId} onReference={segment=>openReference(note.id,segment)}/></p>{missingCitation&&<div className="source-unavailable-note" role="status"><b>{missingCitation.title}</b><p>이 문헌의 원문은 아직 연결되어 있지 않습니다.</p>{missingCitation.href&&<a href={missingCitation.href} target="_blank" rel="noopener noreferrer">문헌 정보 확인 ↗</a>}</div>}
          {note.humanCorrection&&<details className="correction"><summary>각주 수정 제안</summary><p>{note.humanCorrection.reason}</p><p><b>수정 제안</b> {note.humanCorrection.proposedText}</p></details>}
          <details className="rationale" key={active+'-'+sourceId} open><summary>{noteEdited?'원문 인용 내용':relatedRef?'관련 본문':'이 각주가 뒷받침하는 내용'}</summary><blockquote><LegalText text={note.supportedClaim||note.bodyContexts?.[0]?.text||''} contextId={note.id}/></blockquote>{citationExplanation&&<><h3>{relatedRef?'관련 쟁점':'인용 취지'}</h3><p><LegalText text={citationExplanation} contextId={`citation-explanation:${note.id}:${sourceId}`}/></p></>}</details>
          {!!note.missingSources?.length&&<div className="correction"><b>원문 미연결 자료</b><p>{asText(note.missingSources)}</p></div>}
          <div className="source-chips">{sourceRefs.map((r:Obj,i:number)=><button key={r.sourceId+i} className={sourceId===r.sourceId?'selected':''} onClick={()=>openSource(r.sourceId)} title={sources.find(s=>s.id===r.sourceId)?.title}>{i+1}. {sources.find(s=>s.id===r.sourceId)?.title||'연결 자료'}</button>)}</div>
          {!!note.relatedSources?.length&&<div className="supplemental-materials"><b>관련 자료</b><div className="source-chips">{note.relatedSources.map((r:Obj)=><button key={r.sourceId} className={sourceId===r.sourceId?'selected':''} onClick={()=>openSource(r.sourceId)}>{sources.find(s=>s.id===r.sourceId)?.title||'추가 검토자료'}</button>)}</div></div>}
        </div>
        </div><PaneResizer axis="y" className="metadata-edit-divider" label="각주 설명과 편집 영역 높이 조절" value={workspaceLayout.metadataSplit} min={20} max={80} onChange={value=>changeLayout({metadataSplit:value})} unitsPerPixel={()=>100/Math.max(1,(metadataBodyRef.current?.clientHeight||1)-8)} onReset={()=>changeLayout({metadataSplit:52})}/>
        <div className="footnote-edit-box">{noteProposal&&<details className="correction"><summary>{edition.guideVersion} 수정지시서 · {noteProposal.id}</summary><RevisionComparison before={noteProposal.before} after={noteProposal.after} reason={noteProposal.reason} contextId={noteProposal.id}/></details>}<SharedEditEditor datasetId={datasetId} key={active} kind="footnote" targetId={active} proposalId={noteProposal?.id} originalText={originalNote?.text||''} proposalBeforeText={edition.id==='human80'?noteProposal?.before:originalNote?.text} proposalDisplayText={edition.id==='human80'?noteProposal?.after:undefined} proposalReason={edition.id==='human80'?noteProposal?.reason:undefined} proposalApplyText={noteProposal?.applyText} proposalUnsupportedReason={noteProposal?.applyUnsupportedReason} current={shared[active]} onSaved={sharedSaved} onMemo={draft=>newMemo('footnote',{quote:draft})}/></div>
</>:<div className="empty-state">논문의 각주를 누르면 인용 내용과 수정안을 확인할 수 있습니다.</div>}</div>}
      {tab==='library'&&<div className="scroll-panel"><div className="panel-heading"><span className="section-eyebrow">CITATION INDEX</span><h2>각주와 참고자료</h2><p>각주 {notes.length}개 · 인용 연결자료 {sources.length-supplementalSources.length+translationEntries.filter(t=>t.kind==='text').length}개{supplementalSources.length?` · 추가 검토자료 ${supplementalSources.length}개`:""}</p></div><input className="search-input" placeholder="각주 번호, 저자, 사건번호, 본문 설명 검색" value={query} onChange={e=>setQuery(e.target.value)}/>{!!filteredSupplemental.length&&<section className="supplemental-library"><h3>관련 자료</h3>{filteredSupplemental.map(s=><button className="library-row" key={s.id} onClick={()=>openRelatedSource(s.id)}><span className="index-number">＋</span><span>{s.title}<small>{s.reviewSummary}</small></span><span>↗</span></button>)}</section>}{filteredNotes.map(n=><div className="library-row" key={n.id}><button className="index-number" title={`각주 ${n.number} 상세정보`} onClick={()=>openNote(n.id,true)}>{n.number}</button><span><SourceText noteId={n.id} text={n.text} onReference={segment=>openReference(n.id,segment)}/><small>PDF {n.page}쪽 · {citedSourceRefs({id:n.id,sourceRefs:n.sourceRefs},citationPageMap,sources.map(s=>({id:s.id}))).length+translationEntries.filter(t=>t.kind==='text'&&t.noteIds?.includes(n.id)).length}개 자료{n.humanCorrection?' · 수정 제안 있음':''}{n.missingSources?.length?' · 미확보 포함':''}</small></span><button aria-label={`각주 ${n.number} 상세정보 열기`} onClick={()=>openNote(n.id,true)}>↗</button></div>)}</div>}
      {tab==='memos'&&<div className="scroll-panel"><div className="panel-heading"><span className="section-eyebrow">REVIEW NOTES</span><h2>검토 메모 · {edition.label}</h2></div><div className="memo-identity-note"><b>{reviewer.name}</b><p>개인 메모는 현재 브라우저에서만 열립니다. 브라우저 데이터를 지우기 전에 내보내기로 보관해 주세요.</p></div>{memoError&&<div className="memo-error" role="status">{memoError}<button onClick={connectSession} disabled={sessionConnecting}>{sessionConnecting?'연결 중…':'다시 연결'}</button></div>}<div className="memo-actions"><button className="primary" onClick={()=>newMemo('general')}>＋ 새 메모</button><button disabled={exporting} onClick={()=>void downloadNotes('md')}>Markdown ↓</button><button disabled={exporting} onClick={()=>void downloadNotes('csv')}>Excel용 CSV ↓</button><button onClick={connectSession} disabled={sessionConnecting} aria-label="메모 다시 연결">↻</button></div><div className="memo-actions legacy-memo-export"><button disabled={exporting} onClick={()=>void downloadNotes('md','human-1021-1559')}>이전 심사본 메모 MD ↓</button><button disabled={exporting} onClick={()=>void downloadSharedEditsExport('human-1021-1559').catch(error=>setError(error.message))}>이전 공통 수정 이력 JSON ↓</button></div><details className="legacy-memo-export"><summary>이전 77차·v112 기록 내려받기</summary><div className="memo-actions">{[["human-1028-2105","인간77"],["applied-v112-human77","v112"]].flatMap(([priorId,label])=>[<button key={priorId+"-md"} disabled={exporting} onClick={()=>void downloadNotes("md",priorId)}>{label} 메모 MD ↓</button>,<button key={priorId+"-json"} onClick={()=>void downloadSharedEditsExport(priorId).catch(error=>setError(error.message))}>{label} 공통 수정 이력 JSON ↓</button>])}</div></details><input className="search-input" placeholder="메모 내용·선택 구절·작성자 검색" value={query} onChange={e=>setQuery(e.target.value)}/><div className="filter-buttons">{[['all','전체'],['open','미해결'],['resolved','해결']].map(([id,label])=><button key={id} className={filter===id?'selected':''} onClick={()=>setFilter(id)}>{label}</button>)}</div>{filteredMemos.map(m=><button key={m.id} className={'memo-card '+m.status} onClick={()=>selectMemo(m)}><div className="section-eyebrow"><span>{m.noteId?`각주 ${Number(m.noteId.slice(3))}`:m.anchorType==='source'?'참고자료':m.anchorType==='general'?'전체 의견':'논문 원문'}{m.page?` · PDF ${m.page}쪽`:''}</span><span>{m.visibility==='private'?'나만 보기':'링크 방문자 공유'}</span></div>{m.quote&&<blockquote>{m.quote}</blockquote>}<p>{m.text}</p><small>{m.displayName} · {m.status==='resolved'?'해결':'미해결'}{m.editable?' · 수정 가능':''}</small></button>)}{!filteredMemos.length&&<div className="empty-state"><span>▧</span><h3>아직 메모가 없습니다.</h3></div>}</div>}
      {tab==='faq'&&<ThesisFaq/>}
      {tab==='ai-mingyu'&&<AiMingyu/>}
      {tab==='glossary'&&<LegalGlossary/>}
      {tab==='profile'&&<div className="scroll-panel profile-panel"><span className="section-eyebrow">김민규 소개</span><img className="profile-portrait" src="./kim-min-gyu-profile.jpg?v=92e0d14c5852" alt="김민규" width="112" height="140" decoding="async"/><h2>{profile?.name||'김민규'}</h2><p className="profile-headline">{profile?.headline}</p><p>{profile?.summary}</p><ProfileSections profile={profile}/></div>}
      </section>
    </div></div>}
    {data&&<nav className="mobile-navigation" aria-label="심사 화면 전환">
      <button className={mobilePane==='contents'?'active':''} aria-current={mobilePane==='contents'?'page':undefined} onClick={()=>{showNavigation();setOutline(true);}}><span aria-hidden="true">☰</span>목차</button>
      <button className={mobilePane==='thesis'?'active':''} aria-current={mobilePane==='thesis'?'page':undefined} onClick={()=>setMobilePane('thesis')}><span aria-hidden="true">▤</span>논문</button>
      <button className={mobilePane==='source'?'active':''} aria-current={mobilePane==='source'?'page':undefined} onClick={()=>setMobilePane('source')}><span aria-hidden="true">↔</span>원전</button>
      <button className={mobilePane==='metadata'?'active':''} aria-current={mobilePane==='metadata'?'page':undefined} onClick={openMetadata}><span aria-hidden="true">✎</span>정보·수정</button>
    </nav>}
    {toolPopups.layer}
    {composer&&<MemoDialog draft={composer} saving={saving} sessionReady={sessionReady} sessionConnecting={sessionConnecting} error={composerError} onChange={setComposer} onClose={()=>setComposer(null)} onSave={saveMemo} onDelete={()=>void removeMemo(composer)} onReconnect={()=>void connectSession()}/> }
  </div>;
}





