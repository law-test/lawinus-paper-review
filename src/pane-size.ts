export function clampPaneSize(value:number,min:number,max:number){
  return Math.min(Math.max(min,max),Math.max(min,Number.isFinite(value)?value:min));
}

export function draggedPaneSize(startValue:number,startX:number,currentX:number,unitsPerPixel:number,min:number,max:number){
  return clampPaneSize(startValue+(currentX-startX)*unitsPerPixel,min,max);
}

export function keyboardPaneSize(key:string,value:number,min:number,max:number,step:number,axis:'x'|'y'='x'):number|null{
  if(key==='Home')return min;
  if(key==='End')return max;
  if(key===(axis==='y'?'ArrowUp':'ArrowLeft'))return clampPaneSize(value-step,min,max);
  if(key===(axis==='y'?'ArrowDown':'ArrowRight'))return clampPaneSize(value+step,min,max);
  return null;
}
