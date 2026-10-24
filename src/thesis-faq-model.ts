export type FaqSource={label:string;href:string};
export type FaqItem={id:string;category:string;question:string;answer:string[];sources:FaqSource[]};

export function filterFaq(items:FaqItem[],query:string):FaqItem[]{
 const words=query.normalize('NFKC').toLocaleLowerCase('ko').trim().split(/\s+/).filter(Boolean);
 return items.filter(item=>{
  const text=[item.question,item.category,...item.answer,...item.sources.map(source=>source.label)].join(' ').normalize('NFKC').toLocaleLowerCase('ko');
  return words.every(word=>text.includes(word));
 });
}

export function reviewDeepLink(search:string,proposalIds:readonly string[]):{view:'faq'}|{view:'proposal';id:string}|null{
 const params=new URLSearchParams(search),id=params.get('proposal');
 if(id&&proposalIds.includes(id))return {view:'proposal',id};
 return params.get('view')==='faq'?{view:'faq'}:null;
}
