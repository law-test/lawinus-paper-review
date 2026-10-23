export type FourPaneCuts={thesis:number;sourceEnd:number};
export const DEFAULT_FOUR_PANE_CUTS:FourPaneCuts={thesis:40,sourceEnd:72};
const finite=(n:unknown,fallback:number)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));

/** Positions of the two document dividers, excluding the navigation sidebar. */
export function normalizeFourPaneCuts(value:unknown):FourPaneCuts{
  const row=value&&typeof value==='object'?value as Partial<FourPaneCuts>:{};
  const thesis=clamp(finite(row.thesis,DEFAULT_FOUR_PANE_CUTS.thesis),22,60);
  const sourceEnd=clamp(finite(row.sourceEnd,DEFAULT_FOUR_PANE_CUTS.sourceEnd),thesis+20,80);
  return {thesis,sourceEnd};
}
export function moveFourPaneBoundary(cuts:FourPaneCuts,boundary:'thesis'|'source',value:number):FourPaneCuts{
  const current=normalizeFourPaneCuts(cuts);
  return boundary==='thesis'
    ?{...current,thesis:clamp(finite(value,current.thesis),22,current.sourceEnd-20)}
    :{...current,sourceEnd:clamp(finite(value,current.sourceEnd),current.thesis+20,80)};
}
export function fourPaneColumns(cuts:FourPaneCuts):string{
  const {thesis,sourceEnd}=normalizeFourPaneCuts(cuts);
  return `minmax(0, ${thesis}fr) 6px minmax(0, ${sourceEnd-thesis}fr) 6px minmax(0, ${100-sourceEnd}fr)`;
}
