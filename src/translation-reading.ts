export type TranslationMode='original'|'translation'|'parallel';
export type TranslationLayout='horizontal'|'vertical';
export type TranslationView={version:1;mode:TranslationMode;layout:TranslationLayout;splitX:number;splitY:number};
export type TranslationPosition={version:1;block:string;page:number;fraction:number;top:number;left:number;width:number;scrollWidth:number;scrollHeight:number};
type Store=Pick<Storage,'getItem'|'setItem'>;
const object=(v:unknown):Record<string,unknown>|undefined=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:undefined;
const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function translationViewKey(key:string){return 'lawinus.translation-view.v1:'+key;}
export function translationPositionKey(key:string,side:'original'|'translation'){return `lawinus.translation-position.v1:${side}:${key}`;}
export function defaultTranslationView(narrow=false):TranslationView{return {version:1,mode:'parallel',layout:narrow?'vertical':'horizontal',splitX:50,splitY:50};}
export function readTranslationView(storage:Store|undefined,key:string,narrow=false):TranslationView{
 const fallback=defaultTranslationView(narrow);
 try{const raw=storage?.getItem(translationViewKey(key));if(!raw||raw.length>2048)return fallback;const p=object(JSON.parse(raw));if(p?.version!==1)return fallback;
  return {version:1,mode:['original','translation','parallel'].includes(String(p.mode))?p.mode as TranslationMode:fallback.mode,layout:p.layout==='horizontal'||p.layout==='vertical'?p.layout:fallback.layout,splitX:finite(p.splitX,25,75)?p.splitX:50,splitY:finite(p.splitY,25,75)?p.splitY:50};
 }catch{return fallback;}
}
export function writeTranslationView(storage:Store|undefined,key:string,view:TranslationView){try{storage?.setItem(translationViewKey(key),JSON.stringify(view));}catch{}}
export function parseTranslationPosition(raw:string|null,total:number):TranslationPosition|null{
 if(!raw||raw.length>4096)return null;
 try{const p=object(JSON.parse(raw));if(p?.version!==1||typeof p.block!=='string'||!p.block||p.block.length>200||!Number.isInteger(p.page)||!finite(p.page,1,total)||!finite(p.fraction,0,1)||!finite(p.top,0,10000000)||!finite(p.left,0,10000000)||!finite(p.width,1,100000)||!finite(p.scrollWidth,1,10000000)||!finite(p.scrollHeight,1,10000000))return null;
  return {version:1,block:p.block,page:p.page,fraction:p.fraction,top:p.top,left:p.left,width:p.width,scrollWidth:p.scrollWidth,scrollHeight:p.scrollHeight};
 }catch{return null;}
}
export function restoredTranslationPosition(saved:TranslationPosition,box:{width:number;scrollWidth:number;scrollHeight:number;height:number;blockTop:number;blockHeight:number}){
 const same=Math.abs(saved.width-box.width)<.5&&Math.abs(saved.scrollHeight-box.scrollHeight)<.5;
 return {top:Math.max(0,Math.min(box.scrollHeight-box.height,same?saved.top:box.blockTop+box.blockHeight*saved.fraction)),left:Math.max(0,Math.min(box.scrollWidth-box.width,saved.left*box.scrollWidth/saved.scrollWidth))};
}
