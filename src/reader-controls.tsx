import React from 'react';
import {createPortal} from 'react-dom';

/** Moving controls does not move or remount the document's scrollport. */
export default function ReaderControls({host,children}:{host?:HTMLElement|null;children:React.ReactNode}){
  return host===undefined?<>{children}</>:host?createPortal(children,host):null;
}
