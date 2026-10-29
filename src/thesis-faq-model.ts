export type FaqSource={label:string;href:string};
export type FaqItem={id:string;category:string;question:string;answer:string[];sources:FaqSource[];defaultLawId?:string;answerLabel?:string;followup?:string;status?:string};

export function proposalAnnotation(search:string,proposal:{id:string;after:string}|undefined):{number:string;text:string}|null{
 const params=new URLSearchParams(search),number=params.get('annotation');
 if(!proposal||params.get('proposal')!==proposal.id||!number||!/^\d{1,3}$/.test(number))return null;
 const text=proposal.after.split(/\r?\n/).find(line=>line.startsWith(`〔각주 ${number}〕 `));
 return text?{number,text}:null;
}

export function filterFaq(items:FaqItem[],query:string):FaqItem[]{
 const words=query.normalize('NFKC').toLocaleLowerCase('ko').trim().split(/\s+/).filter(Boolean);
 return items.filter(item=>{
  const text=[item.question,item.category,...item.answer,...item.sources.map(source=>source.label)].join(' ').normalize('NFKC').toLocaleLowerCase('ko');
  return words.every(word=>text.includes(word));
 });
}

export function reviewDeepLink(search:string,proposalIds:readonly string[],noteIds:readonly string[]=[],paragraphIds:readonly string[]=[]):{view:'faq'|'ai-mingyu'|'glossary'}|{view:'proposal'|'note'|'paragraph';id:string}|null{
 const params=new URLSearchParams(search),id=params.get('proposal');
 if(id&&proposalIds.includes(id))return {view:'proposal',id};
 const note=params.get('note');if(note&&noteIds.includes(note))return {view:'note',id:note};
 const paragraph=params.get('paragraph');if(paragraph&&paragraphIds.includes(paragraph))return {view:'paragraph',id:paragraph};
 const view=params.get('view');return view==='faq'||view==='ai-mingyu'||view==='glossary'?{view}:null;
}
