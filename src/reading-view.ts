export type ReadingView={focus:boolean;header:boolean;tools:boolean;footnotes:boolean};
export type ReadingPane='contents'|'thesis'|'source'|'metadata';
export const DEFAULT_READING_VIEW:ReadingView={focus:false,header:true,tools:true,footnotes:true};

export function readingVisibility(view:ReadingView,sidebar:boolean,metadata:boolean){
  return {header:!view.focus&&view.header,tools:!view.focus&&view.tools,footnotes:!view.focus&&view.footnotes,sidebar:!view.focus&&sidebar,metadata:!view.focus&&metadata};
}
export function readingPane(view:ReadingView,pane:ReadingPane):ReadingPane{
  return view.focus&&pane!=='source'?'thesis':pane;
}
export function withReadingFocus(view:ReadingView,focus:boolean):ReadingView{
  return {...view,focus};
}
