import data from './citation-links.json' with {type:'json'};
import v120Data from './citation-links-v120.json' with {type:'json'};
import v121Data from './citation-links-v121.json' with {type:'json'};
import v122Data from './citation-links-v122.json' with {type:'json'};
import v123Data from './citation-links-v123.json' with {type:'json'};
import v124Data from './citation-links-v124.json' with {type:'json'};
import v126Data from './citation-links-v126.json' with {type:'json'};
import v127Data from './citation-links-v127.json' with {type:'json'};
import type {PdfTarget} from './pdf-viewer-model.ts';

export type CitationSegment={start:number;end:number;sourceId?:string;page:number;title:string;linkId:string;status:'available'|'unavailable';href?:string};
type CitationNote={text:string;segments:CitationSegment[]};
type EditionId='human80'|'v120'|'v121'|'v122'|'v123'|'v124'|'v126'|'v127';
export type CitationDataset={notes:Record<string,CitationNote>;pdfTargets:PdfTarget[]};
export function createCitationLinkModel(source:CitationDataset){
 return {
  getCitationSegments(noteId:string,text:string):CitationSegment[]{
   const note=source.notes[noteId];
   if(!note||!text||note.text!==text)return [];
   return note.segments.map(segment=>({...segment}));
  },
  citationPdfTargets():PdfTarget[]{return source.pdfTargets.map(target=>({...target,rect:[...target.rect]}));},
 };
}
const editions={human80:createCitationLinkModel(data as unknown as CitationDataset),v120:createCitationLinkModel(v120Data as unknown as CitationDataset),v121:createCitationLinkModel(v121Data as unknown as CitationDataset),v122:createCitationLinkModel(v122Data as unknown as CitationDataset),v123:createCitationLinkModel(v123Data as unknown as CitationDataset),v124:createCitationLinkModel(v124Data as unknown as CitationDataset),v126:createCitationLinkModel(v126Data as unknown as CitationDataset),v127:createCitationLinkModel(v127Data as unknown as CitationDataset)};
// Offsets belong to the audited original note. An edit must never inherit an
// adjacent citation's destination because its characters happen to move.
export function getCitationSegments(noteId:string,text:string,edition:EditionId='human80'):CitationSegment[]{
  return editions[edition].getCitationSegments(noteId,text);
}
export function citationPdfTargets(edition:EditionId='human80'):PdfTarget[]{
  return editions[edition].citationPdfTargets();
}
