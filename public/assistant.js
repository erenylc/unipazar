const root=document.createElement('aside');
root.className='app-assistant';root.setAttribute('aria-label','Üni Satış yardım asistanı');
root.innerHTML=`<button type="button" class="assistant-launcher" aria-expanded="false" aria-controls="assistant-panel" aria-label="Üni Satış yardım asistanını aç"><img src="/assistant-bot.svg" width="38" height="38" alt=""><span>Asistan</span></button>
 <section id="assistant-panel" class="assistant-panel" hidden aria-labelledby="assistant-title"><header><div><strong id="assistant-title">Üni Satış Asistanı</strong><small>Uygulama hakkında yardım</small></div><button type="button" class="assistant-close" aria-label="Asistanı kapat">×</button></header>
 <div class="assistant-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
 <div class="assistant-suggestions"><button type="button">Nasıl ilan verebilirim?</button><button type="button">Dayanışma nedir?</button><button type="button">Profil fotoğrafımı nasıl değiştiririm?</button></div>
 <form class="assistant-form"><label for="assistant-question" class="assistant-sr">Üni Satış ile ilgili sorun</label><input id="assistant-question" name="message" maxlength="600" placeholder="Üni Satış hakkında sor…" autocomplete="off" required><button type="button" class="assistant-mic" aria-label="Sesli soru yazdır" title="Sesli soru yazdır" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg></button><button type="submit" aria-label="Soruyu gönder">➜</button></form>
 <details class="assistant-privacy"><summary>Gizlilik</summary><p><span class="assistant-mode">Yanıtlar uygulamanın yardım bilgilerinden hazırlanır.</span> Şifre veya doğrulama kodu yazma.</p></details></section>`;
document.body.append(root);
const launcher=root.querySelector('.assistant-launcher'),panel=root.querySelector('.assistant-panel'),input=root.querySelector('input'),form=root.querySelector('form'),messages=root.querySelector('.assistant-messages');
let busy=false,configured=false;
const history=[];
const sendButton=form.querySelector('[type="submit"]');
function addMessage(text,user=false){const item=document.createElement('div');item.className='assistant-message'+(user?' assistant-user':'');item.textContent=text;messages.append(item);messages.scrollTop=messages.scrollHeight;return item;}
addMessage('Merhaba! Üni Satış’ta ilan verme, fotoğraflar, mesajlar ve hesap işlemleri hakkında yardımcı olabilirim.');
function close(){recognition?.abort();panel.hidden=true;launcher.setAttribute('aria-expanded','false');launcher.focus();}
launcher.addEventListener('click',async()=>{
 if(!panel.hidden){close();return;}panel.hidden=false;launcher.setAttribute('aria-expanded','true');input.focus();
 if(!configured){configured=true;try{const res=await fetch('/api/assistant/config');if(res.ok){const config=await res.json();if(config.aiAvailable)root.querySelector('.assistant-mode').textContent=config.provider==='gemini'?'Soruların ve son sohbet mesajların Google Gemini’ye gönderilir. Ücretsiz kullanımda Google bu içerikleri ürünlerini geliştirmek için kullanabilir. Kota dolarsa yardım bilgilerinden yanıt verilir.':'Soruların ve son sohbet mesajların yanıtlanmak için OpenAI’ye gönderilir.';}}catch{}}
});
root.querySelector('.assistant-close').addEventListener('click',close);
root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)close();});
document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!root.contains(event.target)){panel.hidden=true;launcher.setAttribute('aria-expanded','false');recognition?.abort();}});
async function ask(question){
 if(busy||!question.trim())return;busy=true;sendButton.disabled=true;input.value='';addMessage(question,true);
 const waiting=addMessage('Yanıt hazırlanıyor…');waiting.setAttribute('aria-busy','true');
 try{
  const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:question,history:history.slice(-10)}),signal:AbortSignal.timeout(25000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Asistan yanıt veremedi.');
  waiting.textContent=data.answer;
  history.push({role:'user',content:question},{role:'assistant',content:data.answer.slice(0,2400)});if(history.length>10)history.splice(0,history.length-10);
  for(const source of data.sources||[]){if(!/^#\/[a-z-]*$/.test(source.link||''))continue;const link=document.createElement('a');link.href=source.link;link.textContent=source.label||source.title;link.addEventListener('click',close);waiting.append(link);}
 }catch(error){waiting.textContent=error.name==='TimeoutError'?'Bağlantı yavaş. Biraz sonra tekrar sorabilirsin.':error.message;}
 finally{waiting.removeAttribute('aria-busy');busy=false;sendButton.disabled=false;messages.scrollTop=messages.scrollHeight;}
}
form.addEventListener('submit',event=>{event.preventDefault();ask(input.value.trim());});
root.querySelectorAll('.assistant-suggestions button').forEach(button=>button.addEventListener('click',()=>ask(button.textContent)));
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const mic=root.querySelector('.assistant-mic');
let recognition=null,listening=false;
if(SpeechRecognition){
 mic.hidden=false;recognition=new SpeechRecognition();recognition.lang=document.documentElement.lang||'tr-TR';recognition.interimResults=true;
 recognition.onstart=()=>{listening=true;mic.classList.add('listening');mic.setAttribute('aria-label','Dinlemeyi durdur');mic.title='Dinlemeyi durdur';input.placeholder='Dinliyorum…';};
 recognition.onresult=event=>{input.value=Array.from(event.results).map(result=>result[0].transcript).join(' ').slice(0,600);};
 recognition.onend=()=>{listening=false;mic.classList.remove('listening');mic.setAttribute('aria-label','Sesli soru yazdır');mic.title='Sesli soru yazdır';input.placeholder='Üni Satış hakkında sor…';input.focus();};
 recognition.onerror=event=>{if(event.error==='aborted')return;addMessage(event.error==='not-allowed'?'Sesli soru için tarayıcıdan mikrofon izni vermen gerekiyor.':'Ses algılanamadı. Sorunu yazarak da gönderebilirsin.');};
 mic.addEventListener('click',()=>{if(listening){recognition.stop();return;}try{recognition.start();}catch{addMessage('Sesli giriş başlatılamadı. Tekrar deneyebilirsin.');}});
}else{mic.hidden=false;mic.addEventListener('click',()=>addMessage('Bu tarayıcı sesli yazdırmayı desteklemiyor. Telefon klavyendeki mikrofonu kullanarak sorunu yazdırabilirsin.'));}
