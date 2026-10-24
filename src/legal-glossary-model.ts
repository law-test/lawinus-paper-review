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
export type GlossaryOrder = 'importance'|'frequency'|'alphabet';
const rankKey=(value:string)=>value.normalize('NFKC').toLowerCase();
// These are attested headwords in the seven source corpora, not additional entries.
// Inflected nouns share their lemma's priority; citation abbreviations do not.
export const coreLegalNouns:Record<GlossaryLanguage,ReadonlySet<string>>={
 en:new Set(['creditor','debtor','claim','debt','estate','discharge','bankruptcy','lien','security','interest','plan','property','collateral','payment','confirmation','liquidation','settlement','stay','court','trustee','exemption','priority','modification','protection','right','law','code']),
 de:new Set(['Insolvenzverwalter','Insolvenzverfahren','Insolvenzgläubiger','Insolvenzmasse','Insolvenzschuldner','Insolvenzgericht','Insolvenzplan','Gläubiger','Schuldner','Forderung','Anspruch','Absonderungsrecht','Zwangsversteigerung','Zwangsverwaltung','Zwangsvollstreckung','Verwertung','Befriedigung','Sicherheit','Sicherheitsleistung','Vermögen','Grundstück','Antrag','Gericht','Recht'].map(rankKey)),
 ja:new Set(['債権','債務','債権者','債務者','再生債務者','再生債権者','再生債権','破産債権','担保権','別除権','質権','抵当権','先取特権','留置権','請求権','共益債権','一般優先債権','財団債権','破産財団','再生手続','破産手続','再生計画','住宅資金特別条項','住宅資金貸付債権','住宅資金貸付契約','強制執行','実行手続','中止命令','申立て','破産管財人','裁判所','財産','弁済','任意売却','民事執行法','破産法','会社法','商法','期限の利益']),
};
const functionTerms:Record<GlossaryLanguage,ReadonlySet<string>>={
 en:new Set(['the','a','an','of','to','in','on','at','for','by','with','from','and','or','but','if','as','that','this','these','those','it','its']),
 de:new Set(['der','die','das','den','dem','des','ein','eine','einer','einem','einen','eines','und','oder','in','im','am','an','auf','von','zu','zur','für','mit']),
 ja:new Set(['の','は','が','を','に','で','と','も','こと','もの','この','その','ため','により','による','について','において','における','に基づく','に関する','ことができる','ことができない']),
};
export function glossaryImportance(entry:GlossaryEntry):number{
 const term=rankKey(entry.term),lemma=rankKey(entry.lemma),pos=entry.partOfSpeech??'';
 // A legal explanation does not turn an article, pronoun or suffix into a noun.
 if(functionTerms[entry.language].has(term)||/대명사|형식명사|관사|전치사|접속사|조사|한정사|관형사|연체사|접미사|접두사|허사|부정사 표지/.test(pos))return 4;
 const abbreviation=/약어/.test(pos)||/약어|약칭/.test(entry.grammaticalNote??'');
 const noun=/명사|\bnoun\b/i.test(pos)&&!abbreviation;
 const japaneseNoun=entry.language==='ja'&&pos==='법률어·구문'&&/(?:権|法|債務者|債権者|管財人|申立人|関係人|手続|命令|計画|決定|財団|利益|損害|期間|条項|契約|申立て|売却|裁判書|ただし書|認可|開始|担保|弁済|財産)$/.test(entry.term);
 if((noun||japaneseNoun)&&!abbreviation){
  if(coreLegalNouns[entry.language].has(term)||coreLegalNouns[entry.language].has(lemma))return 0;
  if(entry.legalMeaning?.trim()||japaneseNoun)return 1;
  if(!/고유명사/.test(pos))return 2;
 }
 return 3;
}
export function isImportantLegalNoun(entry:GlossaryEntry):boolean{return glossaryImportance(entry)<=1;}
export function filterGlossary(entries:GlossaryEntry[],options:{query:string;language:string;source:string;onlyFavorites:boolean;onlyImportant?:boolean;favorites:ReadonlySet<string>;order:GlossaryOrder},searchIndex?:ReadonlyMap<string,string>):GlossaryEntry[]{
 const terms=options.query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 const selected=entries.filter(e=>(options.language==='all'||e.language===options.language)&&(options.source==='all'||(e.sourceIds??e.occurrences.map(o=>o.sourceId)).includes(options.source))&&(!options.onlyFavorites||options.favorites.has(e.id))&&(!options.onlyImportant||isImportantLegalNoun(e))&&terms.every(t=>(searchIndex?.get(e.id)??glossarySearchText(e)).includes(t)));
 const alphabet=(a:GlossaryEntry,b:GlossaryEntry)=>a.term.localeCompare(b.term,['ko','en','de','ja'],{sensitivity:'base'})||a.id.localeCompare(b.id);
 const frequency=(a:GlossaryEntry,b:GlossaryEntry)=>b.frequency-a.frequency||alphabet(a,b);
 if(options.order!=='importance')return selected.sort(options.order==='frequency'?frequency:alphabet);
 const ranked=selected.map(entry=>({entry,tier:glossaryImportance(entry)}));
 const result:GlossaryEntry[]=[];
 for(let tier=0;tier<=4;tier++){
  const groups=(['en','de','ja'] as const).map(language=>ranked.filter(x=>x.tier===tier&&x.entry.language===language).map(x=>x.entry).sort(frequency));
  // Interleave within the same tier, so the longer English corpus cannot hide
  // the German and Japanese legal vocabulary. No entry or definition is changed.
  const length=Math.max(...groups.map(group=>group.length));
  for(let i=0;i<length;i++)for(const group of groups)if(group[i])result.push(group[i]);
 }
 return result;
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
