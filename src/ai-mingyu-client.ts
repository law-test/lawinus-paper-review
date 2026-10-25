import {bridgeRequest,mingyuBridgeActive} from './ai-mingyu-bridge.ts';
import {AI_MINGYU_ENABLED,AI_MINGYU_PAUSED_MESSAGE} from './ai-mingyu-availability.ts';
export const MINGYU_ENDPOINT='http://127.0.0.1:43164';
export const MINGYU_SESSION_KEY='lawinus.ai-mingyu.private-session.v1';
export type Evidence={id:string;label:string;href:string;kind?:string;edition?:string};
export type AnswerSection={kind:'current_law'|'foreign_law'|'research_method'|'author_interpretation'|'proposal'|'limitations';title:string;text:string;citationIds:string[]};
export type MingyuAnswer={summary:string;sections:AnswerSection[];citations:Evidence[]};
export const sectionLabels={current_law:'현행법·판례',foreign_law:'외국법·비교제도',research_method:'자료·연구방법',author_interpretation:'필자 해석',proposal:'개정안',limitations:'연구범위·한계'};
export function evidenceHref(value:string):string|null{
 try{const url=new URL(value,'https://paper.lawinus.org/');return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export async function mingyuRequest<T>(path:string,token:string,body?:unknown,signal?:AbortSignal,method?:string):Promise<T>{
 if(!AI_MINGYU_ENABLED)throw new Error(AI_MINGYU_PAUSED_MESSAGE);
 if(mingyuBridgeActive())return bridgeRequest<T>(path,body,signal,method);
 if(token==='bridge')throw new Error('이 PC의 연결창을 다시 열어 주세요. 사용하는 동안 연결창을 열어 두어야 합니다.');
 const controller=new AbortController();let timedOut=false;
 const cancel=()=>controller.abort(signal?.reason);
 if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},path==='/ask'?120000:15000);
 try{
  const response=await fetch(MINGYU_ENDPOINT+path,{method:method||(body===undefined?'GET':'POST'),headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  const data=await response.json().catch(()=>({error:'연결 프로그램의 응답을 읽을 수 없습니다.'}));
  if(timedOut)throw new Error('timeout');
  if(!response.ok)throw new Error(response.status===401?'비공개 연결이 만료되었습니다. 연결 코드를 다시 입력해 주세요.':typeof data.error==='string'?data.error:'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return data as T;
 }catch(error){
  if(timedOut&&path==='/ask'&&body&&typeof body==='object'&&'requestId' in body&&typeof body.requestId==='string')void mingyuRequest('/cancel',token,{requestId:body.requestId}).catch(()=>{});
  if(timedOut)throw new Error(path==='/ask'?'답변 시간이 길어 요청을 종료했습니다. 잠시 후 다시 질문해 주세요.':'이 PC의 연결 도우미에 연결하지 못했습니다. 도우미 실행 상태와 브라우저의 로컬 네트워크 연결 알림을 확인해 주세요. 앱 안의 브라우저에서 멈추면 Edge에서 같은 주소를 열어 주세요.');
  throw error;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
