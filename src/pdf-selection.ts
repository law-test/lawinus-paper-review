export function selectedPdfText(host:Pick<HTMLElement,'contains'>|null,selection:Pick<Selection,'isCollapsed'|'anchorNode'|'focusNode'|'toString'>|null):string{
 if(!host||!selection||selection.isCollapsed||!selection.anchorNode||!selection.focusNode||!host.contains(selection.anchorNode)||!host.contains(selection.focusNode))return '';
 return selection.toString();
}
