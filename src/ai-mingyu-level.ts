export type AnswerLevel='doctoral'|'undergraduate'|'high-school';
export const answerLevels=[{value:'doctoral',label:'법학박사',description:'법리·반론과 근거를 깊이 있게'},{value:'undergraduate',label:'법학사',description:'핵심 법리와 요건을 차근차근'},{value:'high-school',label:'고졸',description:'쉬운 말과 용어 풀이로'}] as const;
const preferenceKey='lawinus.mingyu.answer-level.v1';
export function answerLevel(value:unknown):AnswerLevel{return value==='doctoral'||value==='high-school'?value:'undergraduate';}
export function readAnswerLevel():AnswerLevel{try{return answerLevel(localStorage.getItem(preferenceKey));}catch{return 'undergraduate';}}
export function saveAnswerLevel(value:AnswerLevel){try{localStorage.setItem(preferenceKey,value);}catch{}}
export const levelLabel=(value?:AnswerLevel)=>answerLevels.find(item=>item.value===answerLevel(value))!.label;
