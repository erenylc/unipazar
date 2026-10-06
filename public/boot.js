try{document.documentElement.dataset.theme=localStorage.getItem('unipazar-theme')==='dark'?'dark':'light';}catch{document.documentElement.dataset.theme='light';}
document.documentElement.dataset.initialRoute=(!location.hash||location.hash==='#/'||location.hash==='#')?'home':'other';
if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true){
 document.documentElement.classList.add('app-launching');
 let ready=false;
 const finish=()=>{
  if(ready)return;ready=true;
  document.documentElement.classList.add('app-launch-complete');
  setTimeout(()=>{document.documentElement.classList.remove('app-launching','app-launch-complete');document.querySelector('.launch-screen')?.remove();},220);
 };
 document.addEventListener('unisatis-ready',finish,{once:true});
 // Show the already-rendered page immediately; network requests continue behind it.
 document.addEventListener('DOMContentLoaded',finish,{once:true});
 setTimeout(finish,300);
 document.addEventListener('DOMContentLoaded',()=>{
  document.querySelector('.launch-retry button')?.addEventListener('click',()=>location.reload());
  setTimeout(()=>{if(!ready){const retry=document.querySelector('.launch-retry');if(retry)retry.hidden=false;}},12000);
 },{once:true});
}
