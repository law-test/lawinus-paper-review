type QuestionKeyEvent={
 key:string;shiftKey:boolean;altKey?:boolean;repeat?:boolean;defaultPrevented?:boolean;
 nativeEvent?:{isComposing?:boolean;keyCode?:number};
 preventDefault:()=>void;
};

// keyCode 229 also protects IME confirmation where isComposing becomes false early.
export function handleQuestionEnter(event:QuestionKeyEvent,send:()=>void,composing=false,busy=false){
 if(event.key!=='Enter'||event.shiftKey||event.altKey||event.defaultPrevented||composing||event.nativeEvent?.isComposing||event.nativeEvent?.keyCode===229)return;
 event.preventDefault();
 if(!busy&&!event.repeat)send();
}
