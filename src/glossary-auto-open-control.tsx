import React,{useEffect,useState} from 'react';
import {GLOSSARY_AUTOSTART_CHANGED,GLOSSARY_AUTOSTART_PAUSE_KEY,glossaryPauseUntil,glossaryPopupStorage,pauseGlossaryForWeek} from './workspace-tools';
import './glossary-auto-open-control.css';

export default function GlossaryAutoOpenControl({onPaused}:{onPaused?:()=>void}){
 const [until,setUntil]=useState(()=>glossaryPauseUntil(glossaryPopupStorage()));
 const [error,setError]=useState(false);
 useEffect(()=>{const sync=(event:Event)=>{if(event.type==='storage'&&(event as StorageEvent).key!==GLOSSARY_AUTOSTART_PAUSE_KEY&&(event as StorageEvent).key!==null)return;setUntil(glossaryPauseUntil(glossaryPopupStorage()));};window.addEventListener('storage',sync);window.addEventListener(GLOSSARY_AUTOSTART_CHANGED,sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener(GLOSSARY_AUTOSTART_CHANGED,sync);};},[]);
 function pause(){const value=pauseGlossaryForWeek(glossaryPopupStorage());setError(!value);if(!value)return;setUntil(value);window.dispatchEvent(new Event(GLOSSARY_AUTOSTART_CHANGED));onPaused?.();}
 return <span className="glossary-auto-open-control"><button type="button" onClick={pause} disabled={until>Date.now()}>{until>Date.now()?'일주일간 안 보기 설정됨':'일주일간 안 보기'}</button>{until>Date.now()&&<span role="status">{new Date(until).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}까지 자동으로 열지 않습니다.</span>}{error&&<span role="status">이 브라우저에서는 설정을 저장할 수 없습니다.</span>}</span>;
}
