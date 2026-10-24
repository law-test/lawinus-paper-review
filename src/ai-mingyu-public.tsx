import React,{useEffect,useMemo,useRef,useState} from 'react';
import publicData from './ai-mingyu-public-answers.json';
import {publicAnswerIndex,type PublicAnswer} from './ai-mingyu-public-model';
import {answerLevels,readAnswerLevel,saveAnswerLevel,levelLabel,type AnswerLevel} from './ai-mingyu-level';
import type {MingyuAnswer} from './ai-mingyu-client';
import ThesisFaq from './thesis-faq';

type PublicTurn={id:string;question:string;item?:PublicAnswer;choices?:PublicAnswer[];level:AnswerLevel;answer?:MingyuAnswer;model?:string;source?:'faq'|'cache'|'model';error?:string;pending?:boolean;elapsedMs?:number;generatedAt?:string;evidenceDate?:string};
export function AnswerLevelControl({level,onChange,disabled=false}:{level:AnswerLevel;onChange:(value:AnswerLevel)=>void;disabled?:boolean}){return <fieldset className="mingyu-level"><legend>답변 수준</legend><div>{answerLevels.map(item=><button key={item.value} type="button" aria-pressed={level===item.value} disabled={disabled} className={level===item.value?'selected':''} onClick={()=>onChange(item.value)}>{item.label}</button>)}</div><small>{answerLevels.find(item=>item.value===level)!.description} · 이후 답변에 적용</small></fieldset>;}

