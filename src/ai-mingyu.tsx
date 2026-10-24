import React,{useEffect,useMemo,useRef,useState} from 'react';
import {filterFaq,type FaqItem} from './thesis-faq-model';
import {MINGYU_SESSION_KEY,mingyuRequest,evidenceHref,sectionLabels,type MingyuAnswer,type Evidence} from './ai-mingyu-client';
import {LegalText} from './legal-links';
import ThesisFaq from './thesis-faq';
import {openMingyuConnection} from './ai-mingyu-bridge';
import './ai-mingyu.css';

type Status={connected:boolean;authType?:string;model?:string;edition?:unknown;private?:boolean};
type DefenseItem=FaqItem&{examiner?:string;researchBasis?:unknown;defaultLawId?:string};
type ResearchPerson={name:string;role?:string;profile:string;profileVerifiedOn:string;publicAcademicBackground:string;preparationFocusInference:string;papers:{id:string;title:string;year:string;href:string;readingScope:string;questionDesignInference:string}[]};
type RedteamItem=FaqItem&{remainingRisk:string;manuscriptAction:string};
type RouteInfo={category?:string;label?:string;reason?:string;route?:string;tier?:string;model?:string;requestedModel?:string;effort?:string};
type Turn={question:string;answer:MingyuAnswer;model?:string;elapsedMs?:number;source?:'faq'|'cache'|'model';originalSource?:'faq'|'model';generatedAt?:string;evidenceDate?:string;classification?:RouteInfo;route?:RouteInfo;entryId?:string};
type ChatTurn=Omit<Turn,'answer'>&{id:string;answer?:MingyuAnswer;state:'pending'|'complete'|'failed'|'cancelled';sentAt:string;error?:string;faqId?:string};
type FaqSuggestion={id:string;question:string;category:string;examiner?:string;exact?:boolean};
type HistoryItem=Turn&{id:string;createdAt?:string;lastUsedAt?:string;reusable?:boolean};
const responseTime=(ms:number)=>ms<1000?`${Math.max(1,Math.round(ms))}ms`:`${(ms/1000).toFixed(1)}초`;
const portrait='./kim-min-gyu-profile.jpg?v=92e0d14c5852';
const messageTime=(value:string)=>new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
function MingyuAvatar(){return <img className="mingyu-avatar" src={portrait} alt="김민규 소개 사진" width="42" height="42" decoding="async"/>;}
const sourceLabel=(source?:string,originalSource?:string)=>source==='faq'?'검토된 FAQ 즉답':source==='cache'?(originalSource==='faq'?'검토된 FAQ 재사용':'이전에 생성한 AI 답변 재사용'):'새 AI 답변';
const evidenceKind=(e:Evidence)=>e.kind==='paper'?'논문':e.kind==='footnote'?'각주':e.kind==='law'?(/판례|판결|결정례/.test(e.label)?'판례':'조문'):'자료';
const answerWarning=(answer:MingyuAnswer)=>'sourceWarning' in answer&&typeof answer.sourceWarning==='string'?answer.sourceWarning:'';
const answerEdition=(answer:MingyuAnswer)=>'edition' in answer&&typeof answer.edition==='string'?answer.edition:'지시서 v104 문안모형 · 실제 적용원고 v102';
function answerForCopy(turn:Turn){
 const lines=['AI민규 · AI 연구 도우미의 답변',`질문: ${turn.question}`,`출처: ${sourceLabel(turn.source,turn.originalSource)}`,`판본: ${answerEdition(turn.answer)}`,`법령 자료 확인일: ${turn.evidenceDate||'2026-10-24'}`];
 if(turn.model)lines.push(`사용 모델/답변 제공 방식: ${turn.model}`);if(turn.generatedAt)lines.push(`작성: ${turn.generatedAt}`);
 lines.push('',turn.answer.summary);
 for(const section of turn.answer.sections){const label=sectionLabels[section.kind]||'확인 필요';lines.push('',`[${label}]${section.title&&section.title!==label?' '+section.title:''}`,section.text);for(const id of section.citationIds){const e=turn.answer.citations.find(c=>c.id===id);if(e)lines.push(`근거 · ${evidenceKind(e)}: ${e.label}`,evidenceHref(e.href)||'링크 확인 필요',...(e.edition?[`근거 판본: ${e.edition}`]:[]));}}
 const warning=answerWarning(turn.answer);if(warning)lines.push('',warning);return lines.join('\n');
}
function AnswerCards({turn}:{turn:Turn}){
 const sourceWarning=answerWarning(turn.answer),[copyState,setCopyState]=useState(''),[copying,setCopying]=useState(false);
 async function copy(){setCopying(true);setCopyState('');try{if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(answerForCopy(turn));setCopyState('법적 구분과 근거 링크를 함께 복사했습니다.');}catch{setCopyState('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인한 뒤 다시 눌러 주세요.');}finally{setCopying(false);}}
 return <><p className="mingyu-summary">{turn.answer.summary}</p>{turn.answer.sections.map((section,i)=>{
  const label=sectionLabels[section.kind]||'확인 필요',refs=section.citationIds.map(id=>turn.answer.citations.find(x=>x.id===id)).filter((e):e is Evidence=>!!e),kinds=[...new Set(refs.map(evidenceKind))].map(kind=>`${kind} ${refs.filter(e=>evidenceKind(e)===kind).length}`).join(' · ');
  return <section className={`mingyu-section ${section.kind}`} key={i}><span className="mingyu-kind">{label}</span>{section.title.trim()!==label&&<h4>{section.title}</h4>}<p>{section.text}</p>{!!refs.length&&<details className="mingyu-sources"><summary>근거 {refs.length}개 <span>· {kinds}</span></summary><ul className="mingyu-evidence">{refs.map(evidence=><li key={evidence.id}><EvidenceLink href={evidence.href} label={evidence.label}/>{evidence.edition&&<small> · {evidence.edition}</small>}</li>)}</ul></details>}</section>;
 })}{sourceWarning&&<p className="mingyu-caption mingyu-source-warning">{sourceWarning}</p>}<p className="mingyu-caption">{sourceLabel(turn.source,turn.originalSource)}{turn.model&&` · ${turn.model}`}{turn.elapsedMs!==undefined&&` · 서버 처리 ${responseTime(turn.elapsedMs)}`}{turn.generatedAt&&` · 작성 ${new Date(turn.generatedAt).toLocaleString('ko-KR')}`}{turn.evidenceDate&&` · 자료 기준 ${turn.evidenceDate}`}</p><div className="mingyu-answer-tools"><button type="button" onClick={()=>void copy()} disabled={copying}>{copying?'복사 중…':'근거와 함께 복사'}</button>{copyState&&<span role="status">{copyState}</span>}</div></>
}

