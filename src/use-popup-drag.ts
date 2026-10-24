import {useLayoutEffect,useRef,useState,type RefObject,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent,type MouseEvent as ReactMouseEvent} from 'react';
import {clampPopupOffset,type PopupOffset} from './popup-position';

type Options={enabled?:boolean;elementRef:RefObject<HTMLElement|null>;margin?:number;topInset?:number|(()=>number);layoutKey?:string|number};
const interactive=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('button,a,input,select,textarea,summary,[contenteditable="true"]');
export function usePopupDrag({enabled=true,elementRef,margin=8,topInset=0,layoutKey}:Options){
 const [offset,setOffset]=useState<PopupOffset>({x:0,y:0}),[dragging,setDragging]=useState(false);
 const current=useRef(offset),rendered=useRef(offset),settings=useRef({enabled,margin,topInset});settings.current={enabled,margin,topInset};
 useLayoutEffect(()=>{rendered.current=offset;},[offset]);
 const start=useRef<{id:number;x:number;y:number;offset:PopupOffset;handle:HTMLElement}|null>(null);
 function move(next:PopupOffset){
  const element=elementRef.current;if(!element)return;
  const r=element.getBoundingClientRect(),v=window.visualViewport,s=settings.current;
  const clamped=clampPopupOffset(next,{left:r.left-rendered.current.x,top:r.top-rendered.current.y,width:r.width,height:r.height},{left:v?.offsetLeft??0,top:v?.offsetTop??0,width:v?.width??window.innerWidth,height:v?.height??window.innerHeight},s.margin,typeof s.topInset==='function'?s.topInset():s.topInset);
  if(Math.abs(clamped.x-current.current.x)<.1&&Math.abs(clamped.y-current.current.y)<.1)return;
  current.current=clamped;setOffset(clamped);
 }
 function end(){const p=start.current;start.current=null;if(p)try{if(p.handle.hasPointerCapture(p.id))p.handle.releasePointerCapture(p.id);}catch{}setDragging(false);}
 function reset(){end();if(settings.current.enabled&&elementRef.current){move({x:0,y:0});return;}current.current={x:0,y:0};setOffset({x:0,y:0});}
 useLayoutEffect(()=>{
  end();
  if(!enabled){reset();return;}
  const element=elementRef.current;if(!element)return;
  let frame=0;
  const fit=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>move(current.current));};
  const resize=()=>{end();fit();};
  const observer=new ResizeObserver(fit);observer.observe(element);
  fit();
  window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',fit);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',fit);const p=start.current;start.current=null;if(p)try{if(p.handle.hasPointerCapture(p.id))p.handle.releasePointerCapture(p.id);}catch{}};
 },[enabled,layoutKey]);
 const handleProps={
  tabIndex:enabled?0:undefined,
  title:enabled?'제목줄을 끌어 이동 · 방향키로 이동 · Home 또는 두 번 누르면 위치 초기화':undefined,
  onPointerDown:(event:ReactPointerEvent<HTMLElement>)=>{if(!enabled||event.button!==0||!event.isPrimary||interactive(event.target))return;event.preventDefault();event.currentTarget.focus({preventScroll:true});start.current={id:event.pointerId,x:event.clientX,y:event.clientY,offset:{...current.current},handle:event.currentTarget};try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}setDragging(true);},
  onPointerMove:(event:ReactPointerEvent<HTMLElement>)=>{const p=start.current;if(!p||p.id!==event.pointerId)return;event.preventDefault();move({x:p.offset.x+event.clientX-p.x,y:p.offset.y+event.clientY-p.y});},
  onPointerUp:(event:ReactPointerEvent<HTMLElement>)=>{if(start.current?.id===event.pointerId)end();},
  onPointerCancel:(event:ReactPointerEvent<HTMLElement>)=>{if(start.current?.id===event.pointerId)end();},
  onLostPointerCapture:()=>{if(start.current){start.current=null;setDragging(false);}},
  onDoubleClick:(event:ReactMouseEvent<HTMLElement>)=>{if(enabled&&!interactive(event.target))reset();},
  onKeyDown:(event:ReactKeyboardEvent<HTMLElement>)=>{if(!enabled||event.target!==event.currentTarget)return;const step=event.shiftKey?48:16;if(event.key==='Home'){event.preventDefault();reset();return;}const delta:Record<string,PopupOffset>={ArrowLeft:{x:-step,y:0},ArrowRight:{x:step,y:0},ArrowUp:{x:0,y:-step},ArrowDown:{x:0,y:step}};const d=delta[event.key];if(d){event.preventDefault();move({x:current.current.x+d.x,y:current.current.y+d.y});}},
 };
 return {offset,handleProps,reset,dragging};
}
