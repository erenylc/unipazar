import {validateRegistration} from './registration-validation.js';
import {languages,applyLocale,translateText} from './i18n.js';
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = cents => new Intl.NumberFormat(({tr:'tr-TR',en:'en-GB',es:'es-ES',kk:'kk-KZ',de:'de-DE',fr:'fr-FR'})[language]||'tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format((cents || 0)/100);
const listingStatus = status => translateText(({active:'Yayında',reserved:'Ayrıldı',sold:'Tamamlandı',removed:'Kaldırıldı',expired:'Süresi doldu'})[status] || status,language);
function localizedMessageText(value){
 const text=String(value||'');
 const offer=text.match(/^(.*) fiyat teklifi gönderdi\.$/);
 if(offer)return `${offer[1]} ${translateText('fiyat teklifi gönderdi.',language)}`;
 for(const prefix of ['📷 Fotoğraf','🎤 Sesli mesaj'])if(text.startsWith(prefix))return translateText(prefix,language)+text.slice(prefix.length);
 return text;
}
const state = { user:null, listings:[], universities:[], emailVerificationAvailable:false, unreadCount:0, selectedConversation:null, filters:{ q:'',category:'',kind:'',university:'' }, modal:null, authTab:'login', devCode:'', pendingRememberMe:false, pendingEmailVerification:false };
let language=languages[localStorage.getItem('unipazar-language')]?localStorage.getItem('unipazar-language'):'tr';
let theme=localStorage.getItem('unipazar-theme')==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;
 const categories = ['Ders kitapları','Elektronik','Ev & yurt','Giyim','Bisiklet & spor','Diğer'];
const icon = { home:'⌂', heart:'♡', plus:'＋', chat:'▤', user:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.4-4.2 3-6.3 7.5-6.3s7.1 2.1 7.5 6.3"/></svg>' };
let toastTimer;
const responseCache=new Map();
let cacheGeneration=0;
function cacheLifetime(url){
 if(url.startsWith('/api/listings?'))return 30000;
 if(/^\/api\/listings\/\d+$/.test(url))return 30000;
 if(url==='/api/mine'||url==='/api/favorites')return 30000;
 if(url==='/api/conversations')return 5000;
 return 0;
}
let voiceAudioContext=null, voiceAnalyser=null, voiceAnimation=null, voiceStarted=0;
let chatPhoto=null, cameraStream=null, voiceClip=null, voicePreviewUrl=null, voiceRecorder=null, voiceStream=null, voiceTimer=null, voiceSeconds=0, discardVoice=false, selectedListingPhotos=[], keptEditPhotos=[], newEditPhotos=[];
const themeIcon=()=>theme==='dark'?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.9A8.7 8.7 0 0 1 8.1 3.8 8.8 8.8 0 1 0 20.2 15.9Z"/><path d="M17.4 3.2v3.4m-1.7-1.7h3.4M21 8.1v2m-1-1h2"/></svg>';
function toast(message){ const el=$('#toast'); el.textContent=translateText(message,language); el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),4000); }
async function api(url, options={}){
  const method=options.method||'GET',lifetime=method==='GET'?cacheLifetime(url):0;
  if(method!=='GET'){responseCache.clear();cacheGeneration++;}
  const cached=lifetime?responseCache.get(url):null;
  if(cached && cached.expires>Date.now())return cached.value||cached.promise;
  const generation=cacheGeneration;
  const request=performApi(url,options);
  if(!lifetime)return request;
  responseCache.set(url,{promise:request,expires:Date.now()+lifetime});
  try{const value=await request;if(generation===cacheGeneration&&responseCache.get(url)?.promise===request)responseCache.set(url,{value,expires:Date.now()+lifetime});return value;}
  catch(error){if(generation===cacheGeneration&&responseCache.get(url)?.promise===request)responseCache.delete(url);throw error;}
}
async function performApi(url, options={}){
  const config={...options,headers:{...(options.headers||{})}};
  if (options.body && !(options.body instanceof FormData)) { config.headers['Content-Type']='application/json'; config.body=JSON.stringify(options.body); }
  const res=await fetch(url,config);
  const data=await res.json().catch(()=>({}));
  if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('debugRequests')){
   const response=url==='/api/universities'?{universityCount:data.universities?.length,emailVerificationAvailable:data.emailVerificationAvailable}:url==='/api/me'?{signedIn:!!data.user,emailVerificationAvailable:data.emailVerificationAvailable}:{keys:Object.keys(data),errorFields:Object.keys(data.fields||{})};
   console.info('[API]',JSON.stringify({method:options.method||'GET',url,status:res.status,response}));
  }

  if(!res.ok){const original=data.error||'İşlem tamamlanamadı.', translated=translateText(original,language);const error=new Error(language==='tr'||translated!==original?translated:translateText('İşlem tamamlanamadı.',language));error.fields=data.fields;throw error;}
  return data;
}
function route(){ return (location.hash || '#/').slice(1); }
function go(path){ location.hash='#'+path; }
function navbar(active){
  const link=(path,label)=>`<a href="#${path}" class="${active===path?'active':''}">${label}</a>`;
  const badge=state.unreadCount?`<span class="message-badge message-count">${state.unreadCount>99?'99+':state.unreadCount}</span>`:'<span class="message-badge message-count" hidden></span>';
  const supportLink=state.user?.needsSupport?link('/donation','Dayanışma'):'';
  const profile=state.user?`<div class="profile-menu" hidden><div class="profile-summary"><strong>${escapeHtml(state.user.name)}</strong><span>${escapeHtml(state.user.university)}</span><small>${escapeHtml(state.user.email)}</small></div><a href="#/account">Hesabım</a>${state.user.role==='admin'?'<a href="#/admin">Yönetim</a>':''}<details class="language-menu"><summary>🌐 ${translateText('Dil',language)} · ${languages[language]}</summary><div class="language-options">${Object.entries(languages).map(([code,label])=>`<button type="button" data-action="set-language" data-language="${code}" ${code===language?'aria-current="true"':''}>${label}</button>`).join('')}</div></details><button class="profile-logout" data-action="logout">Hesaptan çıkış yap</button></div>`:'';
  return `<header class="topbar"><div class="shell top-inner"><a href="#/" class="brand"><img class="brand-mark" src="/logo-mark.svg" alt="" width="36" height="36">UniSatış</a><nav class="nav">${link('/','Keşfet')}${supportLink}${link('/favorites','Favoriler')}${link('/messages',`Mesajlarım ${badge}`)}${state.user?link('/mine','İlanlarım'):''}${state.user?.role==='admin'?link('/admin','Yönetim'):''}</nav><div class="top-spacer"></div><div class="top-actions"><button type="button" class="theme-toggle" data-action="toggle-theme" aria-label="${theme==='dark'?'Açık moda geç':'Karanlık moda geç'}" title="${theme==='dark'?'Açık mod':'Karanlık mod'}">${themeIcon()}</button><a class="support-entry" href="#/support">Destek</a><button class="btn btn-primary desktop-only" data-action="sell">＋ İlan ver</button><button class="icon-btn account-icon" data-action="account" aria-label="Hesabım" aria-expanded="false">${icon.user}</button>${profile}</div></div></header><nav class="mobile-nav"><a href="#/" class="${active==='/'?'active':''}"><span>${icon.home}</span>Keşfet</a>${state.user?.needsSupport?`<a href="#/donation" class="${active==='/donation'?'active':''}"><span>♧</span>Dayanışma</a>`:''}<a href="#/support"><span>♡</span>Destek</a><a href="#/sell"><span>${icon.plus}</span>İlan ver</a><a href="#/messages"><span>${icon.chat}${badge}</span>Mesajlar</a><a href="#/mine"><span>${icon.user}</span>İlanlarım</a>${state.user?.role==='admin'?`<a href="#/admin" class="${active==='/admin'?'active':''}"><span>⚙</span>Yönetim</a>`:''}</nav>`;
}
function footer(){ return `<footer class="footer"><div class="shell footer-inner"><span>© ${new Date().getFullYear()} Üni Satış · Üniversite içinde alışveriş ve dayanışma</span><span>Güvenli buluşmalar için kalabalık ve bilinen noktaları tercih et.</span></div></footer>`; }
function listingCard(item){
 const isDonation=item.kind==='donation';
 return `<article class="card"><a class="card-image" href="#/listing/${item.id}">${item.cover?`<img src="/uploads/${encodeURIComponent(item.cover)}" alt="${escapeHtml(item.title)}" loading="lazy">`:'<div class="placeholder">Fotoğraf yok</div>'}<span class="badge ${isDonation?'free':''}">${isDonation?'Dayanışma':'İkinci el'}</span></a><button class="favorite" data-action="favorite" data-id="${item.id}" aria-label="${item.favorite?'Favorilerden çıkar':'Favorilere ekle'}">${item.favorite?'♥':'♡'}</button><div class="card-body"><a href="#/listing/${item.id}"><h3>${escapeHtml(item.title)}</h3><div class="price">${isDonation?'Ücretsiz':money(item.price)}</div><div class="meta">${escapeHtml(item.university)} · ${escapeHtml(translateText(item.condition,language))}</div><span class="card-detail">İlanı incele <span aria-hidden="true">→</span></span></a></div></article>`;
}
function empty(title,body){ return `<div class="empty"><div class="empty-icon">☘</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`; }
function pageFrame(content,active){
 const art={'/favorites':'favorites','/mine':'listings','/manage':'listings','/sell':'listings','/account':'account','/support':'support','/admin':'account'}[active];
 if(art)content=content.replace(/<div class="section-head"><div><h2>([\s\S]*?)<\/h2><p>([\s\S]*?)<\/p><\/div><\/div>/,
  (_match,title,subtitle)=>`<section class="page-intro page-intro-${art}"><div><span class="page-intro-kicker">ÜNİ SATIŞ</span><h2>${title}</h2><p>${subtitle}</p></div><img src="/${art}-illustration.svg" alt="" aria-hidden="true"></section>`);
 $('#app').innerHTML=navbar(active)+content+footer();
 applyLocale($('#app'),language);
}
async function loadListings(){
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(state.filters)) if(value && !(key==='university' && value==='*')) params.set(key,value);
  state.listings=(await api('/api/listings?'+params)).listings;
}
async function refreshSearchResults(query){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(state.filters)) if(value && !(key==='university' && value==='*')) params.set(key,value);
 try{
  const {listings}=await api('/api/listings?'+params);
  const input=$('#searchInput');
  if(!input || input.value!==query || !['/','/donation'].includes(route())) return;
  state.listings=listings;
  $('.grid').innerHTML=listings.length?listings.map(listingCard).join(''):empty(query?'Sonuç bulunamadı':'Henüz ilan yok',query?'Başka bir ürün adı deneyebilirsin.':'İlk ilanı sen verebilirsin.');
  $('.result-count').textContent=`${listings.length} ilan`;
  applyLocale($('.grid'),language);
  $('.result-count').textContent=translateText(`${listings.length} ilan`,language);
  $('.grid').setAttribute('aria-busy','false');
 }catch(error){toast(error.message);$('.grid')?.setAttribute('aria-busy','false');}
}
async function renderBrowse(donations=false){
 if(donations && !state.user?.needsSupport){go('/support');return;}
 state.filters.kind=donations?'donation':'sale';
  if(donations && state.user) state.filters.university=state.user.university;
 if(!donations && state.user && !state.filters.university) state.filters.university=state.user.university;
 await loadListings();
 if(route()!==(donations?'/donation':'/'))return;
  const title=donations?'Dayanışma ilanları':'Üniversitende neler var?';
  pageFrame(`<main class="shell page">${donations?`<section class="hero"><div class="hero-copy"><div class="eyebrow">♧ Bir eşya, yeni bir başlangıç</div><h1>Paylaştıkça üniversiten güzelleşir.</h1><p>Kullanmadığın eşyaları ücretsiz ver; ihtiyacı olan bir öğrencinin işine yarasın.</p><button class="btn" data-action="sell-donation">Ücretsiz ürün ver →</button></div><div class="hero-art"><img src="/hero-illustration.svg" alt="İkinci el alışveriş ve öğrenci dayanışması çizimi"></div></section>`:`<section class="hero"><div class="hero-copy"><div class="eyebrow">Üni Satış · Öğrenci pazarı ve dayanışma</div><h1>Eşyalar el değiştirir,<br>iyilik büyür.</h1><p>Üniversitende ikinci el alışveriş yap; kullanmadıklarını ihtiyacı olan öğrencilere ücretsiz ver.</p><button class="btn" data-action="sell">İlan ver →</button></div><div class="hero-art"><img src="/hero-illustration.svg" alt="İkinci el alışveriş ve öğrenci dayanışması çizimi"></div></section>`}<div class="campus-strip"><span class="campus-label">Üniversite seç:</span>${donations?`<span class="campus-pill">${escapeHtml(state.user.university)}</span>`:`<button class="campus-picker" data-action="choose-university" aria-label="İlanları görmek için üniversite seç"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 9 10-5 10 5-10 5L2 9Zm4 3v5c3.8 2.8 8.2 2.8 12 0v-5M22 9v7"/></svg><span>${escapeHtml(state.filters.university==='*'?'Tüm üniversiteler':state.filters.university||'Üniversite seç')}</span><b aria-hidden="true">⌄</b></button>`}${!state.user?'<span>Üniversite seçerek ilanları inceleyebilirsin.</span>':''}</div>${donations?`<div class="panel donation-process"><h2>Dayanışma nasıl işler?</h2><div class="steps"><div><strong>1. Ürünü incele</strong><p>Üniversitendeki ücretsiz ürünleri ve açıklamalarını gör.</p></div><div><strong>2. Talep gönder</strong><p>İhtiyacın olan ürüne kısa bir notla talep gönder.</p></div><div><strong>3. Teslim al</strong><p>Bağışçı seçerse güvenli bir noktada teslim alın.</p></div></div><p class="small muted">Aynı anda en fazla 3 açık talep gönderebilirsin.</p></div>`:''}<div class="section-head"><div><h2>${title}</h2><p>${donations?'Ücretsiz ürünleri destek isteyen öğrenciler görebilir ve talep edebilir.':'Öğrencilerin yeni eklediği ilanlar'}</p></div><span class="muted small result-count">${state.listings.length} ilan</span></div><div class="filters"><label class="search"><span>⌕</span><input id="searchInput" placeholder="Ürün, kitap, marka ara..." value="${escapeHtml(state.filters.q)}" aria-label="Ürün ara"></label><details class="category-menu"><summary>${escapeHtml(state.filters.category||'Tüm kategoriler')} <span>⌄</span></summary><div class="category-options">${['',...categories].map(c=>`<button type="button" data-action="filter-category" data-category="${escapeHtml(c)}" aria-pressed="${state.filters.category===c}">${escapeHtml(c||'Tüm kategoriler')}</button>`).join('')}</div></details></div><div class="grid">${state.listings.length?state.listings.map(listingCard).join(''):empty('Henüz ilan yok','İlk ilanı sen verebilirsin.')}</div>${!donations?`<div class="donation-banner"><div><h2>Dayanışma da üniversitenin bir parçası.</h2><p>Kullanmadığın bir eşya başka bir öğrencinin ihtiyacını karşılayabilir.</p></div><a class="btn btn-primary" href="#/sell-donation">Ücretsiz ürün ver →</a></div>`:''}</main>`,donations?'/donation':'/');
}
async function renderDetail(id){
 const {listing:l}=await api('/api/listings/'+id);if(route()!=='/listing/'+id)return;
  const images=l.images.length?l.images.map(i=>`<img src="/uploads/${encodeURIComponent(i.filename)}" alt="${escapeHtml(l.title)}" loading="lazy">`).join(''):`<div class="placeholder" style="grid-column:1/-1;height:390px">Fotoğraf yok</div>`;
 const mine=state.user?.id===l.seller_id;
  pageFrame(`<main class="shell page"><a class="back-link" href="#${l.kind==='donation'?'/donation':'/'}"><span aria-hidden="true">←</span> İlanlara dön</a><div class="detail" style="margin-top:18px"><div><div class="detail-gallery">${images}</div><div class="panel" style="margin-top:18px"><h2>Ürün açıklaması</h2><p style="white-space:pre-wrap">${escapeHtml(l.description)}</p><div class="rule"></div><div class="inline-actions"><span class="status">${escapeHtml(translateText(l.category,language))}</span><span class="status">${escapeHtml(translateText(l.condition,language))}</span><span class="status">${escapeHtml(l.university)}</span></div></div></div><aside class="panel detail-side"><span class="badge ${l.kind==='donation'?'free':''}">${l.kind==='donation'?'Dayanışma':'İkinci el'}</span><h1>${escapeHtml(l.title)}</h1><div class="detail-price">${l.kind==='donation'?'Ücretsiz':money(l.price)}</div><div class="muted small" style="margin-top:10px">⌖ ${escapeHtml(l.university)}</div><div class="rule"></div><a class="seller seller-link" href="#/seller/${l.seller_id}"><span class="avatar">${escapeHtml(l.seller_name[0]?.toUpperCase())}</span><div><strong>${escapeHtml(l.seller_name)}</strong><div class="muted small">Diğer satış ilanlarını gör →</div></div></a><div class="rule"></div>${l.status!=='active'?`<p class="status">${l.status==='expired'?'Bu ilan 180 günü doldurduğu için yayından kaldırıldı.':`Bu ilan şu an ${listingStatus(l.status).toLocaleLowerCase('tr-TR')}.`}</p>`:mine?`<button class="btn btn-light" data-action="mark-sold" data-id="${l.id}">${l.kind==='donation'?'Verildi':'Satıldı'} olarak işaretle</button>`:l.kind==='donation'?`<button class="btn btn-primary" style="width:100%" data-action="request-donation" data-id="${l.id}">Ürünü talep et</button><p class="small muted">Destek isteyen öğrenciler talep gönderebilir.</p>`:`<button class="btn btn-primary" style="width:100%" data-action="start-chat" data-id="${l.id}">Satıcıya özel mesaj yaz</button>`}<button class="btn btn-light" style="width:100%;margin-top:9px" data-action="favorite" data-id="${l.id}">${l.favorite?'♥ Favorilerden çıkar':'♡ Favorilere ekle'}</button><button class="btn btn-outline" style="width:100%;margin-top:9px" data-action="report" data-id="${l.id}">İlanı bildir</button></aside></div></main>`,l.kind==='donation'?'/donation':'/');
}
function renderSell(kind='sale'){
 if(!state.user){ showAuth(); return; }
 selectedListingPhotos=[];
 pageFrame(`<main class="shell page" style="max-width:850px"><div class="section-head"><div><h2>${kind==='donation'?'Ücretsiz ürün paylaş':'Yeni ilan ver'}</h2><p>İlanın kendi üniversitendeki öğrencilere gösterilir.${kind==='donation'?' Paylaştığın bir eşya, başka bir öğrencinin hayatını kolaylaştırabilir.':''}</p></div></div><form class="panel" data-form="listing" enctype="multipart/form-data"><input type="hidden" name="kind" value="${kind}"><p class="status">${kind==='donation'?'Ücretsiz ürün':'İkinci el satış'}</p><div class="field"><label for="title">Ürün adı</label><input name="title" id="title" maxlength="100" required placeholder="Örn. İktisat 101 ders kitabı"></div><div class="form-grid"><div class="field"><label for="category">Kategori</label><select name="category" id="category" required><option value="">Kategori seç</option>${categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select></div><div class="field"><label for="condition">Durumu</label><select name="condition" id="condition" required><option value="">Durum seç</option><option value="Yeni">Yeni</option><option value="Az kullanılmış">Az kullanılmış</option><option value="Kullanılmış">Kullanılmış</option><option value="Onarım gerektirir">Onarım gerektirir</option></select></div></div><div class="field" id="priceField" ${kind==='donation'?'hidden':''}><label for="price">Fiyat (₺)</label><input name="price" id="price" type="text" inputmode="numeric" pattern="[0-9]+" maxlength="9" ${kind==='sale'?'required':''} placeholder="0"></div><div class="field"><label for="description">Açıklama</label><textarea name="description" id="description" maxlength="2000" required placeholder="Ürünün özelliklerini ve varsa kusurlarını açıkça yaz."></textarea></div><div class="field"><label for="photos">Fotoğraflar</label><label class="photo-picker" for="photos"><span class="photo-picker-icon">＋</span><span><strong>Fotoğraf ekle</strong><small id="photoCount">Henüz fotoğraf seçilmedi</small></span><input name="photos" id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required></label><span class="hint">En çok 6 fotoğraf; her biri en fazla 5 MB. İlk fotoğraf kapak olur.</span></div><div class="inline-actions"><button class="btn btn-primary" type="submit">İlanı yayınla</button><button class="btn btn-light" type="button" data-action="cancel-listing">Vazgeç</button></div></form></main>`,'/sell');
}
function restoreDraft(){
 const form=$('[data-form="listing"]'); if(!form)return;
 try{const draft=JSON.parse(localStorage.getItem('unipazar-listing-draft')||'null');if(!draft)return;
  for(const [name,value] of Object.entries(draft)){if(name==='kind')continue;const field=form.elements.namedItem(name);if(field)field.value=value;}
  toast('Kaydedilmiş ilan taslağın yüklendi.');
 }catch{}
}
function addEditButtons(listings){
 for(const item of listings){const row=$(`a[href="#/listing/${item.id}"]`)?.closest('.list-row');row?.querySelector('.inline-actions')?.insertAdjacentHTML('afterbegin',`<button class="btn btn-outline" data-action="edit-listing" data-id="${item.id}">Düzenle</button>`);}
 applyLocale($('.list'),language);
}
function updateFavoriteButtons(id,favorite){
 document.querySelectorAll(`[data-action="favorite"][data-id="${id}"]`).forEach(button=>{
  const detail=!!button.closest('.detail-side');
  button.textContent=detail?translateText(favorite?'♥ Favorilerden çıkar':'♡ Favorilere ekle',language):(favorite?'♥':'♡');
  button.setAttribute('aria-label',translateText(favorite?'Favorilerden çıkar':'Favorilere ekle',language));
 });
 const item=state.listings.find(listing=>String(listing.id)===String(id));
 if(item)item.favorite=favorite;
}
async function renderSeller(id){ const {seller,listings}=await api('/api/sellers/'+id+'/listings');if(route()!=='/seller/'+id)return;pageFrame(`<main class="shell page"><a class="back-link" href="#/"><span aria-hidden="true">←</span> İlanlara dön</a><div class="section-head"><div><h2>${escapeHtml(seller.name)} adlı öğrencinin profili</h2><p>Yayındaki ikinci el satış ilanları · ${escapeHtml(seller.university)}</p></div></div><div class="grid">${listings.length?listings.map(listingCard).join(''):empty('Aktif satış ilanı yok','Bu satıcının başka satış ilanı bulunmuyor.')}</div></main>`,'/');}
async function renderFavorites(){ if(!state.user){showAuth();return;} const {listings}=await api('/api/favorites');if(route()!=='/favorites')return; pageFrame(`<main class="shell page"><div class="section-head"><div><h2>Favorilerim</h2><p>Kaydettiğin ilanlar burada.</p></div></div><div class="grid">${listings.length?listings.map(listingCard).join(''):empty('Henüz favorin yok','Beğendiğin ilanları kalp simgesiyle kaydet.')}</div></main>`,'/favorites'); }
async function renderManage(){ if(!state.user){showAuth();return;} const [{listings},{offers},{requests}]=await Promise.all([api('/api/mine'),api('/api/offers'),api('/api/donation-requests')]);if(route()!=='/manage')return; pageFrame(`<main class="shell page"><div class="section-head"><div><h2>İlanlarım</h2><p>Satışlarını ve Dayanışma taleplerini buradan yönet.</p></div></div><div class="list">${listings.length?listings.map(l=>`<div class="list-row"><div><a href="#/listing/${l.id}"><strong>${escapeHtml(l.title)}</strong></a><small>${l.kind==='donation'?'Ücretsiz':money(l.price)} · ${escapeHtml(listingStatus(l.status))}</small></div><div class="inline-actions">${l.status==='active'?`<button class="btn btn-light" data-action="reserve" data-id="${l.id}">Ayır</button><button class="btn btn-outline" data-action="mark-sold" data-id="${l.id}">Tamamlandı</button>`:''}${l.status==='reserved'?`<button class="btn btn-light" data-action="reactivate" data-id="${l.id}">Yeniden aç</button><button class="btn btn-outline" data-action="mark-sold" data-id="${l.id}">Tamamlandı</button>`:''}${l.status!=='removed'?`<button class="btn btn-danger" data-action="remove" data-id="${l.id}">Kaldır</button>`:''}</div></div>`).join(''):empty('Henüz ilan vermedin','İlk ilanını vererek başlayabilirsin.')}</div>${offers.length?`<div class="section-head"><h2>Gelen teklifler</h2></div><div class="list">${offers.map(o=>`<div class="list-row"><div><strong>${escapeHtml(o.title)} · ${money(o.amount)}</strong><small>${escapeHtml(o.buyer_name)} · ${escapeHtml(o.status)}</small></div>${o.status==='pending'?`<div class="inline-actions"><button class="btn btn-primary" data-action="offer-decision" data-id="${o.id}" data-status="accepted">Kabul et</button><button class="btn btn-outline" data-action="offer-decision" data-id="${o.id}" data-status="rejected">Reddet</button></div>`:''}</div>`).join('')}</div>`:''}${requests.length?`<div class="section-head"><h2>Dayanışma talepleri</h2></div><div class="list">${requests.map(r=>`<div class="list-row"><div><strong>${escapeHtml(r.title)} · ${escapeHtml(r.requester_name)}</strong><small>${escapeHtml(r.note)} · ${escapeHtml(r.status)}</small></div>${r.status==='pending'?`<div class="inline-actions"><button class="btn btn-primary" data-action="request-decision" data-id="${r.id}" data-status="accepted">Kabul et</button><button class="btn btn-outline" data-action="request-decision" data-id="${r.id}" data-status="rejected">Reddet</button></div>`:r.status==='accepted'?`<button class="btn btn-primary" data-action="request-decision" data-id="${r.id}" data-status="completed">Teslim edildi</button>`:''}</div>`).join('')}</div>`:''}</main>`,'/mine'); addEditButtons(listings); }
function ownListingCard(item){
 const free=item.kind==='donation';
 return `<article class="card"><a class="card-image" href="#/listing/${item.id}">${item.cover?`<img src="/uploads/${encodeURIComponent(item.cover)}" alt="${escapeHtml(item.title)}" loading="lazy">`:'<div class="placeholder">Fotoğraf yok</div>'}<span class="badge ${free?'free':''}">${free?'Ücretsiz':'İkinci el'}</span></a><div class="card-body"><a href="#/listing/${item.id}"><h3>${escapeHtml(item.title)}</h3></a><div class="price">${free?'Ücretsiz':money(item.price)}</div><div class="meta">${escapeHtml(item.university)} · ${escapeHtml(item.condition)} · ${item.status==='active'?'Yayında':'Ayrıldı'}</div><button class="btn btn-outline" data-action="edit-listing" data-id="${item.id}" style="margin-top:12px">Düzenle</button></div></article>`;
}
function renderSellChoice(){
 if(!state.user){showAuth();return;}
 pageFrame(`<main class="shell page narrow-page"><div class="section-head"><div><h2>Nasıl ilan vermek istersin?</h2><p>${escapeHtml(state.user.university)} öğrencileri için bir seçenek seç.</p></div></div><div class="choice-grid"><a class="choice-card" href="#/sell-sale"><span class="choice-icon">↗</span><h3>İkinci el satış</h3><p>Ürününe fiyat belirle ve üniversitendeki öğrencilere satışa çıkar.</p><strong>Satılık ilan ver →</strong></a><a class="choice-card choice-free" href="#/sell-donation"><span class="choice-icon">♡</span><h3>Ücretsiz ürün ver</h3><p>Kullanmadığın eşyayı desteğe ihtiyacı olan bir öğrenciye ücretsiz ver.</p><strong>Dayanışma ilanı ver →</strong></a></div></main>`,'/sell');
}
async function renderListingsDashboard(){
 if(!state.user){showAuth();return;}
 const {listings}=await api('/api/mine');if(route()!=='/mine')return;
 const active=listings.filter(item=>item.status==='active'||item.status==='reserved');
 pageFrame(`<main class="shell page account-page"><div class="section-head"><div><h2>İlanlarım</h2><p>${escapeHtml(state.user.university)} için verdiğin ilanlar.</p></div></div><div class="panel giving-panel"><div><h3>Dayanışma için ücretsiz ürün ver</h3><p>Kullanmadığın bir ürünü fiyat koymadan paylaşabilirsin. Ücretsiz ilanlar yalnızca destek isteyen öğrenci hesaplarına gösterilir; sen kendi ilanını buradan takip edebilirsin.</p></div><a class="btn btn-primary" href="#/sell-donation">Ücretsiz ürün ver →</a></div><div class="section-head"><div><h2>Satışta ve paylaşımda olan ürünlerim</h2><p>Fotoğraflarına, fiyatına ve ürün bilgilerine buradan ulaş.</p></div></div><div class="grid">${active.length?active.map(ownListingCard).join(''):empty('Henüz aktif ilanın yok','İkinci el satış veya ücretsiz ürün ilanı verebilirsin.')}</div><div class="inline-actions account-bottom-actions"><a class="btn btn-outline" href="#/manage">Tüm ilanlarımı yönet</a></div></main>`,'/mine');
}
function renderAccount(){
 if(!state.user){pageFrame(`<main class="shell page narrow-page">${empty('Hesabına giriş yap','Kişisel bilgilerini görmek için önce giriş yap.') }<button class="btn btn-primary" data-action="login-required">Giriş yap</button></main>`,'/account');showAuth();return;}
 const u=state.user;
 pageFrame(`<main class="shell page profile-page"><div class="section-head"><div><h2>Hesabım</h2><p>Kişisel bilgilerini burada güncelleyebilirsin.</p></div></div><section class="panel"><div class="seller"><span class="avatar">${escapeHtml(u.name[0]?.toUpperCase())}</span><div><strong>${escapeHtml(u.name)}</strong><div class="muted small">${escapeHtml(u.university)}</div></div></div><div class="rule"></div><form data-form="profile"><div class="field"><label for="profileName">Ad ve soyad</label><input id="profileName" name="name" maxlength="80" required value="${escapeHtml(u.name)}"></div><div class="field"><label for="profileUniversity">Üniversite</label><input id="profileUniversity" name="university" list="profileUniversityOptions" required autocomplete="off" value="${escapeHtml(u.university)}"><datalist id="profileUniversityOptions">${state.universities.map(name=>`<option value="${escapeHtml(name)}"></option>`).join('')}</datalist></div><button class="btn btn-primary">Kişisel bilgileri kaydet</button></form><div class="rule"></div><div class="profile-contact"><div><strong>E-posta</strong><p>${escapeHtml(u.email)}</p></div><button class="btn btn-outline" data-action="change-email">E-postamı değiştir</button></div><div class="profile-contact"><div><strong>Telefon numarası</strong><p>${u.phone?escapeHtml(u.phone):'Henüz eklenmedi'}</p>${u.phone?'<span class="hint">Numara doğrulanmadı</span>':''}</div><button class="btn btn-outline" data-action="change-phone">${u.phone?'Telefon numaramı değiştir':'Telefon numarası ekle'}</button></div>${state.emailVerificationAvailable && !u.emailVerified?`<form class="profile-verification" data-form="profile-verify"><div class="field"><label for="profileCode">E-postana gelen doğrulama kodu</label><input id="profileCode" name="code" inputmode="numeric" maxlength="6" required></div>${state.devCode?`<p class="small">Geliştirme kodu: ${escapeHtml(state.devCode)}</p>`:''}<button class="btn btn-outline">E-postayı doğrula</button><button type="button" class="btn btn-light" data-action="resend-profile-code">Yeni kod gönder</button></form>`:''}</section></main>`,'/account');
}
async function renderSupport(){
 if(state.user) await refreshUser();
 if(!state.user){pageFrame(`<main class="shell page narrow-page">${empty('Destek başvurusu','Başvuru için önce giriş yap.') }<button class="btn btn-primary" data-action="login-required">Giriş yap</button></main>`,'/support');showAuth();return;}
 const {application}=await api('/api/support-application');if(route()!=='/support')return;
 const status=application?.status==='approved'?'Başvurun kabul edildi. Dayanışma ilanlarını görebilirsin.':application?.status==='pending'?'Başvurun incelemede.':application?.status==='rejected'?'Başvurun kabul edilmedi. Bilgilerini güncelleyip yeniden gönderebilirsin.':'';
 pageFrame(`<main class="shell page narrow-page"><div class="section-head"><div><h2>Destek başvurusu</h2><p>İhtiyacı olan öğrencilerin üniversitelerindeki ücretsiz ilanlara erişmesi için.</p></div></div><section class="panel support-panel"><p>Başvurunda ihtiyacının nedenini ve aylık aile gelirini paylaş. Bu bilgiler yalnızca başvuruyu inceleyen yöneticiye gösterilir. Tam TC kimlik numaranı istemiyoruz; son 4 hane başvurunu ayırt etmek içindir ve kimlik doğrulaması sayılmaz.</p>${status?`<p class="status">${escapeHtml(status)}</p>`:''}${application?.status==='approved'?'<a class="btn btn-primary" href="#/donation">Ücretsiz ilanları gör</a>':`<form data-form="support"><div class="field"><label for="supportReason">Desteğe neden ihtiyacın var?</label><textarea id="supportReason" name="reason" minlength="30" maxlength="1000" required placeholder="Durumunu kısaca anlat">${escapeHtml(application?.reason||'')}</textarea></div><div class="field"><label for="familyIncome">Aylık aile geliri (₺)</label><input id="familyIncome" type="number" min="0" max="1000000" step="1" name="familyIncome" value="${application?.family_income??''}" required></div><div class="field"><label for="identityLast4">TC kimlik numaranın son 4 hanesi</label><input id="identityLast4" name="identityLast4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${escapeHtml(application?.identity_last4||'')}" required></div><button class="btn btn-primary">${application?'Başvuruyu güncelle':'Başvuruyu gönder'}</button></form>`}</section></main>`,'/support');
}
const chatTime = value => value ? new Date(value).toLocaleTimeString(({tr:'tr-TR',en:'en-GB',es:'es-ES',kk:'kk-KZ',de:'de-DE',fr:'fr-FR'})[language]||'tr-TR',{hour:'2-digit',minute:'2-digit'}) : '';
let messagesRenderSequence=0;
async function renderMessages(){
 if(!state.user){showAuth();return;}
 const originRoute=route(),sequence=++messagesRenderSequence,requestedConversation=state.selectedConversation;
 const [conversationResult,requestedMessages]=await Promise.all([
  api('/api/conversations'),
  requestedConversation?api(`/api/conversations/${requestedConversation}/messages`):Promise.resolve(null)
 ]);
 if(route()!==originRoute||sequence!==messagesRenderSequence)return;
 const allConversations=conversationResult.conversations;
 const adminChat=route().startsWith('/admin-message/');
 const conversations=allConversations.filter(c=>(!adminChat?(state.user.role!=='admin'||c.listing_id):c.id===state.selectedConversation)&&(c.last_message||c.id===state.selectedConversation));
 const selected=conversations.find(c=>c.id===state.selectedConversation)||{id:null,other_name:'',other_university:'',other_id:0,listing_id:0,title:''};
 const messages=selected.id?(selected.id===requestedConversation?requestedMessages:await api(`/api/conversations/${selected.id}/messages`)).messages:[];
 if(route()!==originRoute||sequence!==messagesRenderSequence)return;
 if(selected.id)selected.unread_count=0;
 state.selectedConversation=selected.id;
 const hadFocus=!!document.activeElement?.closest('.chat-compose');
 const draft=$('.chat-compose [name="body"]')?.value||'';
 pageFrame(`<main class="shell page messages-page"><section class="messages-intro"><div><span class="messages-eyebrow">ÜNİ SATIŞ · ÖZEL SOHBETLER</span><h2>Mesajlarım</h2><p>Ürün hakkında konuş, fotoğraf paylaş, ayrıntıları birlikte netleştir.</p></div><div class="messages-intro-art" aria-hidden="true"><img src="/hero-illustration.svg" alt=""></div></section><p class="chat-moderation-note">Şikâyetlerde konuşmalar yönetici tarafından incelenebilir.</p>${!conversations.length?empty('Henüz konuşman yok','Bir ilandan satıcıya özel mesaj yazarak başlayabilirsin.'):`<div class="chat-layout"><div class="chat-list">${conversations.map(c=>`<a href="${adminChat?'#'+route():'#/messages'}" class="chat-item ${c.id===selected.id?'active':''}" data-conversation="${c.id}"><span class="avatar chat-avatar">${escapeHtml(c.other_name[0]?.toUpperCase())}</span><span class="chat-preview"><span class="chat-name"><strong>${escapeHtml(c.other_name)}</strong><small>${chatTime(c.last_at)}</small></span><span class="chat-last">${escapeHtml(localizedMessageText(c.last_message||'Konuşma henüz başlamadı'))}</span></span>${c.unread_count?`<span class="chat-unread">${c.unread_count}</span>`:''}</a>`).join('')}</div><div class="chat-box"><div class="chat-header"><span class="avatar">${escapeHtml(selected.other_name[0]?.toUpperCase())}</span><span><a class="chat-person-link" href="#/seller/${selected.other_id}">${escapeHtml(selected.other_name)}</a><small>${escapeHtml(selected.other_university)} · ${selected.listing_id?`<a href="#/listing/${selected.listing_id}">${escapeHtml(selected.title)}</a>`:escapeHtml(selected.title)}</small></span></div><div class="messages">${messages.length?messages.map(m=>`<div class="bubble ${m.sender_id===state.user.id?'mine':''}">${m.photo_filename?`<a href="/api/messages/${m.id}/photo" target="_blank" rel="noopener" aria-label="Fotoğrafı aç"><img class="chat-photo" src="/api/messages/${m.id}/photo" alt="Gönderilen fotoğraf" loading="lazy"></a>`:''}${m.body?`<span>${escapeHtml(localizedMessageText(m.body))}</span>`:''}<small>${chatTime(m.created_at)} ${m.sender_id===state.user.id?`<span class="message-ticks ${m.read_at?'read':''}" aria-label="${m.read_at?'Okundu':'Gönderildi'}">✓✓</span>`:''}</small>${m.sender_id===state.user.id?`<details class="message-menu"><summary aria-label="Mesaj seçenekleri">⌄</summary><div>${m.body?`<button data-action="edit-message" data-id="${m.id}" data-body="${escapeHtml(m.body)}">Düzenle</button>`:''}<button data-action="delete-message" data-id="${m.id}">Sil</button></div></details>`:''}</div>`).join(''):'<p class="muted small">İlk mesajı yaz.</p>'}</div><form class="chat-compose" data-form="message" enctype="multipart/form-data"><button type="button" class="chat-attach chat-camera" data-action="photo-menu" title="Fotoğraf çek veya galeriden seç" aria-label="Fotoğraf çek veya galeriden seç"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h4l2-2h6l2 2h4v12H3z"/><circle cx="12" cy="13" r="3"/></svg></button><div class="chat-write"><input name="body" placeholder="Özel mesaj yaz..." maxlength="2000" aria-label="Mesaj"><span id="chatPhotoStatus" class="chat-photo-status" hidden></span></div><button class="btn btn-primary">Gönder</button></form></div></div>`}</main>`,'/messages');
 if(conversations.length && !selected.id) $('.chat-box').innerHTML='<div class="chat-select-empty"><span class="chat-select-icon">✉</span><h3>Bir konuşma seç</h3><p>Yazışmalarını görmek için soldan bir kişiye tıkla.</p></div>';
 applyLocale($('.messages-page'),language);
 const composer=$('.chat-compose');
 if(composer){
  composer.querySelector('.chat-write').insertAdjacentHTML('beforebegin','<button type="button" class="chat-attach chat-mic" data-action="voice-start" aria-label="Sesli mesaj kaydet" title="Sesli mesaj kaydet">🎙</button>');
  composer.querySelector('.chat-write').insertAdjacentHTML('beforeend','<span id="chatVoiceStatus" class="chat-photo-status" hidden></span>');
  document.querySelectorAll('.messages .bubble').forEach((bubble,index)=>{
   if(messages[index]?.sender_id!==state.user.id)bubble.insertAdjacentHTML('beforeend',`<button type="button" class="message-report" data-action="report-message" data-id="${messages[index].id}" aria-label="Mesajı bildir" title="Mesajı bildir">⚑</button>`);
   if(!messages[index]?.voice_filename)return;
   const player=document.createElement('audio');player.controls=true;player.preload='none';player.className='chat-voice';player.src=`/api/messages/${messages[index].id}/voice`;
   player.setAttribute('aria-label','Sesli mesaj');bubble.prepend(player);
  });
 }
 const input=$('.chat-compose [name="body"]');if(input){input.value=draft;if(hadFocus)input.focus();}
 updateChatPhotoStatus();
 updateVoiceStatus();
 applyLocale($('.messages-page'),language);
 await refreshUnread();$('.messages')?.scrollTo(0,$('.messages').scrollHeight);
}
async function renderAdminMessages(accountId,conversationId){
 if(state.user?.role!=='admin'){go('/');return;}
 const data=accountId==='report'?{account:{name:'Şikayet incelemesi'},conversations:[]}:await api(`/api/admin/accounts/${accountId}/conversations`);
 const messages=conversationId?(await api(`/api/admin/conversations/${conversationId}/review`,{method:'POST',body:{reason:'Yönetici konuşma incelemesi'}})).messages:[];
 pageFrame(`<main class="shell page"><a class="btn btn-outline" href="#/admin">← Yönetime dön</a><h2>${escapeHtml(data.account.name)} · Mesajlar</h2><div class="chat-layout"><div class="chat-list">${data.conversations.filter(c=>c.message_count>0).map(c=>`<a class="chat-item ${String(c.id)===conversationId?'active':''}" href="#/admin-messages/${accountId}/${c.id}"><strong>${escapeHtml(c.other_name)}</strong><small>${c.message_count} mesaj</small></a>`).join('')||empty('Konuşma yok','')}</div><div class="chat-box"><div class="chat-header">${conversationId?'Konuşma incelemesi':'Bir kişi seç'}</div><div class="messages">${messages.map(m=>`<div class="bubble"><strong>${escapeHtml(m.sender_name)}</strong><p>${escapeHtml(m.body)}</p>${m.photo_filename?`<img class="chat-photo" src="/api/admin/messages/${m.id}/photo" alt="Gönderilen fotoğraf">`:''}${m.voice_filename?`<audio controls src="/api/admin/messages/${m.id}/voice"></audio>`:''}<small>${chatTime(m.created_at)}</small></div>`).join('')||'<p>Kiminle yazıştığını görmek için soldan bir kişi seç.</p>'}</div></div></div></main>`,'/admin');
}
async function renderHandoff(){
 if(!state.selectedConversation || !$('.chat-box')) return;
 const {handoff}=await api(`/api/conversations/${state.selectedConversation}/handoff`);
 const box=$('.chat-box');
 const note=handoff?`<div><strong>Buluşma:</strong> ${escapeHtml(handoff.place)} · ${escapeHtml(handoff.meeting_at.replace('T',' '))} <span class="status">${escapeHtml(handoff.status)}</span></div>`:'<span class="muted small">Güvenli bir buluşma noktası belirleyin.</span>';
 const actions=handoff?.status==='proposed' && handoff.proposed_by!==state.user.id?`<button class="btn btn-light" data-action="handoff-status" data-status="confirmed">Onayla</button>`:'';
 const completed=handoff?.status==='confirmed'?`<button class="btn btn-light" data-action="handoff-status" data-status="completed">Teslim edildi</button>`:'';
 box.querySelector('.chat-header').insertAdjacentHTML('afterend',`<div style="padding:10px 15px;border-bottom:1px solid #e9ede7;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">${note}<div class="inline-actions"><button class="btn btn-outline" data-action="handoff">${handoff?'Değiştir':'Buluşma öner'}</button>${actions}${completed}</div></div>`);
 applyLocale(box,language);
}
async function renderAdmin(){
 if(state.user?.role!=='admin'){go('/account');return;}
 const [queue,accountData]=await Promise.all([api('/api/admin/queue'),api('/api/admin/accounts')]);if(route()!=='/admin')return;
 const pending=queue.support.filter(application=>application.status==='pending');
 const reviewed=queue.support.filter(application=>application.status!=='pending');
 const supportRow=application=>`<div class="list-row admin-row"><div>
  <strong>${escapeHtml(application.name)} · ${escapeHtml(application.university)}</strong>
  <small>E-posta: ${escapeHtml(application.email)} · Telefon: ${escapeHtml(application.phone||'Eklenmedi')}</small>
  <small>Hesap açılışı: ${escapeHtml(application.created_at)} · E-posta ${application.email_verified?'doğrulandı':'doğrulanmadı'}</small>
  <small>Aylık aile geliri: ${money(application.family_income*100)} · TC kimlik son 4 hane: ${escapeHtml(application.identity_last4)}</small>
  <small>Başvuru: ${escapeHtml(application.submitted_at)}${application.reviewed_at?` · Karar: ${escapeHtml(application.reviewed_at)}`:''}</small>
  <p>${escapeHtml(application.reason)}</p>
 </div><div class="inline-actions">${application.status==='pending'?
  `<button class="btn btn-primary" data-action="admin-support" data-id="${application.user_id}" data-status="approved">Kabul et</button><button class="btn btn-outline" data-action="admin-support" data-id="${application.user_id}" data-status="rejected">Reddet</button>`:
  `<span class="status">${application.status==='approved'?'Kabul edildi':'Reddedildi'}</span>`}</div></div>`;
 pageFrame(`<main class="shell page admin-page">
  <div class="section-head"><div><h2>Yönetim</h2><p>Destek başvurularını, şikâyetleri ve hesapları buradan yönetebilirsin.</p></div></div>
  <div class="section-head"><div><h2>Destek başvuruları (${pending.length})</h2><p>Yalnızca destek formunu gönderen hesaplar burada görünür. Tam TC kimlik numarası alınmaz; yalnızca son 4 hanesi saklanır.</p></div></div>
  <div class="list">${pending.length?pending.map(supportRow).join(''):empty('Bekleyen destek başvurusu yok','')}</div>
  ${reviewed.length?`<div class="section-head"><h2>Karara bağlanan başvurular</h2></div><div class="list">${reviewed.map(supportRow).join('')}</div>`:''}
  <div class="section-head"><h2>Şikâyetler (${queue.reports.length})</h2></div>
  <div class="list">${queue.reports.length?queue.reports.map(report=>`<div class="list-row"><div><strong>${report.message_id?`Mesaj #${report.message_id}`:`İlan #${report.listing_id}`}</strong><small>${escapeHtml(report.reason)}</small></div><div class="inline-actions">${report.message_id?`<button class="btn btn-outline" data-action="admin-review-form" data-id="${report.conversation_id}" data-title="Şikâyet edilen mesaj">Konuşmayı incele</button>`:`<button class="btn btn-danger" data-action="admin-report" data-id="${report.id}" data-remove="1">İlanı kaldır</button>`}<button class="btn btn-outline" data-action="admin-report" data-id="${report.id}">Kapat</button></div></div>`).join(''):empty('Açık şikâyet yok','')}</div>
  <div class="section-head"><div><h2>Hesaplar</h2><p>Toplam ${accountData.total} hesap · ${accountData.active} açık hesap</p></div></div>
  <label class="field admin-account-search"><span>Hesap ara</span><input id="adminAccountSearch" type="search" placeholder="Ad veya e-posta yaz"></label>
  <div class="list" id="adminAccounts">${accountData.accounts.map(account=>`<div class="list-row admin-row" data-admin-account><div>
   <strong>${escapeHtml(account.name)} ${account.role==='admin'?'· Yönetici':''}</strong>
   <small>${escapeHtml(account.email)} · ${escapeHtml(account.university)}</small>
   <small>Telefon: ${escapeHtml(account.phone||'Eklenmedi')} · E-posta ${account.email_verified?'doğrulandı':'doğrulanmadı'}</small>
   <small>Kayıt: ${escapeHtml(account.created_at)} · İlan: ${account.listing_count} · Destek: ${account.support_status==='approved'?'Kabul edildi':account.support_status==='pending'?'İncelemede':account.support_status==='rejected'?'Reddedildi':'Başvuru yok'}</small>
   ${account.closed_at?'<small class="status">Hesap kapalı</small>':''}
  </div><div class="inline-actions">${account.role==='admin'?'':`<button class="btn btn-outline" data-action="admin-conversations" data-id="${account.id}">Konuşmaları incele</button><button class="btn btn-outline" data-action="admin-message" data-id="${account.id}">Mesaj yaz</button><button class="btn btn-outline" data-action="admin-listings" data-id="${account.id}">İlanları yönet</button><button class="btn ${account.closed_at?'btn-light':'btn-outline'}" data-action="admin-account" data-id="${account.id}" data-name="${escapeHtml(account.name)}" data-closed="${account.closed_at?'1':'0'}">${account.closed_at?'Yeniden aç':'Hesabı kapat'}</button>`}</div></div>`).join('')}</div>
 </main>`,'/admin');
}
function updateChatPhotoStatus(){const status=$('#chatPhotoStatus');if(!status)return;status.hidden=!chatPhoto;status.innerHTML=chatPhoto?`${escapeHtml(chatPhoto.name)} <button type="button" data-action="remove-chat-photo" aria-label="Fotoğrafı kaldır">×</button>`:'';applyLocale(status,language);}
function updateVoiceStatus(){
 const status=$('#chatVoiceStatus'), button=$('.chat-mic');
 if(!status)return;

 const recording=voiceRecorder?.state==='recording';
 button.dataset.action=recording?'voice-stop':'voice-start';
 button.setAttribute('aria-label',recording?'Kaydı bitir':'Sesli mesaj kaydet');
 button.title=recording?'Kaydı bitir':'Sesli mesaj kaydet';
 button.textContent=recording?'■':'🎙';
 button.classList.toggle('recording',recording);
 status.hidden=!recording&&!voiceClip;
 status.classList.toggle('voice-recording',recording);
 status.innerHTML=recording?`<span class="voice-live-dot"></span><span class="voice-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><strong>${String(Math.floor(voiceSeconds/60)).padStart(2,'0')}:${String(voiceSeconds%60).padStart(2,'0')}</strong><span class="muted small">Kaydetmek için mikrofona tekrar dokun</span>`:voiceClip?`<audio controls preload="metadata" src="${voicePreviewUrl}"></audio>`:'';
 applyLocale(status,language);
 button.setAttribute('aria-label',translateText(recording?'Kaydı bitir':'Sesli mesaj kaydet',language));
 button.title=translateText(recording?'Kaydı bitir':'Sesli mesaj kaydet',language);
}
async function startVoiceRecording(){
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Bu tarayıcıda ses kaydı açılamıyor.');
 const mimeType=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
 if(!mimeType)throw new Error('Bu tarayıcıdaki ses biçimi desteklenmiyor.');
 voiceStream=await navigator.mediaDevices.getUserMedia({audio:true});
 try{voiceRecorder=new MediaRecorder(voiceStream,{mimeType});}
 catch(error){voiceStream.getTracks().forEach(track=>track.stop());voiceStream=null;throw error;}
 const recorder=voiceRecorder, chunks=[];
 if(voicePreviewUrl)URL.revokeObjectURL(voicePreviewUrl);voicePreviewUrl=null;voiceClip=null;chatPhoto=null;updateChatPhotoStatus();discardVoice=false;voiceSeconds=0;
 recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
 recorder.onstop=async()=>{
  cancelAnimationFrame(voiceAnimation);await voiceAudioContext?.close();voiceAudioContext=null;
  clearInterval(voiceTimer);voiceTimer=null;
  voiceStream?.getTracks().forEach(track=>track.stop());voiceStream=null;
  if(!discardVoice && chunks.length){
   const extension=mimeType.includes('ogg')?'ogg':mimeType.includes('mp4')?'mp4':'webm';
   const clip=new File(chunks,`sesli-mesaj-${Date.now()}.${extension}`,{type:mimeType});
   if(clip.size<=5*1024*1024){voiceClip=clip;voicePreviewUrl=URL.createObjectURL(clip);}else toast('Ses kaydı 5 MB sınırını aştı.');
  }
  voiceRecorder=null;updateVoiceStatus();
  if(voiceClip&&!discardVoice){try{const body=new FormData();body.set('voice',voiceClip);await api(`/api/conversations/${state.selectedConversation}/messages`,{method:'POST',body});discardVoiceRecording();await renderMessages();}catch(error){toast(error.message);}}
 };
 try{recorder.start(1000);}catch(error){voiceStream.getTracks().forEach(track=>track.stop());voiceStream=null;voiceRecorder=null;throw error;}
 voiceStarted=Date.now();
 voiceAudioContext=new AudioContext();await voiceAudioContext.resume();voiceAnalyser=voiceAudioContext.createAnalyser();voiceAnalyser.fftSize=256;voiceAudioContext.createMediaStreamSource(voiceStream).connect(voiceAnalyser);
 const samples=new Uint8Array(voiceAnalyser.frequencyBinCount);
 const drawWave=()=>{if(recorder.state!=="recording")return;voiceAnalyser.getByteFrequencyData(samples);document.querySelectorAll(".voice-bars i").forEach((bar,i)=>{bar.style.height=`${3+samples[i*4]*.09}px`;});voiceAnimation=requestAnimationFrame(drawWave);};drawWave();
 voiceTimer=setInterval(()=>{voiceSeconds=Math.floor((Date.now()-voiceStarted)/1000);updateVoiceStatus();if(voiceSeconds>=60 && recorder.state==='recording')recorder.stop();},1000);
 updateVoiceStatus();
}
function discardVoiceRecording(){discardVoice=true;voiceClip=null;if(voicePreviewUrl)URL.revokeObjectURL(voicePreviewUrl);voicePreviewUrl=null;if(voiceRecorder?.state==='recording')voiceRecorder.stop();else updateVoiceStatus();}
function stopCamera(){cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;}
function showAuth(tab='login'){ state.authTab=tab; state.modal='auth'; drawModal(); }
function showSimpleModal(title,body,form){ state.modal={title,body,form}; drawModal(); }
function universityPickerForm(){
 return `<div class="field"><label for="universityPickerSearch">Üniversite ara</label><input id="universityPickerSearch" placeholder="Üniversite adı yaz"></div><div class="university-options"><button class="university-option" data-action="select-university" data-university="*">Tüm üniversiteler</button>${state.universities.map(u=>`<button class="university-option" data-action="select-university" data-university="${escapeHtml(u)}">${escapeHtml(u)}</button>`).join('')}</div>`;
}
function drawModal(){
 let html='';
 if(state.modal==='auth') html=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Hesap"><div class="modal-top"><h2>${state.authTab==='register'?'Üni Satış’a katıl':state.authTab==='verify'?'E-postanı doğrula':'Hesabınızı giriniz'}</h2><button class="close" data-action="close-modal" aria-label="Kapat">×</button></div>${state.authTab!=='verify'?`<div class="auth-tabs"><button class="btn ${state.authTab==='login'?'btn-primary':'btn-light'}" data-action="auth-tab" data-tab="login">Giriş yap</button><button class="btn ${state.authTab==='register'?'btn-primary':'btn-light'}" data-action="auth-tab" data-tab="register">Kayıt ol</button></div>`:''}${state.authTab==='register'?`<form data-form="register" novalidate><div class="registration-alert" role="alert" hidden></div><div class="field"><label>Adın ve soyadın</label><input name="name" required maxlength="80"></div><div class="field"><label>Üniversiten</label><select name="university" required disabled><option value="">Üniversiteler yükleniyor…</option></select><span class="hint">Türkiye'deki üniversiteler listesinden seç.</span></div><div class="field"><label>E-posta</label><input type="email" name="email" required placeholder="ornek@eposta.com"></div><div class="field"><label for="registerPhone">Telefon numaran</label><input id="registerPhone" type="tel" name="phone" autocomplete="tel" inputmode="tel" maxlength="25" required placeholder="05xx xxx xx xx"><span class="hint">Cep telefonu numaranı gir. SMS doğrulaması henüz yapılmıyor.</span></div><div class="field"><label>Şifre</label><input type="password" name="password" required minlength="10"><span class="hint">En az 10 karakter.</span></div><label class="remember"><input type="checkbox" name="rememberMe" value="true"> Beni hatırla</label><button class="btn btn-primary" style="width:100%">Hesap aç</button></form>`:state.authTab==='verify'?`<p class="muted small">E-postana gönderilen 6 haneli kodu gir. </p>${state.devCode?`<p class="status">Geliştirme kodu: ${escapeHtml(state.devCode)}</p>`:''}<form data-form="verify"><div class="field"><label>E-posta</label><input type="email" name="email" value="${escapeHtml(state.pendingEmail||'')}" required></div><div class="field"><label>Doğrulama kodu</label><input name="code" inputmode="numeric" maxlength="6" required></div><button class="btn btn-primary" style="width:100%">Doğrula</button></form><button class="btn btn-light" data-action="resend-code" style="width:100%;margin-top:8px">Yeni kod gönder</button>`:`<form data-form="login"><div class="field"><label>E-posta</label><input type="email" name="email" required></div><div class="field"><label>Şifre</label><input type="password" name="password" required></div><label class="remember"><input type="checkbox" name="rememberMe" value="true"> Beni hatırla</label><button class="btn btn-primary" style="width:100%">Giriş yap</button></form><button class="btn btn-light" style="width:100%;margin-top:8px" data-action="auth-tab" data-tab="verify">Kodla doğrula</button>`}</div></div>`;
 else if(state.modal==='camera') html=`<div class="modal-backdrop"><div class="modal camera-modal" role="dialog" aria-modal="true" aria-label="Fotoğraf gönder"><div class="modal-top"><h2>Fotoğraf gönder</h2><button class="close" data-action="close-modal" aria-label="Kapat">×</button></div><p class="muted">Ürünün ayrıntısını şimdi çekebilir veya galerinden seçebilirsin.</p><div class="camera-options"><button type="button" class="btn btn-primary" id="cameraStart" data-action="camera-start">Kamerayı aç</button><label class="btn btn-outline camera-gallery">Galeriden seç<input id="chatGalleryInput" type="file" accept="image/jpeg,image/png,image/webp"></label></div><video id="cameraPreview" autoplay playsinline muted hidden></video><button class="btn btn-primary camera-capture" id="cameraCapture" data-action="camera-capture" hidden>Fotoğrafı çek</button></div></div>`;
 else if(state.modal) html=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.modal.title)}"><div class="modal-top"><h2>${escapeHtml(state.modal.title)}</h2><button class="close" data-action="close-modal" aria-label="Kapat">×</button></div><p class="muted">${escapeHtml(state.modal.body)}</p>${state.modal.form}</div></div>`;
 if(state.modal==='auth' && state.authTab==='login' && !state.emailVerificationAvailable){
  html=html.replace('<button class="btn btn-light" style="width:100%;margin-top:8px" data-action="auth-tab" data-tab="verify">Kodla doğrula</button>','');
 }
 $('#modal-root')?.remove(); if(html) document.body.insertAdjacentHTML('beforeend',`<div id="modal-root">${html}</div>`);
 if(html)applyLocale($('#modal-root'),language);
 setupRegistrationForm();
}
let universitiesRequest=null;
async function loadUniversities(){
 if(state.universities.length)return state.universities;
 if(!universitiesRequest)universitiesRequest=api('/api/universities').then(result=>{state.universities=result.universities;return state.universities;}).finally(()=>{universitiesRequest=null;});
 return universitiesRequest;
}
async function populateRegistrationUniversities(form){
 const select=form.elements.university,submit=form.querySelector('button:not([type])');
 select.disabled=true;submit.disabled=true;
 try{
  const universities=await loadUniversities();if(!form.isConnected)return;
  select.innerHTML='<option value="">Üniversite seç</option>'+universities.map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  select.disabled=false;submit.disabled=false;applyLocale(select,language);
 }catch(error){if(!form.isConnected)return;select.innerHTML='<option value="">Liste yüklenemedi</option>';showRegistrationErrors(form,{},'Üniversite listesi yüklenemedi. Tekrar dene.');form.querySelector('.registration-alert').insertAdjacentHTML('beforeend',' <button type="button" data-action="retry-universities">Tekrar dene</button>');}
}
function setupRegistrationForm(){
 const form=$('[data-form="register"]');if(!form)return;
 for(const input of form.querySelectorAll('.field input,.field select')){
  input.id=input.id||'register-'+input.name;
  input.closest('.field').querySelector('label').htmlFor=input.id;
  const error=document.createElement('span');error.id=input.id+'-error';error.className='field-error';error.hidden=true;input.after(error);
  input.setAttribute('aria-describedby',error.id);
  input.autocomplete=({name:'name',email:'email',password:'new-password',phone:'tel'})[input.name]||'off';
 }
 populateRegistrationUniversities(form);
}
function showRegistrationErrors(form,fields,message='',focus=false){
 for(const input of form.querySelectorAll('.field input,.field select')){
  const error=form.querySelector('#'+input.id+'-error');
  input.setAttribute('aria-invalid',fields[input.name]?'true':'false');
  error.textContent=fields[input.name]?translateText(fields[input.name],language):'';error.hidden=!fields[input.name];
 }
 const alert=form.querySelector('.registration-alert');alert.textContent=message?translateText(message,language):'';alert.hidden=!message;
 if(focus)form.querySelector('[aria-invalid="true"]')?.focus();
}
document.addEventListener('change',event=>{
 const input=event.target,form=input.closest('[data-form="register"]');if(!form||input.name!=='university')return;
 const fields=validateRegistration(Object.fromEntries(new FormData(form)),state.universities).fields;
 const error=form.querySelector('#'+input.id+'-error');input.setAttribute('aria-invalid',fields.university?'true':'false');error.textContent=translateText(fields.university||'',language);error.hidden=!fields.university;
});
document.addEventListener('focusout',event=>{
 const form=event.target.closest('[data-form="register"]');if(!form||!event.target.name)return;
 const fields=validateRegistration(Object.fromEntries(new FormData(form)),state.universities).fields;
 const input=event.target,error=form.querySelector('#'+input.id+'-error');if(!error)return;
 input.setAttribute('aria-invalid',fields[input.name]?'true':'false');error.hidden=!fields[input.name];error.textContent=translateText(fields[input.name]||'',language);
});
document.addEventListener('input',event=>{
 const form=event.target.closest('[data-form="register"]');if(!form)return;
 const input=event.target,error=form.querySelector('#'+input.id+'-error');if(!error)return;
 if(input.getAttribute('aria-invalid')==='true'){
  const fields=validateRegistration(Object.fromEntries(new FormData(form)),state.universities).fields;
  error.textContent=translateText(fields[input.name]||'',language);error.hidden=!fields[input.name];input.setAttribute('aria-invalid',fields[input.name]?'true':'false');
 }
 form.querySelector('.registration-alert').hidden=true;
});
function clearEditPhotos(){newEditPhotos.forEach(photo=>URL.revokeObjectURL(photo.url));newEditPhotos=[];keptEditPhotos=[];}
function renderEditPhotos(){
 const list=$('#editPhotoList');if(!list)return;
 const photos=[...keptEditPhotos.map(filename=>({src:`/uploads/${encodeURIComponent(filename)}`,kind:'kept'})),...newEditPhotos.map(photo=>({src:photo.url,kind:'new'}))];
 list.innerHTML=photos.map((photo,index)=>`<div class="edit-photo"><img src="${escapeHtml(photo.src)}" alt="${index+1}. fotoğraf"><span>${index===0?'Kapak fotoğrafı':`${index+1}. fotoğraf`}</span><button type="button" data-action="remove-edit-photo" data-kind="${photo.kind}" data-index="${photo.kind==='kept'?index:index-keptEditPhotos.length}" aria-label="Fotoğrafı kaldır">×</button></div>`).join('');
 $('#editPhotoCount').textContent=translateText(`${photos.length}/6 fotoğraf`,language);
 applyLocale(list,language);
}
function closeModal(){ stopCamera();clearEditPhotos();state.modal=null; $('#modal-root')?.remove(); }
let detailPhotos=[],detailPhotoIndex=0;
function showDetailPhoto(index){
 if(!detailPhotos.length)return;
 detailPhotoIndex=(index+detailPhotos.length)%detailPhotos.length;
 const photo=detailPhotos[detailPhotoIndex],main=$('#detailMainPhoto');if(!main)return;
 main.src=photo.src;main.alt=photo.alt;
 $('#detailPhotoCounter').textContent=`${detailPhotoIndex+1} / ${detailPhotos.length}`;
 document.querySelectorAll('[data-action="carousel-show"]').forEach((button,i)=>button.classList.toggle('active',i===detailPhotoIndex));
}
function decorateDetail(){
 const gallery=$('.detail-gallery');if(!gallery)return;
 detailPhotos=[...gallery.querySelectorAll('img')].map(image=>({src:image.getAttribute('src'),alt:image.alt}));detailPhotoIndex=0;
 if(detailPhotos.length){
  gallery.classList.add('detail-carousel');
  gallery.innerHTML=`<div class="carousel-main"><img id="detailMainPhoto" alt=""><button type="button" class="carousel-arrow prev" data-action="carousel-prev" aria-label="Önceki fotoğraf">‹</button><button type="button" class="carousel-arrow next" data-action="carousel-next" aria-label="Sonraki fotoğraf">›</button><span class="carousel-counter" id="detailPhotoCounter"></span></div>${detailPhotos.length>1?`<div class="carousel-thumbs">${detailPhotos.map((photo,index)=>`<button type="button" data-action="carousel-show" data-index="${index}" aria-label="${index+1}. fotoğraf"><img src="${escapeHtml(photo.src)}" alt=""></button>`).join('')}</div>`:''}`;
  showDetailPhoto(0);
  if(detailPhotos.length===1)gallery.querySelectorAll('.carousel-arrow').forEach(button=>button.hidden=true);
  let startX=0;const main=gallery.querySelector('.carousel-main');
  main.addEventListener('touchstart',event=>{startX=event.touches[0].clientX},{passive:true});
  main.addEventListener('touchend',event=>{const distance=event.changedTouches[0].clientX-startX;if(Math.abs(distance)>45)showDetailPhoto(detailPhotoIndex+(distance<0?1:-1))},{passive:true});
 }
 const sellerId=Number($('.detail-side .seller-link')?.getAttribute('href')?.split('/').pop());
 if(state.user?.id===sellerId){
  const id=route().split('/')[2];
  $('.detail-side').insertAdjacentHTML('afterbegin',`<div class="detail-owner-actions"><button type="button" class="owner-menu-trigger" data-action="owner-menu" aria-label="İlan seçenekleri" aria-expanded="false">⋯</button><div class="owner-menu" hidden><button type="button" data-action="edit-listing" data-id="${id}">İlanı düzenle</button></div></div>`);
 }
 applyLocale(gallery,language);
 applyLocale($('.detail-side'),language);
}
const accountRoutes=new Set(['/favorites','/messages','/mine','/manage','/account','/sell','/sell-sale','/sell-donation','/admin']);
let navigationSequence=0;
function showRouteLoading(path){
 const label=path==='/messages'?'Mesajlar':path==='/favorites'?'Favoriler':path==='/mine'?'İlanlarım':path==='/admin'?'Yönetim':'İlanlar';
 pageFrame(`<main class="shell page route-loading" aria-busy="true"><div class="loading-line"></div><div class="loading-title">${label} yükleniyor…</div><div class="loading-card"></div><div class="loading-card"></div></main>`,path);
}
async function render(){const path=route(),sequence=++navigationSequence;
 const loadingTimer=setTimeout(()=>{if(sequence===navigationSequence&&route()===path)showRouteLoading(path);},120);
 try { const path=route(); if(!state.user && accountRoutes.has(path)){await renderBrowse();showAuth();return;} if(path==='/') await renderBrowse(); else if(path==='/donation') await renderBrowse(true); else if(path.startsWith('/listing/')) {await renderDetail(path.split('/')[2]);decorateDetail();} else if(path.startsWith('/seller/')) await renderSeller(path.split('/')[2]); else if(path==='/sell') renderSellChoice(); else if(path==='/sell-sale') {renderSell();restoreDraft();} else if(path==='/sell-donation') {renderSell('donation');restoreDraft();} else if(path==='/favorites') await renderFavorites(); else if(path.startsWith('/admin-messages/'))await renderAdminMessages(path.split('/')[2],path.split('/')[3]);else if(path.startsWith('/admin-message/')){if(state.user?.role!=='admin'){go('/');return;}state.selectedConversation=Number(path.split('/')[2]);await renderMessages();}else if(path==='/messages') await renderMessages(); else if(path==='/mine') await renderListingsDashboard(); else if(path==='/manage') await renderManage(); else if(path==='/account'){await loadUniversities();renderAccount();} else if(path==='/support') await renderSupport(); else if(path==='/admin') await renderAdmin(); else go('/'); } catch(error){ if(sequence===navigationSequence){toast(error.message);pageFrame(`<main class="shell page">${empty('Sayfa yüklenemedi',error.message)}</main>`,'/');} } finally {clearTimeout(loadingTimer);} }
