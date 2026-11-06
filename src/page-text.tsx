import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ReaderError,type Session} from './reader-api';
import {pageCache} from './visible-page-cache';

export type Rect={x:number;y:number;w:number;h:number};
export type TextLine=Rect&{text:string;size?:number};
export type PageTarget=Rect&{kind:'law'|'case'|'note'|'cross';number?:number;targetPage?:number;noteNumber?:number;sourceId?:string;title?:string;label?:string;url?:string;status?:string;articleText?:string;start?:number;end?:number};
type PageMetadata={lines:TextLine[];targets:PageTarget[];width?:number;height?:number};
export type InlineLink={start:number;end:number;target:PageTarget};

function box(r:Rect){return [r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0&&r.x>=-.015&&r.y>=-.015&&r.x<1.02&&r.y<1.02;}
const openMetadata=pageCache<PageMetadata>(12,2*1024*1024,async response=>{
  const raw=(await response.json()) as PageMetadata;
  if(!Array.isArray(raw.lines))throw Error('쪽의 문자 정보를 확인하지 못했습니다.');
  return {...raw,lines:raw.lines.filter(line=>typeof line.text==='string'&&box(line)),targets:(raw.targets||[]).filter(box)};
},data=>data.lines.reduce((bytes,line)=>bytes+line.text.length*2+80,0)+data.targets.reduce((bytes,t)=>bytes+(t.articleText?.length||0)*2+128,0));

const mapCache=new Map<number,Promise<PageTarget[]>>();
function pageMap(page:number){
  let pending=mapCache.get(page);
  if(!pending){
    pending=fetch(new URL('link-maps/'+page+'.json',document.baseURI),{credentials:'same-origin',referrerPolicy:'no-referrer'}).then(async r=>{
      if(!r.ok)throw Error('쪽의 링크를 불러오지 못했습니다.');
      const data=await r.json();if(data.page!==page||!Array.isArray(data.targets))throw Error('쪽 링크 정보가 맞지 않습니다.');
      return (data.targets as PageTarget[]).filter(box);
    });
    mapCache.set(page,pending);pending.catch(()=>{if(mapCache.get(page)===pending)mapCache.delete(page);});
    while(mapCache.size>12)mapCache.delete(mapCache.keys().next().value!);
  }else{mapCache.delete(page);mapCache.set(page,pending);}
  return pending;
}
export function usePageMetadata(session:Session,query:string,active=true,textAllowed=false) {
  const [state,setState]=useState<{query:string;token:string;data?:PageMetadata;error?:string}>({query:'',token:''});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!active)return;
    let alive=true,timer=0;
    const params=new URLSearchParams(query),page=params.get('metadata')==='page'?Number(params.get('page')):0;
    let targets:PageTarget[]=[],lines:TextLine[]=[];
    const publish=()=>{if(alive)setState({query,token:session.token,data:{lines,targets}});};
    if(page>0&&page<=255){
      pageMap(page).then(value=>{targets=value;publish();},()=>{if(alive)setState({query,token:session.token,error:'쪽 링크를 불러오지 못했습니다.'});});
    }
    if(!textAllowed)return ()=>{alive=false;};
    const item=openMetadata(session,query);
    item.promise.then(data=>{lines=data.lines;if(!page)targets=data.targets;publish();},e=>{
      if(!alive)return;
      if(e instanceof ReaderError&&e.status===429)timer=window.setTimeout(()=>setAttempt(v=>v+1),e.wait*1000);
      setState({query,token:session.token,data:{lines,targets},error:'글자를 불러오지 못했습니다.'});
    });
    return ()=>{alive=false;clearTimeout(timer);item.release();};
  },[session,query,active,attempt,textAllowed]);
  return {data:active&&state.token===session.token&&state.query===query?state.data:undefined,error:active&&state.token===session.token&&state.query===query?state.error:undefined,retry:()=>setAttempt(v=>v+1)};
}

