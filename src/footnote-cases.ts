import index from './footnote-case-index.json';
import originals from './case-original-locations.json';
import type {PageTarget} from './page-text';

export type CasePart='order'|'reasons';
export type OriginalPoint={page:number;y:number;text:string};
export type CaseOriginal={sourceId:string;order:OriginalPoint;reasons?:OriginalPoint;note?:string;officialUrl?:string;title?:string};
const notes=index.notes as Record<string,string[]>;
const printed=index.targets as Record<string,PageTarget[]>;
const locations=originals as Record<string,CaseOriginal>;

export function casesInNote(number?:number):string[]{return notes[String(number)]??[];}
export function caseOriginal(number:string){return locations[number];}
export function footnoteCaseTargets(page:number,targets:PageTarget[]){
  const verified=printed[String(page)]||[];
  if(!verified.length)return targets;
  return targets.filter(t=>{
    if(t.kind==='case'&&t.noteNumber&&casesInNote(t.noteNumber).length)return false;
    return !(t.sourceId==='v15-9461652d69101d4f'&&(t.noteNumber===301||t.number===301)&&t.kind==='note');
  }).concat(verified);
}
