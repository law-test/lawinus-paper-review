import type {PdfRect,PageSize} from './pdf-viewer-model';

export type EvidenceEntry={
 id:string;noteId:string;sourceId:string;status:'verified'|'unverified';kind:'pdf'|'text';
 noteTextSha256:string;sourceSha256:string;page?:number;printedPage?:string;
 rects?:PdfRect[];pageWidth?:number;pageHeight?:number;start?:number;end?:number;quote?:string;textSha256?:string;
};
export type EvidenceDocument={version:1;edition:'human80';entries:EvidenceEntry[]};
export type EvidenceNote={id:string;number:number;text:string;sourceRefs:{sourceId:string;targetPage?:number}[];bodyContexts?:{id:string;text:string;page:number}[]};
export type EvidenceSource={id:string;kind:string;pages?:number|null};
export type SourceHighlight={page:number;rect:PdfRect;kind:'source-evidence';evidenceId:string;pageWidth:number;pageHeight:number;printed?:string};
export type DocumentVerification='checking'|'verified'|'mismatch'|'unavailable';
const sha=/^[a-f0-9]{64}$/i;
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0;

export function parseEvidenceDocument(value:unknown):EvidenceDocument{
 if(!record(value)||value.version!==1||value.edition!=='human80'||!Array.isArray(value.entries))throw Error('인용 구절 정보를 확인하지 못했습니다.');
 const entries:EvidenceEntry[]=[],ids=new Set<string>();
 for(const item of value.entries){
  if(!record(item)||typeof item.id!=='string'||ids.has(item.id)||typeof item.noteId!=='string'||!/^fn-\d{3}$/.test(item.noteId)||typeof item.sourceId!=='string')continue;
  if(item.status!=='verified'&&item.status!=='unverified')continue;
  if(item.kind!=='pdf'&&item.kind!=='text')continue;
  // Unverified entries never become geometry, even if they carry a rectangle.
  if(typeof item.noteTextSha256!=='string'||!sha.test(item.noteTextSha256)||typeof item.sourceSha256!=='string'||!sha.test(item.sourceSha256))continue;
  const entry:EvidenceEntry={id:item.id,noteId:item.noteId,sourceId:item.sourceId,status:item.status,kind:item.kind,noteTextSha256:item.noteTextSha256.toLowerCase(),sourceSha256:item.sourceSha256.toLowerCase()};
  if(typeof item.printedPage==='string'||typeof item.printedPage==='number')entry.printedPage=String(item.printedPage);
  if(item.kind==='pdf'){
   if(!Number.isInteger(item.page)||Number(item.page)<1||!positive(item.pageWidth)||!positive(item.pageHeight)||!Array.isArray(item.rects)||!item.rects.length)continue;
   const width=item.pageWidth,height=item.pageHeight;
   if(!item.rects.every(r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>=0&&r[2]>r[0]&&r[3]>r[1]&&r[2]<=width+.5&&r[3]<=height+.5))continue;
   Object.assign(entry,{page:Number(item.page),pageWidth:width,pageHeight:height,rects:item.rects.map(r=>[...r])});
  }else{
   if(!Number.isInteger(item.start)||!Number.isInteger(item.end)||Number(item.start)<0||Number(item.end)<=Number(item.start))continue;
   if(typeof item.textSha256!=='string'||!sha.test(item.textSha256))continue;
   Object.assign(entry,{start:Number(item.start),end:Number(item.end)});
   entry.textSha256=item.textSha256.toLowerCase();
   if(typeof item.quote==='string')entry.quote=item.quote;
  }
  ids.add(entry.id);entries.push(entry);
 }
 return {version:1,edition:'human80',entries};
}

export function sourceNotes(notes:EvidenceNote[],sourceId:string){return notes.filter(n=>n.sourceRefs.some(r=>r.sourceId===sourceId));}
export function sourceNoteId(notes:EvidenceNote[],sourceId:string,requested:string|null){return requested&&sourceNotes(notes,sourceId).some(n=>n.id===requested)?requested:null;}
export function verifiedEvidence(document:EvidenceDocument|null,note:EvidenceNote|undefined,source:EvidenceSource,noteHash:string):EvidenceEntry[]{
 if(!document||!note||!noteHash||!note.sourceRefs.some(r=>r.sourceId===source.id))return [];
 const scoped=document.entries.filter(e=>e.noteId===note.id&&e.sourceId===source.id&&e.status==='verified'&&e.noteTextSha256===noteHash&&e.kind===source.kind);
 // Conflicting source versions must not be silently combined.
 if(new Set(scoped.map(e=>e.sourceSha256)).size>1)return [];
 return scoped.filter(e=>e.kind!=='pdf'||!!e.page&&(!source.pages||e.page<=source.pages));
}
export function evidenceHighlights(entries:EvidenceEntry[]):SourceHighlight[]{
 return entries.filter(e=>e.kind==='pdf'&&e.status==='verified').flatMap(e=>(e.rects||[]).map(rect=>({page:e.page!,rect,kind:'source-evidence' as const,evidenceId:e.id,pageWidth:e.pageWidth!,pageHeight:e.pageHeight!,printed:e.printedPage})));
}
export function matchesEvidencePage(highlight:{pageWidth?:number;pageHeight?:number},size:PageSize){
 return positive(highlight.pageWidth)&&positive(highlight.pageHeight)&&Math.abs(highlight.pageWidth-size.width)<.5&&Math.abs(highlight.pageHeight-size.height)<.5;
}
export function evidenceRectStyle(rect:PdfRect,size:PageSize){return {left:rect[0]/size.width*100+'%',top:rect[1]/size.height*100+'%',width:(rect[2]-rect[0])/size.width*100+'%',height:(rect[3]-rect[1])/size.height*100+'%'};}
export function documentEvidenceMatches(expected:string|undefined,verified:{doc:unknown;checksum:string}|null,currentDoc:unknown){return !!expected&&!!currentDoc&&!!verified&&verified.doc===currentDoc&&verified.checksum===expected;}
export async function sha256Bytes(bytes:Uint8Array):Promise<string>{
 const data=new Uint8Array(bytes).buffer;
 const hash=await globalThis.crypto.subtle.digest('SHA-256',data);
 return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
export const sha256Text=(text:string)=>sha256Bytes(new TextEncoder().encode(text));
export function verifiedTextEvidence(entries:EvidenceEntry[],text:string,byteHash:string,textHash:string){return entries.filter(e=>e.kind==='text'&&e.status==='verified'&&e.sourceSha256===byteHash&&e.textSha256===textHash&&e.start!==undefined&&e.end!==undefined&&e.start>=0&&e.end>e.start&&e.end<=text.length&&(!e.quote||text.slice(e.start,e.end)===e.quote));}
export function textEvidenceParts(text:string,entries:EvidenceEntry[]){
 const ranges=entries.filter(e=>e.kind==='text'&&e.status==='verified'&&e.start!==undefined&&e.end!==undefined&&e.end<=text.length&&(!e.quote||text.slice(e.start,e.end)===e.quote));
 const boundaries=[...new Set([0,text.length,...ranges.flatMap(e=>[e.start!,e.end!])])].sort((a,b)=>a-b);
 return boundaries.slice(0,-1).map((start,i)=>({text:text.slice(start,boundaries[i+1]),highlighted:ranges.some(e=>e.start!<=start&&e.end!>=boundaries[i+1]),start}));
}
