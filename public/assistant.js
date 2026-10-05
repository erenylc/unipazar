const root=document.createElement('aside');
root.className='app-assistant';root.setAttribute('aria-label','Üni Satış yardım asistanı');
root.innerHTML=`<button type="button" class="assistant-launcher" aria-expanded="false" aria-controls="assistant-panel" aria-label="Üni Satış yardım asistanını aç"><img src="/logo-mark.svg" width="28" height="28" alt=""><span>Yardım</span></button>
 <section id="assistant-panel" class="assistant-panel" hidden aria-labelledby="assistant-title"><header><div><strong id="assistant-title">Üni Satış Asistanı</strong><small>Uygulama hakkında yardım</small></div><button type="button" class="assistant-close" aria-label="Asistanı kapat">×</button></header>
 <div class="assistant-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
 <div class="assistant-suggestions"><button type="button">Nasıl ilan verebilirim?</button><button type="button">Dayanışma nedir?</button><button type="button">Profil fotoğrafımı nasıl değiştiririm?</button></div>
 <form class="assistant-form"><label for="assistant-question" class="assistant-sr">Üni Satış ile ilgili sorun</label><input id="assistant-question" name="message" maxlength="600" placeholder="Üni Satış hakkında sor…" autocomplete="off" required><button type="submit" aria-label="Soruyu gönder">➜</button></form>
 <p class="assistant-disclosure">Şifreni, doğrulama kodunu veya kişisel bilgilerini yazma. <span class="assistant-mode">Yanıtlar uygulamanın yardım bilgilerinden hazırlanır.</span></p></section>`;
document.body.append(root);
const launcher=root.querySelector('.assistant-launcher'),panel=root.querySelector('.assistant-panel'),input=root.querySelector('input'),form=root.querySelector('form'),messages=root.querySelector('.assistant-messages');
let busy=false,configured=false;
function addMessage(text,user=false){const item=document.createElement('div');item.className='assistant-message'+(user?' assistant-user':'');item.textContent=text;messages.append(item);messages.scrollTop=messages.scrollHeight;return item;}
addMessage('Merhaba! Üni Satış’ta ilan verme, fotoğraflar, mesajlar ve hesap işlemleri hakkında yardımcı olabilirim.');
function close(){panel.hidden=true;launcher.setAttribute('aria-expanded','false');launcher.focus();}
launcher.addEventListener('click',async()=>{
 if(!panel.hidden){close();return;}panel.hidden=false;launcher.setAttribute('aria-expanded','true');input.focus();
 if(!configured){configured=true;try{const res=await fetch('/api/assistant/config');if(res.ok&&(await res.json()).aiAvailable)root.querySelector('.assistant-mode').textContent='Soruların yanıtlanmak için OpenAI’ye gönderilebilir. Yanıtlar Üni Satış’ın yardım bilgileriyle sınırlıdır.';}catch{}}
});
root.querySelector('.assistant-close').addEventListener('click',close);
root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)close();});
async function ask(question){
 if(busy||!question.trim())return;busy=true;form.querySelector('button').disabled=true;input.value='';addMessage(question,true);
 const waiting=addMessage('Yanıt hazırlanıyor…');waiting.setAttribute('aria-busy','true');
 try{
  const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:question}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Asistan yanıt veremedi.');
  waiting.textContent=data.answer;
  for(const source of data.sources||[]){if(!/^#\/[a-z-]*$/.test(source.link||''))continue;const link=document.createElement('a');link.href=source.link;link.textContent=source.label||source.title;link.addEventListener('click',close);waiting.append(link);}
 }catch(error){waiting.textContent=error.name==='TimeoutError'?'Bağlantı yavaş. Biraz sonra tekrar sorabilirsin.':error.message;}
 finally{waiting.removeAttribute('aria-busy');busy=false;form.querySelector('button').disabled=false;messages.scrollTop=messages.scrollHeight;}
}
form.addEventListener('submit',event=>{event.preventDefault();ask(input.value.trim());});
root.querySelectorAll('.assistant-suggestions button').forEach(button=>button.addEventListener('click',()=>ask(button.textContent)));
