/** Preserve each edition's printed note-marker style in the text view. */
export function manuscriptNoteLabel(number:string|number,edition:string){
 return `${number}${edition==='v127'?'':')'}`;
}
