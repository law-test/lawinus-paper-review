import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import ReviewWorkspace from './review-workspace';
import AiMingyu from './ai-mingyu';
import LegalGlossary from './legal-glossary';
import {standaloneWorkspaceTool} from './workspace-tools';
import {LegalLinkProvider} from './legal-links';
import {loadReviewConfig} from './review-api';
import {applyTextSize, readTextSize} from './text-size';
import './globals.css';
import './text-size-control.css';
import './mobile-layout.css';
import './workspace-layout.css';
import './ai-mingyu-window.css';
import './workspace-launchers.css';

function App() {
  const [state, setState] = useState<'loading'|'ready'|'setup'>('loading');
  useEffect(() => {
    let active = true;
    loadReviewConfig().then(() => { if (active) setState('ready'); }).catch(() => {
      if (!active) return;
      setState('setup');
    });
    return () => { active = false; };
  }, []);
  if (state === 'ready') {
    const tool=standaloneWorkspaceTool(window.location.search);
    const embedded=window.self!==window.top&&new URLSearchParams(window.location.search).get('embedded')==='1';
    return <LegalLinkProvider>{tool==='ai-mingyu'?<main className="mingyu-standalone">{!embedded&&<nav className="mingyu-window-tools" aria-label="대화창 이동"><span>AI민규 · 논문 질문</span><a href="./?view=ai-mingyu">사이트 안에서 보기</a><a href="./" target="lawinus-paper" rel="noopener">논문 열기 ↗</a></nav>}<AiMingyu/></main>:tool==='glossary'?<main className="glossary-standalone">{!embedded&&<nav className="glossary-window-tools" aria-label="사전창 이동"><strong>법학어학사전</strong><a href="./?view=glossary">사이트 안에서 보기</a><a href="./" target="lawinus-paper" rel="noopener">논문 열기 ↗</a></nav>}<div className="glossary-window-content"><LegalGlossary/></div></main>:<ReviewWorkspace/>}</LegalLinkProvider>;
  }
  return <main className="review-app"><section className="loading-screen" role="status" aria-live="polite">
    <div className="law-logo"><img src="./korea-law-logo.svg" alt="고대법대 KU Law" width="244" height="100"/></div>
    <h1>LAWINUS · 논문 심사실</h1>
    <h2>{state === 'setup' ? '심사 자료를 불러오지 못했습니다.' : '심사 자료를 불러오는 중…'}</h2>
    {state === 'setup' ? <>
      <button className="primary" onClick={() => window.location.reload()}>다시 불러오기</button>
    </> : null}
  </section></main>;
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('화면을 표시할 영역이 없습니다.');
applyTextSize(readTextSize(), false);
createRoot(rootElement).render(<App/>);