export function officialURL(raw?:string){
  if(!raw)return undefined;
  try{
    const link=new URL(raw);
    const host=link.hostname;
    const allowed=['law.go.kr','scourt.go.kr','assembly.go.kr','elaw.klri.re.kr','gesetze-im-internet.de','e-gov.go.jp','japaneselawtranslation.go.jp','uscode.house.gov','govinfo.gov','bundesgerichtshof.de','gesetze-bayern.de','dejure.org','courts.go.jp'];
    return link.protocol==='https:'&&!link.username&&!link.password&&allowed.some(domain=>host===domain||host.endsWith('.'+domain))?link.href:undefined;
  }catch{return undefined;}
}
export function targetLabel(t:PageTarget){return t.label||t.title||((t.kind==='note'||t.kind==='cross')?'각주 '+t.number:'원문 확인');}
function positioning(r:Rect){return {left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'};}
const within=(p:{x:number;y:number},r:Rect)=>p.x>=r.x&&p.y>=r.y&&p.x<=r.x+r.w&&p.y<=r.y+r.h;
const targetPriority=(t:PageTarget)=>t.kind==='note'||t.kind==='cross'?0:1;

export function PageLayer({session,query,active=true,fallback=[],label,onTarget,textAllowed=false}:{session:Session;query:string;active?:boolean;fallback?:PageTarget[];label:string;textAllowed?:boolean;onTarget?:(t:PageTarget)=>void}){
  const {data,error,retry}=usePageMetadata(session,query,active,textAllowed);
  const host=useRef<HTMLDivElement>(null);
  const start=useRef<{x:number;y:number}|null>(null);
  const [size,setSize]=useState({w:0,h:0});
  useLayoutEffect(()=>{
    const node=host.current;if(!node)return;
    const update=()=>{const r=node.getBoundingClientRect();setSize(prev=>prev.w===r.width&&prev.h===r.height?prev:{w:r.width,h:r.height});};
    update();const observer=new ResizeObserver(update);observer.observe(node);return()=>observer.disconnect();
  },[active]);
  const targets=[...(data?.targets||[]),...fallback.filter(f=>!(data?.targets||[]).some(t=>t.kind===f.kind&&t.number===f.number&&Math.abs(t.x-f.x)<.015&&Math.abs(t.y-f.y)<.01))].sort((a,b)=>targetPriority(a)-targetPriority(b)||a.w*a.h-b.w*b.h);
  function activate(t:PageTarget){
    onTarget?.(t);
  }
  function hit(e:React.MouseEvent){
    const r=host.current!.getBoundingClientRect();if(!r.width||!r.height)return;
    const p={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
    return targets.find(t=>within(p,t));
  }
  if(!active)return null;
  return <div ref={host} className={'page-text-layer'+(data?.lines?.length?' has-text':' links-only')} aria-label={label}
    onMouseMove={e=>{const n=host.current!;const t=hit(e); const title=t?targetLabel(t):'';if(n.title!==title)n.title=title;n.style.cursor=t?'pointer':data?.lines?.length?'text':'default';}}
    onCopy={e=>{
      const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return;
      // Ignore selections extending beyond this page so normal multi-page copy remains available.
      const range=selection.getRangeAt(0);
      if(!host.current?.contains(range.commonAncestorContainer))return;
      e.clipboardData.setData('text/plain',selection.toString());e.preventDefault();
    }}
    onPointerDown={e=>{start.current={x:e.clientX,y:e.clientY};}}
    onClick={e=>{
      if(!start.current||e.detail>1||Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y)>4||window.getSelection()?.isCollapsed===false)return;
      const t=hit(e);if(t)activate(t);
    }}>
    {data?.lines.map((line,i)=><TextRun key={i} line={line} width={size.w} height={size.h}/>)}
    {onTarget&&targets.map((t,i)=>{const url=officialURL(t.url);const name=t.kind==='law'?'조문':t.kind==='case'?'판례':'각주';
      const cls='page-link '+t.kind+'-link';const props={className:cls,style:positioning(t),title:targetLabel(t),'aria-label':name+' 열기 · '+targetLabel(t)};
      return url?<a key={i} {...props} href={url} target="_blank" rel="noopener noreferrer" onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();e.stopPropagation();activate(t);}}}/>: 
        (((t.kind==='note'||t.kind==='cross')&&t.number||t.articleText||t.status)?<button type="button" key={i} {...props} onClick={e=>{e.stopPropagation();activate(t);}}/>:null);
    })}
    {error&&<button type="button" className="text-error" onClick={e=>{e.stopPropagation();retry();}}>다시 불러오기</button>}
  </div>;
}
let canvas:CanvasRenderingContext2D|null=null;
const font='Arial,"Malgun Gothic",sans-serif';
function TextRun({line,width,height}:{line:TextLine;width:number;height:number}){
  const h=line.h*height;
  if(!canvas)canvas=document.createElement('canvas').getContext('2d');
  const fontSize=Math.max(.1,h*.90);if(canvas)canvas.font=fontSize+'px '+font;
  const measured=canvas?.measureText(line.text).width||1;
  return <span className="page-text-run" style={{left:line.x*100+'%',top:line.y*100+'%',height:h,fontSize,lineHeight:h+'px',fontFamily:font,transform:'scaleX('+line.w*width/measured+')'}}>{line.text}</span>;
}

