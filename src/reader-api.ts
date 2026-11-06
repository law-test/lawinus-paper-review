const base='https://cefaekvclooytgjkcqum.supabase.co/functions/v1/';
const storageKey='examiner-session';
export type Session={token:string;expiresAt:string|number};
export type Toc={title:string;page:number;level:number};
export type Source={id:string;title:string;kind?:string};
export type Catalog={title:string;subtitle?:string;author?:string;pageCount:number;bodyStartPage:number;textLayersEnabled?:boolean;searchEnabled?:boolean;toc:Toc[];sources:Source[]};
export type Citation={id:string;page?:number;label?:string;excerpt?:string;verified?:boolean;image?:boolean;previewPages?:number[];highlights?:{x:number;y:number;w:number;h:number}[]};
export type Note={number:number;page:number;text:string;sources:Citation[];markers?:{x:number;y:number;w:number;h:number}[]};
export function expiration(value:string|number){
  return typeof value==='number'?(value<1e12?value*1000:value):new Date(value).getTime();
}
export function readSession():Session|null{
  try{const s=JSON.parse(sessionStorage.getItem(storageKey)||'null');return s&&s.mode==='public-visit'&&/^[a-f0-9]{64}$/i.test(s.token)&&expiration(s.expiresAt)>Date.now()+30000?s:null;}
  catch{return null;}
}
export function storeSession(s:Session|null){
  if(s)sessionStorage.setItem(storageKey,JSON.stringify({...s,mode:'public-visit'}));else sessionStorage.removeItem(storageKey);
}
export class ReaderError extends Error{
  constructor(public status:number,public wait:number){
    super(status===429?'열람 요청이 많습니다. 잠시 후 다시 시도해 주세요.':'열람 자료를 불러오지 못했습니다.');
  }
}
async function checked(name:string,options:RequestInit,reviewer=false){
  const response=await fetch(base+name,{...options,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
  if(!response.ok){
    if(reviewer&&(response.status===401||response.status===403))window.dispatchEvent(new Event('paper:expired'));
    throw new ReaderError(response.status,Math.min(120,Number(response.headers.get('Retry-After'))||12));
  }
  return response;
}
let memoryKey='';
function browserKey(){
  try{const saved=localStorage.getItem('paper-reading-browser');if(saved&&/^[a-f0-9]{64}$/i.test(saved))return saved;}catch{}
  if(!memoryKey)memoryKey=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  try{localStorage.setItem('paper-reading-browser',memoryKey);}catch{}
  return memoryKey;
}
export async function visit():Promise<Session>{
  const response=await checked('examiner-visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({browserKey:browserKey()})});
  const result=await response.json();
  if(!/^[a-f0-9]{64}$/i.test(result.token)||!(expiration(result.expiresAt)>Date.now()))throw Error('열람 연결을 시작하지 못했습니다.');
  return {token:result.token,expiresAt:result.expiresAt};
}
export function privateResource(session:Session,query:URLSearchParams,signal:AbortSignal){
  return checked('examiner-page?'+query.toString(),{signal,headers:{Authorization:'Bearer '+session.token}},true);
}
