export type PopupOffset={x:number;y:number};
export type PopupBounds={left:number;top:number;width:number;height:number};
export function clampPopupOffset(next:PopupOffset,base:PopupBounds,viewport:PopupBounds,margin=8,topInset=0):PopupOffset{
 const left=viewport.left+margin,top=viewport.top+Math.max(margin,topInset);
 const right=Math.max(left,viewport.left+viewport.width-margin-base.width);
 const bottom=Math.max(top,viewport.top+viewport.height-margin-base.height);
 return {x:Math.min(right,Math.max(left,base.left+next.x))-base.left,y:Math.min(bottom,Math.max(top,base.top+next.y))-base.top};
}
