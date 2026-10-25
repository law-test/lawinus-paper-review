import {AI_MINGYU_ENABLED,AI_MINGYU_PAUSED_MESSAGE} from './ai-mingyu-availability.ts';
const LOCAL_ORIGIN='http://127.0.0.1:43164';
type Pending={resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>;cleanup:()=>void};
let connectionWindow:Window|null=null,connectionId='',connected=false;
let onConnected:(()=>void)|null=null,onClosed:(()=>void)|null=null;
let readyTimer:ReturnType<typeof setTimeout>|undefined;
const pending=new Map<string,Pending>();
function failPending(message:string){for(const p of pending.values()){clearTimeout(p.timer);p.cleanup();p.reject(new Error(message));}pending.clear();}
function receive(event:MessageEvent){
 if(!AI_MINGYU_ENABLED)return;
 if(event.origin!==LOCAL_ORIGIN||event.source!==connectionWindow)return;
 const d=event.data;if(!d||d.id!==connectionId)return;
 if(d.type==='mingyu:ready'){clearTimeout(readyTimer);return;}
 if(d.type==='mingyu:connected'){clearTimeout(readyTimer);connected=true;onConnected?.();return;}
 if(d.type==='mingyu:disconnected'){connected=false;failPending('비공개 연결이 해제되었습니다.');onClosed?.();return;}
 if(d.type!=='mingyu:response'||typeof d.requestId!=='string')return;
 const p=pending.get(d.requestId);if(!p)return;pending.delete(d.requestId);clearTimeout(p.timer);p.cleanup();d.error?p.reject(new Error(String(d.error))):p.resolve(d.data);
}
if(AI_MINGYU_ENABLED&&typeof window!=='undefined')window.addEventListener('message',receive);
export function openMingyuConnection(ready:()=>void,closed:()=>void,unavailable?:(message:string)=>void){
 if(!AI_MINGYU_ENABLED)throw new Error(AI_MINGYU_PAUSED_MESSAGE);
 clearTimeout(readyTimer);
 if(connectionWindow&&!connectionWindow.closed)connectionWindow.close();
 connectionId=crypto.randomUUID();connected=false;onConnected=ready;onClosed=closed;
 failPending('새 연결창을 열었습니다. 다시 질문해 주세요.');
 const fragment=new URLSearchParams({origin:window.location.origin,id:connectionId});
 connectionWindow=window.open(`${LOCAL_ORIGIN}/connect265#${fragment}`,'ai-mingyu-local-'+connectionId,'popup,width=680,height=740');
 if(!connectionWindow)throw new Error('연결창이 열리지 않았습니다. 이 사이트의 연결창 열기를 허용한 뒤 다시 눌러 주세요.');
 readyTimer=setTimeout(()=>unavailable?.('연결창을 확인하지 못했습니다. 이 PC의 연결 도우미가 실행 중인지 확인해 주세요. 앱 안 브라우저에서 창이 보이지 않으면 Edge 또는 Chrome에서 논문 사이트를 열어 주세요.'),10000);
}
export function mingyuBridgeActive(){return AI_MINGYU_ENABLED&&connected&&!!connectionWindow&&!connectionWindow.closed;}
export function bridgeRequest<T>(path:string,body?:unknown,signal?:AbortSignal,method?:string):Promise<T>{
 if(!AI_MINGYU_ENABLED)return Promise.reject(new Error(AI_MINGYU_PAUSED_MESSAGE));
 if(!mingyuBridgeActive())return Promise.reject(new Error('이 PC의 연결창을 다시 열어 주세요. 연결창은 사용하는 동안 열어 두어야 합니다.'));
 const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{
  const abort=()=>{const p=pending.get(requestId);if(!p)return;pending.delete(requestId);clearTimeout(p.timer);p.cleanup();reject(new DOMException('답변을 중지했습니다.','AbortError'));};
  const timer=setTimeout(()=>{pending.delete(requestId);signal?.removeEventListener('abort',abort);reject(new Error(path==='/ask'?'답변 시간이 길어 요청을 종료했습니다.':'연결창의 응답이 없습니다. 이 PC의 연결창을 다시 열어 주세요.'));},path==='/ask'?120000:15000);
  pending.set(requestId,{resolve,reject,timer,cleanup:()=>signal?.removeEventListener('abort',abort)});
  if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
  connectionWindow!.postMessage({type:'mingyu:request',id:connectionId,requestId,path,method:method||(body===undefined?'GET':'POST'),body},LOCAL_ORIGIN);
 });
}
