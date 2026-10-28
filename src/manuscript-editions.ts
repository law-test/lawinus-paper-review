import humanCatalog from './paragraph-catalog.json';
import appliedCatalog from './paragraph-catalog-v112.json';
import humanToc from './thesis-toc-data.json';
import appliedToc from './thesis-toc-data-v112.json';
import revisionData from './revision-proposals.json';
import type {ManuscriptEditionId} from './manuscript-edition-context';
import type {ManuscriptParagraph} from './web-manuscript';

export const MANUSCRIPT_EDITIONS={
 human77:{id:'human77' as const,datasetId:'human-1028-2105',label:'심사본',date:'2026. 10. 28.',pages:262,footnotes:348,catalog:humanCatalog,toc:humanToc},
 v112:{id:'v112' as const,datasetId:'applied-v112-human77',label:'수정본',date:'2026. 10. 28.',pages:269,footnotes:349,catalog:appliedCatalog,toc:appliedToc},
};
export type ManuscriptEdition=typeof MANUSCRIPT_EDITIONS[ManuscriptEditionId];
export type EditionProposal={id:string;before:string;after:string;reason:string;priority:string;page:number;page_end:number;anchorId?:string;paragraphIds?:string[];targetParagraphId?:string;targetNoteId?:string;applyText?:string;applyUnsupportedReason?:string;[key:string]:unknown};
export function editionFromSearch(search:string):ManuscriptEditionId{return new URLSearchParams(search).get('edition')==='v112'?'v112':'human77';}
export function editionDownloadPath(id:ManuscriptEditionId,format:'pdf'|'hwpx'|'md'|'guide'|'hwp'){
 const name=format==='guide'?'revision-guide.md':format==='hwp'?'original.hwp':`manuscript.${format}`;
 return `./editions/${id}/${name}`;
}
export function editionParagraphs(id:ManuscriptEditionId){return MANUSCRIPT_EDITIONS[id].catalog.paragraphs as ManuscriptParagraph[];}
export function editionProposals(id:ManuscriptEditionId):EditionProposal[]{
 const available=new Set(editionParagraphs(id).map(paragraph=>paragraph.id));
 return (revisionData.items as unknown as Record<string,any>[]).map(item=>{
  const paragraphIds=((id==='v112'?item.appliedParagraphIds:item.originalParagraphIds)||[]).filter((value:string)=>available.has(value));
  const targetParagraphId=paragraphIds[0];
  const targetNoteId=id==='v112'?item.appliedNoteId:item.originalNoteId;
  const page=Number(id==='v112'?item.appliedPage:item.humanPage)||Number(item.page)||1;
  const pages=(id==='v112'?item.appliedPages:item.humanPages)||[page];
  return {...item,id:item.id,before:item.before,after:item.after,reason:item.reason,priority:item.priority,page,page_end:Math.max(page,...pages),
   targetParagraphId,targetNoteId,anchorId:targetParagraphId,paragraphIds,
   // Only the verified single-target human proposal can enter an editor; v112 already contains the change.
   applyText:id==='human77'?item.applyText:undefined,
   applyUnsupportedReason:id==='v112'?'v112 원고에 반영된 수정지시입니다. 추가 교정은 현재 문안에서 작성해 주세요.':item.applyUnsupportedReason||'수정지시서의 변경 전·후를 확인하고 현재 문안을 교정해 주세요.',
  };
 });
}
