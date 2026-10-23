import {useEffect, useId, useReducer, useRef, useState} from 'react';
import {
 getSharedEditHistory, restoreSharedEdit, saveSharedEdit, SharedEditError,
 type SharedEdit, type SharedEditKind, type SharedHistory,
} from './shared-edits';
import './shared-edit-editor.css';

export type SharedEditEditorProps = {
 kind:SharedEditKind; targetId:string; originalText:string; proposalApplyText?:string; proposalUnsupportedReason?:string;
 current:SharedEdit|undefined; onSaved:(edit:SharedEdit)=>void; onMemo?:(draft:string)=>void;
};

type EditorState = {
 draft:string; reason:string; baseText:string; revision:number;
 conflict:boolean; confirmOverwrite:boolean;
};
type EditorAction =
 | {type:'draft'|'reason'; value:string}
 | {type:'incoming'|'latest'; revision:number; text:string}
 | {type:'saved'; edit:SharedEdit}
 | {type:'conflict'};

type DraftStorage = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function sharedDraftKey(kind:SharedEditKind,targetId:string){
 return `lawinus.shared-edit-draft.v1:${kind}:${targetId}`;
}

export function readSharedEditorDraft(storage:DraftStorage,kind:SharedEditKind,targetId:string,originalText:string,current?:SharedEdit){
 const fallback={state:initialSharedEditorState(originalText,current),recovered:false,failed:false};
 try{
  const raw=storage.getItem(sharedDraftKey(kind,targetId));if(!raw)return fallback;
  const data=JSON.parse(raw);const state=data?.state;
  if(data.schema!==1||data.kind!==kind||data.targetId!==targetId||data.originalText!==originalText||!state||
   !['draft','reason','baseText'].every(key=>typeof state[key]==='string')||
   !Number.isSafeInteger(state.revision)||state.revision<0||typeof state.conflict!=='boolean'||typeof state.confirmOverwrite!=='boolean')return fallback;
  if(state.draft===state.baseText&&!state.reason)return fallback;
  return {state:state as EditorState,recovered:true,failed:false};
 }catch{return {...fallback,failed:true};}
}

export function writeSharedEditorDraft(storage:DraftStorage,kind:SharedEditKind,targetId:string,originalText:string,state:EditorState){
 const key=sharedDraftKey(kind,targetId);
 if(state.draft===state.baseText&&!state.reason){storage.removeItem(key);return;}
 storage.setItem(key,JSON.stringify({schema:1,kind,targetId,originalText,state}));
}

export function initialSharedEditorState(originalText:string,current?:SharedEdit):EditorState {
 // A deliberately emptied passage is still a saved edit.
 const text=current?.text??originalText;
 return {draft:text,reason:'',baseText:text,revision:current?.revision??0,conflict:false,confirmOverwrite:false};
}

export function sharedEditorReducer(state:EditorState,action:EditorAction):EditorState {
 switch(action.type){
  case 'draft': return {...state,draft:action.value};
  case 'reason': return {...state,reason:action.value};
  case 'conflict': return {...state,conflict:true};
  case 'incoming':
   if(action.revision<=state.revision)return state;
   if(state.draft!==state.baseText||state.reason)return {...state,conflict:true};
   return {...state,baseText:action.text,draft:action.text,revision:action.revision,conflict:false,confirmOverwrite:false};
  case 'latest':
   if(action.revision<state.revision)return state;
   return {...state,baseText:action.text,revision:action.revision,conflict:false,
    confirmOverwrite:state.draft!==action.text&&(action.revision>state.revision||state.conflict||state.confirmOverwrite)};
  case 'saved':
   return {draft:action.edit.text,reason:'',baseText:action.edit.text,revision:action.edit.revision,conflict:false,confirmOverwrite:false};
 }
}