export function NoteText({text,links,onTarget}:{text:string;links:InlineLink[];onTarget:(t:PageTarget)=>void}){
  let cursor=0;const parts:React.ReactNode[]=[];
  for(const link of [...links].sort((a,b)=>a.start-b.start)){
    if(link.start<cursor||link.end<=link.start||link.end>text.length)continue;
    const url=officialURL(link.target.url),internal=link.target.kind==='note'||link.target.kind==='cross';if(!internal&&!url&&!link.target.articleText&&!link.target.status)continue;
    parts.push(text.slice(cursor,link.start));
    const phrase=text.slice(link.start,link.end);
    parts.push((internal||!url)?<button key={link.start} type="button" className="inline-note-link" onClick={()=>onTarget(link.target)}>{phrase}</button>:
      <a key={link.start} href={url} className="inline-note-link" target="_blank" rel="noopener noreferrer" onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey){e.preventDefault();onTarget(link.target);}}}>{phrase}</a>);
    cursor=link.end;
  }
  parts.push(text.slice(cursor));return <>{parts}</>;
}

export function LegalInfo({target,close}:{target:PageTarget;close:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;if(!dialog)return;dialog.showModal();return()=>{if(dialog.open)dialog.close();};},[]);
  const status:Record<string,string>={current:'현행',historical:'연혁',foreign:'외국법',proposal:'입법안',unresolved:'출전 확인 필요'};
  const url=officialURL(target.url);
  return <dialog ref={ref} className="law-popup" aria-label={target.kind==='case'?'판례 열람':'조문 열람'} onCancel={close} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}}>
    <header><span>{target.kind==='case'?'판례':'조문'}{target.status&&' · '+(status[target.status]||target.status)}</span><button type="button" onClick={close}>닫기</button></header>
    <h2>{target.title||target.label}</h2>{target.articleText&&<p>{target.articleText}</p>}{url&&<a href={url} target="_blank" rel="noopener noreferrer">공식 원문 열기 ↗</a>}
  </dialog>;
}

// Source rectangles refer to the printed page. The side panel quotes the same note without line wrapping.
export function inlineLinks(text:string,noteNumber:number,targets:PageTarget[]):InlineLink[]{
  const links:InlineLink[]=[];
  for(const t of targets){
    if((t.noteNumber??(t.sourceId?t.number:undefined))!==noteNumber||(t.kind==='note'&&!t.sourceId))continue;
    const label=(t.label||'').trim();if(!label)continue;
    const compact=label.replace(/\s/g,'');
    if(t.start!==undefined&&t.end!==undefined&&text.slice(t.start,t.end).replace(/\s/g,'')===compact){links.push({start:t.start,end:t.end,target:t});continue;}
    const escaped=Array.from(compact,c=>((c==='\\'||'^$.*+?()[]{}|'.includes(c))?'\\':'')+c).join('\\s*');
    for(const match of text.matchAll(new RegExp(escaped,'g')))links.push({start:match.index!,end:match.index!+match[0].length,target:t});
  }
  return links.filter((link,i)=>!links.some((other,j)=>j!==i&&other.start===link.start&&other.end===link.end&&(
    other.target.kind!==link.target.kind||other.target.url!==link.target.url||other.target.number!==link.target.number||other.target.sourceId!==link.target.sourceId
  )));
}
