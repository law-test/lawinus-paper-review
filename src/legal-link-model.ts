import catalogData from './legal-link-catalog.json' with {type:'json'};
import editionContextData from './manuscript-legal-contexts.json' with {type:'json'};

export type LegalStatus='current'|'proposal'|'historical'|'foreign'|'unresolved';
export type LegalRelated={label:string;href:string;lawId?:string;article?:string};
export type LegalMention={start:number;end:number;label:string;lawId?:string;lawName?:string;article?:string;paragraph?:string;href:string;related:LegalRelated[];status:LegalStatus;reason?:string;articleText?:string};
export type LegalContext={contextId?:string;defaultLawId?:string;edition?:'human80'|'v120'|'v121'|'v122'|'legacy1021'};
export type LegalArticle={title:string;text:string;paragraphs?:string[]};
export type LegalLaw={id:string;name:string;aliases:string[];status?:LegalStatus;href:string;lsiSeq?:string;effectiveDate?:string;effectiveLabel?:string;articleNumbers?:string[];articles?:Record<string,LegalArticle>;relatedLawIds?:string[];relatedArticleMap?:Record<string,{lawId:string;article:string}[]>;relatedNote?:string};
type ContextRecord={defaultLawId?:string;lawId?:string;status?:LegalStatus;proposalHref?:string;source?:string;textHash?:string;excludedSpans?:{start:number;label:string}[];mentions?:{article:string;lawId:string;status?:LegalStatus;start?:number}[];auditedSpans?:{start:number;label:string;article:string;lawId:string;status:LegalStatus}[]};
type Catalog={verifiedOn:string;laws:LegalLaw[];foreignLaws:LegalLaw[];contexts:Record<string,ContextRecord>;contextOverrides:Record<string,ContextRecord>;proposalArticles:Record<string,string[]>;proposalParagraphs:Record<string,string[]>};
export const legalCatalog=catalogData as unknown as Catalog;
const laws=[...legalCatalog.laws,...legalCatalog.foreignLaws];
const byId=new Map(laws.map(l=>[l.id,l]));
export function getLegalLaw(lawId?:string):LegalLaw|undefined{return lawId?byId.get(lawId):undefined;}
export function legalTextFingerprint(s:string):string{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
const compact=(s:string)=>s.replace(/\s+/g,'').replaceAll('ㆍ','·');
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const aliasSource=(s:string)=>[...s.replace(/\s+/g,'')].map(c=>c==='ㆍ'||c==='·'?'[ㆍ·]':esc(c)).join('\\s*');
const aliases=laws.flatMap(l=>[l.name,...l.aliases].filter(Boolean).map(name=>({name,id:l.id,source:aliasSource(name)}))).sort((a,b)=>b.name.length-a.name.length);
const aliasRegex=new RegExp(aliases.map(x=>'('+x.source+')').join('|'),'g');
const searchHref=(text:string)=>'https://www.law.go.kr/LSW/lsSc.do?menuId=1&query='+encodeURIComponent(text);
export function legalArticleHref(law:LegalLaw,article:string):string {
 if(law.id==='de-insolvency')return 'https://www.gesetze-im-internet.de/inso/__'+article.replace('-','')+'.html';
 if(law.id==='de-civil')return 'https://www.gesetze-im-internet.de/bgb/__'+article.replace('-','')+'.html';
 if(law.id==='de-execution')return 'https://www.gesetze-im-internet.de/zvg/__'+article.replace('-','')+'.html';
 if(law.id==='us-bankruptcy')return 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title11-section'+article+'&num=0&edition=prelim';
 if(law.id.startsWith('jp-'))return law.href+(law.href.includes('#')?'':'#Mp-At_'+article.replace('-','_'));
 if(!law.lsiSeq||article.startsWith('부칙:'))return law.href;
 const [n,b='0']=article.split('-');
 return `https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=${b.padStart(2,'0')}&joNo=${n.padStart(4,'0')}&lsiSeq=${law.lsiSeq}&urlMode=lsScJoRltInfoR`;
}
// A source explanation has its own subject; the footnote's surrounding
// manuscript default must not assign its unnamed foreign articles to Korean law.
const citationExplanationScopes:Record<string,{lawId:string;textHash:string}>={
 'fn-225:s-afdd9b909aa984fb':{lawId:'us-bankruptcy',textHash:'bcb44ca6'},
 'fn-226:s-92ee28b9ae50b4f6':{lawId:'de-insolvency',textHash:'84717a56'},
};
function contextRecord(context:string|LegalContext|undefined,text:string):ContextRecord {
 const o=typeof context==='string'?{contextId:context}:context||{};let id=o.contextId||'';
 const explanation=id.match(/^citation-explanation:(fn-\d+):([^:]+)$/);
 const scope=explanation?Object.entries(citationExplanationScopes).find(([key])=>key.endsWith(':'+explanation[2]))?.[1]:undefined;
 if(scope)return {defaultLawId:o.defaultLawId||(scope.textHash===legalTextFingerprint(text)?scope.lawId:undefined)};
 const plain=explanation?.[1]||id.replace(/^(paragraph|note|faq):/,'');
 const scoped=o.edition==='legacy1021'?legalCatalog:(editionContextData as unknown as Record<string,{contexts:Record<string,ContextRecord>;contextOverrides:Record<string,ContextRecord>}>)[o.edition||'human80'];
 const base=scoped.contexts[id]||scoped.contexts[plain]||{};
 const extra=scoped.contextOverrides[id]||scoped.contextOverrides[plain]||{};
 return {...base,...extra,...(o.defaultLawId?{defaultLawId:o.defaultLawId}:{})};
}
function relatedLinks(law:LegalLaw|undefined,article:string,status:LegalStatus):LegalRelated[]{
 if(law?.id==='us-bankruptcy'&&status==='foreign'){
  const paths:Record<string,string>={'361':'chap3-subchapIV','362':'chap3-subchapIV','1306':'chap13-subchapI','1327':'chap13-subchapII'};
  return paths[article]?[{label:'미국 연방법전 제11편 § '+article+' — 2024 공식판(과거판)',href:'https://www.govinfo.gov/content/pkg/USCODE-2024-title11/html/USCODE-2024-title11-'+paths[article]+'-sec'+article+'.htm',lawId:law.id,article}]:[];
 }
 if(!law||status!=='current')return [];
 const links:LegalRelated[]=[];
 for(const pair of law.relatedArticleMap?.[article]||[]){const child=byId.get(pair.lawId);if(child)links.push({label:child.name+' '+(child.articles?.[pair.article]?.title||'제'+pair.article.replace('-','조의')+'조'),href:legalArticleHref(child,pair.article),lawId:child.id,article:pair.article});}
 for(const id of law.relatedLawIds||[]){const child=byId.get(id);if(child)links.push({label:child.name+' 전체',href:child.href,lawId:child.id});}
 return links.filter((v,i,a)=>a.findIndex(x=>x.href===v.href)===i);
}
function foreignOverride(text:string,index:number,lawId:string):string {
 const prefix=text.slice(Math.max(0,index-12),index);
 if(/일본\s*$/.test(prefix)){if(lawId==='civil')return 'jp-civil';if(lawId==='civil-execution')return 'jp-execution';}
 if(/독일\s*$/.test(prefix)&&lawId==='civil')return 'de-civil';
 return lawId;
}
type LawHit={start:number;end:number;id:string;historical:boolean};
function lawHits(text:string):LawHit[]{
 const out:LawHit[]=[];aliasRegex.lastIndex=0;let m:RegExpExecArray|null;
 while((m=aliasRegex.exec(text))){const ai=m.slice(1).findIndex(Boolean);const item=aliases[ai];if(!item)continue;
  const id=foreignOverride(text,m.index,item.id),prefix=text.slice(Math.max(0,m.index-10),m.index);
  out.push({start:m.index,end:aliasRegex.lastIndex,id,historical:/구\s*[「『]?\s*$/.test(prefix)||id==='old-individual-rehab'});
 }
 for(const m of text.matchAll(/같은\s*법\s*(시행령|시행규칙)/g)){
  const previous=out.filter(x=>x.end<=m.index!).sort((a,b)=>a.end-b.end).at(-1);
  const parent=getLegalLaw(previous?.id);if(!parent)continue;
  const child=parent.name.endsWith(m[1])?parent:(parent.relatedLawIds||[]).map(getLegalLaw).find(x=>x?.name.endsWith(m[1]));
  if(child)out.push({start:m.index!,end:m.index!+m[0].length,id:child.id,historical:previous?.historical||false});
 }
 return out.sort((a,b)=>a.start-b.start);
}
const articlePattern=/제\s*(\d+[a-z]?)\s*조(?:\s*의\s*(\d+))?(?:\s*제\s*(\d+)\s*항)?(?:\s*제\s*(\d+)\s*호)?/g;
const sentenceStart=(t:string,pos:number)=>Math.max(t.lastIndexOf('\n',pos-1),t.lastIndexOf('。',pos-1),t.lastIndexOf('. ',pos-1)+1);

/** No global statute default. Context defaults must come from the reviewed manuscript map. */
export function getLegalMentions(text:string,context?:string|LegalContext):LegalMention[]{
 const ctx=contextRecord(context,text),hits=lawHits(text),out:LegalMention[]=[];
 const excluded=ctx.textHash===legalTextFingerprint(text)?(ctx.excludedSpans||[]).filter(x=>text.slice(x.start,x.start+x.label.length)===x.label):[];
 const proposedSupplementDocument=/^\s*(?:<\s*신설\s*>\s*\|?\s*)?부칙\s+제\s*1\s*조\s*\(시행일\)/.test(text);
 const contextId=typeof context==='string'?context:context?.contextId||'';
 // Contract terms and local practice directions are linked by the source-document layer.
 // Sending these provision numbers to the national statute search would misidentify them.
 if(/주택도시보증공사/.test(text)&&/한국주택금융공사/.test(text)&&/SGI서울보증/.test(text)&&/약관/.test(text))return [];
 let previous:LegalMention|undefined;
 const matches=[...text.matchAll(articlePattern)];
 for(const m of matches){
  const start=m.index!,end=start+m[0].length,article=m[1]+(m[2]?'-'+m[2]:''),paragraph=m[3];
  if(excluded.some(x=>x.start<end&&x.start+x.label.length>start))continue;
  // A commentary's article-number chapter title belongs to its bibliography
  // link; retain any actual statute references later in the same footnote.
  const chapterTitle=/「\s*$/.test(text.slice(0,start))&&/^\s*(?:\[[^\]\n]{1,150}\]\s*)?」\s*,[^;\n]{0,140}『[^』]*(?:주석|온주)/.test(text.slice(end));
  if(chapterTitle)continue;
  // A proposal may quote a commentary chapter titled 「제589조」. It is a
  // bibliographic title, not an instruction to open a national statute.
  if(contextId.startsWith('proposal:')&&/「\s*$/.test(text.slice(0,start))&&/^\s*」/.test(text.slice(end)))continue;
  if(contextId.startsWith('proposal:')&&/김범준\s*$/.test(text.slice(0,start))&&m[1]==='615'&&!m[2])continue;
  // Local practice-rule numbers are document references; a later national-law
  // provision in the same footnote remains linkable through its audited scope.
  if(!hits.length&&/약관/.test(text))continue;
  const practiceStart=text.lastIndexOf('실무준칙',start);
  if(practiceStart>=0&&!text.slice(practiceStart,start).includes('\n\n')&&/(?:실무준칙[』」]?\s*|제\s*\d+\s*호\s*(?:「[^」]*」\s*)?)$/.test(text.slice(0,start)))continue;
  const left=text.slice(0,start),sentence=sentenceStart(text,start),prefix=left.slice(-45),tail=text.slice(end,end+12);
  const preceding=hits.filter(h=>h.end<=start),nearest=preceding.at(-1);
  const explicit=nearest&&/^\s*[」』]?\s*(?:부칙\s*)?$/.test(text.slice(nearest.end,start));
  const sameLaw=/같은\s*법\s*$/.test(prefix),sameSentence=nearest&&nearest.start>=sentence&&previous?.lawId===nearest.id&&previous.start>=nearest.end;
  const chain=previous&&/^[\s·ㆍ,;및부터까지내지~～〜와과]*(?:제\s*\d+\s*항)?[\s·ㆍ,;및부터까지내지~～〜와과]*$/.test(text.slice(previous.end,start));
  const repeated=out.filter(x=>x.article===article&&x.end<=start&&!text.slice(x.end,start).includes('\n\n')&&!hits.some(h=>h.start>x.end&&h.end<=start)).at(-1);
  const override=(!ctx.textHash||ctx.textHash===legalTextFingerprint(text))?ctx.mentions?.find(x=>x.article===article&&(x.start===undefined||x.start===start)):undefined;
  const foreignScope=nearest&&byId.get(nearest.id)?.status==='foreign'&&nearest.start>text.lastIndexOf('\n\n',start);
  let id=(explicit?nearest?.id:undefined)||override?.lawId||(sameLaw||sameSentence||foreignScope?nearest?.id:chain?previous?.lawId:repeated?.lawId)||ctx.lawId||ctx.defaultLawId;
  let law=getLegalLaw(id),status:LegalStatus=(!explicit?override?.status:undefined)||'current';
  // In chapter 4, the author explicitly defines unnamed articles as DRBA provisions.
  // If an intervening named statute has no such article, use that reviewed scope, not a numeric guess.
  if(!explicit&&!override&&law&&law.status!=='foreign'&&law.status!=='historical'&&!law.articleNumbers?.includes(article)){
   const scoped=getLegalLaw(ctx.defaultLawId);
   if(scoped&&(scoped.articleNumbers?.includes(article)||(legalCatalog.proposalArticles[scoped.id]||[]).includes(article))){id=scoped.id;law=scoped;}
  }
  const supplementaryPrefix=left.slice(Math.max(0,left.lastIndexOf('부칙'))).replace(/\([^)]*\)/g,'');
  const isSupplement=(proposedSupplementDocument&&/^\s*\([^)]*\)/.test(text.slice(end)))||(left.includes('부칙')&&/^부칙[^.。\n;]*$/.test(supplementaryPrefix))||!!(chain&&previous?.article?.startsWith('부칙:'));
  const currentMarker=/현행\s*$/.test(prefix);
  const historic=(!currentMarker&&nearest?.historical&&(explicit||sameLaw||sameSentence))||ctx.status==='historical';
  // A contradictory nearest statute is never rescued by guessing from the article number.
  if(law?.status==='foreign')status='foreign';else if(historic||law?.status==='historical')status='historical';
  const proposed=(legalCatalog.proposalArticles[id||'']||[]).includes(article)||!!(paragraph&&(legalCatalog.proposalParagraphs[(id||'')+':'+article]||[]).includes(paragraph))||(id==='drba'&&article==='611'&&paragraph==='1'&&m[4]==='4')||/^\s*안(?:은|의|을|에|과|이|\b|\s)/.test(tail)||(id==='drba'&&article==='615'&&/^\s*\([^)]*\)\s*[④⑤]/.test(text.slice(end,end+70)));
  if(proposed&&status==='current')status='proposal';
  if(isSupplement){status=ctx.proposalHref||proposedSupplementDocument?'proposal':'historical';}
  if(!law)status='unresolved';
  if(law&&status==='current'&&!law.articleNumbers?.includes(article))status='unresolved';
  const baseArticle=isSupplement?'부칙:'+article:article;
  let href=law?legalArticleHref(law,baseArticle):searchHref(m[0]);
  let reason:string|undefined;
  if(status==='historical'){href=searchHref((law?.name||'')+' '+(isSupplement?'부칙':'연혁'));reason=isSupplement?'부칙은 공포번호와 시행시점에 따라 확인해야 합니다.':'구법 인용입니다. 적용 시점의 연혁을 확인하세요.';}
  if(status==='proposal'){href=ctx.proposalHref||searchHref((law?.name||'')+' '+m[0]+' 개정안');reason='개정안에 관한 인용입니다. 현행 조문과 구별하여 확인하세요.';}
  if(status==='foreign')reason='외국 법령의 공식 자료입니다. 인용 당시 적용본은 논문의 설명도 확인하세요.';
  if(status==='unresolved'){href=searchHref((law?.name||'')+' '+m[0]);reason=law?'해당 번호의 현행 조문을 확정하지 못했습니다. 법령명·연혁·개정안 여부를 확인하세요.':'생략된 법령명을 확정하지 못했습니다. 주변 문맥과 함께 확인하세요.';}
  const mention:LegalMention={start,end,label:m[0],lawId:id,lawName:law?.name,article:baseArticle,paragraph,href,related:relatedLinks(law,article,status),status,reason,...(status==='current'&&law?.articles?.[article]?.text?{articleText:law.articles[article].text}:{})};
  out.push(mention);previous=mention;
 }
 // Relative paragraph references retain the last article in the same text block.
 // A bare paragraph number with no antecedent is not assigned to an invented article.
 const ownArticle=out.find(x=>x.start<60&&/^\s*\([^)]{1,120}\)\s*[①-⑳]/.test(text.slice(x.end)));
 for(const m of text.matchAll(/(?:(?:같은|이)\s*조\s*)?제\s*(\d+)\s*항(?:\s*제\s*(\d+)\s*호)?/g)){
  const start=m.index!,end=start+m[0].length;if(out.some(x=>x.start<end&&x.end>start))continue;
  const latest=out.filter(x=>x.end<=start&&x.article&&!x.article.startsWith('부칙:')).sort((a,b)=>a.end-b.end).at(-1);
  const immediate=latest&&/^[\s,·ㆍ및또는와과~～〜부터까지내지]*$/.test(text.slice(latest.end,start));
  if(!ownArticle&&!immediate&&!/^같은\s*조/.test(m[0]))continue;
  const prev=ownArticle&&!/^같은\s*조/.test(m[0])&&!immediate?ownArticle:latest;
  if(!prev||text.slice(prev.end,start).includes('\n\n'))continue;
  const law=getLegalLaw(prev.lawId),paragraph=m[1],proposal=(prev.article!.startsWith('부칙:')&&prev.status==='proposal')||(legalCatalog.proposalArticles[prev.lawId||'']||[]).includes(prev.article!)||(legalCatalog.proposalParagraphs[(prev.lawId||'')+':'+prev.article]||[]).includes(paragraph)||(prev.lawId==='drba'&&prev.article==='611'&&paragraph==='1'&&m[2]==='4');
  const inherited=prev.status==='proposal'&&law?.articleNumbers?.includes(prev.article!)?'current':prev.status;
  const status:LegalStatus=inherited==='current'||inherited==='proposal'?(proposal?'proposal':'current'):inherited;
  out.push({...prev,start,end,label:m[0],paragraph,status,href:status==='proposal'?(ctx.proposalHref||searchHref((law?.name||'')+' 제'+prev.article+'조 개정안')):status==='current'&&law?legalArticleHref(law,prev.article!):prev.href,articleText:status==='current'?law?.articles?.[prev.article!]?.text:undefined,related:status==='current'?relatedLinks(law,prev.article!,status):[],reason:status==='proposal'?'개정안에 관한 인용입니다. 현행 조문과 구별하여 확인하세요.':status==='current'?undefined:prev.reason});
 }
 // Foreign citations use their own official providers, never a Korean statute URL.
 const foreignPattern=/(§{1,2}\s*\d+[a-z]?(?:\([a-z0-9]+\))*(?:\s*[,·–-]\s*(?:\d+[a-z]?(?:\([a-z0-9]+\))*|\([a-z0-9]+\)))*|\bArt(?:icle)?\.?\s*\d+[a-z]?(?:\([a-z0-9]+\))*|\b11\s*U\.?S\.?C\.?\s*§?\s*\d+[a-z]?)/g;
 for(const m of text.matchAll(foreignPattern)){
  const start=m.index!,end=start+m[0].length;if(out.some(x=>x.start<end&&x.end>start))continue;
  if(/Claude\s+v\d+\s*$/.test(text.slice(Math.max(0,start-25),start)))continue;
  let id=hits.filter(x=>x.end<=start).at(-1)?.id||ctx.lawId||ctx.defaultLawId;
  if(/^Art/.test(m[0])&&!id){const next=hits.find(h=>h.start>=end&&h.start<end+120);if(next)id=next.id;}
  if(/U\.?S\.?C/.test(m[0])||/11\s*U\.?S\.?C\.?\s*$/.test(text.slice(Math.max(0,start-16),start)))id='us-bankruptcy';
  const law=byId.get(id||''),numText=m[0].replace(/^11\s*U\.?S\.?C\.?\s*/,'').replace(/^(?:§+|Art(?:icle)?\.?)\s*/,''),numbers=[...numText.matchAll(/(?:^|[,·–-])\s*(\d+[a-z]?)/g)];
  const offset=m[0].length-numText.length;
  for(let i=0;i<numbers.length;i++){
   const n=numbers[i],article=n[1],partStart=i===0?start:start+offset+n.index!+n[0].lastIndexOf(article),partEnd=i+1<numbers.length?start+offset+numbers[i+1].index!:end;
   const label=text.slice(partStart,partEnd).trimEnd(),trimEnd=partStart+label.length;
   const foreign=law?.status==='foreign',domestic=!!(law&&/^Art/.test(m[0])&&law.articleNumbers?.includes(article)),known=foreign||domestic;
   out.push({start:partStart,end:trimEnd,label,lawId:known?id:undefined,lawName:known?law!.name:undefined,article,href:known?legalArticleHref(law!,article):searchHref(label),related:relatedLinks(law,article,foreign?'foreign':domestic?'current':'unresolved'),status:foreign?'foreign':domestic?'current':'unresolved',reason:foreign?(id==='us-bankruptcy'?'미국 하원 공식 사이트의 일시적 접속 오류에 대비하여 2024 공식판도 연결했습니다. 과거판과 인용 당시 적용법을 구별해 확인하세요.':'외국 법령의 공식 자료입니다. 인용 당시 적용본은 논문의 설명도 확인하세요.'):domestic?undefined:'인용된 법령명을 주변 문맥에서 확인해야 합니다.',...(domestic&&law?.articles?.[article]?.text?{articleText:law.articles[article].text}:{})});
  }
 }
 // Audited self-references in amendment tables are tied to the exact source text.
 // They do not survive an edited paragraph merely because its context ID is reused.
 if(ctx.textHash===legalTextFingerprint(text))for(const fix of ctx.auditedSpans||[]){
  const {start,label,article,lawId,status}=fix,end=start+label.length;
  if(text.slice(start,end)!==label)continue;
  const law=getLegalLaw(lawId);if(!law)continue;
  for(let i=out.length-1;i>=0;i--)if(out[i].start<end&&out[i].end>start)out.splice(i,1);
  const paragraph=label.match(/제\s*(\d+)\s*항/)?.[1];
  const href=status==='proposal'?(ctx.proposalHref||searchHref(law.name+' '+(article.startsWith('부칙:')?'부칙':label)+' 개정안')):status==='historical'?searchHref(law.name+' 부칙 연혁'):legalArticleHref(law,article);
  out.push({start,end,label,lawId,lawName:law.name,article,paragraph,status,href,related:relatedLinks(law,article,status),reason:status==='proposal'?'개정안에 관한 인용입니다. 현행 조문과 구별하여 확인하세요.':status==='historical'?'부칙은 공포번호와 시행시점에 따라 확인해야 합니다.':undefined,...(status==='current'&&law.articles?.[article]?.text?{articleText:law.articles[article].text}:{})});
 }
 return out.filter(m=>!excluded.some(x=>x.start<m.end&&x.start+x.label.length>m.start)).sort((a,b)=>a.start-b.start);
}