function errorText(error:unknown):string {
 return error instanceof Error?error.message:'수정 내용을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}
function isConflict(error:unknown):boolean {
 return error instanceof SharedEditError&&error.code==='PT409';
}
function revisionDate(value:string):string {
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'':date.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}

/** A new target gets its own draft and pending-request lifetime. */
export function SharedEditEditor(props:SharedEditEditorProps){
 return <SharedEditEditorSession key={`${props.kind}:${props.targetId}`} {...props}/>;
}

function SharedEditEditorSession({kind,targetId,originalText,proposalApplyText,proposalUnsupportedReason,current,onSaved,onMemo}:SharedEditEditorProps){
 const validCurrent=current?.kind===kind&&current.targetId===targetId?current:undefined;
 const [boot]=useState(()=>{
  if(typeof window==='undefined')return {state:initialSharedEditorState(originalText,validCurrent),recovered:false,failed:false};
  try{return readSharedEditorDraft(window.sessionStorage,kind,targetId,originalText,validCurrent);}
  catch{return {state:initialSharedEditorState(originalText,validCurrent),recovered:false,failed:true};}
 });
 const [state,dispatch]=useReducer(sharedEditorReducer,boot.state);
 const [storageFailed,setStorageFailed]=useState(boot.failed);
 const [busy,setBusy]=useState(false),[historyBusy,setHistoryBusy]=useState(false);
 const [showHistory,setShowHistory]=useState(false),[history,setHistory]=useState<SharedHistory|null>(null);
 const [notice,setNotice]=useState(boot.recovered?'입력 중이던 문안을 불러왔습니다.':''),[error,setError]=useState('');
 const [showLatest,setShowLatest]=useState(false);
 const alive=useRef(true),saving=useRef(false),loading=useRef(false),epoch=useRef(0);
 const ids=useId(),bodyId=`${ids}-body`,reasonId=`${ids}-reason`,historyId=`${ids}-history`;
 const label=kind==='paragraph'?'본문':'각주';
 const dirty=state.draft!==state.baseText;
 const tooLong=Array.from(state.draft).length>100000||Array.from(state.reason).length>2000;

 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
 useEffect(()=>{
  if(validCurrent)dispatch({type:'incoming',revision:validCurrent.revision,text:validCurrent.text});
 },[validCurrent?.revision,validCurrent?.text]);
 useEffect(()=>{
  try{writeSharedEditorDraft(window.sessionStorage,kind,targetId,originalText,state);setStorageFailed(false);}
  catch{setStorageFailed(true);}
 },[kind,targetId,originalText,state]);
 useEffect(()=>{
  if(!dirty&&!state.reason)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);
  return()=>window.removeEventListener('beforeunload',warn);
 },[dirty,state.reason]);

 async function readHistory(mode:'first'|'more'|'latest'){
  if(loading.current||saving.current)return;
  const cursor=mode==='more'?history?.nextBeforeRevision??null:null;
  if(mode==='more'&&cursor===null)return;
  loading.current=true;setHistoryBusy(true);setError('');
  const requestEpoch=epoch.current;
  try{
   const result=await getSharedEditHistory(kind,targetId,cursor);
   if(!alive.current||requestEpoch!==epoch.current)return;
   if(mode==='more'){
    setHistory(previous=>{
     if(!previous)return result;
     const revisions=[...new Map([...previous.revisions,...result.revisions].map(edit=>[edit.revision,edit])).values()].sort((a,b)=>b.revision-a.revision);
     return {...result,revisions};
    });
    if(result.currentRevision>state.revision)dispatch({type:'conflict'});
   }else{
    setHistory(result);
    const newest=result.revisions.find(edit=>edit.revision===result.currentRevision);
    if(result.currentRevision!==0&&!newest)throw new Error('최신 수정 내용을 확인하지 못했습니다. 다시 불러와 주세요.');
    dispatch({type:mode==='latest'?'latest':'incoming',revision:result.currentRevision,text:newest?.text??result.original.text});
    if(mode==='latest'){
     setShowLatest(true);
     setNotice('최신 내용을 불러왔습니다. 입력 중인 문안은 그대로 유지했습니다.');
    }
   }
  }catch(caught){if(alive.current&&requestEpoch===epoch.current)setError(errorText(caught));}
  finally{loading.current=false;if(alive.current){setHistoryBusy(false);}}
 }

 function putText(text:string){
  if(text===state.draft)return;
  if(dirty&&!window.confirm('입력 중인 문안을 선택한 내용으로 바꾸시겠습니까? 아직 저장하지 않은 내용은 사라집니다.'))return;
  dispatch({type:'draft',value:text});setNotice('');setError('');
 }

 function acceptSaved(edit:SharedEdit){
  epoch.current++;
  try{window.sessionStorage.removeItem(sharedDraftKey(kind,targetId));setStorageFailed(false);}catch{setStorageFailed(true);}
  dispatch({type:'saved',edit});setShowLatest(false);setError('');
  setHistory(previous=>previous?{
   ...previous,currentRevision:edit.revision,
   revisions:[edit,...previous.revisions.filter(item=>item.revision!==edit.revision)],
  }:null);
  setNotice(edit.text.trim()===''?'삭제했습니다.':'저장했습니다.');
  onSaved(edit);
 }

 async function save(){
  if(saving.current||loading.current||state.conflict||!dirty||tooLong)return;
  if(state.confirmOverwrite&&!window.confirm(`확인한 최신 수정 ${state.revision}을 입력한 문안으로 바꾸시겠습니까? 기존 내용은 변경 이력에 남습니다.`))return;
  saving.current=true;setBusy(true);setError('');setNotice('');
  try{
   const edit=await saveSharedEdit({kind,targetId,text:state.draft,expectedRevision:state.revision,reason:state.reason});
   if(alive.current)acceptSaved(edit);
  }catch(caught){
   if(alive.current){if(isConflict(caught))dispatch({type:'conflict'});setError(errorText(caught));}
  }finally{saving.current=false;if(alive.current)setBusy(false);}
 }

 async function restore(revision:number){
  if(saving.current||loading.current||state.conflict||revision===state.revision)return;
  const name=revision===0?'원문':`수정 ${revision}`;
  const draftWarning=dirty?' 입력 중인 문안은 해당 내용으로 바뀝니다.':'';
  if(!window.confirm(`${name}으로 복원하시겠습니까? 복원은 새 변경 이력으로 저장되며 이전 이력은 유지됩니다.${draftWarning}`))return;
  saving.current=true;setBusy(true);setError('');setNotice('');
  try{
   const edit=await restoreSharedEdit({kind,targetId,restoreRevision:revision,expectedRevision:state.revision,reason:state.reason||`${name}으로 복원`});
   if(alive.current)acceptSaved(edit);
  }catch(caught){
   if(alive.current){if(isConflict(caught))dispatch({type:'conflict'});setError(errorText(caught));}
  }finally{saving.current=false;if(alive.current)setBusy(false);}
 }

 function toggleHistory(){
  const open=!showHistory;setShowHistory(open);
  if(open&&!history)void readHistory('first');
 }

 return <section className="shared-edit-editor" aria-label={`${label} 수정`} aria-busy={busy}>
  <div className="shared-edit-heading"><h3>{label} 수정</h3><span>{state.revision===0?'원문':`수정 ${state.revision}`}{dirty?' · 저장 전':''}</span></div>
  <div className="shared-edit-tools">
   <button type="button" disabled={busy||historyBusy} onClick={()=>putText(originalText)}>Before 넣기</button>
   {proposalApplyText!==undefined&&<button type="button" disabled={busy||historyBusy} onClick={()=>putText(proposalApplyText)}>{proposalApplyText===''?'삭제안 넣기':'After 넣기'}</button>}
  </div>
  {proposalApplyText===undefined&&proposalUnsupportedReason&&<p className="shared-edit-proposal-note">{proposalUnsupportedReason}</p>}
  <label className="shared-edit-label" htmlFor={bodyId}>수정할 문안</label>
  <textarea id={bodyId} className="shared-edit-body" value={state.draft} disabled={busy} onChange={event=>dispatch({type:'draft',value:event.target.value})} spellCheck={false}/>
  {dirty&&state.draft.trim()===''&&<p className="shared-edit-proposal-note">저장하면 {label} 내용이 삭제됩니다. 원문과 변경 이력은 유지됩니다.</p>}
  <label className="shared-edit-label" htmlFor={reasonId}>수정 이유 <span>(선택)</span></label>
  <textarea id={reasonId} className="shared-edit-reason" value={state.reason} disabled={busy} onChange={event=>dispatch({type:'reason',value:event.target.value})} rows={2}/>
  {storageFailed&&(dirty||state.reason)&&<p className="shared-edit-error" role="alert">이 브라우저에서 초안을 보관하지 못했습니다. 다른 화면으로 이동하기 전에 저장하거나 메모로 남겨 주세요.</p>}
  {tooLong&&<p className="shared-edit-error" role="alert">수정 내용은 100,000자, 수정 이유는 2,000자 이내로 입력해 주세요.</p>}
  {state.conflict&&<div className="shared-edit-conflict" role="alert">
   <p>다른 수정이 먼저 저장되었습니다. 입력한 문안은 유지됩니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.</p>
   <button type="button" disabled={busy||historyBusy} onClick={()=>void readHistory('latest')}>{historyBusy?'불러오는 중…':'최신 내용 불러오기'}</button>
  </div>}
  {showLatest&&!state.conflict&&<div className="shared-edit-latest">
   <details open><summary>최신 저장 내용 · {state.revision===0?'원문':`수정 ${state.revision}`}</summary><pre>{state.baseText||'내용 없음'}</pre></details>
   {state.draft!==state.baseText&&<button type="button" disabled={busy||historyBusy} onClick={()=>putText(state.baseText)}>최신 내용으로 입력 바꾸기</button>}
  </div>}
  {error&&!state.conflict&&<p className="shared-edit-error" role="alert">{error}</p>}
  {state.conflict&&error&&!isGenericConflictMessage(error)&&<p className="shared-edit-error" role="alert">{error}</p>}
  {notice&&<p className="shared-edit-status" role="status">{notice}</p>}
  <div className="shared-edit-actions">
   <button type="button" className="primary" disabled={busy||historyBusy||state.conflict||!dirty||tooLong} onClick={()=>void save()}>{busy?'저장 중…':`${label} ${dirty&&state.draft.trim()===''?'삭제':'수정'}하기`}</button>
   {onMemo&&<button type="button" disabled={busy||!state.draft.trim()} onClick={()=>onMemo(state.draft)}>이 문안으로 메모</button>}
   <button type="button" aria-expanded={showHistory} aria-controls={historyId} disabled={busy} onClick={toggleHistory}>{showHistory?'변경 이력 접기':'변경 이력 보기'}</button>
  </div>
  {showHistory&&<div className="shared-edit-history" id={historyId}>
   <div className="shared-edit-history-top"><h4>변경 이력</h4><button type="button" disabled={busy||historyBusy} onClick={()=>void readHistory('latest')}>최신 내용 불러오기</button></div>
   {historyBusy&&<p role="status">이력을 불러오는 중…</p>}
   {history?.revisions.map(edit=><article key={edit.id} className="shared-edit-revision">
    <div className="shared-edit-revision-heading"><b>수정 {edit.revision}{edit.revision===history.currentRevision?' · 현재':''}</b><button type="button" disabled={busy||historyBusy||state.conflict||edit.revision===state.revision} onClick={()=>void restore(edit.revision)}>수정 {edit.revision} 복원</button></div>
    <p className="shared-edit-byline">{edit.displayName}{edit.createdAt&&` · ${revisionDate(edit.createdAt)}`}{edit.action==='restore'&&` · ${edit.restoredFromRevision===0?'원문':`수정 ${edit.restoredFromRevision}`} 복원`}</p>
    {edit.reason&&<p className="shared-edit-revision-reason">{edit.reason}</p>}
    <details><summary>내용 보기</summary><pre>{edit.text||'내용 없음'}</pre></details>
   </article>)}
   {history?.hasMore&&<button type="button" className="shared-edit-more" disabled={busy||historyBusy} onClick={()=>void readHistory('more')}>이전 이력 더 보기</button>}
   {history&&<article className="shared-edit-revision">
    <div className="shared-edit-revision-heading"><b>원문 · 수정 0</b><button type="button" disabled={busy||historyBusy||state.conflict||state.revision===0} onClick={()=>void restore(0)}>원문 복원</button></div>
    <details><summary>내용 보기</summary><pre>{history.original.text||'내용 없음'}</pre></details>
   </article>}
   {!history&&!historyBusy&&<button type="button" onClick={()=>void readHistory('first')}>이력 다시 불러오기</button>}
  </div>}
 </section>;
}

function isGenericConflictMessage(message:string){return message.startsWith('다른 방문자가 먼저 수정했습니다.');}
export default SharedEditEditor;
