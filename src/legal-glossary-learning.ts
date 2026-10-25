import type {GlossaryLanguage} from './legal-glossary-model.ts';

export type LearningExample={entryId:string;language:GlossaryLanguage;kind:'authored-learning';text:string;translation:string;speechText?:string};
export function parseLearningExamples(value:unknown):Map<string,LearningExample>{
 const items=value&&typeof value==='object'&&'items' in value?(value as {items:unknown}).items:null;
 if(!Array.isArray(items))throw new Error('invalid-learning-examples');
 const result=new Map<string,LearningExample>();
 for(const item of items){
  if(!item||typeof item!=='object'||typeof item.entryId!=='string'||!item.entryId||result.has(item.entryId)||!['en','de','ja'].includes(item.language)||item.kind!=='authored-learning'||typeof item.text!=='string'||!item.text.trim()||typeof item.translation!=='string'||!item.translation.trim())throw new Error('invalid-learning-example');
  result.set(item.entryId,{entryId:item.entryId,language:item.language,kind:'authored-learning',text:item.text,translation:item.translation,...(typeof item.speechText==='string'&&item.speechText.trim()?{speechText:item.speechText}:{} )});
 }
 return result;
}
