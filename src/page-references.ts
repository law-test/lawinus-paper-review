type Reference={sourceId:string;targetPage?:number};
type Note={id:string;number:number;page:number;sourceRefs:Reference[]};
type Source={id:string;title:string};

export function pageReferences(notes:Note[],sources:Map<string,Source>,page:number){
 return notes.filter(note=>note.page===page).flatMap(note=>note.sourceRefs.flatMap(ref=>{
  const source=sources.get(ref.sourceId);
  return source?[{key:note.id+'/'+source.id,noteId:note.id,number:note.number,sourceId:source.id,title:source.title,page:ref.targetPage||1}]:[];
 }));
}
