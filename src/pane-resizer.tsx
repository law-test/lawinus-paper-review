import React,{useCallback,useEffect,useRef,useState} from 'react';
import {draggedPaneSize,keyboardPaneSize} from './pane-size';

type Props={label:string;className?:string;value:number;min:number;max:number;step?:number;unit?:string;axis?:'x'|'y';onChange:(value:number)=>void;unitsPerPixel?:()=>number;onReset?:()=>void;getValue?:()=>number};
type Drag={pointerId:number;startX:number;startValue:number;scale:number;element:HTMLDivElement;cursor:string;userSelect:string};

export default function PaneResizer({label,className='',value,min,max,step=2,unit='%',axis='x',onChange,unitsPerPixel=()=>1,onReset,getValue}:Props){
  const drag=useRef<Drag|null>(null);
  const [active,setActive]=useState(false);
  const finish=useCallback(()=>{
    const previous=drag.current;
    if(!previous)return;
    drag.current=null;
    document.body.style.cursor=previous.cursor;
    document.body.style.userSelect=previous.userSelect;
    if(previous.element.hasPointerCapture(previous.pointerId))previous.element.releasePointerCapture(previous.pointerId);
    setActive(false);
  },[]);
  useEffect(()=>{window.addEventListener('blur',finish);return()=>{window.removeEventListener('blur',finish);finish();};},[finish]);
  return <div className={`pane-resizer ${axis==='y'?'horizontal-resizer ':''}${className}${active?' resizing':''}`} role="separator" aria-label={label} title={`드래그하여 ${axis==='y'?'높이':'너비'} 조절${axis==='y'&&min===0?' · Home 접기 · End 펼치기':''}${onReset?' · 두 번 누르면 초기화':''}`} aria-orientation={axis==='y'?'horizontal':'vertical'} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(value)}${unit}`} aria-valuemin={min} aria-valuemax={max} tabIndex={0} onDoubleClick={onReset}
    onPointerDown={e=>{
      if(e.button!==0||!e.isPrimary)return;
      e.preventDefault();
      finish();
      e.currentTarget.focus({preventScroll:true});
      drag.current={pointerId:e.pointerId,startX:axis==='y'?e.clientY:e.clientX,startValue:getValue?.()??value,scale:unitsPerPixel(),element:e.currentTarget,cursor:document.body.style.cursor,userSelect:document.body.style.userSelect};
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.cursor=axis==='y'?'row-resize':'col-resize';document.body.style.userSelect='none';setActive(true);
    }}
    onPointerMove={e=>{const current=drag.current;if(!current||current.pointerId!==e.pointerId)return;e.preventDefault();onChange(draggedPaneSize(current.startValue,current.startX,axis==='y'?e.clientY:e.clientX,current.scale,min,max));}}
    onPointerUp={e=>{if(drag.current?.pointerId===e.pointerId)finish();}}
    onPointerCancel={e=>{if(drag.current?.pointerId===e.pointerId)finish();}}
    onLostPointerCapture={finish}
    onKeyDown={e=>{const next=keyboardPaneSize(e.key,getValue?.()??value,min,max,unitsPerPixel()<0?-step:step,axis);if(next!==null){e.preventDefault();onChange(next);}}}
  ><span/></div>;
}
