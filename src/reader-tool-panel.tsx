import React,{useLayoutEffect,useRef,useState} from 'react';
import PaneResizer from './pane-resizer';
import {boundedPanelHeight} from './workspace-layout';

type Props={label:string;className:string;height:number|null;available:number;onChange:(height:number)=>void;onReset:()=>void;children:React.ReactNode};

/** The controls keep their state while their viewport shrinks all the way to zero. */
export default function ReaderToolPanel({label,className,height,available,onChange,onReset,children}:Props){
  const panel=useRef<HTMLDivElement>(null),[measured,setMeasured]=useState(0);
  const maximum=boundedPanelHeight(900,available,0,.7,160);
  const rendered=height===null?undefined:boundedPanelHeight(height,available,0,.7,160);
  useLayoutEffect(()=>{const element=panel.current;if(!element)return;const measure=()=>setMeasured(element.getBoundingClientRect().height);measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[]);
  return <>
    <div ref={panel} className={'reader-tool-panel '+className} data-collapsed={rendered===0?'true':undefined} inert={rendered===0} aria-hidden={rendered===0?true:undefined} style={{height:rendered,flexBasis:rendered,maxHeight:maximum}}>{children}</div>
    <PaneResizer axis="y" className={'reader-tools-divider '+className+'-divider'} label={label} value={rendered??measured} getValue={()=>panel.current?.getBoundingClientRect().height??rendered??measured} min={0} max={maximum} unit="픽셀" step={16} onChange={onChange} onReset={onReset}/>
  </>;
}
