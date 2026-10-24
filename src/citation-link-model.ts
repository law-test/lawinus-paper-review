import data from './citation-links.json' with {type:'json'};
import type {PdfTarget} from './pdf-viewer-model.ts';

export type CitationSegment={start:number;end:number;sourceId?:string;page:number;title:string;linkId:string;status:'available'|'unavailable';href?:string};
type CitationNote={text:string;segments:CitationSegment[]};
const notes=data.notes as Record<string,CitationNote>;
// Offsets belong to the audited original note. An edit must never inherit an
// adjacent citation's destination because its characters happen to move.
export function getCitationSegments(noteId:string,text:string):CitationSegment[]{
  const note=notes[noteId];
  if(!note||!text||note.text!==text)return [];
  return note.segments.map(segment=>({...segment}));
}
export function citationPdfTargets():PdfTarget[]{
  return (data.pdfTargets as PdfTarget[]).map(target=>({...target,rect:[...target.rect]}));
}
