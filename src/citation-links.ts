import data from './citation-link-data.json';
import type {PageTarget} from './page-text';

const cases:Record<string,string>=data.sourceCases;
const destinations:Record<string,string>=data.caseDestinations;
const extra=data.extra as Record<string,PageTarget[]>;
const external=new Set(Object.values(extra).flat().filter(t=>t.kind==='external').map(t=>t.url));

export function bibliographyURL(url?:string){
  return url&&external.has(url)?url:undefined;
}

export function catalogCase(sourceId?:string){
  return sourceId?cases[sourceId]:undefined;
}

export function caseDestination(number:string){
  return destinations[number];
}

export function repairCitationTargets(page:number,raw:PageTarget[]){
  // Page 114 ends a body paragraph with 2014다32014. The following line
  // begins the printed footnote 168), which is a separate link.
  const targets=raw.filter(t=>!(page===114&&t.kind==='case'&&t.label==='2014다32014'&&t.line===19));
  return targets.map(t=>{
    const url=t.kind==='case'&&t.label?destinations[t.label]:undefined;
    return url?{...t,url}:t;
  }).concat(extra[String(page)]??[]);
}