export function getLegalMentionDetails(mention:LegalMention){
 const law=getLegalLaw(mention.lawId);
 const relative=/^(?:(?:같은|이)\s*조\s*)?제\s*\d+\s*(?:항|호)/.test(mention.label);
 const articleLabel=mention.article?.startsWith('부칙:')?'부칙 제'+mention.article.slice(3).replace('-','조의')+'조':'제'+(mention.article||'').replace(/-(\d+)$/,'조의$1')+(mention.article?.includes('-')?'':'조');
 const titleLabel=relative&&mention.article?articleLabel+' '+mention.label.replace(/^(?:같은|이)\s*조\s*/,''):mention.article?.startsWith('부칙:')?articleLabel:mention.status==='foreign'&&!/[§조]|Art/i.test(mention.label)?'§ '+mention.label:mention.label;
 return {...mention,title:(law?.name?law.name+' ':'')+titleLabel,law,article:mention.status==='current'&&mention.article?law?.articles?.[mention.article]:undefined,
  articleText:mention.status==='current'?mention.articleText:undefined,verifiedOn:legalCatalog.verifiedOn,effectiveLabel:mention.status==='current'?law?.effectiveLabel:undefined,
  relatedNote:mention.status==='current'?(law?.relatedNote||(!law?.relatedLawIds?.length?'연결된 일반 시행령·규칙이 없습니다. 조문별 특별 규정은 공식 법령의 연계정보에서 확인할 수 있습니다.':undefined)):undefined};
}
