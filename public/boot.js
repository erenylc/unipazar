try{document.documentElement.dataset.theme=localStorage.getItem('unipazar-theme')==='dark'?'dark':'light';}catch{document.documentElement.dataset.theme='light';}
document.documentElement.dataset.initialRoute=(!location.hash||location.hash==='#/'||location.hash==='#')?'home':'other';
