export type GlossaryLanguage = 'en' | 'de' | 'ja';
export type GlossarySource = {id:string;title:string;language:string;scope:string;href:string};
export type GlossaryOccurrence = {sourceId:string;page?:number|string;label:string;href:string;context?:string};
export type GlossaryExample = {id:string;language:GlossaryLanguage;text:string;translation:string;sourceId:string;label:string;href:string;kind:string;editorialNotes?:string[]};
export type GlossaryEntry = {id:string;term:string;lemma:string;language:GlossaryLanguage;pronunciation:string;meaning:string;legalMeaning?:string;partOfSpeech?:string;grammaticalNote?:string;forms?:string[];frequency:number;occurrences:GlossaryOccurrence[];sourceIds?:string[];exampleIds?:string[]};
export type GlossaryData = {version:string;scope:string;sources:GlossarySource[];entries:GlossaryEntry[];examples:GlossaryExample[]};
export const languageLabels:Record<GlossaryLanguage,string>={en:'영어',de:'독일어',ja:'일본어'};
export const speechLanguages:Record<GlossaryLanguage,string>={en:'en-US',de:'de-DE',ja:'ja-JP'};
export function exampleKindLabel(kind:string):string{
 if(kind==='sentence')return '원문 문장';
 if(kind==='heading')return '표제';
 if(kind==='contents-entry')return '목차 항목';
 if(kind==='quotation')return '원문 인용문';
 if(kind==='commentary-paragraph')return '원문 주석';
 if(['article_unit','article-unit','original-provision','statutory-subsection','statutory-paragraph'].includes(kind))return '원문 조문';
 return '원문 인용단위';
}
export function normalizeLanguage(value:unknown):GlossaryLanguage|null{
 const s=String(value??'').trim().toLowerCase();
 if(['영어','english','eng','en'].includes(s)||s.startsWith('en-'))return 'en';
 if(['독일어','german','deutsch','deu','ger','de'].includes(s)||s.startsWith('de-'))return 'de';
 if(['일본어','japanese','日本語','jpn','ja'].includes(s)||s.startsWith('ja-'))return 'ja';
 return null;
}
export function safeGlossaryHref(value:unknown):string|null{
 if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))return null;
 const s=value.trim();
 if(!/^https:\/\//i.test(s)&&!(/^(?:\/(?!\/)|\.\/|\?|#)/.test(s)))return null;
 try{const u=new URL(s,'https://paper.lawinus.org/');return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function dictionaryHref(entry:Pick<GlossaryEntry,'term'|'lemma'|'language'>):string{
 const term=encodeURIComponent(entry.term||entry.lemma);
 if(entry.language==='de')return `https://www.duden.de/suchen/dudenonline/${term}`;
 if(entry.language==='ja')return `https://kotobank.jp/search?q=${term}`;
 return `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent((entry.term||entry.lemma).toLowerCase())}`;
}
const str=(v:unknown)=>typeof v==='string'?v:'';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function parseGlossary(value:unknown):GlossaryData{
 if(!record(value)||!Array.isArray(value.sources)||!Array.isArray(value.entries)||!['string','number'].includes(typeof value.version))throw new Error('invalid-glossary');
 const ids=new Set<string>();
 const sources:GlossarySource[]=value.sources.map(v=>{
  if(!record(v)||!str(v.id)||!str(v.title)||ids.has(str(v.id)))throw new Error('invalid-source');
  ids.add(str(v.id));return{id:str(v.id),title:str(v.title),language:str(v.language),scope:str(v.scope),href:safeGlossaryHref(v.href)??''};
 });
 const exampleIds=new Set<string>();
 const examples:GlossaryExample[]=(Array.isArray(value.examples)?value.examples:[]).map(v=>{
  if(!record(v)||!str(v.id)||!str(v.text)||!ids.has(str(v.sourceId))||exampleIds.has(str(v.id)))throw new Error('invalid-example');
  const language=normalizeLanguage(v.language);if(!language)throw new Error('invalid-example');
  const editorialNotes=Array.isArray(v.editorialNotes)?v.editorialNotes.filter((x):x is string=>typeof x==='string'&&!!x.trim()):str(v.editorialNote)?[str(v.editorialNote)]:[];
  exampleIds.add(str(v.id));return{id:str(v.id),language,text:str(v.text),translation:str(v.translation),sourceId:str(v.sourceId),label:str(v.label),href:safeGlossaryHref(v.href)??'',kind:str(v.kind),editorialNotes};
 });
 const entryIds=new Set<string>();
 const entries:GlossaryEntry[]=value.entries.map(v=>{
  if(!record(v)||!str(v.id)||!str(v.term)||entryIds.has(str(v.id))||!Array.isArray(v.occurrences))throw new Error('invalid-entry');
  const language=normalizeLanguage(v.language);if(!language||typeof v.frequency!=='number'||!Number.isFinite(v.frequency)||v.frequency<0)throw new Error('invalid-entry');
  entryIds.add(str(v.id));
  const occurrences:GlossaryOccurrence[]=v.occurrences.map(o=>{
   if(!record(o)||!ids.has(str(o.sourceId)))throw new Error('invalid-occurrence');
   return {sourceId:str(o.sourceId),label:str(o.label),href:safeGlossaryHref(o.href)??'',...(typeof o.page==='number'||typeof o.page==='string'?{page:o.page}:{}),...(str(o.context)?{context:str(o.context)}:{})};
  });
  const linkedExamples=Array.isArray(v.exampleIds)?v.exampleIds.filter((x):x is string=>typeof x==='string'):[];
  if(linkedExamples.some(id=>!exampleIds.has(id)))throw new Error('invalid-example-reference');
  const sourceIds=[...new Set(Array.isArray(v.sourceIds)?v.sourceIds:occurrences.map(o=>o.sourceId))];
  if(sourceIds.some(id=>typeof id!=='string'||!ids.has(id))||occurrences.some(o=>!sourceIds.includes(o.sourceId)))throw new Error('invalid-source-reference');
  return{id:str(v.id),term:str(v.term),lemma:str(v.lemma)||str(v.term),language,pronunciation:str(v.pronunciation),meaning:str(v.meaning),legalMeaning:str(v.legalMeaning),partOfSpeech:str(v.partOfSpeech),grammaticalNote:str(v.grammaticalNote),forms:Array.isArray(v.forms)?v.forms.filter((x):x is string=>typeof x==='string'):[],frequency:v.frequency,occurrences,sourceIds:sourceIds as string[],exampleIds:linkedExamples};
 });
 return{version:String(value.version),scope:str(value.scope),sources,entries,examples};
}
export function glossarySearchText(entry:GlossaryEntry):string{
 return [entry.term,entry.lemma,entry.pronunciation,entry.meaning,entry.legalMeaning,entry.partOfSpeech,entry.grammaticalNote,...entry.forms??[]].join(' ').normalize('NFKC').toLocaleLowerCase();
}
export function filterGlossary(entries:GlossaryEntry[],options:{query:string;language:string;source:string;onlyFavorites:boolean;favorites:ReadonlySet<string>;order:'frequency'|'alphabet'},searchIndex?:ReadonlyMap<string,string>):GlossaryEntry[]{
 const terms=options.query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 const selected=entries.filter(e=>(options.language==='all'||e.language===options.language)&&(options.source==='all'||(e.sourceIds??e.occurrences.map(o=>o.sourceId)).includes(options.source))&&(!options.onlyFavorites||options.favorites.has(e.id))&&terms.every(t=>(searchIndex?.get(e.id)??glossarySearchText(e)).includes(t)));
 const alphabet=(a:GlossaryEntry,b:GlossaryEntry)=>a.term.localeCompare(b.term,['ko','en','de','ja'],{sensitivity:'base'})||a.id.localeCompare(b.id);
 return selected.sort(options.order==='frequency'?(a,b)=>b.frequency-a.frequency||alphabet(a,b):alphabet);
}
export function favoriteStorageKey(version:string):string{return `lawinus:legal-glossary:favorites:${version}`;}
export function parseFavoriteIds(raw:string|null,entries:GlossaryEntry[]):Set<string>{
 try{const value=JSON.parse(raw??'[]');const available=new Set(entries.map(e=>e.id));return new Set(Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'&&available.has(id)):[]);}catch{return new Set();}
}
export function selectSpeechVoice<T extends {lang:string;default?:boolean;localService?:boolean;name?:string}>(voices:readonly T[],language:GlossaryLanguage):T|null{
 const matching=voices.filter(v=>v.lang.toLowerCase().replaceAll('_','-').split('-')[0]===language);
 const exact=(v:T)=>v.lang.toLowerCase().replaceAll('_','-')===speechLanguages[language].toLowerCase();
 const local=matching.filter(v=>v.localService===true);
 return local.find(exact)??local.find(v=>v.default)??local[0]??matching.find(v=>exact(v)&&!/multilingual|다국어/i.test(v.name??''))??matching.find(exact)??matching.find(v=>v.default)??matching[0]??null;
}
