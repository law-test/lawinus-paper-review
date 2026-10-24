import React,{lazy,Suspense,useState} from 'react';
import PublicAiMingyu from './ai-mingyu-public';
import {AnswerCards} from './ai-mingyu-answer';
import './ai-mingyu.css';
const PrivateAiMingyu=lazy(()=>import('./ai-mingyu-private'));
export default function AiMingyu(){
 const [owner,setOwner]=useState(false);
 if(owner)return <Suspense fallback={<p role="status">작성자 연결 도구를 여는 중…</p>}><PrivateAiMingyu onPublic={()=>setOwner(false)}/></Suspense>;
 return <PublicAiMingyu onOwner={()=>setOwner(true)} renderAnswer={({level,...turn})=><AnswerCards turn={turn} level={level}/>}/>;
}
