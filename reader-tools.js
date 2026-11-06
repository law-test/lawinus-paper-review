(() => {
  'use strict';
  const dictionaryURL = new URL('/tools/glossary/index.html', location.origin).href;
  const explicit = new URLSearchParams(location.search);
  if (explicit.get('view') === 'glossary' && explicit.get('dictionary') === '1') {
    location.replace(dictionaryURL);
    return;
  }
  const edition = '1103_85_';
  const pageCount = 255;
  const memoPrefix = 'paper:sticky:' + edition + ':';
  const layoutKey = 'paper:tools:layout:2';
  let currentPage = 1;
  let dictionaryWindow;
  let tools, box, active, trigger, body, memoInput, memoPage;
  const pageFrom = v => Number.isInteger(Number(v)) && Number(v)>0 && Number(v)<=pageCount ? Number(v) : null;
  function read(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
  function write(key, value) { try { const store=localStorage; if (value === null)store.removeItem(key);else store.setItem(key,value); return true; } catch { return false; } }
  function gotoPage(page) { window.dispatchEvent(new CustomEvent('paper:navigate', {detail:{page}})); }
  function el(tag, text, cls) { const node=document.createElement(tag); if(text!==undefined) node.textContent=text; if(cls)node.className=cls; return node; }
  function button(text, action, label) { const b=el('button',text);b.type='button';if(label)b.setAttribute('aria-label',label);b.addEventListener('click',action);return b; }
  function openDictionary() {
    try {
      if(dictionaryWindow && !dictionaryWindow.closed) {dictionaryWindow.focus();return true;}
      dictionaryWindow=window.open(dictionaryURL,'lawinus-glossary',window.innerWidth>=700?'popup,width=940,height=840,resizable=yes,scrollbars=yes':undefined);
      if(!dictionaryWindow)return false;
      dictionaryWindow.opener=null;dictionaryWindow.focus();return true;
    } catch { return false; }
  }
  const notesEndpoint='https://cefaekvclooytgjkcqum.supabase.co/functions/v1/examiner-notes';
  const cacheKey=memoPrefix+'drafts';
  let noteSession=null;
  function getToken(){try{return JSON.parse(sessionStorage.getItem('examiner-session')||'null')?.token||'';}catch{return '';}}
  function memoNumbers(){return [...(noteSession?.values.keys()||[])].filter(n=>noteSession.values.get(n)?.trim()).sort((a,b)=>a-b);}
  function memoValue(n){return noteSession?.values.get(n)||'';}
  function storeDrafts(state){
    if(state!==noteSession)return;
    try{
      if(state.pending.size)sessionStorage.setItem(cacheKey,JSON.stringify({owner:state.token.slice(0,20),pages:Object.fromEntries(state.pending)}));
      else sessionStorage.removeItem(cacheKey);
    }catch{}
  }
  function redrawMemoState(){
    if(active==='notes'){
      const status=body.querySelector('[data-status]');
      const retry=body.querySelector('[data-retry]');
      if(status)status.textContent=noteSession?.error||(!noteSession||noteSession.loading?'포스트잇을 불러오는 중…':noteSession.pending.size?'저장 중…':'내 심사코드에 저장됨');
      if(retry)retry.hidden=!noteSession?.error;
    }
  }
  function refreshVisibleNotes(){
    if(active==='notes'&&document.activeElement!==memoInput)renderNotes(memoPage);
    else if(active==='notes')body.querySelector('.prt-saved')?.dispatchEvent(new Event('refresh'));
    redrawMemoState();markPages();
  }
  async function loadRemote(state){
    state.loading=true;state.error='';const version=state.edits;
    try{
      const res=await fetch(notesEndpoint,{headers:{Authorization:'Bearer '+state.token},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:state.controller.signal});
      if(!res.ok)throw Error();
      const payload=await res.json();
      if(!Array.isArray(payload.notes))throw Error();
      if(state!==noteSession)return;
      for(const item of payload.notes){
        const n=pageFrom(item.page);
        if(n&&typeof item.body==='string'&&!state.pending.has(n)&&(state.touch.get(n)||0)<=version)state.values.set(n,item.body);
      }
      state.loaded=true;
    }catch{if(state===noteSession)state.error='포스트잇을 불러오지 못했습니다.';}
    finally{if(state===noteSession){state.loading=false;refreshVisibleNotes();}}
  }
  function syncLogin(){
    const token=getToken();if(!token||token===noteSession?.token)return;
    clearSessionMemos(false);
    const state={token,values:new Map(),pending:new Map(),touch:new Map(),edits:0,error:'',loaded:false,loading:true,timer:0,worker:null,controller:new AbortController()};
    noteSession=state;
    try{
      const draft=JSON.parse(sessionStorage.getItem(cacheKey)||'null');
      if(draft?.owner===token.slice(0,20))for(const [key,value] of Object.entries(draft.pages||{})){
        const page=pageFrom(key);if(page&&typeof value==='string'){state.values.set(page,value);state.pending.set(page,value);}
      }
      storeDrafts(state);
    }catch{}
    loadRemote(state);
    if(state.pending.size)flushState(state);
  }
  function flushState(state){
    if(state.worker)return state.worker;
    clearTimeout(state.timer);
    state.worker=(async()=>{
      while(state===noteSession&&state.pending.size){
        const [page,body]=state.pending.entries().next().value;
        try{
          const res=await fetch(notesEndpoint,{method:'PUT',headers:{Authorization:'Bearer '+state.token,'Content-Type':'application/json'},body:JSON.stringify({page,body}),credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:state.controller.signal});
          if(!res.ok||!(await res.json()).ok)throw Error();
          if(state!==noteSession)return false;
          if(state.pending.get(page)===body)state.pending.delete(page);
          state.error='';storeDrafts(state);
        }catch{if(state===noteSession)state.error='저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';return false;}
      }
      return state===noteSession;
    })().finally(()=>{state.worker=null;if(state===noteSession)redrawMemoState();});
    return state.worker;
  }
  window.paperFlushNotes=async()=>{
    const state=noteSession;if(!state||!state.pending.size)return true;
    const ok=await flushState(state);
    if(!ok&&state===noteSession){
      if(active!=='notes')showBox('notes',tools.querySelector('[data-tool="notes"]'));
      const first=state.pending.keys().next().value;if(first)renderNotes(first);redrawMemoState();
    }
    return ok;
  };
  function updateMemo(page,text){
    const state=noteSession;if(!state)return;
    const value=text.trim()?text:'';
    state.values.set(page,value);state.pending.set(page,value);state.touch.set(page,++state.edits);
    state.error='';storeDrafts(state);clearTimeout(state.timer);state.timer=setTimeout(()=>flushState(state),550);redrawMemoState();
  }
  window.addEventListener('pagehide',()=>{if(noteSession?.pending.size)storeDrafts(noteSession);});
  function closeBox(restore=true) {
    if(!box)return;
    box.remove();box=null;active=null;memoInput=null;
    for(const b of tools.querySelectorAll('[aria-expanded]'))b.setAttribute('aria-expanded','false');
    if(restore&&trigger?.isConnected)trigger.focus();
  }
  function attachResize(node, kind, axes, apply, limits) {
    const grip=button('⤡',()=>{},'너비·높이 조절');
    grip.className='prt-grip';grip.title='드래그 또는 방향키로 크기 조절';
    grip.setAttribute('aria-label',kind+' 크기 조절');
    node.append(grip);
    let drag;
    const clamp=(v,lo,hi)=>Math.min(Math.max(lo,hi),Math.max(lo,v));
    function resize(w,h) {
      const [minW,maxW,minH,maxH]=limits();
      const next={width:clamp(w,minW,maxW),height:clamp(h,minH,maxH)};
      apply(next);
      write(layoutKey+':'+kind,JSON.stringify(next));
    }
    grip.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      const rect=node.getBoundingClientRect();
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,w:rect.width,h:rect.height};
      grip.setPointerCapture(e.pointerId);e.preventDefault();
    });
    grip.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id)return;
      resize(drag.w+(axes.x||0)*(e.clientX-drag.x),drag.h+(axes.y||0)*(e.clientY-drag.y));
    });
    function finish(){drag=null;}
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])grip.addEventListener(ev,finish);
    grip.addEventListener('keydown',e=>{
      const delta={ArrowRight:[16,0],ArrowLeft:[-16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[e.key];
      if(!delta)return;
      e.preventDefault(); const rect=node.getBoundingClientRect(); resize(rect.width+delta[0],rect.height+delta[1]);
    });
    try {const saved=JSON.parse(read(layoutKey+':'+kind,'null')); if(saved && Number.isFinite(saved.width)&&Number.isFinite(saved.height)) resize(saved.width,saved.height);}catch{}
  }
  function showBox(kind, anchor) {
    if(active===kind){closeBox();return;}
    closeBox(false);active=kind;trigger=anchor;anchor.setAttribute('aria-expanded','true');
    box=el('section',undefined,'prt-box prt-'+kind);box.setAttribute('role','dialog');
    const heading=kind==='notes'?'포스트잇':'전체보기';box.setAttribute('aria-label',heading);
    const head=el('header');head.append(el('h2',heading),button('닫기',()=>closeBox()));box.append(head);
    body=el('div',undefined,'prt-body');box.append(body);document.body.append(box);
    attachResize(box,heading,{x:-1,y:1},s=>{box.style.width=s.width+'px';box.style.height=s.height+'px';},()=>[Math.min(245,innerWidth-20),innerWidth-20,175,innerHeight-20]);
    if(kind==='notes')renderNotes(currentPage);else renderOverview();
    head.lastChild.focus();
  }
  function renderNotes(page) {
    memoPage=page;body.replaceChildren();
    const heading=el('label','제출본 '+page+'쪽');heading.htmlFor='prt-memo';
    memoInput=el('textarea');memoInput.id='prt-memo';memoInput.rows=5;memoInput.maxLength=6000;memoInput.disabled=!noteSession?.loaded;memoInput.value=memoValue(page);memoInput.placeholder='이 쪽에 남길 메모';
    const status=el('small');status.dataset.status='';status.setAttribute('role','status');
    const retry=button('다시 시도',async()=>{const state=noteSession;if(!state)return;if(!state.loaded&&!state.loading)await loadRemote(state);if(state.pending.size)await flushState(state);});retry.dataset.retry='';
    const counter=el('small');counter.textContent=memoInput.value.length.toLocaleString('ko-KR')+' / 6,000자';const rows=el('div',undefined,'prt-actions');const updated=()=>drawTabs();
    memoInput.addEventListener('input',()=>{
      counter.textContent=memoInput.value.length.toLocaleString('ko-KR')+' / 6,000자';updateMemo(page,memoInput.value);
      updated();
    });
    rows.append(status,counter,retry);
    const list=el('div',undefined,'prt-saved');list.setAttribute('aria-label','메모가 있는 쪽');
    function drawTabs(){
      const pages=memoNumbers(); list.replaceChildren();
      if(pages.length)list.append(el('h3','메모가 있는 쪽'));
      for(const n of pages){
        const b=button(n+'쪽',()=>{renderNotes(n);gotoPage(n);});
        b.setAttribute('aria-current',n===page?'page':'false');b.title=memoValue(n).slice(0,100);list.append(b);
      }
      markPages();
    }
    list.addEventListener('refresh',drawTabs);body.append(heading,memoInput,rows,list);drawTabs();redrawMemoState();
  }
  function markPages() {
    const withMemos=new Set(memoNumbers());
    for(const page of document.querySelectorAll('.paper-page[data-page]')){
      const n=pageFrom(page.dataset.page); const old=page.querySelector(':scope > .prt-note-marker');
      if(!n||!withMemos.has(n)){old?.remove();continue;}
      if(old)continue;
      const b=button('메모',()=>{if(active!=='notes')showBox('notes',tools.querySelector('[data-tool="notes"]'));renderNotes(n);},n+'쪽 포스트잇 열기');
      b.className='prt-note-marker';page.append(b);
    }
  }
  function renderOverview() {
    body.replaceChildren();
    const actions=el('div',undefined,'prt-actions');
    const fullscreen=button(document.fullscreenElement?'전체 화면 종료':'전체 화면',async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen(); closeBox();}
      catch {fullscreen.textContent='이 환경에서는 전체 화면을 사용할 수 없습니다.';}
    });
    actions.append(el('span','논문 255쪽'),fullscreen);
    const grid=el('div',undefined,'prt-grid');
    for(let n=1;n<=pageCount;n++){
      const b=button(String(n),()=>{closeBox(false);gotoPage(n);},'제출본 '+n+'쪽으로 이동');
      if(n===currentPage)b.setAttribute('aria-current','page');
      grid.append(b);
    }
    body.append(actions,grid);requestAnimationFrame(()=>grid.querySelector('[aria-current="page"]')?.scrollIntoView({block:'nearest'}));
  }
  function mountTools(header) {
    const slot=header.querySelector('.reader-tools-slot')||header.querySelector('nav')||header;
    tools=el('div',undefined,'prt-tool-row');tools.setAttribute('aria-label','논문 열람 도구');
    const lookup=el('a','어학사전');lookup.href=dictionaryURL;lookup.target='lawinus-glossary';lookup.rel='noopener noreferrer';
    lookup.addEventListener('click',e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&openDictionary())e.preventDefault();});
    tools.append(lookup);
    for(const [kind,title] of [['overview','전체보기'],['notes','포스트잇']]){
      const b=button(title,()=>showBox(kind,b));b.dataset.tool=kind;b.setAttribute('aria-expanded','false');tools.append(b);
    }
    slot.append(tools);
  }
  let wasAdmitted=false;
  function clearSessionMemos(dropCache=true){
    if(noteSession){clearTimeout(noteSession.timer);noteSession.controller.abort();noteSession=null;}
    if(dropCache)try{sessionStorage.removeItem(cacheKey);}catch{}
  }
  function autoDictionary(){
    try{
      const ordinary=!location.hash&&[...explicit.keys()].every(k=>k==='v');
      if(ordinary&&window.top===window.self&&!sessionStorage.getItem('paper:glossary-attempt')&&Number(read('lawinus.glossary-autostart.pause-until.v1','0'))<=Date.now()){
        sessionStorage.setItem('paper:glossary-attempt','1');openDictionary();
      }
    }catch{}
  }
  function sync() {
    const header=document.querySelector('.examiner-header');
    const admitted=Boolean(header&&document.querySelector('.manuscript-pane')&&!document.querySelector('.gate'));
    if(!admitted){
      if(wasAdmitted){closeBox(false);clearSessionMemos();tools?.remove();wasAdmitted=false;}
      return;
    }
    syncLogin();if(!wasAdmitted){wasAdmitted=true;autoDictionary();}
    if(!document.querySelector('.prt-tool-row'))mountTools(header);
    const toc=document.querySelector('.toc-pane');
    if(toc&&!toc.querySelector(':scope > .prt-grip')){
      attachResize(toc,'목차 메뉴',{x:1,y:1},({width,height})=>{
        const layout=toc.closest('.reader-layout'); layout?.style.setProperty('--toc-width',width+'px');
        toc.style.setProperty('--prt-toc-width',width+'px');toc.style.setProperty('--prt-toc-height',height+'px');
      },()=>[Math.min(150,innerWidth-20),Math.min(640,innerWidth-20),125,Math.max(125,innerHeight-(header?.getBoundingClientRect().height||0)-12)]);
    }
    markPages();
  }
  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});}
  window.addEventListener('paper:page',e=>{const n=pageFrom(e.detail?.page);if(!n)return;currentPage=n;if(active==='notes'&&memoPage!==n)renderNotes(n);});

  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box){closeBox();e.preventDefault();}});
  const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});schedule();
})();
