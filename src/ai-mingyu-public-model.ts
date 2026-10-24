import type {MingyuAnswer} from './ai-mingyu-client';
export type PublicAnswer={id:string;question:string;category:string;answer:MingyuAnswer};
export const normalizePublicQuestion=(value:string)=>value.normalize('NFKC').toLowerCase().trim().replace(/\s+/gu,'').replace(/[?!？！]+$/u,'');
const tokens=(value:string)=>[...new Set((value.toLowerCase().match(/[가-힣a-z0-9]{2,}/gu)||[]).flatMap(word=>[word,...Array.from({length:Math.max(0,word.length-1)},(_,i)=>word.slice(i,i+2))]))];
export function publicAnswerIndex(items:PublicAnswer[]){
 const exact=new Map<string,PublicAnswer[]>(),postings=new Map<string,Map<string,number>>(),byId=new Map(items.map(item=>[item.id,item]));
 for(const item of items){const key=normalizePublicQuestion(item.question);exact.set(key,[...(exact.get(key)||[]),item]);const questionTokens=new Set(tokens(item.question)),answerTokens=new Set(tokens(item.answer.sections.map(s=>s.text).join(' ')));for(const token of new Set([...questionTokens,...answerTokens])){const entries=postings.get(token)||new Map<string,number>();entries.set(item.id,(questionTokens.has(token)?Math.min(6,token.length)*3:0)+(answerTokens.has(token)?Math.min(3,token.length):0));postings.set(token,entries);}}
 return {
  exact(question:string,id?:string){const key=normalizePublicQuestion(question);if(id){const item=byId.get(id);return item&&normalizePublicQuestion(item.question)===key?item:null;}const found=exact.get(key)||[];return found.length===1?found[0]:null;},
  search(question:string){const scores=new Map<string,number>();for(const token of tokens(question))for(const[id,score]of postings.get(token)||[])scores.set(id,(scores.get(id)||0)+score);return [...scores].filter(([,score])=>score>=10).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,5).map(([id])=>byId.get(id)!);}
 };
}
export const plainLegalTerms=[
 ['채권','다른 사람에게 돈을 지급하거나 일정한 일을 하라고 요구할 수 있는 권리'],
 ['채무','상대방에게 돈을 지급하거나 일정한 일을 해야 하는 의무'],
 ['배당','경매 등으로 마련된 돈을 법이 정한 순서와 비율에 따라 채권자들에게 나누는 절차'],
 ['인가','법원이 계획 등을 심사하여 승인하는 결정'],
 ['면책','법이 정한 범위에서 채무에 대한 책임을 면하게 하는 것. 모든 채무가 언제나 면책되는 것은 아닙니다.'],
 ['실효','법적 효력을 잃는 것. 무엇이 언제 효력을 잃는지는 해당 조문과 사실관계에 따라 구별합니다.'],
 ['집행권원','강제집행의 근거가 되는 판결 등 법률이 정한 문서'],
 ['우선변제권','법이 정한 요건을 갖춘 때 다른 채권자보다 먼저 변제받을 수 있는 권리']
] as const;
export function termsForAnswer(answer:MingyuAnswer){const text=answer.sections.map(s=>s.text).join(' ');return plainLegalTerms.filter(([term])=>text.includes(term));}
