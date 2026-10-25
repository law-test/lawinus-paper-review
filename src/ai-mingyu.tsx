import React,{lazy,Suspense,useState} from 'react';
import PublicAiMingyu from './ai-mingyu-public';
import {AnswerCards} from './ai-mingyu-answer';
import './ai-mingyu.css';
import {AI_MINGYU_ENABLED,AI_MINGYU_LABEL,AI_MINGYU_PAUSED_MESSAGE} from './ai-mingyu-availability';
const PrivateAiMingyu=lazy(()=>import('./ai-mingyu-private'));
export default function AiMingyu(){
 const [owner,setOwner]=useState(false);
 if(!AI_MINGYU_ENABLED)return <section className="mingyu-maintenance" role="status"><h1>{AI_MINGYU_LABEL}</h1><p>{AI_MINGYU_PAUSED_MESSAGE}</p><a href="./?view=faq" target="_top">논문 FAQ 보기</a></section>;
 if(owner)return <Suspense fallback={<p role="status">작성자 연결 도구를 여는 중…</p>}><PrivateAiMingyu onPublic={()=>setOwner(false)}/></Suspense>;
 return <PublicAiMingyu onOwner={()=>setOwner(true)} renderAnswer={({level,...turn})=><AnswerCards turn={turn} level={level}/>}/>;
}
