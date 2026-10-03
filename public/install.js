let installPrompt=null;
const button=document.querySelector('#install-button');
const status=document.querySelector('#install-status');
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function updateInstall(){
 if(!button)return;
 button.hidden=standalone()||!installPrompt;
 if(standalone()&&status)status.textContent='UniSatış uygulama olarak açıldı. Kullanıma hazırsın.';
}
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();installPrompt=event;updateInstall();
});
window.addEventListener('appinstalled',()=>{installPrompt=null;if(status)status.textContent='UniSatış yüklendi. Ana ekrandaki simgesinden açabilirsin.';updateInstall();});
button?.addEventListener('click',async()=>{
 if(!installPrompt)return;
 const prompt=installPrompt;installPrompt=null;button.disabled=true;
 try{await prompt.prompt();const {outcome}=await prompt.userChoice;if(status)status.textContent=outcome==='accepted'?'Kurulum isteği kabul edildi. Ana ekranını kontrol et.':'Dilediğinde tarayıcı menüsünden tekrar yükleyebilirsin.';}
 catch{if(status)status.textContent='Tarayıcı menüsünden “Uygulamayı yükle” seçeneğini kullanabilirsin.';}
 finally{button.disabled=false;updateInstall();}
});
updateInstall();
function updateThemeColor(){
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=document.documentElement.dataset.theme==='dark'?'#1e1e2e':'#f6f6f1';
}
updateThemeColor();
new MutationObserver(updateThemeColor).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{}));