async function refreshUser(){const result=await api('/api/me');state.user=result.user;state.emailVerificationAvailable=result.emailVerificationAvailable;connectMessageStream();}
async function refreshUnread(){
  state.unreadCount=state.user?(await api('/api/unread-count')).count:0;
  document.querySelectorAll('.message-count').forEach(badge=>{badge.hidden=state.unreadCount===0;badge.textContent=state.unreadCount>99?'99+':String(state.unreadCount);});
}
let messageStream=null, streamUserId=null, liveRenderTimer=null;
function connectMessageStream(){
 if(streamUserId===state.user?.id && messageStream)return;
 messageStream?.close();messageStream=null;streamUserId=state.user?.id||null;
 if(!streamUserId)return;
 messageStream=new EventSource('/api/message-events');
 messageStream.onmessage=event=>{
  let payload;try{payload=JSON.parse(event.data)}catch{return;}
  responseCache.delete('/api/conversations');
  if(payload.senderId===state.user?.id){refreshUnread().catch(()=>{});return;}
  clearTimeout(liveRenderTimer);
  liveRenderTimer=setTimeout(()=>{
   if((route()==='/messages'||route().startsWith('/admin-message/')) && !document.hidden && voiceRecorder?.state!=='recording') renderMessages().catch(error=>toast(error.message));
   else refreshUnread().catch(()=>{});
  },60);
 };
}
document.addEventListener('click',async event=>{
 const target=event.target.closest('[data-action]');
 if(target){event.preventDefault(); const action=target.dataset.action,id=target.dataset.id;
  try{
   if(action==='close-modal') return closeModal();
   if(action==='photo-menu'){discardVoiceRecording();state.modal='camera';drawModal();return;}
   if(action==='edit-message')return showSimpleModal('Mesajı düzenle','',`<form data-form="edit-message" data-id="${id}"><textarea name="body" maxlength="2000" required>${escapeHtml(target.dataset.body)}</textarea><button class="btn btn-primary">Kaydet</button></form>`);
   if(action==='delete-message'){await api('/api/messages/'+id,{method:'DELETE'});return renderMessages();}
   if(action==='voice-start'){await startVoiceRecording();return;}
   if(action==='voice-stop'){if(voiceRecorder?.state==='recording')voiceRecorder.stop();return;}
   if(action==='remove-voice'){discardVoiceRecording();return;}
   if(action==='remove-chat-photo'){chatPhoto=null;updateChatPhotoStatus();return;}
   if(action==='camera-start'){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Bu tarayıcıda canlı kamera açılamıyor. Galeriden seçebilirsin.');
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    const video=$('#cameraPreview');video.srcObject=cameraStream;video.hidden=false;try{await video.play();}catch(error){stopCamera();throw error;}
    $('#cameraStart').hidden=true;$('#cameraCapture').hidden=false;return;
   }
   if(action==='camera-capture'){
    const video=$('#cameraPreview');if(!video?.videoWidth)throw new Error('Kamera görüntüsü henüz hazır değil.');
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    canvas.getContext('2d').drawImage(video,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
    if(!blob || blob.size>5*1024*1024)throw new Error('Fotoğraf 5 MB sınırını aşıyor.');
    chatPhoto=new File([blob],`kamera-${Date.now()}.jpg`,{type:'image/jpeg'});discardVoiceRecording();closeModal();updateChatPhotoStatus();return;
   }
   if(action==='login-required') return showAuth();
   if(action==='choose-university'){
    showSimpleModal('Üniversite seç','Bu seçim yalnızca hangi üniversitenin ilanlarını gördüğünü değiştirir.',state.universities.length?universityPickerForm():'<p class="muted" role="status">Üniversiteler yükleniyor…</p>');
    const picker=state.modal;
    if(!state.universities.length){
     try{await loadUniversities();}catch(error){if(state.modal===picker)closeModal();throw error;}
     if(state.modal!==picker)return;
     picker.form=universityPickerForm();drawModal();
    }
    $('#universityPickerSearch')?.focus();return;
   }
   if(action==='select-university'){state.filters.university=target.dataset.university;closeModal();return render();}
   if(action==='retry-universities'){const form=target.closest('form');showRegistrationErrors(form,{});return populateRegistrationUniversities(form);}
   if(action==='auth-tab'){state.authTab=target.dataset.tab;return drawModal();}
   if(action==='sell'){ if(!state.user)return showAuth(); return go('/sell'); }
   if(action==='sell-donation'){ if(!state.user)return showAuth(); return go('/sell-donation'); }
   if(action==='filter-category'){state.filters.category=target.dataset.category;return render();}
   if(action==='toggle-theme'){const change=()=>{theme=theme==='dark'?'light':'dark';localStorage.setItem('unipazar-theme',theme);document.documentElement.dataset.theme=theme;const button=document.querySelector('.theme-toggle');button.innerHTML=themeIcon();button.setAttribute('aria-label',theme==='dark'?'Açık moda geç':'Karanlık moda geç');button.title=theme==='dark'?'Açık mod':'Karanlık mod';};change();return;}
   if(action==='set-language'){language=target.dataset.language;localStorage.setItem('unipazar-language',language);return render();}
   if(action==='carousel-prev')return showDetailPhoto(detailPhotoIndex-1);
   if(action==='carousel-next')return showDetailPhoto(detailPhotoIndex+1);
   if(action==='carousel-show')return showDetailPhoto(Number(target.dataset.index));
   if(action==='owner-menu'){const menu=$('.owner-menu');menu.hidden=!menu.hidden;target.setAttribute('aria-expanded',String(!menu.hidden));return;}
   if(action==='cancel-listing'){localStorage.removeItem('unipazar-listing-draft');selectedListingPhotos=[];const form=target.closest('[data-form="listing"]');form?.reset();go('/');return;}
   if(action==='account'){ if(!state.user)return showAuth(); const menu=$('.profile-menu'); menu.hidden=!menu.hidden; target.setAttribute('aria-expanded',String(!menu.hidden)); return; }
   if(action==='change-email') return showSimpleModal('E-postamı değiştir','Yeni e-postanı doğrulaman gerekecek.',`<form data-form="change-email"><div class="field"><label>Yeni e-posta</label><input name="email" type="email" required></div><div class="field"><label>Mevcut şifren</label><input name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary">E-postayı değiştir</button></form>`);
   if(action==='change-phone') return showSimpleModal('Telefon numaramı değiştir','Numaran yalnızca hesap bilgilerinde görünür.',`<form data-form="change-phone"><div class="field"><label>Yeni telefon numarası</label><input name="phone" type="tel" placeholder="05xx xxx xx xx" required></div><div class="field"><label>Mevcut şifren</label><input name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary">Numarayı kaydet</button></form>`);
   if(action==='logout'){await api('/api/logout',{method:'POST'});state.user=null;connectMessageStream();state.unreadCount=0;state.filters.university='';go('/');toast('Çıkış yapıldı.');return render();}
   if(!state.user){showAuth();return;}
   if(action==='favorite'){
    const wasFavorite=target.textContent.includes('♥');
    updateFavoriteButtons(id,!wasFavorite);target.disabled=true;
    try{
     await api(`/api/listings/${id}/favorite`,{method:wasFavorite?'DELETE':'POST'});
     if(wasFavorite&&route()==='/favorites'){
      target.closest('.card')?.remove();
      if(!document.querySelector('.grid .card')){$('.grid').innerHTML=empty('Henüz favorin yok','Beğendiğin ilanları kalp simgesiyle kaydet.');applyLocale($('.grid'),language);}
     }
     toast(wasFavorite?'Favorilerden çıkarıldı.':'Favorilere eklendi.');
    }catch(error){updateFavoriteButtons(id,wasFavorite);throw error;}
    finally{target.disabled=false;}
    return;
   }
   if(action==='start-chat'){const data=await api(`/api/listings/${id}/conversation`,{method:'POST'});state.selectedConversation=data.id;state.openConversationOnNavigation=true;return go('/messages');}
   if(action==='request-donation') return showSimpleModal('Ürünü talep et','Kısa bir not yaz. İhtiyaç durumun bağışçıya gösterilmez.',`<form data-form="donation-request" data-id="${id}"><div class="field"><label>Talep notu</label><textarea name="note" maxlength="500" required></textarea></div><button class="btn btn-primary">Talep gönder</button></form>`);
   if(action==='report') return showSimpleModal('İlanı bildir','Sorunu kısaca açıkla; yönetici inceleyecek.',`<form data-form="report" data-id="${id}"><div class="field"><label>Bildirim nedeni</label><textarea name="reason" maxlength="500" required></textarea></div><button class="btn btn-primary">Bildir</button></form>`);
   if(action==='report-message')return showSimpleModal('Mesajı bildir','Yönetici bildirilen konuşmayı inceleyebilir.',`<form data-form="report-message" data-id="${id}"><div class="field"><label>Bildirim nedeni</label><textarea name="reason" maxlength="500" required></textarea></div><button class="btn btn-primary">Bildir</button></form>`);
   if(action==='edit-listing'){
    const {listing:l}=await api(`/api/listings/${id}`);
    clearEditPhotos();keptEditPhotos=l.images.map(image=>image.filename);
    const conditions=['Yeni','Az kullanılmış','Kullanılmış','Onarım gerektirir'];
    showSimpleModal('İlanı düzenle','İlan bilgilerini ve fotoğraflarını güncelleyebilirsin.',`<form data-form="edit-listing" data-id="${id}" enctype="multipart/form-data"><div class="field"><label>Ürün adı</label><input name="title" maxlength="100" value="${escapeHtml(l.title)}" required></div><div class="form-grid"><div class="field"><label>Kategori</label><select name="category" required>${categories.map(category=>`<option value="${escapeHtml(category)}" ${category===l.category?'selected':''}>${escapeHtml(category)}</option>`).join('')}</select></div><div class="field"><label>Durumu</label><select name="condition" required>${conditions.map(condition=>`<option value="${escapeHtml(condition)}" ${condition===l.condition?'selected':''}>${condition}</option>`).join('')}</select></div></div>${l.kind==='sale'?`<div class="field"><label>Fiyat (₺)</label><input name="price" type="text" inputmode="numeric" pattern="[0-9]+" maxlength="9" value="${l.price/100}" required></div>`:''}<div class="field"><label>Açıklama</label><textarea name="description" maxlength="2000" required>${escapeHtml(l.description)}</textarea></div><div class="field"><label>Fotoğraflar</label><div id="editPhotoList" class="edit-photo-list"></div><label class="photo-picker edit-photo-picker" for="editPhotos"><span class="photo-picker-icon">＋</span><span><strong>Fotoğraf ekle</strong><small id="editPhotoCount"></small></span><input id="editPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><span class="hint">En çok 6 fotoğraf; her biri en fazla 5 MB. İlk fotoğraf kapak olur.</span></div><button class="btn btn-primary">Kaydet</button></form>`);
    $('#modal-root .modal').classList.add('edit-listing-modal');renderEditPhotos();return;
   }
   if(action==='remove-edit-photo'){const index=Number(target.dataset.index);if(target.dataset.kind==='kept')keptEditPhotos.splice(index,1);else{const [photo]=newEditPhotos.splice(index,1);if(photo)URL.revokeObjectURL(photo.url);}return renderEditPhotos();}
   if(action==='handoff') return showSimpleModal('Güvenli buluşma öner','Kalabalık ve bilinen bir noktayı tercih et.',`<form data-form="handoff"><div class="field"><label>Buluşma noktası</label><input name="place" required maxlength="120" placeholder="Örn. Kütüphane girişi"></div><div class="field"><label>Tarih ve saat</label><input name="meetingAt" type="datetime-local" required></div><button class="btn btn-primary">Öneriyi gönder</button></form>`);
   if(action==='handoff-status'){await api(`/api/conversations/${state.selectedConversation}/handoff`,{method:'PATCH',body:{status:target.dataset.status}});toast('Buluşma güncellendi.');return render();}
   if(action==='mark-sold') return showSimpleModal('İlanı tamamla','Bu ilanı satıldı veya verildi olarak işaretlemek istediğine emin misin?',`<form data-form="confirm-sold" data-id="${id}"><div class="inline-actions"><button class="btn btn-primary">Evet, tamamla</button><button type="button" class="btn btn-light" data-action="close-modal">Vazgeç</button></div></form>`);
   if(['reserve','reactivate','remove'].includes(action)){const status={'mark-sold':'sold',reserve:'reserved',reactivate:'active',remove:'removed'}[action];await api(`/api/listings/${id}`,{method:'PATCH',body:{status}});toast('İlan güncellendi.');return render();}
   if(action==='offer-decision'){await api(`/api/offers/${id}`,{method:'PATCH',body:{status:target.dataset.status}});toast('Teklif yanıtlandı.');return render();}
   if(action==='request-decision'){await api(`/api/donation-requests/${id}`,{method:'PATCH',body:{status:target.dataset.status}});toast('Talep güncellendi.');return render();}
   if(action==='admin-account'){
    const closed=target.dataset.closed==='1';
    if(closed){await api(`/api/admin/accounts/${id}`,{method:'PATCH',body:{closed:false}});toast('Hesap yeniden açıldı.');return render();}
    return showSimpleModal('Hesabı kapat',`${target.dataset.name} adlı kişinin hesabı kapatılacak. Oturumu sonlandırılacak ve yayındaki ilanları kaldırılacak.`, `<form data-form="admin-close-account" data-id="${id}"><div class="inline-actions"><button class="btn btn-danger">Evet, hesabı kapat</button><button type="button" class="btn btn-light" data-action="close-modal">Vazgeç</button></div></form>`);
   }
   if(action==='admin-message'){const result=await api('/api/admin/accounts/'+id+'/message',{method:'POST',body:{}});closeModal();state.selectedConversation=result.conversationId;state.openConversationOnNavigation=true;go('/admin-message/'+result.conversationId);return;}
   if(action==='admin-listings'){
    const {listings}=await api('/api/admin/accounts/'+id+'/listings');
    return showSimpleModal('Kullanıcının ilanları','İlanları inceleyebilir, düzenleyebilir veya yayından kaldırabilirsin.',listings.length?listings.map(l=>`<div class="list-row"><div><a href="#/listing/${l.id}" data-action="close-modal"><strong>${escapeHtml(l.title)}</strong></a><small>${listingStatus(l.status)}</small></div><div class="inline-actions"><button class="btn btn-outline" data-action="edit-listing" data-id="${l.id}">Düzenle</button>${l.status!=='removed'?`<button class="btn btn-danger" data-action="admin-remove-listing" data-id="${l.id}">Kaldır</button>`:''}</div></div>`).join(''):empty('İlan yok',''));
   }
   if(action==='admin-remove-listing')return showSimpleModal('İlanı kaldır','Bu ilan yayından kaldırılacak.',`<form data-form="admin-remove-listing" data-id="${id}"><button class="btn btn-danger">Kaldırmayı onayla</button></form>`);
   if(action==='admin-conversations'){closeModal();go('/admin-messages/'+id);return;}
   if(action==='admin-review-form'){closeModal();go('/admin-messages/'+(target.dataset.account||'report')+'/'+id);return;}
   if(action==='admin-support'){await api(`/api/admin/support/${id}`,{method:'PATCH',body:{status:target.dataset.status}});toast('Destek başvurusu güncellendi.');return render();}
   if(action==='admin-report'){await api(`/api/admin/reports/${id}`,{method:'PATCH',body:{removeListing:!!target.dataset.remove}});toast('Şikâyet kapatıldı.');return render();}
   if(action==='resend-profile-code'){const result=await api('/api/resend-code',{method:'POST',body:{email:state.user.email}});state.devCode=result.devCode||'';toast(result.message);return render();}
   if(action==='resend-code'){const email=$('[data-form="verify"] [name="email"]')?.value;const result=await api('/api/resend-code',{method:'POST',body:{email}});state.devCode=result.devCode||'';drawModal();toast(result.message);}
  }catch(error){toast(error.message);}
 }
 const conversation=event.target.closest('[data-conversation]'); if(conversation){event.preventDefault();state.selectedConversation=Number(conversation.dataset.conversation);render();}
 if(event.target.closest('a[href="#/messages"]') && !conversation){state.selectedConversation=null;if(route()==='/messages')renderMessages().catch(error=>toast(error.message));}
});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-form]'); if(!form)return; event.preventDefault();
 const type=form.dataset.form, data=Object.fromEntries(new FormData(form).entries()); const submit=form.querySelector('[type="submit"],button:not([type])'); if(submit)submit.disabled=true;
 try{
  if(type==='register'){const validation=validateRegistration(data,state.universities);showRegistrationErrors(form,validation.fields,Object.keys(validation.fields).length?'Lütfen işaretli alanları kontrol et.':'',true);if(Object.keys(validation.fields).length)return;Object.assign(data,validation.values);data.rememberMe=data.rememberMe==='true';const result=await api('/api/register',{method:'POST',body:data});if(result.user){state.user=result.user;connectMessageStream();refreshUnread().catch(()=>{});closeModal();toast(result.message);return render();}state.pendingEmail=data.email;state.pendingRememberMe=data.rememberMe;state.devCode=result.devCode||'';state.authTab='verify';drawModal();toast(result.message);return;}
  if(type==='verify'){data.rememberMe=state.pendingRememberMe;const result=await api('/api/verify-email',{method:'POST',body:data});state.user=result.user;connectMessageStream();closeModal();toast('E-posta doğrulandı.');return render();}
  if(type==='login'){data.rememberMe=data.rememberMe==='true';const result=await api('/api/login',{method:'POST',body:data});state.user=result.user;connectMessageStream();refreshUnread().catch(()=>{});closeModal();toast('Hoş geldin!');return render();}
  if(type==='listing'){const body=new FormData(form);if(body.getAll('photos').length>6)throw new Error('En fazla 6 fotoğraf ekleyebilirsin.');if(body.get('kind')==='donation')body.set('price','0');const result=await api('/api/listings',{method:'POST',body});localStorage.removeItem('unipazar-listing-draft');selectedListingPhotos=[];toast('İlan yayınlandı.');return go('/listing/'+result.id);}
  if(type==='admin-remove-listing'){await api('/api/listings/'+form.dataset.id,{method:'PATCH',body:{status:'removed'}});closeModal();toast('İlan kaldırıldı.');return render();}
  if(type==='edit-listing'){if(keptEditPhotos.length+newEditPhotos.length<1)throw new Error('En az bir fotoğraf gerekli.');const body=new FormData(form);body.set('keepPhotos',JSON.stringify(keptEditPhotos));newEditPhotos.forEach(photo=>body.append('photos',photo.file));await api(`/api/listings/${form.dataset.id}`,{method:'PATCH',body});closeModal();toast('İlan güncellendi.');return render();}
  if(type==='profile'){const result=await api('/api/me/profile',{method:'PATCH',body:data});state.user=result.user;state.filters.university=state.user.university;toast('Bilgiler kaydedildi.');return render();}
  if(type==='change-email'){const result=await api('/api/me/email',{method:'PATCH',body:data});state.user=result.user;state.devCode=result.devCode||'';closeModal();toast('E-posta değiştirildi. Yeni adresini doğrula.');return render();}
  if(type==='change-phone'){const result=await api('/api/me/phone',{method:'PATCH',body:data});state.user=result.user;closeModal();toast('Telefon numarası kaydedildi.');return render();}
  if(type==='support'){await api('/api/support-application',{method:'POST',body:data});toast('Başvurun gönderildi.');return render();}
  if(type==='admin-close-account'){await api(`/api/admin/accounts/${form.dataset.id}`,{method:'PATCH',body:{closed:true}});closeModal();toast('Hesap kapatıldı.');return render();}
  if(type==='edit-message'){await api('/api/messages/'+form.dataset.id,{method:'PATCH',body:{body:data.body}});closeModal();return renderMessages();}
  if(type==='admin-review'){const {messages}=await api(`/api/admin/conversations/${form.dataset.id}/review`,{method:'POST',body:{reason:data.reason}});return showSimpleModal('Konuşma incelemesi','İnceleme gerekçesi kaydedildi. Mesajlar yalnızca okunabilir.',`<div class="admin-review-messages">${messages.length?messages.map(m=>`<div class="admin-review-message"><strong>${escapeHtml(m.sender_name)}</strong><small>${escapeHtml(m.created_at)}</small>${m.body?`<p>${escapeHtml(m.body)}</p>`:''}${m.photo_filename?`<img class="chat-photo" src="/api/admin/messages/${m.id}/photo" alt="Gönderilen fotoğraf">`:''}${m.voice_filename?`<audio controls preload="none" src="/api/admin/messages/${m.id}/voice" aria-label="Sesli mesaj"></audio>`:''}</div>`).join(''):empty('Mesaj yok','')}</div>`);}
  if(type==='confirm-sold'){await api(`/api/listings/${form.dataset.id}`,{method:'PATCH',body:{status:'sold'}});closeModal();toast('İlan tamamlandı.');return render();}
  if(type==='profile-verify'){const result=await api('/api/me/verify-email',{method:'POST',body:data});state.user=result.user;state.pendingEmailVerification=false;state.devCode='';toast('E-posta doğrulandı.');return render();}
  if(type==='message'){
   const body=new FormData(form);if(chatPhoto)body.set('photo',chatPhoto);
   if(voiceRecorder?.state==='recording')throw new Error('Önce ses kaydını bitir.');
   if(voiceClip)body.set('voice',voiceClip);
   if(!String(body.get('body')||'').trim() && !chatPhoto && !voiceClip)throw new Error('Mesaj yaz, fotoğraf veya ses kaydı ekle.');
   await api(`/api/conversations/${state.selectedConversation}/messages`,{method:'POST',body});
   chatPhoto=null;discardVoiceRecording();form.reset();return renderMessages();
  }
  if(type==='handoff'){await api(`/api/conversations/${state.selectedConversation}/handoff`,{method:'POST',body:data});closeModal();toast('Buluşma önerisi gönderildi.');return render();}
  if(type==='donation-request'){await api(`/api/listings/${form.dataset.id}/requests`,{method:'POST',body:data});closeModal();toast('Talep gönderildi.');return;}
  if(type==='report'){await api('/api/reports',{method:'POST',body:{listingId:Number(form.dataset.id),reason:data.reason}});closeModal();toast('Bildirim alındı.');return;}
  if(type==='report-message'){await api('/api/reports',{method:'POST',body:{messageId:Number(form.dataset.id),reason:data.reason}});closeModal();toast('Mesaj bildirildi.');return;}
 }catch(error){if(type==='register'){showRegistrationErrors(form,error.fields||{},error.message,true);}else toast(error.message);}finally{if(submit)submit.disabled=false;}
});
let searchTimer; document.addEventListener('input',event=>{if(event.target.id==='adminAccountSearch'){const query=event.target.value.toLocaleLowerCase('tr-TR');document.querySelectorAll('[data-admin-account]').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase('tr-TR').includes(query)});return;}if(event.target.id==='universityPickerSearch'){const q=event.target.value.toLocaleLowerCase('tr-TR');document.querySelectorAll('.university-option').forEach(option=>{option.hidden=!option.textContent.toLocaleLowerCase('tr-TR').includes(q)});return;}if(event.target.name==='price')event.target.value=event.target.value.replace(/[^0-9]/g,'');if(event.target.id==='searchInput'){clearTimeout(searchTimer);const query=event.target.value;state.filters.q=query;$('.grid')?.setAttribute('aria-busy','true');searchTimer=setTimeout(()=>refreshSearchResults(query),250);} const form=event.target.closest('[data-form="listing"]');if(form){const draft=Object.fromEntries([...new FormData(form).entries()].filter(([,value])=>typeof value==='string'));localStorage.setItem('unipazar-listing-draft',JSON.stringify(draft));}});
document.addEventListener('change',event=>{if(event.target.id==='chatGalleryInput'){const file=event.target.files?.[0];if(file){if(file.size>5*1024*1024){toast('Fotoğraf en fazla 5 MB olabilir.');return;}chatPhoto=file;discardVoiceRecording();closeModal();updateChatPhotoStatus();}return;}if(event.target.id==='editPhotos'){const incoming=[...event.target.files];event.target.value='';if(keptEditPhotos.length+newEditPhotos.length+incoming.length>6){toast('En fazla 6 fotoğraf ekleyebilirsin.');return;}if(incoming.some(file=>file.size>5*1024*1024)){toast('Her fotoğraf en fazla 5 MB olabilir.');return;}newEditPhotos.push(...incoming.map(file=>({file,url:URL.createObjectURL(file)})));renderEditPhotos();return;}if(event.target.id==='photos'){const incoming=[...event.target.files];if(selectedListingPhotos.length+incoming.length>6){toast('En fazla 6 fotoğraf ekleyebilirsin.');}else if(incoming.some(file=>file.size>5*1024*1024)){toast('Her fotoğraf en fazla 5 MB olabilir.');}else selectedListingPhotos.push(...incoming);const transfer=new DataTransfer();selectedListingPhotos.forEach(file=>transfer.items.add(file));event.target.files=transfer.files;$('#photoCount').textContent=translateText(selectedListingPhotos.length?`${selectedListingPhotos.length}/6 fotoğraf seçildi`:'Henüz fotoğraf seçilmedi',language);return;}if(event.target.id==='categoryFilter'){state.filters.category=event.target.value;render();} if(event.target.id==='browseUniversity'){state.filters.university=event.target.value;render();} if(event.target.id==='kind'){const donation=event.target.value==='donation';$('#priceField').hidden=donation;$('#price').required=!donation;}});
let previousRoute=route();
function prefetchListing(event){
 const link=event.target.closest?.('a[href^="#/listing/"]');
 if(!link)return;
 const id=link.getAttribute('href').match(/^#\/listing\/(\d+)$/)?.[1];
 if(id)api('/api/listings/'+id).catch(()=>{});
}
document.addEventListener('pointerover',prefetchListing);
document.addEventListener('focusin',prefetchListing);
document.addEventListener('touchstart',prefetchListing,{passive:true});
window.addEventListener('hashchange',()=>{const nextRoute=route();window.scrollTo(0,0);if(state.modal==='camera')closeModal();if(nextRoute!=='/messages')discardVoiceRecording();if(nextRoute==='/messages'&&previousRoute!=='/messages'&&!state.openConversationOnNavigation)state.selectedConversation=null;state.openConversationOnNavigation=false;previousRoute=nextRoute;render();});
if(!location.hash)history.replaceState(null,'',location.pathname+location.search+'#/');
refreshUser().then(()=>{refreshUnread().catch(()=>{});if(!state.user && accountRoutes.has(route()))history.replaceState(null,'',location.pathname+location.search+'#/');render();}).catch(error=>toast(error.message));
setInterval(()=>{if(state.user && !document.hidden) refreshUnread().catch(()=>{});},15000);
