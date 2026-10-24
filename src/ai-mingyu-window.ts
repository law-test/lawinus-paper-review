// A separate chat keeps the paper's scroll position and document panes intact.
export function openMingyuChatWindow(){
 const url=new URL(window.location.href);url.search='?view=ai-mingyu&chat=1';url.hash='';
 if(window.innerWidth<700){window.location.assign(url.href);return true;}
 const chat=window.open(url.href,'ai-mingyu-chat','popup,width=660,height=840,resizable=yes,scrollbars=yes');
 if(!chat)return false;
 chat.focus();return true;
}
