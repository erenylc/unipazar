import {optimizePhoto} from './photo-upload.js';
const approved=new WeakSet();let pending=0;
async function configuration(){const response=await fetch('/api/assistant/config',{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Fotoğraf kontrol ayarı alınamadı. Biraz sonra tekrar dene.');return response.json();}
function status(input,text,error=false){
 const parent=input.closest('.field,.camera-options')||input.parentElement;
 let note=parent.querySelector('.photo-check-status');if(!note){note=document.createElement('p');note.className='photo-check-status';note.setAttribute('role','status');parent.append(note);}
 note.textContent=text;note.classList.toggle('photo-check-error',error);
}
document.addEventListener('change',async event=>{
 const input=event.target;
 if(!['photos','editPhotos','avatarGallery'].includes(input.id)||approved.has(input)){approved.delete(input);return;}
 const files=[...input.files||[]];if(!files.length||files.length>6||files.some(file=>file.size>12*1024*1024))return;
 event.stopImmediatePropagation();pending++;input.disabled=true;
 status(input,'Fotoğraflar hazırlanıyor…');
 try{
  const config=await configuration();
  if(config.photoModerationEnabled){
   status(input,'Uygunsuz içerik kontrolü yapılıyor. Fotoğraflar kontrol için OpenAI’ye gönderilir.');
   for(const file of files){
    const compact=await optimizePhoto(file,input.id==='avatarGallery'?768:1600),body=new FormData();body.append('photo',compact,compact.name);
    const response=await fetch('/api/photos/check',{method:'POST',body,signal:AbortSignal.timeout(20000)}),data=await response.json();
    if(!response.ok||!data.checked)throw new Error(data.error||'Fotoğraf kontrolü tamamlanamadı. Tekrar dene.');
   }
  }
  status(input,config.photoModerationEnabled?'Fotoğraflar kontrol edildi.':'');
  if(input.isConnected){approved.add(input);input.dispatchEvent(new Event('change',{bubbles:true}));}
 }catch(error){input.value='';status(input,error.name==='TimeoutError'?'Fotoğraf kontrolü zaman aşımına uğradı. Tekrar dene.':error.message,true);}
 finally{input.disabled=false;pending--;}
},true);
document.addEventListener('submit',event=>{
 if(pending&&['listing','edit-listing'].includes(event.target.dataset.form)){event.preventDefault();event.stopImmediatePropagation();const input=event.target.querySelector('input[type=file]');if(input)status(input,'Fotoğrafların kontrolü bitince ilanı gönderebilirsin.');}
},true);
