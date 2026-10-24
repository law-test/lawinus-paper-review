export const MINGYU_ENDPOINT='http://127.0.0.1:43164';
export const MINGYU_SESSION_KEY='lawinus.ai-mingyu.private-session.v1';
export type Evidence={id:string;label:string;href:string;kind?:string;edition?:string};
export type AnswerSection={kind:'current_law'|'author_interpretation'|'proposal'|'limitations';title:string;text:string;citationIds:string[]};
export type MingyuAnswer={summary:string;sections:AnswerSection[];citations:Evidence[]};
export const sectionLabels={current_law:'현행법·판례',author_interpretation:'필자 해석',proposal:'개정안',limitations:'연구한계·확인 필요'};
export function evidenceHref(value:string):string|null{
 try{const url=new URL(value,'https://paper.lawinus.org/');return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export async function mingyuRequest<T>(path:string,token:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch(MINGYU_ENDPOINT+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
 const data=await response.json().catch(()=>({error:'연결 프로그램의 응답을 읽을 수 없습니다.'}));
 if(!response.ok)throw new Error(response.status===401?'비공개 연결이 만료되었습니다. 연결 코드를 다시 입력해 주세요.':typeof data.error==='string'?data.error:'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
 return data as T;
}
