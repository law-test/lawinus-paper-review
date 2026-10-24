import React,{useState} from 'react';
import type {WorkspaceTool} from './workspace-tools';
import './workspace-launchers.css';

export default function WorkspaceLaunchers({compactHeader=false,onOpen}:{compactHeader?:boolean;onOpen:(tool:WorkspaceTool)=>void}){
 const [dismissed,setDismissed]=useState(false);
 if(dismissed)return null;
 return <section className={'workspace-launchers'+(compactHeader?' compact-header':'')} aria-label="논문 도구 시작하기">
  <div className="workspace-launcher-heading"><span>논문과 함께 쓰는 도구</span><button type="button" onClick={()=>setDismissed(true)} aria-label="시작 도구 안내 접기">안내 접기 ×</button></div>
  <div className="workspace-launcher-cards">
   <button type="button" className="workspace-launcher-card mingyu-launcher" data-workspace-tool-launch="ai-mingyu" onClick={()=>onOpen('ai-mingyu')}><strong>AI민규 <span>팝업 열기</span></strong><span>논문 질문과 근거를 함께 확인하세요.</span></button>
   <button type="button" className="workspace-launcher-card glossary-launcher" data-workspace-tool-launch="glossary" onClick={()=>onOpen('glossary')}><strong>법학어학사전 <span>팝업 열기</span></strong><span>외국어 법률 용어·예문·발음을 찾아보세요.</span></button>
  </div>
 </section>;
}
