export function viewportState({width,height,layoutHeight,offsetTop=0,scale=1,editing=false}){
 return {height:Math.max(1,height),top:Math.max(0,offsetTop),keyboard:width<=700&&editing&&scale<=1.05&&layoutHeight-height>100};
}

if(typeof window!=='undefined'){
 const html=document.documentElement,viewport=window.visualViewport;
 let baseline=window.innerHeight,scheduled=false;
 const editable=element=>element?.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,[contenteditable=true]');
 function update(){
  scheduled=false;
  const active=document.activeElement,editing=editable(active);
  if(!editing)baseline=window.innerHeight;
  const state=viewportState({width:window.innerWidth,height:viewport?.height||window.innerHeight,layoutHeight:Math.max(baseline,window.innerHeight),offsetTop:viewport?.offsetTop||0,scale:viewport?.scale||1,editing});
  html.style.setProperty('--visible-height',state.height+'px');
  html.style.setProperty('--visible-top',state.top+'px');
  html.classList.toggle('mobile-keyboard',state.keyboard);
  html.classList.toggle('chat-keyboard',state.keyboard&&!!active.closest('.chat-compose'));
  html.classList.toggle('assistant-editing',!!editing&&!!active.closest('.app-assistant'));
  if(state.keyboard&&editing&&!active.closest('.app-assistant,.chat-compose')){
   const rect=active.getBoundingClientRect();
   if(rect.bottom>state.top+state.height-16||rect.top<state.top+16)active.scrollIntoView({block:'center',behavior:'instant'});
  }
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
 viewport?.addEventListener('resize',schedule);
 viewport?.addEventListener('scroll',schedule);
 window.addEventListener('resize',schedule);
 window.addEventListener('orientationchange',()=>{baseline=window.innerHeight;schedule();});
 document.addEventListener('focusin',schedule);
 document.addEventListener('focusout',schedule);
 update();
}
