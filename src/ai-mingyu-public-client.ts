import type {MingyuAnswer,AnswerSection,Evidence} from './ai-mingyu-client';
import {answerLevel,type AnswerLevel} from './ai-mingyu-level';
export const PUBLIC_MINGYU_ENDPOINT='https://cefaekvclooytgjkcqum.supabase.co/functions/v1/ai-mingyu';
const deviceKey='lawinus.mingyu.public-device.v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds=new Set(['current_law','foreign_law','research_method','author_interpretation','proposal','limitations']);
const evidenceKinds=new Set(['paper','footnote','law','source']);
let transientDevice='';
type RecordValue=Record<string,unknown>;
function record(value:unknown):value is RecordValue{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function boundedText(value:unknown,max:number){return typeof value==='string'&&value.trim().length>0&&value.length<=max;}
function publicDeviceId(){
 try{const saved=localStorage.getItem(deviceKey);if(saved&&uuid.test(saved))return saved;}catch{}
 const id=transientDevice||(transientDevice=crypto.randomUUID());
 try{localStorage.setItem(deviceKey,id);}catch{}
 return id;
}
export type PublicMingyuResult={answer:MingyuAnswer;level:AnswerLevel;source:'faq'|'cache'|'model';model?:string;elapsedMs?:number;generatedAt?:string;evidenceDate?:string};
export function validatePublicAnswer(value:unknown):MingyuAnswer{
 if(!record(value)||!boundedText(value.summary,3000)||!Array.isArray(value.sections)||value.sections.length<1||value.sections.length>24||!Array.isArray(value.citations)||value.citations.length>100)throw new Error('답변 형식을 확인하지 못했습니다. 다시 질문해 주세요.');
 const citations:Evidence[]=[],ids=new Set<string>();
 for(const c of value.citations){
  if(!record(c)||!boundedText(c.id,160)||!boundedText(c.label,1000)||!boundedText(c.href,2500)||typeof c.kind!=='string'||!evidenceKinds.has(c.kind)||ids.has(c.id as string))throw new Error('답변 근거를 확인하지 못했습니다. 다시 질문해 주세요.');
  let url:URL;try{url=new URL(c.href as string);}catch{throw new Error('답변 근거 링크를 확인하지 못했습니다.');}
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('답변 근거 링크를 확인하지 못했습니다.');
  ids.add(c.id as string);citations.push({id:c.id as string,label:c.label as string,href:url.href,kind:c.kind,...(boundedText(c.edition,500)?{edition:c.edition as string}:{})});
 }
 const sections:AnswerSection[]=value.sections.map(s=>{
  if(!record(s)||typeof s.kind!=='string'||!kinds.has(s.kind)||!boundedText(s.title,300)||!boundedText(s.text,10000)||!Array.isArray(s.citationIds)||(s.kind!=='limitations'&&s.citationIds.length<1)||s.citationIds.length>100||s.citationIds.some(id=>typeof id!=='string'||!ids.has(id)))throw new Error('답변의 법적 구분과 근거를 확인하지 못했습니다.');
  return {kind:s.kind as AnswerSection['kind'],title:s.title as string,text:s.text as string,citationIds:[...new Set(s.citationIds as string[])]};
 });
 return {summary:value.summary as string,sections,citations,...(boundedText(value.edition,500)?{edition:value.edition as string}:{}),...(boundedText(value.sourceWarning,1000)?{sourceWarning:value.sourceWarning as string}:{})};
}
async function publicRequest(path:'/status'|'/ask',body?:unknown,signal?:AbortSignal){
 const controller=new AbortController();let timedOut=false;const abort=()=>controller.abort(signal?.reason);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},path==='/status'?5000:120000);
 try{
  const response=await fetch(PUBLIC_MINGYU_ENDPOINT+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  const text=await response.text();if(text.length>240000)throw new Error('답변이 너무 길어 표시하지 못했습니다. 질문을 나누어 보내 주세요.');
  let data:unknown;try{data=JSON.parse(text);}catch{throw new Error('공개 답변 서비스에 연결하지 못했습니다. 잠시 후 다시 질문해 주세요.');}
  if(!response.ok){
   const code=record(data)?data.code:'';
   throw new Error(code==='temporarily_limited'?'지금은 새 답변 요청이 많습니다. 잠시 후 다시 질문하거나 관련 FAQ를 선택해 주세요.':code==='unavailable'?'공개 생성 답변을 연결하는 중입니다. 관련 FAQ를 선택해 주세요.':code==='invalid_request'?'질문 내용을 확인한 뒤 다시 보내 주세요.':'답변을 완성하지 못했습니다. 잠시 후 다시 질문하거나 관련 FAQ를 선택해 주세요.');
  }
  return data;
 }catch(error){if(timedOut)throw new Error('답변 시간이 길어 요청을 종료했습니다. 질문을 나누어 다시 보내 주세요.');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function publicServiceStatus():Promise<boolean>{
 try{const data=await publicRequest('/status');return record(data)&&data.active===true&&data.generationEnabled===true;}catch{return false;}
}
export async function askPublicMingyu(question:string,level:AnswerLevel,requestId:string,signal?:AbortSignal):Promise<PublicMingyuResult>{
 question=question.trim();if(!question||question.length>1800||!uuid.test(requestId))throw new Error('질문 내용을 확인한 뒤 다시 보내 주세요.');
 const selected=answerLevel(level),data=await publicRequest('/ask',{question,level:selected,deviceId:publicDeviceId(),requestId},signal);
 if(!record(data)||data.private!==false||data.requestId!==requestId||data.level!==selected||!['faq','cache','model'].includes(String(data.source)))throw new Error('답변 요청 정보를 확인하지 못했습니다. 다시 질문해 주세요.');
 const result:PublicMingyuResult={answer:validatePublicAnswer(data.answer),level:selected,source:data.source as PublicMingyuResult['source']};
 if(boundedText(data.model,100))result.model=data.model as string;
 if(typeof data.elapsedMs==='number'&&Number.isFinite(data.elapsedMs)&&data.elapsedMs>=0)result.elapsedMs=data.elapsedMs;
 if(typeof data.generatedAt==='string'&&Number.isFinite(Date.parse(data.generatedAt)))result.generatedAt=data.generatedAt;
 if(typeof data.evidenceDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(data.evidenceDate))result.evidenceDate=data.evidenceDate;
 return result;
}
