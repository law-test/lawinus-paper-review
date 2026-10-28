import data from './citation-links.json' with {type:'json'};
import v112Data from './citation-links-v112.json' with {type:'json'};
import type {PdfTarget} from './pdf-viewer-model.ts';

export type CitationSegment={start:number;end:number;sourceId?:string;page:number;title:string;linkId:string;status:'available'|'unavailable';href?:string};
type CitationNote={text:string;segments:CitationSegment[]};
type EditionId='human77'|'v112';
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
const editions={human77:createCitationLinkModel(data as unknown as CitationDataset),v112:createCitationLinkModel(v112Data as unknown as CitationDataset)};
// Offsets belong to the audited original note. An edit must never inherit an
// adjacent citation's destination because its characters happen to move.
export function getCitationSegments(noteId:string,text:string,edition:EditionId='human77'):CitationSegment[]{
  return editions[edition].getCitationSegments(noteId,text);
}
export function citationPdfTargets(edition:EditionId='human77'):PdfTarget[]{
  return editions[edition].citationPdfTargets();
}
