try{document.documentElement.dataset.theme=localStorage.getItem('unipazar-theme')==='dark'?'dark':'light';}catch{document.documentElement.dataset.theme='light';}
document.documentElement.dataset.initialRoute=(!location.hash||location.hash==='#/'||location.hash==='#')?'home':'other';
if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true){
 document.documentElement.classList.add('app-launching');
 document.addEventListener('DOMContentLoaded',()=>{
  const splash=document.querySelector('.launch-screen');
  const finish=()=>{document.documentElement.classList.remove('app-launching');splash?.remove();};
  splash?.addEventListener('animationend',event=>{if(event.animationName==='launch-screen-away')finish();},{once:true});
  setTimeout(finish,850);
 },{once:true});
}