export default function PublicAiMingyu({onOwner,renderAnswer}:{onOwner:()=>void;renderAnswer:(props:{question:string;answer:MingyuAnswer;level:AnswerLevel;source?:'faq'|'cache'|'model';model?:string;elapsedMs?:number;generatedAt?:string;evidenceDate?:string})=>React.ReactNode}){
 const items=publicData.items as PublicAnswer[],index=useMemo(()=>publicAnswerIndex(items),[]);
 const [question,setQuestion]=useState(''),[level,setLevel]=useState<AnswerLevel>(readAnswerLevel),[turns,setTurns]=useState<PublicTurn[]>([]),[mode,setMode]=useState<'chat'|'faq'>('chat');
 const [apiReady,setApiReady]=useState(false),[busy,setBusy]=useState(false);
 const end=useRef<HTMLDivElement>(null),active=useRef<AbortController|null>(null);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[turns.length,busy,mode]);
 useEffect(()=>{let alive=true;import('./ai-mingyu-public-client').then(api=>api.publicServiceStatus()).then(ready=>{if(alive)setApiReady(ready);}).catch(()=>{});return()=>{alive=false;active.current?.abort();};},[]);
 function changeLevel(value:AnswerLevel){setLevel(value);saveAnswerLevel(value);}
 async function ask(text:string,id?:string){
  text=text.trim();if(!text||text.length>1800||busy||active.current)return;const matched=index.exact(text,id),turnId=crypto.randomUUID(),chosen=level;
  setQuestion('');
  if(matched){setTurns(old=>[...old,{id:turnId,question:text,item:matched,level:chosen,source:'faq' as const}].slice(-40));return;}
  const choices=index.search(text);
  if(!apiReady){setTurns(old=>[...old,{id:turnId,question:text,choices,level:chosen}].slice(-40));return;}
  const controller=new AbortController();active.current=controller;setBusy(true);setTurns(old=>[...old,{id:turnId,question:text,level:chosen,pending:true}].slice(-40));
  try{const api=await import('./ai-mingyu-public-client'),result=await api.askPublicMingyu(text,chosen,turnId,controller.signal);if(active.current===controller&&!controller.signal.aborted)setTurns(old=>old.map(turn=>turn.id===turnId?{...turn,...result,pending:false}:turn));}
  catch(error){setTurns(old=>old.map(turn=>turn.id===turnId?{...turn,pending:false,error:controller.signal.aborted?'답변 생성을 중지했습니다.':error instanceof Error?error.message:'잠시 후 다시 질문해 주세요.',choices}:turn));}
  finally{if(active.current===controller){active.current=null;setBusy(false);}}
 }
 return <div className={`scroll-panel ai-mingyu-panel${mode==='chat'?' mingyu-chat-active':''}`}>
  <header className="panel-heading mingyu-panel-heading"><img className="mingyu-avatar" src="./kim-min-gyu-profile.jpg?v=92e0d14c5852" alt="김민규 소개 사진" width="54" height="54"/><div><span className="section-eyebrow">논문 연구 도우미</span><h2>AI민규</h2><p>논문을 읽다 궁금한 점을 물어보세요.</p></div></header>
  <div className="mingyu-public-toolbar"><AnswerLevelControl level={level} onChange={changeLevel}/><div className="mingyu-tabs" aria-label="AI민규 기능"><button className={mode==='chat'?'selected':''} onClick={()=>setMode('chat')}>질문하기</button><button className={mode==='faq'?'selected':''} onClick={()=>setMode('faq')}>FAQ 300개</button></div></div>
  {mode==='faq'?<ThesisFaq onQuestion={item=>{setMode('chat');void ask(item.question,item.id);}}/>:<div className="mingyu-chatroom">
   <div className="mingyu-chat-notice">현행법·필자 해석·개정안을 구별하고 근거를 연결합니다.</div>
   <div className="mingyu-conversation" role="log" aria-label="AI민규와 논문 질의" aria-live="polite" aria-relevant="additions text">
    {!turns.length&&<div className="mingyu-message mingyu-ai-message"><img className="mingyu-avatar" src="./kim-min-gyu-profile.jpg?v=92e0d14c5852" alt=""/><div className="mingyu-message-content"><span className="mingyu-sender">AI민규</span><div className="mingyu-bubble mingyu-ai-bubble"><p className="mingyu-greeting">어떤 부분이 궁금하세요?</p><p>{apiReady?'질문에 맞는 검토된 FAQ를 먼저 찾고, 새 답변이 필요하면 논문 근거로 답합니다.':'검토된 FAQ 300개를 바로 읽을 수 있습니다. 질문을 입력하거나 아래 문답을 선택해 주세요.'}</p><div className="mingyu-starters">{['faq-research-contribution','faq-paid-auction-before-confirmation','faq-post-discharge-deficiency'].map(id=>items.find(item=>item.id===id)).filter((item):item is PublicAnswer=>!!item).map(item=><button key={item.id} onClick={()=>void ask(item.question,item.id)}>{item.question}</button>)}</div></div></div></div>}
    {turns.map(turn=><article className="mingyu-chat-turn" key={turn.id} aria-label="질문과 답변"><div className="mingyu-message mingyu-user-message"><div className="mingyu-message-content"><span className="mingyu-sender">나</span><div className="mingyu-bubble mingyu-user-bubble">{turn.question}</div></div></div><div className="mingyu-message mingyu-ai-message"><img className="mingyu-avatar" src="./kim-min-gyu-profile.jpg?v=92e0d14c5852" alt=""/><div className="mingyu-message-content"><span className="mingyu-sender">AI민규 <small>{levelLabel(turn.level)}</small></span><div className="mingyu-bubble mingyu-ai-bubble">{turn.pending?<p role="status">질문에 맞는 논문 근거를 살펴보고 있어요.</p>:turn.item||turn.answer?renderAnswer({question:turn.question,answer:turn.item?.answer||turn.answer!,level:turn.level,source:turn.source||'faq',model:turn.model,elapsedMs:turn.elapsedMs,generatedAt:turn.generatedAt,evidenceDate:turn.evidenceDate||publicData.verifiedOn}):<><p>{turn.error||'아래 관련 문답 중 궁금한 내용과 맞는 질문을 선택해 주세요.'}</p>{!!turn.choices?.length&&<div className="mingyu-starters">{turn.choices.map(item=><button key={item.id} onClick={()=>void ask(item.question,item.id)}>{item.question}</button>)}</div>}{!turn.choices?.length&&<button onClick={()=>setMode('faq')}>주제별 FAQ 보기</button>}{!apiReady&&<p className="mingyu-caption">현재 공개 답변은 검토된 FAQ를 제공합니다. 자유질문 생성 답변은 연결 준비 중입니다.</p>}</>}</div></div></div></article>)}<div ref={end}/>
   </div>
   <form className="mingyu-question-form" onSubmit={e=>{e.preventDefault();void ask(question);}}><label htmlFor="mingyu-public-question">AI민규에게 질문 보내기</label><textarea id="mingyu-public-question" maxLength={1800} rows={3} value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing){e.preventDefault();void ask(question);}}} placeholder="논문의 주장, 조문, 예외가 궁금하면 질문해 주세요."/><div className="mingyu-compose-footer"><span>Ctrl + Enter로 보내기</span><div className="mingyu-actions">{busy?<button type="button" onClick={()=>active.current?.abort()}>답변 중지</button>:<button type="submit" disabled={!question.trim()}>보내기 ↑</button>}</div></div></form>
  </div>}
  <div className="mingyu-chat-footer"><p className="mingyu-caption">검토된 FAQ는 답변 원문을 유지합니다. 고졸은 용어 풀이를 더하고, 법학박사는 근거를 펼쳐 보여줍니다. 새 AI 답변은 선택한 수준으로 설명합니다.</p>{!!turns.length&&<button disabled={busy} onClick={()=>setTurns([])}>대화 화면 비우기</button>}</div>
  <details className="mingyu-public-info"><summary>자료 판본·작성자 도구</summary><p>지시서 v104 문안모형 · 실제 적용원고 v102 · 법령 자료 기준 {publicData.verifiedOn}. 각 근거의 판본을 확인해 주세요.</p><button type="button" onClick={onOwner}>작성자 전용 연결</button></details>
 </div>;
}
