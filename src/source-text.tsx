import React,{useMemo} from 'react';
import {getCitationSegments} from './citation-link-model';
import {getLegalMentions} from './legal-link-model';
import {LegalCitation} from './legal-links';
import {useManuscriptEditionId} from './manuscript-edition-context';

export type SourceSegment=ReturnType<typeof getCitationSegments>[number];
export default function SourceText({noteId,text,onReference,selectedSourceId}:{noteId:string;text:string;onReference:(segment:SourceSegment)=>void;selectedSourceId?:string}){
 const edition=useManuscriptEditionId();
 const citations=useMemo(()=>getCitationSegments(noteId,text,edition),[noteId,text,edition]);
 // A commentary chapter title such as 「제589조」 names the cited book entry.
 // Its click must open that source, not replace it with a statute lookup.
 const laws=useMemo(()=>getLegalMentions(text,{contextId:`note:${noteId}`,edition}).filter(law=>!citations.some(c=>c.start<=law.start&&c.end>=law.end)),[noteId,text,citations,edition]);
 const boundaries=[...new Set([0,text.length,...citations.flatMap(c=>[c.start,c.end]),...laws.flatMap(c=>[c.start,c.end])])].filter(n=>n>=0&&n<=text.length).sort((a,b)=>a-b);
 return <>{boundaries.slice(0,-1).map((start,index)=>{
  const end=boundaries[index+1],value=text.slice(start,end),law=laws.find(c=>c.start<=start&&c.end>=end),citation=citations.find(c=>c.start<=start&&c.end>=end);
  if(law)return <LegalCitation key={start} mention={law}>{value}</LegalCitation>;
  if(citation)return <a key={start} className="source-inline-link" href={citation.href||`#${citation.linkId}`} aria-current={citation.sourceId===selectedSourceId?'true':undefined} title={citation.status==='available'?`${citation.title} · 인용 부분 열기`:`${citation.title} · 자료 정보 확인`} onClick={event=>{event.stopPropagation();if(citation.href&&(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey))return;event.preventDefault();onReference(citation);}}>{value}</a>;
  return <React.Fragment key={start}>{value}</React.Fragment>;
 })}</>;
}
