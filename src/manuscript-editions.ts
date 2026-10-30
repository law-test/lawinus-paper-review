import humanCatalog from './paragraph-catalog.json';
import appliedCatalog from './paragraph-catalog-v120.json';
import previousCatalog from './paragraph-catalog-v121.json';
import archived122Catalog from './paragraph-catalog-v122.json';
import archived123Catalog from './paragraph-catalog-v123.json';
import latestCatalog from './paragraph-catalog-v124.json';
import humanToc from './thesis-toc-data.json';
import appliedToc from './thesis-toc-data-v120.json';
import previousToc from './thesis-toc-data-v121.json';
import archived122Toc from './thesis-toc-data-v122.json';
import archived123Toc from './thesis-toc-data-v123.json';
import latestToc from './thesis-toc-data-v124.json';
import revisionData from './revision-proposals.json';
import archived122RevisionData from './revision-proposals-v122.json';
import archived123RevisionData from './revision-proposals-v123.json';
import archived123CitationData from './citation-links-v123.json';
import latestCitationData from './citation-links-v124.json';
import priorRevisionData from './revision-proposals-v120.json';
import previousRevisionData from './revision-proposals-v121.json';
import type {ManuscriptEditionId} from './manuscript-edition-context';
import type {ManuscriptParagraph} from './web-manuscript';

export const MANUSCRIPT_EDITIONS={
 human80:{id:'human80' as const,datasetId:'human-1029-1629',label:'인간80 심사본',guideVersion:'v124',date:'2026. 10. 29.',pages:266,footnotes:444,catalog:humanCatalog,toc:humanToc},
 v120:{id:'v120' as const,datasetId:'applied-v120-human80',label:'v120 이전 수정본',guideVersion:'v120',date:'2026. 10. 30.',pages:appliedToc.pageCount,footnotes:444,catalog:appliedCatalog,toc:appliedToc},
 v121:{id:'v121' as const,datasetId:'applied-v121-human80',label:'v121 이전 수정본',guideVersion:'v121',date:'2026. 10. 30.',pages:previousToc.pageCount,footnotes:444,catalog:previousCatalog,toc:previousToc},
 v122:{id:'v122' as const,datasetId:'applied-v122-human80',label:'v122 이전 수정본',guideVersion:'v122',date:'2026. 10. 30.',pages:archived122Toc.pageCount,footnotes:444,catalog:archived122Catalog,toc:archived122Toc},
 v123:{id:'v123' as const,datasetId:'applied-v123-human80',label:'v123 이전 수정본',guideVersion:'v123',date:'2026. 10. 31.',pages:archived123Toc.pageCount,footnotes:Object.keys(archived123CitationData.notes).length,catalog:archived123Catalog,toc:archived123Toc},
 v124:{id:'v124' as const,datasetId:'applied-v124-human80',label:'v124 수정본',guideVersion:'v124',date:'2026. 10. 31.',pages:latestToc.pageCount,footnotes:Object.keys(latestCitationData.notes).length,catalog:latestCatalog,toc:latestToc},
};
export type ManuscriptEdition=typeof MANUSCRIPT_EDITIONS[ManuscriptEditionId];
export type EditionProposal={id:string;before:string;after:string;reason:string;priority:string;page:number;page_end:number;anchorId?:string;paragraphIds?:string[];targetParagraphId?:string;targetNoteId?:string;applyText?:string;applyUnsupportedReason?:string;[key:string]:unknown};
export function editionFromSearch(search:string):ManuscriptEditionId{const id=new URLSearchParams(search).get('edition');return id==='v120'||id==='v121'||id==='v122'||id==='v123'||id==='v124'?id:'human80';}
export function editionDownloadPath(id:ManuscriptEditionId,format:'pdf'|'hwpx'|'md'|'guide'|'hwp'){
 const name=format==='guide'?'revision-guide.md':format==='hwp'?'original.hwp':`manuscript.${format}`;
 return `./editions/${id}/${name}`;
}
export function editionParagraphs(id:ManuscriptEditionId){return MANUSCRIPT_EDITIONS[id].catalog.paragraphs as ManuscriptParagraph[];}
export function editionProposals(id:ManuscriptEditionId):EditionProposal[]{
 const available=new Set(editionParagraphs(id).map(paragraph=>paragraph.id));
 const guide=id==='v120'?priorRevisionData:id==='v121'?previousRevisionData:id==='v122'?archived122RevisionData:id==='v123'?archived123RevisionData:revisionData;
 const applied=id!=='human80';
 return (guide.items as unknown as Record<string,any>[]).map(item=>{
  const paragraphIds=((applied?item.appliedParagraphIds:item.originalParagraphIds)||[]).filter((value:string)=>available.has(value));
  const targetParagraphId=paragraphIds[0];
  const targetNoteId=applied?item.appliedNoteId:item.originalNoteId;
  const page=Number(applied?item.appliedPage:item.humanPage)||Number(item.page)||1;
  const pages=(applied?item.appliedPages:item.humanPages)||[page];
  return {...item,id:item.id,before:item.before,after:item.after,reason:item.reason,priority:item.priority,page,page_end:Math.max(page,...pages),
   targetParagraphId,targetNoteId,anchorId:targetParagraphId,paragraphIds,
   // Applied editions already contain their own archived guide's changes.
   applyText:id==='human80'?item.applyText:undefined,
   applyUnsupportedReason:applied?`${id} 원고에 반영된 수정지시입니다. 추가 교정은 현재 문안에서 작성해 주세요.`:item.applyUnsupportedReason||'수정지시서의 변경 전·후를 확인하고 현재 문안을 교정해 주세요.',
  };
 });
}