const starters=['이 논문은 무엇을 새롭게 설명하려 하나요?','개인회생 인가 전에 매각대금을 모두 냈다면 배당은 그대로 계속되나요?','개인회생 면책 후 우선배당으로 못 받은 금액을 다른 재산에 청구할 수 있나요?'];
function storedToken(){try{return sessionStorage.getItem(MINGYU_SESSION_KEY)||'';}catch{return '';}}
function writeToken(value:string){try{if(value)sessionStorage.setItem(MINGYU_SESSION_KEY,value);else sessionStorage.removeItem(MINGYU_SESSION_KEY);}catch{}}
function EvidenceLink({href,label}:{href:string;label:string}){const safe=evidenceHref(href);return safe?<a href={safe} target="_blank" rel="noopener noreferrer">{label} ↗</a>:<span>{label} · 링크 확인 필요</span>;}

export default function AiMingyu(){
 const [token,setToken]=useState(storedToken),[code,setCode]=useState(''),[status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[connecting,setConnecting]=useState(false);
 const [question,setQuestion]=useState(''),[turns,setTurns]=useState<ChatTurn[]>([]),[busy,setBusy]=useState(false),[mode,setMode]=useState<'chat'|'faq'|'redteam'|'history'>('chat');
 const [suggestions,setSuggestions]=useState<FaqSuggestion[]>([]),[classification,setClassification]=useState<RouteInfo|null>(null),[history,setHistory]=useState<HistoryItem[]>([]),[historyLoaded,setHistoryLoaded]=useState(false);
 const [historySearch,setHistorySearch]=useState('');
 const [bridgeWaiting,setBridgeWaiting]=useState(false),[directMode,setDirectMode]=useState(false);
 const [defense,setDefense]=useState<DefenseItem[]>([]),[defenseLoaded,setDefenseLoaded]=useState(false),[examiner,setExaminer]=useState('전체'),[search,setSearch]=useState('');
 const [research,setResearch]=useState<ResearchPerson[]>([]);
 const [redteam,setRedteam]=useState<RedteamItem[]>([]);
 const request=useRef<{id:string;controller:AbortController}|null>(null),answerEnd=useRef<HTMLDivElement>(null);
 useEffect(()=>{answerEnd.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[turns.length,busy,mode]);
 useEffect(()=>{if(!token){setStatus(null);return;}let alive=true;mingyuRequest<Status>('/status',token).then(value=>{if(alive){setStatus(value);setError('');}}).catch(e=>{if(alive){setStatus(null);setError(e.message);}});return()=>{alive=false;};},[token]);
 useEffect(()=>()=>{const active=request.current;if(active){active.controller.abort();void mingyuRequest('/cancel',token,{requestId:active.id}).catch(()=>{});}},[token]);
 useEffect(()=>{if(!status?.connected||mode!=='chat'||question.trim().length<2){setSuggestions([]);setClassification(null);return;}let alive=true;const timer=setTimeout(()=>{mingyuRequest<{items:FaqSuggestion[];classification?:RouteInfo;route?:RouteInfo}>('/search',token,{question,limit:5}).then(value=>{if(alive){setSuggestions(value.items||[]);setClassification(value.classification||value.route||null);}}).catch(()=>{});},250);return()=>{alive=false;clearTimeout(timer);};},[question,status?.connected,token,mode]);
 function connectWindow(){setError('');setBridgeWaiting(true);try{openMingyuConnection(()=>{writeToken('bridge');setToken('bridge');setBridgeWaiting(false);void mingyuRequest<Status>('/status','bridge').then(setStatus).catch(e=>setError(e.message));},()=>{setStatus(null);writeToken('');setToken('');setBridgeWaiting(false);setHistory([]);setHistoryLoaded(false);setDefense([]);setDefenseLoaded(false);},message=>{setBridgeWaiting(false);setError(message);});}catch(e:any){setBridgeWaiting(false);setError(e.message);}}
 async function openHistory(){setMode('history');setHistoryLoaded(false);try{const value=await mingyuRequest<{items?:HistoryItem[];records?:HistoryItem[]}>('/history',token);setHistory(value.items||value.records||[]);setHistoryLoaded(true);}catch(e:any){setError(e.message);}}
 async function removeHistory(id:string){try{await mingyuRequest('/history/'+encodeURIComponent(id),token,undefined,undefined,'DELETE');setHistory(old=>old.filter(item=>item.id!==id));}catch(e:any){setError(e.message);}}
 const filtered=useMemo(()=>filterFaq(defense.filter(item=>examiner==='전체'||item.examiner===examiner),search) as DefenseItem[],[defense,examiner,search]);
 const examiners=useMemo(()=>[...new Set(defense.map(item=>item.examiner).filter(Boolean))] as string[],[defense]);
 const filteredHistory=useMemo(()=>{const needle=historySearch.trim().toLocaleLowerCase();return needle?history.filter(item=>[item.question,item.answer.summary,...item.answer.sections.map(s=>s.text)].join('\n').toLocaleLowerCase().includes(needle)):history;},[history,historySearch]);
 async function pair(event:React.FormEvent){event.preventDefault();setConnecting(true);setError('');try{const result=await mingyuRequest<{token:string}>('/pair','',{code:code.trim()});writeToken(result.token);setToken(result.token);setCode('');}catch(e:any){setError(e instanceof TypeError?'이 PC의 AI민규 연결 프로그램을 실행해 주세요. 브라우저가 로컬 네트워크 접근을 묻는 경우 허용해야 연결됩니다.':e.message);}finally{setConnecting(false);}}
 async function submitQuestion(text:string,faqId?:string){
  text=text.trim();if(!text||busy||request.current||!status?.connected)return;
  const id=crypto.randomUUID(),controller=new AbortController();request.current={id,controller};
  setBusy(true);setError('');setQuestion('');setSuggestions([]);setClassification(null);
  setTurns(old=>[...old,{id,question:text,faqId,state:'pending',sentAt:new Date().toISOString()}]);
  try{
   const result=await mingyuRequest<Omit<Turn,'question'>>('/ask',token,{question:text,requestId:id,...(faqId?{faqId}:{})},controller.signal);
   if(request.current?.id!==id)return;
   setTurns(old=>old.map(turn=>turn.id===id?{...turn,...result,state:'complete'}:turn));
  }catch(e:any){
   void mingyuRequest('/cancel',token,{requestId:id}).catch(()=>{});
   if(request.current?.id!==id)return;
   const message=e.name==='AbortError'?'답변 생성을 중지했습니다.':e instanceof TypeError?'연결이 끊겼습니다. 이 PC의 연결창이 열려 있는지 확인해 주세요.':e.message||'답변을 받지 못했습니다. 다시 시도해 주세요.';
   setTurns(old=>old.map(turn=>turn.id===id?{...turn,state:e.name==='AbortError'?'cancelled':'failed',error:message}:turn));
  }finally{if(request.current?.id===id){request.current=null;setBusy(false);}}
 }
 async function ask(event:React.FormEvent){event.preventDefault();await submitQuestion(question);}
 function cancel(){const active=request.current;if(active){request.current=null;active.controller.abort();void mingyuRequest('/cancel',token,{requestId:active.id}).catch(()=>{});setTurns(old=>old.map(turn=>turn.id===active.id?{...turn,state:'cancelled',error:'답변 생성을 중지했습니다. 보낸 질문은 그대로 남아 있습니다.'}:turn));}setBusy(false);}
 function disconnect(){cancel();void mingyuRequest('/logout',token,{}).catch(()=>{});writeToken('');setToken('');setStatus(null);setDefense([]);setResearch([]);setRedteam([]);setDefenseLoaded(false);setTurns([]);setHistory([]);setHistoryLoaded(false);setError('');}
 async function openDefense(target:'redteam'='redteam'){setMode(target);if(defenseLoaded)return;setError('');try{const result=await mingyuRequest<{items:DefenseItem[];research?:{people?:ResearchPerson[]};redteam?:{committee?:{items?:any[]};general?:{items?:any[]}}}>('/defense',token);setDefense(result.items);setResearch(result.research?.people||[]);setRedteam([...(result.redteam?.committee?.items||[]),...(result.redteam?.general?.items||[])].map(item=>({id:item.id,category:item.perspective,question:item.attack||item.question,answer:item.answer||[item.preparedAnswer],sources:item.sources,remainingRisk:item.residualRisk||item.remainingRisk,manuscriptAction:item.manuscriptReview?.action||item.manuscriptAction})));setDefenseLoaded(true);}catch(e:any){setError(e.message);}}
 return <div className={`scroll-panel ai-mingyu-panel${status?.connected&&mode==='chat'?' mingyu-chat-active':''}`}>
  <header className="panel-heading mingyu-panel-heading"><MingyuAvatar/><div><span className="section-eyebrow">비공개 논문 연구 도우미</span><h2>AI민규</h2><p>김민규의 논문을 근거로 AI가 답합니다.</p></div></header>
  <details className="mingyu-edition"><summary>v104 문안 · v102 적용 <span>· 법령 확인 2026. 10. 24.</span></summary><p>수정지시서 v104는 문안모형이며, 실제 적용원고는 v102입니다. 사이트의 기존 심사본과 수정안은 판본을 구별해 인용합니다. 법령은 표시된 확인일의 자료이며 실시간 조회 결과가 아닙니다.</p></details>
  <p className={`mingyu-status ${status?.connected?'connected':''}`} role="status">{status?.connected?'● 현재 ChatGPT 계정 연결됨 · 이 PC 전용':'○ 비공개 연결 대기'}</p>
  {!status?.connected?<section className="mingyu-pair"><p>이 PC의 연결 도우미를 실행한 뒤 연결창을 열어 주세요. 연결 코드는 새로 열린 로컬 창에 입력합니다.</p><button onClick={connectWindow}>이 PC의 연결창 열기</button>{bridgeWaiting&&<p role="status">연결창에서 코드를 입력한 뒤 이 탭으로 돌아오세요. 연결창은 열어 둡니다.</p>}<p className="mingyu-caption">다른 방문자는 계정과 비공개 답변에 접근할 수 없습니다. 기존 ChatGPT 대화 기록을 가져오지 않습니다.</p><button className="mingyu-subtle" onClick={()=>setDirectMode(value=>!value)}>직접 연결 방식 {directMode?'닫기':'열기'}</button>{directMode&&<form onSubmit={pair}><label htmlFor="mingyu-pair-code">비공개 연결 코드</label><div className="mingyu-inline"><input id="mingyu-pair-code" type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} required/><button disabled={connecting||!code.trim()}>{connecting?'연결 중…':'연결'}</button></div><p className="mingyu-caption">브라우저의 로컬 네트워크 연결 권한을 이미 허용한 경우 사용할 수 있습니다.</p></form>}</section>:<>
   <div className="mingyu-tabs" aria-label="AI민규 기능"><button className={mode==='chat'?'selected':''} onClick={()=>setMode('chat')}>논문 질의</button><button className={mode==='faq'?'selected':''} onClick={()=>setMode('faq')}>논문 FAQ</button><button className={mode==='redteam'?'selected':''} onClick={()=>void openDefense('redteam')}>반론·방어 답변</button><button className={mode==='history'?'selected':''} onClick={()=>void openHistory()}>저장된 답변</button><button onClick={disconnect}>연결 해제</button></div>
   {mode==='chat'?<>
    <div className="mingyu-chatroom">
     <div className="mingyu-chat-notice">주택임차보증금 논문 질의 · 각 질문은 독립적으로 처리합니다.</div>
     <div className="mingyu-conversation" role="log" aria-label="AI민규와 논문 질의" aria-live="polite" aria-relevant="additions text">
      {!turns.length&&<div className="mingyu-message mingyu-ai-message"><MingyuAvatar/><div className="mingyu-message-content"><span className="mingyu-sender">AI민규 <small>AI 연구 도우미</small></span><div className="mingyu-bubble mingyu-ai-bubble"><p className="mingyu-greeting">논문에서 궁금한 점을 보내 주세요.<br/>현행법, 필자의 해석, 개정안을 구별하고 근거를 함께 보여드릴게요.</p><div className="mingyu-starters"><p>바로 확인하기</p>{starters.map(text=><button key={text} disabled={busy} onClick={()=>void submitQuestion(text)}>{text}<span aria-hidden="true"> ↗</span></button>)}</div></div></div></div>}
      {turns.map(turn=><article className="mingyu-chat-turn" key={turn.id} aria-label="질문과 답변">
       <div className="mingyu-message mingyu-user-message"><div className="mingyu-message-content"><span className="mingyu-sender">나</span><div className="mingyu-bubble mingyu-user-bubble">{turn.question}</div><time className="mingyu-message-time" dateTime={turn.sentAt}>{messageTime(turn.sentAt)}</time></div></div>
       <div className="mingyu-message mingyu-ai-message"><MingyuAvatar/><div className="mingyu-message-content"><span className="mingyu-sender">AI민규 <small>AI 연구 도우미</small></span><div className={`mingyu-bubble mingyu-ai-bubble ${turn.state!=='complete'?'mingyu-state-bubble':''}`}>
        {turn.state==='pending'?<div className="mingyu-pending" role="status"><span className="mingyu-typing" aria-hidden="true"><i/><i/><i/></span><span>질문을 분류하고 근거를 확인하고 있어요.</span><small>검토된 FAQ와 저장 답변을 먼저 확인합니다.</small></div>:turn.answer?<>{(turn.classification||turn.route)&&<p className="mingyu-route">{(turn.classification||turn.route)?.label||(turn.classification||turn.route)?.category} · {(turn.classification||turn.route)?.reason}</p>}<AnswerCards turn={{...turn,answer:turn.answer}}/></>:<div className="mingyu-answer-error" role="status"><p>{turn.error||'답변을 받지 못했습니다.'}</p><div className="mingyu-actions"><button disabled={busy} onClick={()=>void submitQuestion(turn.question,turn.faqId)}>다시 보내기</button><button disabled={busy} onClick={()=>setQuestion(turn.question)}>질문 수정</button></div></div>}
       </div>{turn.generatedAt&&<time className="mingyu-message-time" dateTime={turn.generatedAt}>{messageTime(turn.generatedAt)}</time>}</div></div>
      </article>)}<div ref={answerEnd}/>
     </div>
     <form className="mingyu-question-form" onSubmit={ask}>
      <label htmlFor="mingyu-question">AI민규에게 질문 보내기</label>
      <textarea id="mingyu-question" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy)void submitQuestion(question);}}} maxLength={1800} rows={3} placeholder="주장, 조문, 예외 또는 예상 반론을 질문해 주세요."/>
      <div className="mingyu-compose-footer"><span>{busy?'답변을 기다리는 동안 다음 질문을 적을 수 있어요.':'앞선 답변을 이어 묻더라도 필요한 사실관계를 함께 적어 주세요.'}</span><div className="mingyu-actions">{busy?<button type="button" className="mingyu-stop" onClick={cancel}>답변 중지</button>:<button type="submit" disabled={!question.trim()}>보내기 <span aria-hidden="true">↑</span></button>}</div></div>
      {!busy&&classification&&<p className="mingyu-route">자동 분류: {classification.label||classification.category}{classification.model&&` · 새 답변이 필요하면 ${classification.model}`}<small>{classification.reason}</small></p>}
      {!busy&&!!suggestions.length&&<div className="mingyu-suggestions"><p>관련 FAQ · 선택하면 검토된 답변을 바로 봅니다.</p>{suggestions.map(item=><button key={item.id} type="button" onClick={()=>void submitQuestion(item.question,item.id)}><small>{item.examiner||item.category}</small>{item.question}</button>)}</div>}
     </form>
    </div>
    <div className="mingyu-chat-footer"><p className="mingyu-caption">새 답변은 질문의 난도에 따라 Luna·Sol·Astra를 선택합니다. 질문·답변은 이 PC에만 누적 저장되며 ‘저장된 답변’에서 삭제할 수 있습니다.</p>{!!turns.length&&!busy&&<button type="button" onClick={()=>setTurns([])}>대화 화면 비우기</button>}</div>
   </>:mode==='faq'?<ThesisFaq onQuestion={item=>{setMode('chat');void submitQuestion(item.question,item.id);}}/>:mode==='history'?<section className="mingyu-history"><h3>이 PC에 저장된 질문과 답변</h3><p>누적 답변을 검색 자료로 보관합니다. AI 생성 답변은 검토 완료된 FAQ와 구별하며, 같은 질문·같은 자료 판본의 유효한 기록만 재사용합니다.</p><label htmlFor="mingyu-history-search">저장된 질문·답변 검색</label><input id="mingyu-history-search" type="search" value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="질문이나 답변에 있는 말을 입력해 주세요."/><button onClick={()=>void openHistory()}>목록 새로고침</button><p role="status">{historyLoaded?`${history.length}개 중 ${filteredHistory.length}개`:'기록을 불러오는 중…'}</p>{filteredHistory.map(item=><details className="mingyu-defense-item" key={item.id}><summary>{item.question}</summary><p className="mingyu-caption">{sourceLabel(item.source)} · {item.generatedAt||item.createdAt}</p>{item.reusable===false&&<p className="mingyu-caption">이 기록은 보관용입니다. 현재 자료·모델 또는 보관기간 기준에 맞지 않으면 답변에 자동 재사용하지 않습니다.</p>}<AnswerCards turn={item}/><button onClick={()=>void removeHistory(item.id)}>이 기록 삭제</button><button onClick={()=>{setQuestion(item.question);setMode('chat');}}>같은 질문하기</button></details>)}</section>:<section className="mingyu-redteam"><h3>반론과 준비한 답변</h3><p>심사위원의 공개 연구에서 도출한 관점과 다양한 이해관계자의 관점에서 쟁점을 검토했습니다. 같은 법적 쟁점이 관점에 따라 반복될 수 있으며, 독립 실증사례 수를 뜻하지 않습니다.</p><label htmlFor="mingyu-redteam-search">반론·답변 검색</label><input id="mingyu-redteam-search" type="search" value={search} onChange={e=>setSearch(e.target.value)}/><p role="status">{redteam.length}개 쟁점 중 {filterFaq(redteam,search).length}개</p>{(filterFaq(redteam,search) as RedteamItem[]).map(item=><details className="mingyu-defense-item" key={item.id}><summary><span>{item.category}</span>{item.question}</summary><h4>준비한 답변</h4>{item.answer.map((text,i)=><p key={i}>{text}</p>)}<h4>남아 있는 한계</h4><p>{item.remainingRisk}</p><h4>논문 보완 판단</h4><p>{item.manuscriptAction}</p><ul>{item.sources.map(source=><li key={source.href+source.label}><EvidenceLink {...source}/></li>)}</ul><button onClick={()=>{setQuestion(item.question);setMode('chat');}}>이 반론으로 AI 답변 확인</button></details>)}</section>}
  </>}
  {error&&<p role="alert" className="mingyu-error">{error}</p>}
 </div>;
}
