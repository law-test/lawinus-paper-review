import humanCatalog from './paragraph-catalog.json';
import appliedCatalog from './paragraph-catalog-v110.json';
import humanToc from './thesis-toc-data.json';
import appliedToc from './thesis-toc-data-v110.json';
import revisionData from './revision-proposals.json';
import type {ManuscriptEditionId} from './manuscript-edition-context';
import type {ManuscriptParagraph} from './web-manuscript';

export const MANUSCRIPT_EDITIONS={
 human73:{id:'human73' as const,datasetId:'human-1026-1710',label:'인간 최종본 · 73차',date:'2026. 10. 26.',pages:324,footnotes:258,catalog:humanCatalog,toc:humanToc},
 v110:{id:'v110' as const,datasetId:'applied-v110-human73',label:'수정 적용본 · v110',date:'2026. 10. 27.',pages:335,footnotes:267,catalog:appliedCatalog,toc:appliedToc},
};
export type ManuscriptEdition=typeof MANUSCRIPT_EDITIONS[ManuscriptEditionId];
export type EditionProposal={id:string;before:string;after:string;reason:string;priority:string;page:number;page_end:number;anchorId?:string;paragraphIds?:string[];targetParagraphId?:string;targetNoteId?:string;applyText?:string;applyUnsupportedReason?:string;[key:string]:unknown};
export function editionFromSearch(search:string):ManuscriptEditionId{return new URLSearchParams(search).get('edition')==='v110'?'v110':'human73';}
export function editionDownloadPath(id:ManuscriptEditionId,format:'pdf'|'hwpx'|'md'|'guide'|'hwp'){
 const name=format==='guide'?'revision-guide.md':format==='hwp'?'original.hwp':`manuscript.${format}`;
 return `./editions/${id}/${name}`;
}
export function editionParagraphs(id:ManuscriptEditionId){return MANUSCRIPT_EDITIONS[id].catalog.paragraphs as ManuscriptParagraph[];}
export function editionProposals(id:ManuscriptEditionId):EditionProposal[]{
 const available=new Set(editionParagraphs(id).map(paragraph=>paragraph.id));
 return (revisionData.items as unknown as Record<string,any>[]).map(item=>{
  const paragraphIds=((id==='v110'?item.appliedParagraphIds:item.originalParagraphIds)||[]).filter((value:string)=>available.has(value));
  const targetParagraphId=paragraphIds[0];
  const targetNoteId=id==='v110'?item.appliedNoteId:item.originalNoteId;
  const page=Number(id==='v110'?item.appliedPage:item.humanPage)||Number(item.page)||1;
  const pages=(id==='v110'?item.appliedPages:item.humanPages)||[page];
  return {...item,id:item.id,before:item.before,after:item.after,reason:item.reason,priority:item.priority,page,page_end:Math.max(page,...pages),
   targetParagraphId,targetNoteId,anchorId:targetParagraphId,paragraphIds,
   // Only the verified single-target human proposal can enter an editor; v110 already contains the change.
   applyText:id==='human73'?item.applyText:undefined,
   applyUnsupportedReason:id==='v110'?'v110 원고에 반영된 수정지시입니다. 추가 교정은 현재 문안에서 작성해 주세요.':item.applyUnsupportedReason||'수정지시서의 변경 전·후를 확인하고 현재 문안을 교정해 주세요.',
  };
 });
}
