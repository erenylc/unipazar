import {syncMessageMedia,messagePhotoURL,clearMessageMedia,mountVoicePreview,clearVoicePreview} from './message-media.js';
import {attachPhotoGestures} from './photo-gestures.js';
import {chatIcons,avatarMarkup} from './chat-ui.js';
import {optimizePhoto} from './photo-upload.js';
import {createRefreshQueue} from './live-refresh.js';
import {helpTopics} from './help-topics.js';
import {validateRegistration} from './registration-validation.js';
import {authModal} from './auth-templates.js';
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
const state = { user:null, listings:[], universities:[], emailVerificationAvailable:false,emailVerificationRequired:false,phoneVerificationAvailable:false,contactVerificationRequired:false, googleClientId:'', googleProfile:null, legalVersion:null, unreadCount:0, selectedConversation:null, filters:{ q:'',category:'',kind:'',university:'*' }, modal:null, authTab:'login', devCode:'', pendingRememberMe:false, pendingEmailVerification:false };
let saleUniversityFilter='*';
let language=languages[localStorage.getItem('unipazar-language')]?localStorage.getItem('unipazar-language'):'tr';
let theme=localStorage.getItem('unipazar-theme')==='dark'?'dark':'light';
function applyTheme(){
 document.documentElement.dataset.theme=theme;
 document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',theme==='dark'?'dark':'only light');
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#1e1e2e':'#f6f6f1');
}
applyTheme();
 const categories = ['Ders kitapları','Elektronik','Ev & yurt','Giyim','Spor','Diğer'];
const icon = { home:'⌂', heart:'♡', plus:'＋', chat:'▤', user:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.4-4.2 3-6.3 7.5-6.3s7.1 2.1 7.5 6.3"/></svg>' };
let toastTimer;
let photoViewerCleanup=null;
const responseCache=new Map();
let cacheGeneration=0;
function cacheLifetime(url){
 if(url.startsWith('/api/listings?'))return 30000;
 if(/^\/api\/listings\/\d+$/.test(url))return 30000;
 if(url==='/api/mine'||url==='/api/favorites')return 30000;
 if(['/api/conversations','/api/admin/queue','/api/admin/accounts','/api/support-application','/api/offers','/api/donation-requests'].includes(url))return 5000;
 return 0;
}
let voiceAudioContext=null, voiceAnalyser=null, voiceAnimation=null, voiceStarted=0;
let chatPhoto=null, cameraStream=null, voiceClip=null, voicePreviewUrl=null, voiceRecorder=null, voiceStream=null, voiceTimer=null, voiceSeconds=0, discardVoice=false, voiceFinishing=false, voiceStarting=false, voiceGeneration=0, selectedListingPhotos=[], keptEditPhotos=[], newEditPhotos=[];
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

  if(!res.ok){const original=data.error||'İşlem tamamlanamadı.', translated=translateText(original,language);const error=new Error(language==='tr'||translated!==original?translated:translateText('İşlem tamamlanamadı.',language));error.fields=data.fields;error.retryAfter=data.retryAfter;throw error;}
  return data;
}
function route(){ return (location.hash || '#/').slice(1); }
function go(path){ location.hash='#'+path; }
function mobileNavbar(active,badge){
 const svg=paths=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
 const navIcons={
  explore:svg('<path d="m3.5 10 8.5-7 8.5 7v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/><path d="M9 21v-8h6v8"/>'),
  plus:svg('<path d="M12 5v14M5 12h14"/>'),
  messages:svg('<path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 10 10 0 0 1-3.6-.7L3 21l1.7-5.4a8.5 8.5 0 1 1 15.8-4.1Z"/><path d="M8 10h8M8 14h5"/>'),
  account:icon.user
 };
 const item=(path,label,image,selected,extra='')=>`<a href="#${path}" class="mobile-nav-item ${selected?'active':''} ${extra}" ${selected?'aria-current="page"':''}><span class="mobile-nav-icon">${image}${path==='/messages'?badge:''}</span><span class="mobile-nav-label">${label}</span></a>`;
 return `<nav class="mobile-nav" aria-label="Ana menü">${item('/','Keşfet',navIcons.explore,active==='/')}${item('/messages','Mesajlar',navIcons.messages,active==='/messages')}${item('/sell','İlan ver',navIcons.plus,active==='/sell','mobile-nav-create')}${item('/account','Hesabım',state.user?.avatarUrl?avatarMarkup(state.user.name,state.user.avatarUrl):navIcons.account,['/account','/orders','/mine','/favorites','/support','/donation','/admin','/manage'].includes(active))}</nav>`;
}
const languageNames={tr:'Türkçe',en:'English',es:'Español',kk:'Қазақша',de:'Deutsch',fr:'Français'};
const languageFlag=code=>`<img class="language-flag" src="/flags/${code}.svg" alt="" width="22" height="15">`;
function navbar(active){
  const link=(path,label)=>`<a href="#${path}" class="${active===path?'active':''}">${label}</a>`;
  const badge=state.unreadCount?`<span class="message-badge message-count">${state.unreadCount>99?'99+':state.unreadCount}</span>`:'<span class="message-badge message-count" hidden></span>';
  const supportLink=state.user?.needsSupport?link('/donation','Dayanışma'):'';
  const profile=state.user?`<div class="profile-menu" hidden><div class="profile-summary"><div class="profile-summary-text"><strong>${escapeHtml(state.user.name)}</strong><span>${escapeHtml(state.user.university)}</span><small>${escapeHtml(state.user.email)}</small></div><button type="button" class="profile-summary-photo" data-action="view-avatar" aria-label="Profil fotoğrafını büyüt">${avatarMarkup(state.user.name,state.user.avatarUrl,'avatar profile-summary-avatar')}</button></div><a href="#/account">Hesabım</a><a href="#/mine">İlanlarım</a><a href="#/notifications">Bildirimler</a><a href="#/orders">Siparişlerim</a><a href="#/favorites">Favoriler</a><a href="#/support">Destek</a>${state.user.needsSupport?'<a href="#/donation">Dayanışma</a>':''}${state.user.role==='admin'?'<a href="#/admin">Yönetim</a>':''}<details class="language-menu"><summary>🌐 ${translateText('Dil',language)} · ${languageFlag(language)} ${languageNames[language]}</summary><div class="language-options">${Object.entries(languages).map(([code,label])=>`<button type="button" data-action="set-language" data-language="${code}" ${code===language?'aria-current="true"':''}>${languageFlag(code)}<span>${languageNames[code]}</span></button>`).join('')}</div></details><button class="profile-logout" data-action="logout">Hesaptan çıkış yap</button></div>`:`<div class="profile-menu guest-profile-menu" hidden><a href="#/account">Hesabım</a><a href="#/mine">İlanlarım</a><a href="#/notifications">Bildirimler</a><a href="#/orders">Siparişlerim</a><a href="#/favorites">Favoriler</a><a href="#/support">Destek</a><button type="button" data-action="login-required">Giriş yap</button><button type="button" data-action="login-required" data-tab="register">Hesap oluştur</button></div>`;
  return `<header class="topbar"><div class="shell top-inner"><a href="#/" class="brand"><img class="brand-mark" src="/logo-mark.svg" alt="" width="36" height="36">UniSatış</a><nav class="nav">${link('/','Keşfet')}${supportLink}${link('/favorites','Favoriler')}${link('/messages',`Mesajlarım ${badge}`)}${state.user?link('/mine','İlanlarım')+link('/notifications','Bildirimler'):''}${state.user?.role==='admin'?link('/admin','Yönetim'):''}</nav><div class="top-spacer"></div><div class="top-actions"><button type="button" class="theme-toggle" data-action="toggle-theme" aria-label="${theme==='dark'?'Açık moda geç':'Karanlık moda geç'}" title="${theme==='dark'?'Açık mod':'Karanlık mod'}">${themeIcon()}</button><a class="support-entry" href="#/support">Destek</a><button class="btn btn-primary desktop-only" data-action="sell">＋ İlan ver</button><button class="icon-btn account-icon" data-action="account" aria-label="Hesabım" aria-expanded="false">${state.user?.avatarUrl?avatarMarkup(state.user.name,state.user.avatarUrl):icon.user}</button>${profile}</div></div></header>${mobileNavbar(active,badge)}`;
}
function faqContent(){ return `<section class="faq-section" aria-labelledby="faqTitle"><h2 id="faqTitle">Sıkça sorulan sorular</h2><div class="faq-list">${helpTopics.map(topic=>`<details class="faq-item"><summary>${escapeHtml(topic.title)}</summary><p>${escapeHtml(topic.answer)}</p></details>`).join('')}</div></section>`; }
function footer(){return `<footer class="footer"><div class="shell footer-help"><button type="button" class="btn btn-outline" data-action="faq">Sıkça sorulan sorular</button><a class="btn btn-outline" href="/legal/privacy" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a></div><div class="shell footer-inner"><span>© ${new Date().getFullYear()} Üni Satış · Üniversite içinde alışveriş ve dayanışma</span><span>Güvenli buluşmalar için kalabalık ve bilinen noktaları tercih et.</span></div></footer>`;}
function listingCard(item){
 const isDonation=item.kind==='donation';
 return `<article class="card"><a class="card-image" href="#/listing/${item.id}">${item.cover?`<img src="/uploads/${encodeURIComponent(item.cover)}?width=480" alt="${escapeHtml(item.title)}" loading="lazy">`:'<div class="placeholder">Fotoğraf yok</div>'}<span class="badge ${isDonation?'free':''}">${isDonation?'Dayanışma':'İkinci el'}</span></a><button class="favorite ${item.favorite?'is-favorite':''}" aria-pressed="${!!item.favorite}" data-action="favorite" data-id="${item.id}" aria-label="${item.favorite?'Favorilerden çıkar':'Favorilere ekle'}">${item.favorite?'♥':'♡'}</button><div class="card-body"><a href="#/listing/${item.id}"><h3>${escapeHtml(item.title)}</h3><div class="price">${isDonation?'Ücretsiz':money(item.price)}</div><div class="meta card-campus"><span class="card-campus-logo" data-university-logo="${escapeHtml(item.university)}">${universityLogo(item.university)}</span><span>${escapeHtml(item.university)}</span></div><div class="meta card-condition">${escapeHtml(translateText(item.condition,language))}</div><span class="card-detail">İlanı incele <span aria-hidden="true">→</span></span></a></div></article>`;
}
function contactBadges(email,phone){return `<div class="seller-verification" aria-label="Satıcının iletişim doğrulaması">${email?'<span>✓ E-posta doğrulandı</span>':''}${phone?'<span>✓ Telefon doğrulandı</span>':'<small>Telefon doğrulanmadı</small>'}</div>`;}
function empty(title,body){ return `<div class="empty"><div class="empty-icon">☘</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`; }
function pageFrame(content,active){
 const art={'/favorites':'favorites','/mine':'listings','/manage':'listings','/sell':'listings','/account':'account','/support':'support','/admin':'account'}[active];
 if(art)content=content.replace(/<div class="section-head"><div><h2>([\s\S]*?)<\/h2><p>([\s\S]*?)<\/p><\/div><\/div>/,
  (_match,title,subtitle)=>`<section class="page-intro page-intro-${art}"><div><span class="page-intro-kicker">ÜNİ SATIŞ</span><h2>${title}</h2><p>${subtitle}</p></div><img src="/${art}-illustration.svg" alt="" aria-hidden="true"></section>`);
 if(active!=='/messages')syncMessageMedia(null,state.user?.id??null);
 $('#app').innerHTML=navbar(active)+content+footer();
 applyLocale($('#app'),language);
 document.dispatchEvent(new Event('unisatis-render'));
}
async function loadListings(){
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(state.filters)) if(value && !(key==='university' && value==='*')) params.set(key,value);
  const result=await api('/api/listings?'+params);state.listings=result.listings;state.feedPage=result.page;
}
async function refreshSearchResults(query){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(state.filters)) if(value && !(key==='university' && value==='*')) params.set(key,value);
 const grid=$('.grid'), filters=JSON.stringify(state.filters);
 if(!grid)return;
 grid.setAttribute('aria-busy','true');
 const isCurrent=()=>grid===$('.grid') && filters===JSON.stringify(state.filters) && $('#searchInput')?.value===query && ['/','/donation'].includes(route());
 try{
  const {listings,page}=await api('/api/listings?'+params);
  if(!isCurrent())return;
  state.listings=listings;state.feedPage=page;
  if(route()==='/')$('.section-head h2').textContent=translateText(state.filters.university==='*'?'Tüm üniversitelerde neler var?':`${state.filters.university}’nde neler var?`,language);
  $('.grid').innerHTML=listings.length?listings.map(listingCard).join(''):empty(query?'Sonuç bulunamadı':'Henüz ilan yok',query?'Başka bir ürün adı deneyebilirsin.':'İlk ilanı sen verebilirsin.');
  $('.result-count').textContent=`${listings.length} ilan`;
  applyLocale($('.grid'),language);
  $('.result-count').textContent=translateText(`${listings.length} ilan`,language);
  $('.grid').setAttribute('aria-busy','false');
  document.dispatchEvent(new Event('unisatis-feed-reset'));
 }catch(error){if(isCurrent()){toast(error.message);grid.setAttribute('aria-busy','false');}}
}
async function renderBrowse(donations=false){
 if(donations && !state.user?.needsSupport){go('/support');return;}
 if(donations&&state.filters.kind!=='donation')saleUniversityFilter=state.filters.university||'*';
 if(!donations&&state.filters.kind==='donation')state.filters.university=saleUniversityFilter;
 state.filters.kind=donations?'donation':'sale';
  if(donations && state.user) state.filters.university=state.user.university;
 if(!donations&&!state.filters.university)state.filters.university='*';
 await loadListings();
 if(route()!==(donations?'/donation':'/'))return;
  const title=donations?'Dayanışma ilanları':state.filters.university==='*'?'Tüm üniversitelerde neler var?':`${state.filters.university}’nde neler var?`;
  pageFrame(`<main class="shell page">${donations?`<section class="hero"><div class="hero-copy"><div class="eyebrow">♧ Bir eşya, yeni bir başlangıç</div><h1>Paylaştıkça üniversiten güzelleşir.</h1><p>Kullanmadığın eşyaları ücretsiz ver; ihtiyacı olan bir öğrencinin işine yarasın.</p><button class="btn" data-action="sell-donation">Ücretsiz ürün ver →</button></div><div class="hero-art"><img src="/marketplace-motion.svg" alt="İkinci el alışveriş ve öğrenci dayanışması çizimi"></div></section>`:`<section class="hero"><div class="hero-copy"><div class="eyebrow">Üni Satış · Öğrenci pazarı ve dayanışma</div><h1>Öğrenciler arasında<br>ikinci el alışveriş.</h1><p>İkinci el ürünleri keşfet, kullanmadığın eşyaları paylaş.</p><button class="btn" data-action="sell">İlan ver →</button></div><div class="hero-art"><img src="/marketplace-motion.svg" alt="İkinci el alışveriş ve öğrenci dayanışması çizimi"></div></section>`}<div class="campus-strip"><span class="campus-label">Üniversite seç:</span>${donations?`<span class="campus-pill campus-own">${universityLogo(state.user.university,true)}${escapeHtml(state.user.university)}</span>`:`<button class="campus-picker" data-action="choose-university" aria-label="İlanları görmek için üniversite seç"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 9 10-5 10 5-10 5L2 9Zm4 3v5c3.8 2.8 8.2 2.8 12 0v-5M22 9v7"/></svg><span>${escapeHtml(state.filters.university==='*'?'Tüm üniversiteler':state.filters.university||'Üniversite seç')}</span>${universityLogo(state.filters.university,true)}<b aria-hidden="true">⌄</b></button>`}${!state.user?'<span>Üniversite seçerek ilanları inceleyebilirsin.</span>':''}</div>${donations?`<div class="panel donation-process"><h2>Dayanışma nasıl işler?</h2><div class="steps"><div><strong>1. Ürünü incele</strong><p>Üniversitendeki ücretsiz ürünleri ve açıklamalarını gör.</p></div><div><strong>2. Talep gönder</strong><p>İhtiyacın olan ürüne kısa bir notla talep gönder.</p></div><div><strong>3. Teslim al</strong><p>Bağışçı seçerse güvenli bir noktada teslim alın.</p></div></div><p class="small muted">Aynı anda en fazla 3 açık talep gönderebilirsin.</p></div>`:''}<div class="section-head"><div><h2>${title}</h2><p>${donations?'Ücretsiz ürünleri destek isteyen öğrenciler görebilir ve talep edebilir.':'Öğrencilerin yeni eklediği ilanlar'}</p></div><span class="muted small result-count">${state.listings.length} ilan</span></div><div class="filters"><label class="search"><span>⌕</span><input id="searchInput" placeholder="Ürün, kitap, marka ara..." value="${escapeHtml(state.filters.q)}" aria-label="Ürün ara"></label><details class="category-menu"><summary>${escapeHtml(state.filters.category||'Tüm kategoriler')} <span>⌄</span></summary><div class="category-options">${['',...categories].map(c=>`<button type="button" data-action="filter-category" data-category="${escapeHtml(c)}" aria-pressed="${state.filters.category===c}">${escapeHtml(c||'Tüm kategoriler')}</button>`).join('')}</div></details></div><div class="grid">${state.listings.length?state.listings.map(listingCard).join(''):empty('Henüz ilan yok','İlk ilanı sen verebilirsin.')}</div>${!donations?`<div class="donation-banner"><div><h2>Dayanışma da üniversitenin bir parçası.</h2><p>Kullanmadığın bir eşya başka bir öğrencinin ihtiyacını karşılayabilir.</p></div><a class="btn btn-primary" href="#/sell-donation">Ücretsiz ürün ver →</a></div>`:''}</main>`,donations?'/donation':'/');
}
async function renderDetail(id){
 const {listing:l}=await api('/api/listings/'+id);if(route()!=='/listing/'+id)return;
  const images=l.images.length?l.images.map(i=>`<img src="/uploads/${encodeURIComponent(i.filename)}?width=1600" alt="${escapeHtml(l.title)}" decoding="async">`).join(''):`<div class="placeholder" style="grid-column:1/-1;height:390px">Fotoğraf yok</div>`;
 const mine=state.user?.id===l.seller_id;
  pageFrame(`<main class="shell page"><a class="back-link" href="#${l.kind==='donation'?'/donation':'/'}"><span aria-hidden="true">←</span> İlanlara dön</a><div class="detail" style="margin-top:18px"><div><div class="detail-gallery">${images}</div><div class="panel" style="margin-top:18px"><h2>Ürün açıklaması</h2><p style="white-space:pre-wrap">${escapeHtml(l.description)}</p><div class="rule"></div><div class="inline-actions"><span class="status">${escapeHtml(translateText(l.category,language))}</span><span class="status">${escapeHtml(translateText(l.condition,language))}</span><span class="detail-university">${universityLogo(l.university)}<strong>${escapeHtml(l.university)}</strong></span></div></div></div><aside class="panel detail-side" data-listing-status="${escapeHtml(l.status)}"><span class="badge ${l.kind==='donation'?'free':''}">${l.kind==='donation'?'Dayanışma':'İkinci el'}</span><h1>${escapeHtml(l.title)}</h1><div class="detail-price">${l.kind==='donation'?'Ücretsiz':money(l.price)}</div><div class="muted small" style="margin-top:10px">⌖ ${escapeHtml(l.university)}</div><div class="rule"></div><a class="seller seller-link" href="#/seller/${l.seller_id}"><span class="avatar">${escapeHtml(l.seller_name[0]?.toUpperCase())}</span><div><strong>${escapeHtml(l.seller_name)}</strong><div class="muted small">Diğer satış ilanlarını gör →</div>${contactBadges(l.seller_email_verified,l.seller_phone_verified)}</div></a><div class="rule"></div>${l.status!=='active'?`<p class="status">${l.status==='expired'?'Bu ilan 180 günü doldurduğu için yayından kaldırıldı.':`Bu ilan şu an ${listingStatus(l.status).toLocaleLowerCase('tr-TR')}.`}</p>`:mine?`<button class="btn btn-primary listing-complete-button" data-action="mark-sold" data-id="${l.id}"><span aria-hidden="true">✓</span><span>${l.kind==='donation'?'Paylaşımı tamamla':'Satışı tamamla'}</span><span aria-hidden="true">→</span></button>`:l.kind==='donation'?`<button class="btn btn-primary" style="width:100%" data-action="request-donation" data-id="${l.id}">Ürünü talep et</button><p class="small muted">Destek isteyen öğrenciler talep gönderebilir.</p>`:`<button class="btn btn-primary" style="width:100%" data-action="start-chat" data-id="${l.id}">Satıcıya özel mesaj yaz</button>`}<button class="btn btn-light" style="width:100%;margin-top:9px" data-action="favorite" data-id="${l.id}">${l.favorite?'♥ Favorilerden çıkar':'♡ Favorilere ekle'}</button><button class="detail-report" data-action="report" data-id="${l.id}" title="İlanı bildir" aria-label="İlanı bildir">⚑</button></aside></div></main>`,l.kind==='donation'?'/donation':'/');
 const published=new Date(String(l.created_at||'').replace(' ','T')+(/Z$|[+-]\d\d:\d\d$/.test(l.created_at||'')?'':'Z'));
 if(!Number.isNaN(published.getTime()))$('.detail-side .badge')?.insertAdjacentHTML('afterend',`<time class="listing-published" datetime="${published.toISOString()}" title="Yayın tarihi">${published.toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'})}</time>`);
}
function renderSell(kind='sale'){
 if(!state.user){ showAuth(); return; }
 if(!ensureSellingPhone())return;
 clearListingPhotos();
 pageFrame(`<main class="shell page" style="max-width:850px"><div class="section-head"><div><h2>${kind==='donation'?'Ücretsiz ürün paylaş':'Yeni ilan ver'}</h2><p>${kind==='donation'?'İlanın kendi üniversitendeki öğrencilere gösterilir.':'İlanın tüm üniversitelerdeki öğrencilere gösterilir.'}${kind==='donation'?' Paylaştığın bir eşya, başka bir öğrencinin hayatını kolaylaştırabilir.':''}</p></div></div><form class="panel" data-form="listing" enctype="multipart/form-data"><input type="hidden" name="kind" value="${kind}"><p class="status">${kind==='donation'?'Ücretsiz ürün':'İkinci el satış'}</p><div class="field"><label for="title">Ürün adı</label><input name="title" id="title" maxlength="100" required placeholder="Örn. İktisat 101 ders kitabı"></div><div class="form-grid"><div class="field"><label for="category">Kategori</label><select name="category" id="category" required><option value="">Kategori seç</option>${categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select></div><div class="field"><label for="condition">Durumu</label><select name="condition" id="condition" required><option value="">Durum seç</option><option value="Yeni">Yeni</option><option value="Az kullanılmış">Az kullanılmış</option><option value="Kullanılmış">Kullanılmış</option><option value="Onarım gerektirir">Onarım gerektirir</option></select></div></div><div class="field" id="priceField" ${kind==='donation'?'hidden':''}><label for="price">Fiyat (₺)</label><input name="price" id="price" type="text" inputmode="numeric" pattern="[0-9]+" maxlength="9" ${kind==='sale'?'required':''} placeholder="0"></div><div class="field"><label for="description">Açıklama</label><textarea name="description" id="description" maxlength="2000" required placeholder="Ürünün özelliklerini ve varsa kusurlarını açıkça yaz."></textarea></div><div class="field"><label for="photos">Fotoğraflar</label><label class="photo-picker" for="photos"><span class="photo-picker-icon">＋</span><span><strong>Fotoğraf ekle</strong><small id="photoCount">Henüz fotoğraf seçilmedi</small></span><input name="photos" id="photos" type="file" accept="image/*,.heic,.heif" multiple></label><div id="listingPhotoList" class="listing-photo-list" aria-label="Seçilen fotoğraflar"></div><span class="hint">En çok 6 fotoğraf; her biri en fazla 12 MB. İlk fotoğraf kapak olur.</span></div><div class="inline-actions"><button class="btn btn-primary" type="submit">İlanı yayınla</button><button class="btn btn-light" type="button" data-action="cancel-listing">Vazgeç</button></div></form></main>`,'/sell');
}
function restoreDraft(){
 const form=$('[data-form="listing"]'); if(!form)return;
 try{const draft=JSON.parse(localStorage.getItem('unipazar-listing-draft')||'null');if(!draft)return;
  for(const [name,value] of Object.entries(draft)){if(name==='kind')continue;const field=form.elements.namedItem(name);if(field)field.value=value;}
  toast('Kaydedilmiş ilan taslağın yüklendi.');
 }catch{}
}
function addEditButtons(listings){
 for(const item of listings){const row=$(`a[href="#/listing/${item.id}"]`)?.closest('.list-row');row?.querySelector('.inline-actions')?.insertAdjacentHTML('afterbegin',item.status==='active'||item.status==='reserved'?`<button class="btn btn-outline" data-action="edit-listing" data-id="${item.id}">Düzenle</button>`:`<a class="btn btn-outline" href="#/listing/${item.id}">İncele</a>`);}
 applyLocale($('.list'),language);
}
function updateFavoriteButtons(id,favorite){
 document.querySelectorAll(`[data-action="favorite"][data-id="${id}"]`).forEach(button=>{
  const detail=!!button.closest('.detail-side');
  button.textContent=detail?translateText(favorite?'♥ Favorilerden çıkar':'♡ Favorilere ekle',language):(favorite?'♥':'♡');
  button.setAttribute('aria-label',translateText(favorite?'Favorilerden çıkar':'Favorilere ekle',language));
  button.classList.toggle('is-favorite',favorite);button.setAttribute('aria-pressed',String(favorite));
 });
 const item=state.listings.find(listing=>String(listing.id)===String(id));
 if(item)item.favorite=favorite;
}
async function renderSeller(id){ const {seller,listings}=await api('/api/sellers/'+id+'/listings');if(route()!=='/seller/'+id)return;pageFrame(`<main class="shell page"><a class="back-link" href="#/"><span aria-hidden="true">←</span> İlanlara dön</a><div class="section-head">${avatarMarkup(seller.name,state.user?seller.avatarUrl:null)}<div><h2>${escapeHtml(seller.name)} adlı öğrencinin profili</h2><p>Yayındaki ikinci el satış ilanları · ${escapeHtml(seller.university)}</p>${contactBadges(seller.email_verified,seller.phone_verified)}</div></div><div class="grid">${listings.length?listings.map(listingCard).join(''):empty('Aktif satış ilanı yok','Bu satıcının başka satış ilanı bulunmuyor.')}</div></main>`,'/');}
async function renderFavorites(){ if(!state.user){showAuth();return;} const {listings}=await api('/api/favorites');if(route()!=='/favorites')return; pageFrame(`<main class="shell page"><div class="section-head"><div><h2>Favorilerim</h2><p>Kaydettiğin ilanlar burada.</p></div></div><div class="grid">${listings.length?listings.map(listingCard).join(''):empty('Henüz favorin yok','Beğendiğin ilanları kalp simgesiyle kaydet.')}</div></main>`,'/favorites'); }
async function renderManage(){ if(!state.user){showAuth();return;} const [{listings},{offers},{requests}]=await Promise.all([api('/api/mine'),api('/api/offers'),api('/api/donation-requests')]);if(route()!=='/manage')return; const archived=listings.filter(l=>!['active','reserved'].includes(l.status)); pageFrame(`<main class="shell page"><div class="section-head"><div><h2>Eski ve silinen ilanlarım</h2><p>Tamamlanan, silinen ve süresi dolan ilanların.</p></div></div><div class="list">${archived.length?archived.map(l=>`<div class="list-row"><div><a href="#/listing/${l.id}"><strong>${escapeHtml(l.title)}</strong></a><small>${l.kind==='donation'?'Ücretsiz':money(l.price)} · ${escapeHtml(listingStatus(l.status))}</small></div><div class="inline-actions">${l.status==='active'?`<button class="btn btn-light" data-action="reserve" data-id="${l.id}">Ayır</button><button class="btn btn-outline" data-action="mark-sold" data-id="${l.id}">Tamamlandı</button>`:''}${l.status==='reserved'?`<button class="btn btn-light" data-action="reactivate" data-id="${l.id}">Yeniden aç</button><button class="btn btn-outline" data-action="mark-sold" data-id="${l.id}">Tamamlandı</button>`:''}${l.status!=='removed'?`<button class="btn btn-danger" data-action="remove" data-id="${l.id}">Sil</button>`:''}</div></div>`).join(''):empty('Arşivde ilanın yok','Tamamlanan, silinen ve süresi dolan ilanlar burada görünür.')}</div>${false&&offers.length?`<div class="section-head"><h2>Gelen teklifler</h2></div><div class="list">${offers.map(o=>`<div class="list-row"><div><strong>${escapeHtml(o.title)} · ${money(o.amount)}</strong><small>${escapeHtml(o.buyer_name)} · ${escapeHtml(o.status)}</small></div>${o.status==='pending'?`<div class="inline-actions"><button class="btn btn-primary" data-action="offer-decision" data-id="${o.id}" data-status="accepted">Kabul et</button><button class="btn btn-outline" data-action="offer-decision" data-id="${o.id}" data-status="rejected">Reddet</button></div>`:''}</div>`).join('')}</div>`:''}${false&&requests.length?`<div class="section-head"><h2>Dayanışma talepleri</h2></div><div class="list">${requests.map(r=>`<div class="list-row"><div><strong>${escapeHtml(r.title)} · ${escapeHtml(r.requester_name)}</strong><small>${escapeHtml(r.note)} · ${escapeHtml(r.status)}</small></div>${r.status==='pending'?`<div class="inline-actions"><button class="btn btn-primary" data-action="request-decision" data-id="${r.id}" data-status="accepted">Kabul et</button><button class="btn btn-outline" data-action="request-decision" data-id="${r.id}" data-status="rejected">Reddet</button></div>`:r.status==='accepted'?`<button class="btn btn-primary" data-action="request-decision" data-id="${r.id}" data-status="completed">Teslim edildi</button>`:''}</div>`).join('')}</div>`:''}</main>`,'/mine'); addEditButtons(listings); }
function ownListingCard(item){
 const free=item.kind==='donation';
 return `<article class="card"><a class="card-image" href="#/listing/${item.id}">${item.cover?`<img src="/uploads/${encodeURIComponent(item.cover)}" alt="${escapeHtml(item.title)}" loading="lazy">`:'<div class="placeholder">Fotoğraf yok</div>'}<span class="badge ${free?'free':''}">${free?'Ücretsiz':'İkinci el'}</span></a><div class="card-body"><a href="#/listing/${item.id}"><h3>${escapeHtml(item.title)}</h3></a><div class="price">${free?'Ücretsiz':money(item.price)}</div><div class="meta">${escapeHtml(item.university)} · ${escapeHtml(item.condition)} · ${item.status==='active'?'Yayında':'Ayrıldı'}</div><button class="btn btn-outline" data-action="edit-listing" data-id="${item.id}" style="margin-top:12px">Düzenle</button></div></article>`;
}
function ensureSellingPhone(){
 const needed=[state.emailVerificationRequired&&!state.user.emailVerified?'e-posta':null,(state.contactVerificationRequired||state.sellerPhoneVerificationRequired)&&!state.user.phoneVerified?'telefon':null].filter(Boolean);if(needed.length){pageFrame(`<main class="shell page narrow-page"><section class="panel"><h2>İletişim bilgilerini doğrula</h2><p>İlan verebilmek için ${needed.join(' ve ')} doğrulamasını tamamlaman gerekiyor.</p><a class="btn btn-primary" href="#/account">Hesabımdan doğrula</a></section></main>`,'/sell');return false;}
 if(state.user.phone)return true;
 pageFrame(`<main class="shell page narrow-page"><section class="panel"><h2>Telefon numaranı ekle</h2><p>İlan vermek için telefon bilgilerini tamamlaman gerekiyor.</p><div class="phone-required-actions"><button class="btn btn-primary" data-action="change-phone">Telefon numarası ekle</button><a class="btn btn-light" href="#/sell">Seçeneklere dön</a></div></section></main>`,'/sell');
 return false;
}
function renderSellChoice(){
 if(!state.user){showAuth();return;}
 pageFrame(`<main class="shell page narrow-page"><div class="section-head"><div><h2>Nasıl ilan vermek istersin?</h2><p>${escapeHtml(state.user.university)} öğrencileri için bir seçenek seç.</p></div></div><div class="choice-grid"><a class="choice-card" href="#/sell-sale"><span class="choice-icon">↗</span><h3>İkinci el satış</h3><p>Ürününe fiyat belirle ve üniversitendeki öğrencilere satışa çıkar.</p><strong>Satılık ilan ver →</strong></a><a class="choice-card choice-free" href="#/sell-donation"><span class="choice-icon">♡</span><h3>Ücretsiz ürün ver</h3><p>Kullanmadığın eşyayı desteğe ihtiyacı olan bir öğrenciye ücretsiz ver.</p><strong>Dayanışma ilanı ver →</strong></a></div></main>`,'/sell');
}
async function renderListingsDashboard(){
 if(!state.user){showAuth();return;}
 const {listings}=await api('/api/mine');if(route()!=='/mine')return;
 const active=listings.filter(item=>item.status==='active'||item.status==='reserved');
 pageFrame(`<main class="shell page account-page"><div class="section-head"><div><h2>İlanlarım</h2><p>${escapeHtml(state.user.university)} için verdiğin ilanlar.</p></div></div><div class="panel giving-panel"><div><h3>Dayanışma için ücretsiz ürün ver</h3><p>Kullanmadığın bir ürünü fiyat koymadan paylaşabilirsin. Ücretsiz ilanlar yalnızca destek isteyen öğrenci hesaplarına gösterilir; sen kendi ilanını buradan takip edebilirsin.</p></div><a class="btn btn-primary" href="#/sell-donation">Ücretsiz ürün ver →</a></div><div class="section-head"><div><h2>Satışta ve paylaşımda olan ürünlerim</h2><p>Fotoğraflarına, fiyatına ve ürün bilgilerine buradan ulaş.</p></div></div><div class="grid">${active.length?active.map(ownListingCard).join(''):empty('Henüz aktif ilanın yok','İkinci el satış veya ücretsiz ürün ilanı verebilirsin.')}</div><div class="inline-actions account-bottom-actions"><a class="btn btn-outline" href="#/manage">İlanlarım ve eski ilanlarım</a></div></main>`,'/mine');
}
function renderAccount(){
 if(!state.user){pageFrame(`<main class="shell page narrow-page">${empty('Hesabına giriş yap','Kişisel bilgilerini görmek için önce giriş yap.') }<button class="btn btn-primary" data-action="login-required">Giriş yap</button></main>`,'/account');showAuth();return;}
 const u=state.user;
 pageFrame(`<main class="shell page profile-page"><div class="section-head"><div><h2>Hesabım</h2><p>Kişisel bilgilerini burada güncelleyebilirsin.</p></div></div><section class="panel"><div class="seller"><button type="button" class="profile-photo-button" data-action="view-avatar" aria-label="Profil fotoğrafını büyüt">${avatarMarkup(u.name,u.avatarUrl)}<span class="profile-camera">${chatIcons.camera}</span></button><div><strong>${escapeHtml(u.name)}</strong><div class="muted small">${escapeHtml(u.university)}</div></div></div><button type="button" class="auth-text-link profile-photo-link" data-action="profile-photo">Profil fotoğrafını değiştir</button><div class="rule"></div><form data-form="profile"><div class="field"><label for="profileName">Ad ve soyad</label><input id="profileName" name="name" maxlength="80" required value="${escapeHtml(u.name)}"></div><div class="field"><label for="profileUniversity">Üniversite</label><input id="profileUniversity" name="university" list="profileUniversityOptions" required autocomplete="off" value="${escapeHtml(u.university)}"><datalist id="profileUniversityOptions">${state.universities.map(name=>`<option value="${escapeHtml(name)}"></option>`).join('')}</datalist></div><button class="btn btn-primary">Kişisel bilgileri kaydet</button></form><div class="rule"></div><div class="profile-contact"><div><strong>E-posta</strong><p>${escapeHtml(u.email)}</p><span class="contact-status ${u.emailVerified?'verified':''}">${u.emailVerified?'✓ E-posta doğrulandı':'E-posta doğrulanmadı'}</span></div><button class="btn btn-outline" data-action="change-email">E-postamı değiştir</button></div><div class="profile-contact"><div><strong>Telefon numarası</strong><p>${u.phone?escapeHtml(u.phone):'Henüz eklenmedi'}</p>${u.phone?`<span class="contact-status ${u.phoneVerified?'verified':''}">${u.phoneVerified?'✓ SMS ile doğrulandı':'Telefon numarası doğrulanmadı'}</span>${!u.phoneVerified?'<div class="verification-actions"><button type="button" class="btn btn-outline" data-action="verify-phone">Telefonumu doğrula</button></div>':''}`:''}</div><button class="btn btn-outline" data-action="change-phone">${u.phone?'Telefon numaramı değiştir':'Telefon numarası ekle'}</button></div>${state.emailVerificationAvailable && !u.emailVerified?`<form class="profile-verification" data-form="profile-verify"><div class="field"><label for="profileCode">E-postana gelen doğrulama kodu</label><input id="profileCode" name="code" inputmode="numeric" maxlength="6" required></div>${state.devCode?`<p class="small">Geliştirme kodu: ${escapeHtml(state.devCode)}</p>`:''}<button class="btn btn-outline">E-postayı doğrula</button><button type="button" class="btn btn-light" data-action="resend-profile-code">Yeni kod gönder</button></form>`:''}</section></main>`,'/account');
 if(u.role!=='admin')$('.profile-page')?.insertAdjacentHTML('beforeend','<section class="panel account-delete-panel"><h3>Hesabı sil</h3><p>Hesabın, ilanların, mesajların ve yüklediğin dosyalar kalıcı olarak silinir.</p><button class="btn btn-danger" data-action="delete-account">Hesabımı sil</button></section>');
}
async function renderSupport(){
 if(state.user) await refreshUser();
 if(!state.user){renderGuestArea('/support');return;}
 const {application}=await api('/api/support-application');if(route()!=='/support')return;
 const status=application?.status==='approved'?'Başvurun kabul edildi. Dayanışma ilanlarını görebilirsin.':application?.status==='pending'?'Başvurun incelemede.':application?.status==='rejected'?'Başvurun kabul edilmedi. Bilgilerini güncelleyip yeniden gönderebilirsin.':'';
 pageFrame(`<main class="shell page narrow-page"><div class="section-head"><div><h2>Destek başvurusu</h2><p>İhtiyacı olan öğrencilerin üniversitelerindeki ücretsiz ilanlara erişmesi için.</p></div></div><section class="panel support-panel"><p>Başvurunda ihtiyacının nedenini ve aylık aile gelirini paylaş. Bu bilgiler yalnızca başvuruyu inceleyen yöneticiye gösterilir. Tam TC kimlik numaranı istemiyoruz; son 4 hane başvurunu ayırt etmek içindir ve kimlik doğrulaması sayılmaz.</p>${status?`<p class="status">${escapeHtml(status)}</p>`:''}${application?.status==='approved'?'<a class="btn btn-primary" href="#/donation">Ücretsiz ilanları gör</a>':`<form data-form="support"><div class="field"><label for="supportReason">Desteğe neden ihtiyacın var?</label><textarea id="supportReason" name="reason" minlength="30" maxlength="1000" required placeholder="Durumunu kısaca anlat">${escapeHtml(application?.reason||'')}</textarea></div><div class="field"><label for="familyIncome">Aylık aile geliri (₺)</label><input id="familyIncome" type="number" min="0" max="1000000" step="1" name="familyIncome" value="${application?.family_income??''}" required></div><div class="field"><label for="identityLast4">TC kimlik numaranın son 4 hanesi</label><input id="identityLast4" name="identityLast4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${escapeHtml(application?.identity_last4||'')}" required></div><button class="btn btn-primary">${application?'Başvuruyu güncelle':'Başvuruyu gönder'}</button></form>`}</section></main>`,'/support');
}
const chatTime = value => value ? new Date(value).toLocaleTimeString(({tr:'tr-TR',en:'en-GB',es:'es-ES',kk:'kk-KZ',de:'de-DE',fr:'fr-FR'})[language]||'tr-TR',{hour:'2-digit',minute:'2-digit'}) : '';
let messagesRenderSequence=0;

let chatConversations=[],chatRenderedId=null,typingStopTimer=null,typingSent=false;
const chatMessages=new Map(),chatDrafts=new Map();
const chatHistoryBefore=new Map();
const messagePageURL=id=>`/api/conversations/${id}/messages${chatHistoryBefore.has(id)?'?before='+chatHistoryBefore.get(id):''}`;
function conversationById(id){return chatConversations.find(c=>c.id===Number(id));}
function decorateChatOptions(conversations,selected){
 document.querySelectorAll('.chat-list [data-conversation]').forEach(link=>{
  const row=document.createElement('div');row.className='chat-row';link.replaceWith(row);row.append(link);
  row.insertAdjacentHTML('beforeend',`<button type="button" class="chat-options-trigger" data-action="conversation-options" data-id="${link.dataset.conversation}" aria-label="Sohbet seçenekleri">${chatIcons.more}</button>`);
 });
 if(selected.id)$('.chat-header')?.insertAdjacentHTML('beforeend',`<button type="button" class="chat-options-trigger" data-action="conversation-options" data-id="${selected.id}" aria-label="Sohbet seçenekleri">${chatIcons.more}</button>`);
 chatRenderedId=selected.id;
}
function showConversationOptions(id){
 const c=conversationById(id);if(!c)return;
 showSimpleModal(c.other_name,'Sohbet seçenekleri',`<div class="conversation-options"><button class="btn btn-outline" data-action="seller-listings" data-id="${c.other_id}">Diğer satış ilanları</button><button class="btn btn-outline" data-action="clear-chat" data-id="${c.id}">Sohbeti sil</button><button class="btn btn-danger" data-action="report-conversation" data-id="${c.id}">Şikâyet et</button></div>`);
}
async function switchConversation(id){
 if(id===state.selectedConversation)return;
 if(chatRenderedId)chatDrafts.set(chatRenderedId,$('.chat-compose [name="body"]')?.value||'');
 chatPhoto=null;discardVoiceRecording();chatRenderedId=id;state.selectedConversation=id;
 const c=conversationById(id);if(c&&$('.chat-box')){
  document.querySelectorAll('.chat-item').forEach(link=>link.classList.toggle('active',Number(link.dataset.conversation)===id));
  $('.chat-box').innerHTML=`<div class="chat-header">${avatarMarkup(c.other_name,c.other_avatar_url)}<span class="chat-person"><a class="chat-person-link" href="#/seller/${c.other_id}">${escapeHtml(c.other_name)}</a><small>${escapeHtml(c.other_university)}</small></span></div><div class="messages" aria-busy="true"><p class="muted small" role="status">Mesajlar yükleniyor…</p></div>`;
  const cached=chatMessages.get(id);if(cached){const template=document.createElement('template');template.innerHTML=conversationPanel(c,cached);$('.chat-box').replaceWith(template.content.querySelector('.chat-box'));const input=$('.chat-compose [name="body"]');if(input)input.value=chatDrafts.get(id)||'';$('.messages').scrollTo(0,$('.messages').scrollHeight);}
 }
 try{await renderMessages();}catch(error){if(state.selectedConversation===id){$('.messages')?.removeAttribute('aria-busy');if($('.messages'))$('.messages').innerHTML='<p class="muted">Mesajlar yüklenemedi. Sohbeti yeniden açabilirsin.</p>';toast(error.message);}}
}
function showProfilePhotoOptions(){
 showSimpleModal('Profil fotoğrafı','Fotoğrafın, giriş yapmış kullanıcılar tarafından profilinde ve sohbetlerinde görülebilir.',`<div class="camera-options"><button type="button" class="btn btn-primary" data-action="profile-camera">Kamerayı aç</button><label class="btn btn-outline camera-gallery">Galeriden seç<input type="file" id="avatarGallery" accept="image/*,.heic,.heif"></label>${state.user.avatarUrl?'<button class="btn btn-danger" data-action="remove-avatar">Fotoğrafı kaldır</button>':''}</div>`);
}
async function compactAvatar(file){return optimizePhoto(file,768);}
let avatarUploadBusy=false;
async function uploadAvatar(file){
 if(avatarUploadBusy)return;
 if(file.size>12*1024*1024){toast('Fotoğraf en fazla 12 MB olabilir.');return;}
 avatarUploadBusy=true;const previousUser=state.user,preview=URL.createObjectURL(file);
 closeModal();state.user={...state.user,avatarUrl:preview};await render();toast('Profil fotoğrafı kaydediliyor…');
 try{const body=new FormData();body.append('photo',await compactAvatar(file));const result=await api('/api/me/avatar',{method:'POST',body});if(state.user?.id!==previousUser.id)return;state.user=result.user;await render();toast('Profil fotoğrafın kaydedildi.');}catch(error){if(state.user?.id===previousUser.id){state.user=previousUser;await render();toast(error.message);}}finally{URL.revokeObjectURL(preview);avatarUploadBusy=false;}
}
let pressTimer=null,pressOrigin=null;
document.addEventListener('pointerdown',event=>{
 if(event.button!==0||event.target.closest('button,input,audio,summary'))return;
 const row=event.target.closest('.chat-row'),bubble=event.target.closest('.bubble[data-message-id]');if(!row&&!bubble)return;
 pressOrigin=[event.clientX,event.clientY];pressTimer=setTimeout(()=>{pressTimer=null;if(row)showConversationOptions(Number(row.querySelector('[data-conversation]').dataset.conversation));else bubble.querySelector('.message-menu')?.setAttribute('open','');},550);
});
const cancelPress=()=>{clearTimeout(pressTimer);pressTimer=null;};
document.addEventListener('toggle',event=>{
 const menu=event.target;if(!menu.matches?.('.message-menu')||!menu.open)return;
 document.querySelectorAll('.message-menu[open]').forEach(other=>{if(other!==menu)other.open=false;});
 menu.classList.remove('upward');const panel=menu.querySelector('div'),area=menu.closest('.messages');
 if(panel&&area&&panel.getBoundingClientRect().bottom>area.getBoundingClientRect().bottom-8)menu.classList.add('upward');
},true);
function closeOutsideMenus(event){for(const selector of ['.message-menu','.category-menu','.language-menu','.advanced-filter-menu'])document.querySelectorAll(selector+'[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});}
document.addEventListener('pointerdown',closeOutsideMenus);
document.addEventListener('click',closeOutsideMenus);
let backdropPress=false;
document.addEventListener('pointerdown',event=>{backdropPress=event.target.matches?.('.modal-backdrop')||false;const profile=$('.profile-menu');if(profile&&!profile.hidden&&!event.target.closest('.profile-menu,.account-icon')){profile.hidden=true;$('.account-icon')?.setAttribute('aria-expanded','false');}const owner=$('.owner-menu');if(owner&&!owner.hidden&&!event.target.closest('.detail-owner-actions'))owner.hidden=true;});
document.addEventListener('pointerup',event=>{if(backdropPress&&event.target.matches?.('.modal-backdrop'))closeModal();backdropPress=false;});
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(state.modal)closeModal();document.querySelectorAll('details[open]').forEach(el=>el.open=false);const profile=$('.profile-menu');if(profile)profile.hidden=true;const owner=$('.owner-menu');if(owner)owner.hidden=true;});
document.addEventListener('pointerover',event=>{if(!state.user&&event.target.closest('.account-icon,[data-action="auth-tab"]')){warmGoogleSignIn().catch(()=>{});loadUniversities().catch(()=>{});}});
document.addEventListener('pointerup',cancelPress);document.addEventListener('pointercancel',cancelPress);document.addEventListener('pointermove',event=>{if(pressOrigin&&Math.hypot(event.clientX-pressOrigin[0],event.clientY-pressOrigin[1])>10)cancelPress();});
document.addEventListener('input',event=>{if(!event.target.matches('.chat-compose [name="body"]')||!chatRenderedId)return;chatDrafts.set(chatRenderedId,event.target.value);const typing=!!event.target.value.trim();if(typing!==typingSent){typingSent=typing;api(`/api/conversations/${chatRenderedId}/typing`,{method:'POST',body:{typing}}).catch(()=>{});}clearTimeout(typingStopTimer);if(typing)typingStopTimer=setTimeout(()=>{typingSent=false;api(`/api/conversations/${chatRenderedId}/typing`,{method:'POST',body:{typing:false}}).catch(()=>{});},1800);});
document.addEventListener('change',event=>{if(event.target.id==='avatarGallery'&&event.target.files?.[0])uploadAvatar(event.target.files[0]);});
let universityLogos={};const warmedUniversityLogos=new Set();
function warmUniversityLogos(){
 for(const name of [...Object.keys(universityLogos).slice(0,12),state.filters.university,state.user?.university]){
  const src=universityLogos[name];if(!src||warmedUniversityLogos.has(src))continue;
  warmedUniversityLogos.add(src);const image=new Image();image.src=src;
 }
}
document.addEventListener('pointerover',event=>{if(event.target.closest('.campus-picker')){loadUniversities().catch(()=>{});warmUniversityLogos();}});
function universityLogo(name,eager=false){return universityLogos[name]?`<img class="university-logo" src="${universityLogos[name]}" alt="${escapeHtml(name)} logosu" width="30" height="30" loading="${eager?'eager':'lazy'}" decoding="async">`:'';}
const universityLogosReady=fetch('/university-logos.json').then(r=>r.json()).then(logos=>{universityLogos=logos;warmUniversityLogos();document.querySelectorAll('[data-university-logo]').forEach(el=>el.innerHTML=universityLogo(el.dataset.universityLogo));const picker=$('.campus-picker');if(picker&&!picker.querySelector('.university-logo'))picker.querySelector('span')?.insertAdjacentHTML('afterend',universityLogo(state.filters.university,true));}).catch(()=>{});
function conversationPanel(selected,messages){return `<div class="chat-box"><div class="chat-header">${avatarMarkup(selected.other_name,selected.other_avatar_url)}<span class="chat-person"><a class="chat-person-link" href="#/seller/${selected.other_id}">${escapeHtml(selected.other_name)}</a><small>${escapeHtml(selected.other_university)} · ${selected.listing_id?`<a href="#/listing/${selected.listing_id}">${escapeHtml(selected.title)}</a>`:escapeHtml(selected.title)}</small></span></div><div class="messages">${messages.length?messages.map(m=>`<div data-message-id="${m.id}" class="bubble ${m.sender_id===state.user.id?'mine':''}">${m.photo_filename?`<button type="button" class="chat-photo-open" data-action="view-chat-photo" data-id="${m.id}" aria-label="Fotoğrafı aç"><img class="chat-photo" data-message-photo="${m.id}" alt="Gönderilen fotoğraf" decoding="async"></button>`:''}${m.body?`<span>${escapeHtml(localizedMessageText(m.body))}</span>`:''}<small>${chatTime(m.created_at)} ${m.sender_id===state.user.id?`<span class="message-ticks ${m.read_at?'read':''}" title="${m.read_at?'Okundu':'Gönderildi · henüz okunmadı'}" aria-label="${m.read_at?'Okundu':'Gönderildi · henüz okunmadı'}">${chatIcons.check}</span>`:''}</small>${m.sender_id===state.user.id?`<details class="message-menu"><summary aria-label="Mesaj seçenekleri">${chatIcons.down}</summary><div>${m.body?`<button data-action="edit-message" data-id="${m.id}" data-body="${escapeHtml(m.body)}">Düzenle</button>`:''}<button data-action="delete-message" data-id="${m.id}">Sil</button></div></details>`:''}</div>`).join(''):'<p class="muted small">İlk mesajı yaz.</p>'}</div><form class="chat-compose" data-form="message" enctype="multipart/form-data"><button type="button" class="chat-attach chat-camera" data-action="photo-menu" title="Fotoğraf çek veya galeriden seç" aria-label="Fotoğraf çek veya galeriden seç"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h4l2-2h6l2 2h4v12H3z"/><circle cx="12" cy="13" r="3"/></svg></button><div class="chat-write"><input name="body" placeholder="Özel mesaj yaz..." maxlength="2000" aria-label="Mesaj"><span id="chatPhotoStatus" class="chat-photo-status" hidden></span></div><button class="btn btn-primary">Gönder</button></form></div>`;}
async function renderMessages(){
 if(!state.user){showAuth();return;}
 if(chatRenderedId&&$('.chat-compose [name="body"]'))chatDrafts.set(chatRenderedId,$('.chat-compose [name="body"]').value);
 const originRoute=route(),sequence=++messagesRenderSequence,requestedConversation=state.selectedConversation;
 const [conversationResult,requestedMessages]=await Promise.all([
  api('/api/conversations'),
  requestedConversation?api(messagePageURL(requestedConversation)):Promise.resolve(null)
 ]);
 if(route()!==originRoute||sequence!==messagesRenderSequence)return;
 const allConversations=conversationResult.conversations;chatConversations=allConversations;
 const matching=allConversations.find(c=>c.conversationIds?.includes(state.selectedConversation));if(matching)state.selectedConversation=matching.id;
 const adminChat=route().startsWith('/admin-message/');
 const conversations=allConversations.filter(c=>(!adminChat||c.id===state.selectedConversation)&&(c.last_message||c.id===state.selectedConversation));
 const selected=conversations.find(c=>c.id===state.selectedConversation)||{id:null,other_name:'',other_university:'',other_id:0,listing_id:0,title:''};
 const messageResult=selected.id?(selected.id===requestedConversation?requestedMessages:await api(messagePageURL(selected.id))):{messages:[],page:{}};
 const messages=messageResult.messages;
 if(route()===originRoute&&sequence===messagesRenderSequence&&selected.id&&chatHistoryBefore.has(selected.id)&&!messages.length){chatHistoryBefore.delete(selected.id);return renderMessages();}
 if(route()!==originRoute||sequence!==messagesRenderSequence)return;
 if(selected.id)selected.unread_count=0;
 state.selectedConversation=selected.id;
 const hadFocus=!!document.activeElement?.closest('.chat-compose');
 const draft=chatDrafts.get(selected.id)||'';
 const pageHtml=`<main class="shell page messages-page"><section class="messages-intro"><div><span class="messages-eyebrow">ÜNİ SATIŞ · ÖZEL SOHBETLER</span><h2>Mesajlarım</h2><p>Ürün hakkında konuş, fotoğraf paylaş, ayrıntıları birlikte netleştir.</p></div><div class="messages-intro-art" aria-hidden="true"><img src="/messages-illustration.svg" alt=""></div></section><p class="chat-moderation-note">Şikâyetlerde konuşmalar yönetici tarafından incelenebilir.</p>${!conversations.length?empty('Henüz konuşman yok','Bir ilandan satıcıya özel mesaj yazarak başlayabilirsin.'):`<div class="chat-layout"><div class="chat-list">${conversations.map(c=>`<a href="${adminChat?'#'+route():'#/messages'}" class="chat-item ${c.id===selected.id?'active':''}" data-conversation="${c.id}">${avatarMarkup(c.other_name,c.other_avatar_url,'avatar chat-avatar')}<span class="chat-preview"><span class="chat-name"><strong>${escapeHtml(c.other_name)}</strong><small>${chatTime(c.last_at)}</small></span><span class="chat-last">${escapeHtml(localizedMessageText(c.last_message||'Konuşma henüz başlamadı'))}</span></span>${c.unread_count?`<span class="chat-unread">${c.unread_count}</span>`:''}</a>`).join('')}</div>${conversationPanel(selected,messages)}</div>`}</main>`;
 const existing=$('.messages-page');
 if(existing&&$('.chat-layout')){
  const template=document.createElement('template');template.innerHTML=pageHtml;
  const replacement=template.content.querySelector('.chat-layout');
  if(replacement){$('.chat-list').innerHTML=replacement.querySelector('.chat-list').innerHTML;$('.chat-box').innerHTML=replacement.querySelector('.chat-box').innerHTML;}
  else existing.replaceWith(template.content.querySelector('.messages-page'));
 }else pageFrame(pageHtml,'/messages');
 if(conversations.length && !selected.id) $('.chat-box').innerHTML='<div class="chat-select-empty"><span class="chat-select-icon" aria-hidden="true"><svg viewBox="0 0 96 80"><path d="M12 12h54a10 10 0 0 1 10 10v27a10 10 0 0 1-10 10H35L18 72V59h-6A10 10 0 0 1 2 49V22a10 10 0 0 1 10-10Z" fill="currentColor" opacity=".16"/><path d="M24 20h55a10 10 0 0 1 10 10v25a10 10 0 0 1-10 10h-9v11L55 65H24a10 10 0 0 1-10-10V30a10 10 0 0 1 10-10Z" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="35" cy="43" r="3" fill="currentColor"/><circle cx="51" cy="43" r="3" fill="currentColor"/><circle cx="67" cy="43" r="3" fill="currentColor"/></svg></span><h3>Bir konuşma seç</h3><p>Yazışmalarını görmek için bir kişi seç.</p></div>';
 if(selected.id && selected.listing_id && !adminChat){

  if(selected.messagesClosed){const composer=$('.chat-compose');composer?.insertAdjacentHTML('beforebegin','<p class="chat-moderation-note">Bu kullanıcıyla mesajlaşma kapalı.</p>');composer?.remove();}
 }
 decorateChatOptions(conversations,selected);
 $('.chat-layout')?.classList.toggle('conversation-open',!!selected.id);
 if(selected.id)$('.chat-header')?.insertAdjacentHTML('afterbegin','<button type="button" class="chat-back" data-action="chat-back" aria-label="Konuşmalara dön">←</button>');
 chatMessages.set(selected.id,messages);
 if(selected.id&&(messageResult.page?.hasOlder||chatHistoryBefore.has(selected.id))){
  const navigation=document.createElement('div');navigation.className='message-history-nav';
  if(messageResult.page?.hasOlder){const older=document.createElement('button');older.type='button';older.className='btn btn-outline';older.dataset.action='older-messages';older.dataset.before=messageResult.page.before;older.textContent='Önceki mesajlar';navigation.append(older);}
  if(chatHistoryBefore.has(selected.id)){const latest=document.createElement('button');latest.type='button';latest.className='btn btn-outline';latest.dataset.action='latest-messages';latest.textContent='Yeni mesajlara dön';navigation.append(latest);}
  $('.messages')?.prepend(navigation);
 }
 const prefetchGeneration=cacheGeneration,prefetchUser=state.user.id;
 conversations.slice(0,8).filter(c=>!chatMessages.has(c.id)).forEach(c=>api(`/api/conversations/${c.id}/messages?preview=1`).then(data=>{if(cacheGeneration===prefetchGeneration&&state.user?.id===prefetchUser&&!chatMessages.has(c.id))chatMessages.set(c.id,data.messages);}).catch(()=>{}));
 applyLocale($('.messages-page'),language);
 const composer=$('.chat-compose');
 if(composer){
  composer.querySelector('.chat-write').insertAdjacentHTML('beforebegin','<button type="button" class="chat-attach chat-mic" data-action="voice-start" aria-label="Sesli mesaj kaydet" title="Sesli mesaj kaydet">'+chatIcons.mic+'</button>');
  composer.querySelector('.chat-write').insertAdjacentHTML('beforeend','<span id="chatVoiceStatus" class="chat-photo-status" hidden></span>');
  document.querySelectorAll('.messages .bubble').forEach((bubble,index)=>{
   if(messages[index]?.sender_id!==state.user.id)bubble.insertAdjacentHTML('beforeend',`<details class="message-menu"><summary aria-label="Mesaj seçenekleri">${chatIcons.down}</summary><div><button type="button" data-action="report-message" data-id="${messages[index].id}">Mesajı bildir</button></div></details>`);
   if(!messages[index]?.voice_filename)return;
   const player=document.createElement('div');player.className='voice-player';player.dataset.voiceId=messages[index].id;
   player.setAttribute('aria-label','Sesli mesaj');bubble.prepend(player);
  });
 }
 const input=$('.chat-compose [name="body"]');if(input){input.value=draft;if(hadFocus)input.focus();}
 syncMessageMedia($('.messages'),state.user.id);
 updateChatPhotoStatus();
 updateVoiceStatus();
 applyLocale($('.messages-page'),language);
 refreshUnread().catch(()=>{});$('.messages')?.scrollTo(0,$('.messages').scrollHeight);
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
  `<span class="status">${application.status==='approved'?'Kabul edildi':'Reddedildi'}</span><button class="btn btn-danger" data-action="remove-support-form" data-id="${application.user_id}">${application.status==='approved'?'Desteği geri çek':'Başvuruyu kaldır'}</button>`}</div></div>`;
 pageFrame(`<main class="shell page admin-page">
  <div class="section-head"><div><h2>Yönetim</h2><p>Destek başvurularını, şikâyetleri ve hesapları buradan yönetebilirsin.</p></div></div>
  <div class="section-head"><div><h2>Destek başvuruları (${pending.length})</h2><p>Yalnızca destek formunu gönderen hesaplar burada görünür. Tam TC kimlik numarası alınmaz; yalnızca son 4 hanesi saklanır.</p></div></div>
  <div class="list">${pending.length?pending.map(supportRow).join(''):empty('Bekleyen destek başvurusu yok','')}</div>
  ${reviewed.length?`<div class="section-head"><h2>Karara bağlanan başvurular</h2></div><div class="list">${reviewed.map(supportRow).join('')}</div>`:''}
  <div class="section-head"><h2 id="adminReportHeading">Şikâyetler (${queue.reports.length})</h2></div>
  <div class="list">${queue.reports.length?queue.reports.map(report=>`<div class="list-row"><div><strong>${report.message_id?`Mesaj #${report.message_id}`:report.conversation_id?`Sohbet #${report.conversation_id}`:`İlan #${report.listing_id}`}</strong><small>${escapeHtml(report.reason)}</small></div><div class="inline-actions">${report.conversation_id?`<button class="btn btn-outline" data-action="admin-review-form" data-id="${report.conversation_id}" data-title="Şikâyet edilen sohbet">Konuşmayı incele</button>`:`<button class="btn btn-danger" data-action="admin-report" data-id="${report.id}" data-remove="1">İlanı kaldır</button>`}<button class="btn btn-outline" data-action="admin-report" data-id="${report.id}">Kapat</button></div></div>`).join(''):empty('Açık şikâyet yok','')}</div>
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
 button.innerHTML=recording?'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>':chatIcons.mic;
 button.classList.toggle('recording',recording);
 status.hidden=!recording&&!voiceClip;
 status.classList.toggle('voice-recording',recording);
 status.innerHTML=recording?`<span class="voice-live-dot"></span><span class="voice-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><strong>${String(Math.floor(voiceSeconds/60)).padStart(2,'0')}:${String(voiceSeconds%60).padStart(2,'0')}</strong><span class="muted small">Kaydetmek için mikrofona tekrar dokun</span>`:voiceClip?`<div class="voice-player" id="voicePreviewPlayer"></div>`:'';
 if(!recording&&voiceClip&&voicePreviewUrl)mountVoicePreview($('#voicePreviewPlayer'),voicePreviewUrl);
 applyLocale(status,language);
 button.setAttribute('aria-label',translateText(recording?'Kaydı bitir':'Sesli mesaj kaydet',language));
 button.title=translateText(recording?'Kaydı bitir':'Sesli mesaj kaydet',language);
}
async function startVoiceRecording(){
 if(voiceFinishing||voiceStarting)throw new Error('Ses kaydı hazırlanıyor. Biraz bekle.');
 const recordingConversation=state.selectedConversation,recordingUser=state.user?.id,recordingRoute=route(),recordingGeneration=++voiceGeneration;
 if(!recordingConversation||!recordingUser)throw new Error('Önce bir sohbet seç.');
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Bu tarayıcıda ses kaydı açılamıyor.');
 const mimeType=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
 if(!mimeType)throw new Error('Bu tarayıcıdaki ses biçimi desteklenmiyor.');
 voiceStarting=true;try{voiceStream=await navigator.mediaDevices.getUserMedia({audio:true});}finally{voiceStarting=false;}
 if(recordingGeneration!==voiceGeneration||state.user?.id!==recordingUser||state.selectedConversation!==recordingConversation||route()!==recordingRoute){voiceStream.getTracks().forEach(track=>track.stop());voiceStream=null;return;}
 try{voiceRecorder=new MediaRecorder(voiceStream,{mimeType});}
 catch(error){voiceStream.getTracks().forEach(track=>track.stop());voiceStream=null;throw error;}
 const recorder=voiceRecorder, chunks=[];
 clearVoicePreview();if(voicePreviewUrl)URL.revokeObjectURL(voicePreviewUrl);voicePreviewUrl=null;voiceClip=null;chatPhoto=null;updateChatPhotoStatus();discardVoice=false;voiceSeconds=0;
 recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
 recorder.onstop=async()=>{
  voiceFinishing=true;
  try{
   cancelAnimationFrame(voiceAnimation);const context=voiceAudioContext;voiceAudioContext=null;await context?.close().catch(()=>{});
   clearInterval(voiceTimer);voiceTimer=null;voiceStream?.getTracks().forEach(track=>track.stop());voiceStream=null;
   const sameConversation=recordingGeneration===voiceGeneration&&state.user?.id===recordingUser&&state.selectedConversation===recordingConversation&&route()===recordingRoute;
   if(!discardVoice&&sameConversation&&chunks.length){const extension=mimeType.includes('ogg')?'ogg':mimeType.includes('mp4')?'mp4':'webm';const clip=new File(chunks,`sesli-mesaj-${Date.now()}.${extension}`,{type:mimeType});if(clip.size<=5*1024*1024){voiceClip=clip;voicePreviewUrl=URL.createObjectURL(clip);}else toast('Ses kaydı 5 MB sınırını aştı.');}
   voiceRecorder=null;updateVoiceStatus();
   if(voiceClip&&!discardVoice&&sameConversation){const sentClip=voiceClip,body=new FormData();body.set('voice',sentClip);await api(`/api/conversations/${recordingConversation}/messages`,{method:'POST',body});if(state.user?.id===recordingUser)document.dispatchEvent(new Event('unisatis-message-sent'));if(state.selectedConversation===recordingConversation&&voiceClip===sentClip){discardVoiceRecording();await renderMessages();}}
  }catch(error){toast(error.message);}finally{voiceFinishing=false;voiceRecorder=null;}
 };
 try{recorder.start(1000);}catch(error){voiceStream.getTracks().forEach(track=>track.stop());voiceStream=null;voiceRecorder=null;throw error;}
 voiceStarted=Date.now();
 voiceAudioContext=new AudioContext();await voiceAudioContext.resume();voiceAnalyser=voiceAudioContext.createAnalyser();voiceAnalyser.fftSize=256;voiceAudioContext.createMediaStreamSource(voiceStream).connect(voiceAnalyser);
 const samples=new Uint8Array(voiceAnalyser.frequencyBinCount);
 const drawWave=()=>{if(recorder.state!=="recording")return;voiceAnalyser.getByteFrequencyData(samples);document.querySelectorAll(".voice-bars i").forEach((bar,i)=>{bar.style.height=`${3+samples[i*4]*.09}px`;});voiceAnimation=requestAnimationFrame(drawWave);};drawWave();
 voiceTimer=setInterval(()=>{voiceSeconds=Math.floor((Date.now()-voiceStarted)/1000);updateVoiceStatus();if(voiceSeconds>=60 && recorder.state==='recording'){voiceFinishing=true;recorder.stop();}},1000);
 updateVoiceStatus();
}
function discardVoiceRecording(){voiceGeneration++;clearVoicePreview();discardVoice=true;voiceClip=null;if(voicePreviewUrl)URL.revokeObjectURL(voicePreviewUrl);voicePreviewUrl=null;if(voiceRecorder?.state==='recording'){voiceFinishing=true;voiceRecorder.stop();}else updateVoiceStatus();}
function stopCamera(){cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;}
function showAuth(tab='login'){ state.googleProfile=null;state.authTab=tab; state.modal='auth';loadUniversities().catch(()=>{}); drawModal(); }
function showSimpleModal(title,body,form){ state.modal={title,body,form}; drawModal(); }
function universityPickerForm(){
 return `<div class="field"><label for="universityPickerSearch">Üniversite ara</label><input id="universityPickerSearch" placeholder="Üniversite adı yaz"></div><div class="university-options"><button class="university-option" data-action="select-university" data-university="*">Tüm üniversiteler</button>${state.universities.map((u,index)=>`<button class="university-option" data-action="select-university" data-university="${escapeHtml(u)}">${universityLogo(u,index<12)}<span>${escapeHtml(u)}</span></button>`).join('')}</div>`;
}
function drawModal(){
 photoViewerCleanup?.();photoViewerCleanup=null;
 document.documentElement.classList.toggle('modal-open',!!state.modal);
 let html='';
 if(state.modal==='auth') html=authModal(state);
 else if(state.modal==='camera') html=`<div class="modal-backdrop"><div class="modal camera-modal" role="dialog" aria-modal="true" aria-label="Fotoğraf gönder"><div class="modal-top"><h2>Fotoğraf gönder</h2><button class="close" data-action="close-modal" aria-label="Kapat">×</button></div><p class="muted">${state.cameraPurpose==='avatar'?'Profil fotoğrafını çekebilir veya galerinden seçebilirsin.':'Ürünün ayrıntısını şimdi çekebilir veya galerinden seçebilirsin.'}</p><div class="camera-options"><button type="button" class="btn btn-primary" id="cameraStart" data-action="camera-start">Kamerayı aç</button><label class="btn btn-outline camera-gallery">Galeriden seç<input id="chatGalleryInput" type="file" accept="image/*,.heic,.heif"></label></div><video id="cameraPreview" autoplay playsinline muted hidden></video><button class="btn btn-primary camera-capture" id="cameraCapture" data-action="camera-capture" hidden>Fotoğrafı çek</button></div></div>`;
 else if(state.modal) html=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.modal.title)}"><div class="modal-top"><h2>${escapeHtml(state.modal.title)}</h2><button class="close" data-action="close-modal" aria-label="Kapat">×</button></div><p class="muted">${escapeHtml(state.modal.body)}</p>${state.modal.form}</div></div>`;
 $('#modal-root')?.remove(); if(html) document.body.insertAdjacentHTML('beforeend',`<div id="modal-root">${html}</div>`);
 if(html)applyLocale($('#modal-root'),language);
 setupRegistrationForm();
 setupVerificationResend();
 if(state.modal==='auth' && ['login','register'].includes(state.authTab) && !state.googleProfile && state.googleClientId){
  $('.auth-tabs').insertAdjacentHTML('beforebegin','<div class="google-auth"><div class="google-button-slot"><div class="google-button-placeholder" aria-hidden="true"><span class="google-brand-letter">G</span>Google ile devam edin</div><div id="googleSignIn"></div></div><p class="hint" id="googleSignInStatus" role="status">Google ile giriş yükleniyor…</p></div><div class="auth-divider"><span>veya</span></div>');
  setupGoogleSignIn().catch(()=>{const status=$('#googleSignInStatus');if(status)status.textContent='Google ile giriş yüklenemedi. E-posta ile devam edebilirsin.';});
 }
}
let verificationResendTimer;
function setupVerificationResend(){
 clearInterval(verificationResendTimer);
 if(!$('[data-action="resend-code"]'))return;
 $('#verifyEmail')?.addEventListener('input',()=>{state.verificationMessage='';updateVerificationResend();});
 updateVerificationResend();
 verificationResendTimer=setInterval(()=>{if(!$('[data-action="resend-code"]'))return clearInterval(verificationResendTimer);updateVerificationResend();},1000);
}
function updateVerificationResend(){
 const button=$('[data-action="resend-code"]'),status=$('#verificationSendStatus');
 if(!button||!status)return;
 const email=$('#verifyEmail')?.value.trim().toLowerCase();
 const seconds=state.verificationResendEmail===email?Math.max(0,Math.ceil(((state.verificationResendUntil||0)-Date.now())/1000)):0;
 button.disabled=!!state.verificationBusy||seconds>0;
 button.textContent=state.verificationBusy?'Gönderiliyor…':seconds?`${seconds} saniye sonra tekrar gönder`:'Yeni kod gönder';
 status.textContent=state.verificationMessage||'';
 status.hidden=!status.textContent;
 status.dataset.error=state.verificationError?'true':'false';
}
async function resendVerificationCode(){
 const input=$('#verifyEmail');
 if(!input||!input.reportValidity()||state.verificationBusy)return;
 const email=input.value.trim().toLowerCase();
 if(state.verificationResendEmail===email&&state.verificationResendUntil>Date.now())return;
 state.pendingEmail=email;state.verificationBusy=true;state.verificationError=false;state.verificationMessage='Doğrulama kodu gönderiliyor…';updateVerificationResend();
 try{
  const result=await api('/api/resend-code',{method:'POST',body:{email}});
  state.devCode=result.devCode||'';state.verificationResendEmail=email;state.verificationResendUntil=Date.now()+(result.retryAfter||60)*1000;
  state.verificationMessage=result.message;
  if(state.modal==='auth'&&state.authTab==='verify'&&$('#verifyEmail')?.value.trim().toLowerCase()===email)drawModal();
 }catch(error){
  state.verificationError=true;state.verificationMessage=error.message;
  if(error.retryAfter){state.verificationResendEmail=email;state.verificationResendUntil=Date.now()+error.retryAfter*1000;}
 }finally{state.verificationBusy=false;updateVerificationResend();}
}
let googleScriptRequest=null,googleNonceRequest=null,googleNonceTime=0;
function warmGoogleSignIn(){
 if(!state.googleClientId)return Promise.resolve();
 if(!googleNonceRequest||Date.now()-googleNonceTime>60000){googleNonceTime=Date.now();googleNonceRequest=api('/api/auth/google/nonce').catch(error=>{googleNonceRequest=null;throw error;});}
 if(!googleScriptRequest)googleScriptRequest=new Promise((resolve,reject)=>{
  if(window.google?.accounts?.id)return resolve();
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>{script.remove();googleScriptRequest=null;reject(new Error('Google yüklenemedi.'));};document.head.append(script);
 });
 return Promise.all([googleScriptRequest,googleNonceRequest]);
}
async function setupGoogleSignIn(){
 const button=$('#googleSignIn');if(!button||!state.googleClientId)return;
 const [,challenge]=await warmGoogleSignIn();
 if(!button?.isConnected)return;
 window.google.accounts.id.initialize({client_id:state.googleClientId,nonce:challenge.nonce,auto_select:false,button_auto_select:false,callback:async(response)=>{
  try{
   googleNonceRequest=null;
   const result=await api('/api/auth/google',{method:'POST',body:{credential:response.credential}});
   if(result.user){state.user=result.user;state.googleProfile=null;connectMessageStream();closeModal();refreshUnread().catch(()=>{});return render();}
   state.googleProfile=result.profile;state.authTab='register';drawModal();
  }catch(error){toast(error.message);if(state.modal==='auth')drawModal();}
 }});
 window.google.accounts.id.renderButton(button,{type:'standard',theme:'outline',size:'medium',shape:'pill',width:Math.min(400,Math.floor(button.parentElement.clientWidth)),text:'continue_with',logo_alignment:'left',locale:'tr'});
 $('#googleSignInStatus').textContent='';
}
function registrationValidation(values){
 const validation=validateRegistration(values,state.universities,{passwordRequired:!state.googleProfile,phoneRequired:!state.googleProfile});
 if(state.legalVersion){
  if(values.termsAccepted!=='true')validation.fields.termsAccepted='Üyelik sözleşmesini kabul etmelisin.';
  if(values.privacyRead!=='true')validation.fields.privacyRead='KVKK aydınlatma metnini okuyup anladığını belirt.';
 }
 return validation;
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
 if(state.googleProfile){
  form.elements.name.value=state.googleProfile.name;form.elements.email.value=state.googleProfile.email;form.elements.email.readOnly=true;
  form.elements.password.closest('.field').remove();
  form.elements.phone.required=false;
  form.elements.phone.closest('.field').querySelector('label').textContent='Telefon numaran (isteğe bağlı)';
  form.elements.phone.closest('.field').insertAdjacentHTML('beforeend','<span class="hint">İlan vermek istediğinde telefon numaranı ekleyebilirsin.</span>');
  form.querySelector('.registration-alert').insertAdjacentHTML('afterend','<p class="google-profile-note">Adın ve e-postan Google hesabından alındı. Üniversiteni seç, üyelik ve KVKK kutularını işaretleyerek hesabını oluştur.</p>');
 }
 if(state.legalVersion){
  form.querySelector('button:not([type])').insertAdjacentHTML('beforebegin',`<div class="registration-legal"><input type="hidden" name="legalVersion" value="${escapeHtml(state.legalVersion)}"><div class="field"><label class="legal-check"><input name="termsAccepted" type="checkbox" value="true"><span><a href="/legal/terms" target="_blank" rel="noopener">Üyelik Sözleşmesi</a>’ni okudum ve kabul ediyorum.</span></label></div><div class="field"><label class="legal-check"><input name="privacyRead" type="checkbox" value="true"><span><a href="/legal/privacy" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a>’ni okudum ve anladım.</span></label></div></div>`);
 }
 for(const input of form.querySelectorAll('.field input,.field select')){
  input.id=input.id||'register-'+input.name;
  input.closest('.field').querySelector('label').htmlFor=input.id;
  const error=document.createElement('span');error.id=input.id+'-error';error.className='field-error';error.hidden=true;if(input.type==='checkbox')input.closest('.field').append(error);else input.after(error);
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
 const fields=registrationValidation(Object.fromEntries(new FormData(form))).fields;
 const error=form.querySelector('#'+input.id+'-error');input.setAttribute('aria-invalid',fields.university?'true':'false');error.textContent=translateText(fields.university||'',language);error.hidden=!fields.university;
});
document.addEventListener('focusout',event=>{
 const form=event.target.closest('[data-form="register"]');if(!form||!event.target.name)return;
 const fields=registrationValidation(Object.fromEntries(new FormData(form))).fields;
 const input=event.target,error=form.querySelector('#'+input.id+'-error');if(!error)return;
 input.setAttribute('aria-invalid',fields[input.name]?'true':'false');error.hidden=!fields[input.name];error.textContent=translateText(fields[input.name]||'',language);
});
document.addEventListener('input',event=>{
 const form=event.target.closest('[data-form="register"]');if(!form)return;
 const input=event.target,error=form.querySelector('#'+input.id+'-error');if(!error)return;
 if(input.getAttribute('aria-invalid')==='true'){
  const fields=registrationValidation(Object.fromEntries(new FormData(form))).fields;
  error.textContent=translateText(fields[input.name]||'',language);error.hidden=!fields[input.name];input.setAttribute('aria-invalid',fields[input.name]?'true':'false');
 }
 form.querySelector('.registration-alert').hidden=true;
});
const listingPreviewUrls=new Map();
function clearListingPhotos(){for(const url of listingPreviewUrls.values())URL.revokeObjectURL(url);listingPreviewUrls.clear();selectedListingPhotos=[];}
function listingPreview(file){if(!listingPreviewUrls.has(file))listingPreviewUrls.set(file,URL.createObjectURL(file));return listingPreviewUrls.get(file);}
function renderListingPhotos(){
 const field=$('#photos')?.closest('.field');if(!field)return;
 let list=$('#listingPhotoList');if(!list){list=document.createElement('div');list.id='listingPhotoList';list.className='listing-photo-list';field.append(list);}
 list.innerHTML=selectedListingPhotos.map((file,index)=>`<div class="listing-photo-thumb"><button type="button" class="listing-photo-open" data-action="preview-listing-photo" data-index="${index}" aria-label="${index+1}. fotoğrafı büyüt"><img src="${escapeHtml(listingPreview(file))}" alt="${index+1}. seçilen fotoğraf"><span>${index===0?'Kapak':index+1}</span></button><button type="button" class="listing-photo-remove" data-action="remove-listing-photo" data-index="${index}" aria-label="${index+1}. fotoğrafı kaldır"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button></div>`).join('');
 $('#photoCount').textContent=`${selectedListingPhotos.length}/6 fotoğraf seçildi`;
}
function showPhotoViewer(src,title,editable=false,photos=null,index=0){
 showSimpleModal(title,'',`<div class="app-photo-viewer"><div class="photo-gesture-frame"><img src="${escapeHtml(src)}" alt="${escapeHtml(title)}"></div><div class="photo-zoom-tools"><button type="button" class="btn btn-outline" data-zoom="reset">Sığdır</button><button type="button" class="btn btn-outline" data-zoom="out" aria-label="Fotoğrafı küçült">−</button><button type="button" class="btn btn-outline" data-zoom="in" aria-label="Fotoğrafı büyüt">+</button></div>${photos?.length>1?'<p class="photo-gesture-hint">Fotoğraflar arasında sağa veya sola kaydır.</p>':''}${editable?'<button type="button" class="photo-edit-link" data-action="profile-photo">Resmi düzenle</button>':''}</div>`);
 const modal=$('#modal-root .modal');modal.classList.add('photo-viewer-modal');
 const viewer=$('.app-photo-viewer'),frame=viewer.querySelector('.photo-gesture-frame'),image=frame.querySelector('img');let current=index,gestures;
 const move=delta=>{if(!photos?.length)return;current=(current+delta+photos.length)%photos.length;image.src=photos[current].src;image.alt=photos[current].alt||title;viewer.querySelector('.viewer-counter').textContent=`${current+1} / ${photos.length}`;gestures?.reset();showDetailPhoto(current);};
 if(photos?.length>1){frame.insertAdjacentHTML('beforeend','<button type="button" class="viewer-arrow viewer-prev" aria-label="Önceki fotoğraf">‹</button><button type="button" class="viewer-arrow viewer-next" aria-label="Sonraki fotoğraf">›</button><span class="viewer-counter" aria-live="polite"></span>');viewer.querySelector('.viewer-prev').addEventListener('click',()=>move(-1));viewer.querySelector('.viewer-next').addEventListener('click',()=>move(1));move(0);}
 gestures=attachPhotoGestures(frame,image,{onNavigate:delta=>{if(photos?.length>1)move(delta);}});photoViewerCleanup=()=>gestures.dispose();
 viewer.querySelector('[data-zoom="in"]').addEventListener('click',()=>gestures.zoom(1.5));viewer.querySelector('[data-zoom="out"]').addEventListener('click',()=>gestures.zoom(1/1.5));viewer.querySelector('[data-zoom="reset"]').addEventListener('click',()=>gestures.reset());
 modal.tabIndex=-1;modal.focus();modal.addEventListener('keydown',event=>{if(photos?.length>1&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}});
}
function showPhoneVerification(codeSent=false){
 if(!state.phoneVerificationAvailable){showSimpleModal('Telefon doğrulaması','SMS hizmeti henüz etkin değil. Numaran doğrulanmış sayılmıyor. Hizmet açıldığında buradan SMS koduyla doğrulayabileceksin.','');return;}
 showSimpleModal('Telefonunu doğrula',`${state.user.phone} numarana gönderilen 6 haneli kodu gir. Kod 3 dakika geçerli.`,`${codeSent?'<p class="contact-status">SMS gönderildi.</p>':''}<form data-form="verify-phone"><div class="field"><label for="phoneCode">SMS doğrulama kodu</label><input id="phoneCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></div><button class="btn btn-primary">Telefonumu doğrula</button><button type="button" class="btn btn-outline" data-action="send-phone-code">${codeSent?'Yeni kod gönder':'SMS kodu gönder'}</button></form>`);
}
function clearEditPhotos(){newEditPhotos.forEach(photo=>URL.revokeObjectURL(photo.url));newEditPhotos=[];keptEditPhotos=[];}
function renderEditPhotos(){
 const list=$('#editPhotoList');if(!list)return;
 const photos=[...keptEditPhotos.map(filename=>({src:`/uploads/${encodeURIComponent(filename)}`,kind:'kept'})),...newEditPhotos.map(photo=>({src:photo.url,kind:'new'}))];
 list.innerHTML=photos.map((photo,index)=>`<div class="edit-photo"><img src="${escapeHtml(photo.src)}" alt="${index+1}. fotoğraf"><span>${index===0?'Kapak fotoğrafı':`${index+1}. fotoğraf`}</span><button type="button" data-action="remove-edit-photo" data-kind="${photo.kind}" data-index="${photo.kind==='kept'?index:index-keptEditPhotos.length}" aria-label="Fotoğrafı kaldır">×</button></div>`).join('');
 $('#editPhotoCount').textContent=translateText(`${photos.length}/6 fotoğraf`,language);
 applyLocale(list,language);
}
function closeModal(){ photoViewerCleanup?.();photoViewerCleanup=null;stopCamera();clearEditPhotos();state.modal=null; $('#modal-root')?.remove();document.documentElement.classList.remove('modal-open'); }
let detailPhotos=[],detailPhotoIndex=0;
function showDetailPhoto(index){
 if(!detailPhotos.length)return;
 detailPhotoIndex=(index+detailPhotos.length)%detailPhotos.length;
 const photo=detailPhotos[detailPhotoIndex],main=$('#detailMainPhoto');if(!main)return;
 const changed=main.getAttribute('src')!==photo.src;main.src=photo.src;main.alt=photo.alt;
 const track=$('.carousel-track');if(track){main.src=detailPhotos[0].src;track.scrollTo({left:detailPhotoIndex*track.clientWidth,behavior:track.dataset.ready&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'auto'});track.dataset.ready='1';}
 else if(changed&&!matchMedia('(prefers-reduced-motion: reduce)').matches)main.animate([{opacity:.45},{opacity:1}],{duration:170,easing:'ease-out'});
 $('#detailPhotoCounter').textContent=`${detailPhotoIndex+1} / ${detailPhotos.length}`;
 document.querySelectorAll('[data-action="carousel-show"]').forEach((button,i)=>button.classList.toggle('active',i===detailPhotoIndex));
}
function decorateDetail(){
 const gallery=$('.detail-gallery');if(!gallery)return;
 detailPhotos=[...gallery.querySelectorAll('img')].map(image=>({src:image.getAttribute('src'),alt:image.alt}));detailPhotoIndex=0;
 if(detailPhotos.length){
  gallery.classList.add('detail-carousel');
  gallery.innerHTML=`<div class="carousel-main"><div class="carousel-track">${detailPhotos.map((photo,index)=>`<img ${index===0?'id="detailMainPhoto"':''} src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt)}" draggable="false" loading="${index===0?'eager':'lazy'}">`).join('')}</div><button type="button" class="carousel-arrow prev" data-action="carousel-prev" aria-label="Önceki fotoğraf">‹</button><button type="button" class="carousel-arrow next" data-action="carousel-next" aria-label="Sonraki fotoğraf">›</button><span class="carousel-counter" id="detailPhotoCounter"></span></div>${detailPhotos.length>1?`<div class="carousel-thumbs">${detailPhotos.map((photo,index)=>`<button type="button" data-action="carousel-show" data-index="${index}" aria-label="${index+1}. fotoğraf"><img src="${escapeHtml(photo.src.replace(/width=1600$/,'width=160'))}" alt=""></button>`).join('')}</div>`:''}`;
  showDetailPhoto(0);
  if(detailPhotos.length===1)gallery.querySelectorAll('.carousel-arrow').forEach(button=>button.hidden=true);
  const main=gallery.querySelector('.carousel-main'),image=main.querySelector('img');image.draggable=false;main.tabIndex=0;main.setAttribute('role','button');main.setAttribute('aria-label','Fotoğrafı büyüt; yön tuşlarıyla fotoğraf değiştir');
  const track=main.querySelector('.carousel-track');let gesture=null,suppressClick=false,scrollFrame=0;
  track.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;detailPhotoIndex=Math.max(0,Math.min(detailPhotos.length-1,Math.round(track.scrollLeft/track.clientWidth)));$('#detailPhotoCounter').textContent=`${detailPhotoIndex+1} / ${detailPhotos.length}`;document.querySelectorAll('[data-action="carousel-show"]').forEach((button,i)=>button.classList.toggle('active',i===detailPhotoIndex));});},{passive:true});
  track.addEventListener('pointerdown',event=>{if(event.button!==0)return;suppressClick=false;gesture={x:event.clientX,y:event.clientY,left:track.scrollLeft,id:event.pointerId,mouse:event.pointerType==='mouse'};if(gesture.mouse){track.setPointerCapture(event.pointerId);track.style.scrollSnapType='none';track.style.scrollBehavior='auto';}});
  track.addEventListener('pointermove',event=>{if(!gesture)return;const dx=event.clientX-gesture.x;if(Math.abs(dx)>8){suppressClick=true;if(gesture.mouse){track.scrollLeft=gesture.left-dx;main.classList.add('dragging');}}});
  const finishGesture=event=>{if(!gesture)return;const mouse=gesture.mouse;gesture=null;main.classList.remove('dragging');track.style.scrollSnapType='';track.style.scrollBehavior='';if(mouse)showDetailPhoto(Math.round(track.scrollLeft/track.clientWidth));};
  track.addEventListener('pointerup',finishGesture);track.addEventListener('pointercancel',finishGesture);
  main.addEventListener('click',event=>{if(event.target.closest('button')||suppressClick){suppressClick=false;return;}showPhotoViewer(detailPhotos[detailPhotoIndex].src,detailPhotos[detailPhotoIndex].alt,false,detailPhotos,detailPhotoIndex);});
  main.addEventListener('keydown',event=>{if(event.target!==main)return;if(['ArrowLeft','ArrowRight','Enter',' '].includes(event.key))event.preventDefault();if(event.key==='ArrowLeft')showDetailPhoto(detailPhotoIndex-1);if(event.key==='ArrowRight')showDetailPhoto(detailPhotoIndex+1);if(event.key==='Enter'||event.key===' ')showPhotoViewer(detailPhotos[detailPhotoIndex].src,detailPhotos[detailPhotoIndex].alt,false,detailPhotos,detailPhotoIndex);});
  detailPhotos.slice(1).forEach(photo=>{const preload=new Image();preload.src=photo.src;});
 }
 const sellerId=Number($('.detail-side .seller-link')?.getAttribute('href')?.split('/').pop());
 if(state.user?.id===sellerId&&['active','reserved'].includes($('.detail-side').dataset.listingStatus)){
  const id=route().split('/')[2];
  $('.detail-side').insertAdjacentHTML('afterbegin',`<div class="detail-owner-actions"><button type="button" class="owner-menu-trigger" data-action="owner-menu" aria-label="İlan seçenekleri" aria-expanded="false">⋯</button><div class="owner-menu" hidden><button type="button" data-action="edit-listing" data-id="${id}">İlanı düzenle</button></div></div>`);
 }
 applyLocale(gallery,language);
 applyLocale($('.detail-side'),language);
}
const accountRoutes=new Set(['/favorites','/orders','/messages','/mine','/manage','/account','/sell','/sell-sale','/sell-donation','/admin']);
function renderGuestArea(path){
 if(path==='/sell'){
  pageFrame(`<main class="shell page narrow-page guest-sell-choice"><div class="section-head"><div><h2>Nasıl ilan vermek istersin?</h2><p>Seçimini yap; yayınlama adımında giriş yapabilir veya hesap oluşturabilirsin.</p></div></div><div class="choice-grid"><button class="choice-card" data-action="login-required"><span class="choice-icon">↗</span><h3>İkinci el satış</h3><p>Ürününe fiyat belirle ve öğrencilerle güvenli şekilde iletişime geç.</p><strong>Satılık ilan ver →</strong></button><button class="choice-card choice-free" data-action="login-required" data-tab="register"><span class="choice-icon">♡</span><h3>Destek ol</h3><p>Kullanmadığın ürünü ihtiyacı olan bir öğrenciyle ücretsiz paylaş.</p><strong>Dayanışma ilanı ver →</strong></button></div></main>`,'/sell');
  return;
 }
 const sections={
  '/account':['Hesabım','İlanları hesap açmadan inceleyebilirsin. İlan vermek, favorilerini saklamak ve satıcılarla mesajlaşmak için hesabına giriş yap.'],
  '/favorites':['Beğendiğin ilanları bir arada tut','Favorilerin hesabına kaydedilir; telefondan ve bilgisayardan aynı listeye ulaşabilirsin. Ürünleri incelemek için hesap gerekmez.'],
  '/messages':['Satıcılarla uygulama içinde konuş','Ürün ve teslimat hakkında özel mesajlaşmak için giriş yap. İlanları ve satıcının diğer ürünlerini şimdiden inceleyebilirsin.'],
  '/orders':['Siparişlerini takip et','Satın alma ve sipariş bilgilerin kişiseldir. Bu bölümü kullanmak için hesabına giriş yap.'],
  '/sell':['Eşyalarına yeni bir öğrenciyle hayat ver','İkinci el satış yapabilir veya kullanmadığın ürünleri ücretsiz paylaşabilirsin. Fotoğraf, fiyat ve açıklama ekleyerek ilan oluşturmak için giriş yap.'],
  '/sell-sale':['İkinci el ilan ver','Ürünün fotoğraflarını, fiyatını ve açıklamasını ekle; öğrenciler seninle uygulamadan iletişime geçsin. İlanı hesabınla yayınlayabilirsin.'],
  '/sell-donation':['Kullanmadığın eşyayı paylaş','Ürününü ücretsiz paylaşarak başka bir öğrenciye destek olabilirsin. Paylaşım ilanını oluşturmak için giriş yap.'],
  '/support':['Destek ve dayanışma','Uygulama hakkında soruların için sıkça sorulan soruları inceleyebilirsin. Kişisel destek başvurusu göndermek ve sonucunu takip etmek için giriş yap.']
 };
 const [title,description]=sections[path]||['Hesabına giriş yap','İlanlarını ve hesabına özel bilgileri yönetmek için giriş yap.'];
 pageFrame(`<main class="shell page guest-page"><section class="panel guest-welcome"><span class="guest-symbol" aria-hidden="true">${(path==='/favorites'||path==='/sell-donation')?'♡':path==='/messages'?'✉':'↗'}</span><div class="eyebrow">Üni Satış</div><h1>${title}</h1><p>${description}</p><div class="guest-actions"><button class="btn btn-primary" data-action="login-required">Giriş yap</button><button class="btn btn-outline" data-action="login-required" data-tab="register">Hesap oluştur</button></div><a class="guest-browse" href="#/">İlanları keşfet →</a>${path==='/support'?'<button class="btn btn-light" data-action="faq">Sıkça sorulan sorular</button>':''}</section></main>`,path);
}
function warmNavigation(event){
 const link=event.target.closest('.nav a,.profile-menu a,.mobile-nav a,.support-entry');if(!link)return;
 const path=link.getAttribute('href')?.slice(1);
 const endpoints={'/favorites':['/api/favorites'],'/mine':['/api/mine'],'/manage':['/api/mine','/api/offers','/api/donation-requests'],'/messages':['/api/conversations'],'/support':['/api/support-application'],'/admin':['/api/admin/queue','/api/admin/accounts']};
 if(!state.user||path==='/admin'&&state.user.role!=='admin')return;
 for(const url of endpoints[path]||[])api(url).catch(()=>{});
 if(path==='/account')loadUniversities().catch(()=>{});
}
for(const event of ['pointerover','focusin','touchstart'])document.addEventListener(event,warmNavigation,{passive:true});
let navigationSequence=0;
function showRouteLoading(path){
 const label=path==='/messages'?'Mesajlar':path==='/favorites'?'Favoriler':path==='/mine'?'İlanlarım':path==='/admin'?'Yönetim':'İlanlar';
 const main=$('#app main');if(main){main.setAttribute('aria-busy','true');if(!main.querySelector('.navigation-progress'))main.insertAdjacentHTML('afterbegin','<div class="navigation-progress" role="status">'+label+' açılıyor…</div>');}
}
async function render(){const path=route(),sequence=++navigationSequence;
 if(!state.user&&accountRoutes.has(path)){renderGuestArea(path);return;}
 const loadingTimer=setTimeout(()=>{if(sequence===navigationSequence&&route()===path)showRouteLoading(path);},120);
 try { const path=route(); if(path==='/') await renderBrowse(); else if(path==='/donation') await renderBrowse(true); else if(path.startsWith('/listing/')) {await renderDetail(path.split('/')[2]);decorateDetail();} else if(path.startsWith('/seller/')) await renderSeller(path.split('/')[2]); else if(path==='/sell') renderSellChoice(); else if(path==='/sell-sale') {renderSell();restoreDraft();} else if(path==='/sell-donation') {renderSell('donation');restoreDraft();} else if(path.startsWith('/checkout/')) await (await import('./commerce.js')).renderCheckout(path.split('/')[2]); else if(path==='/orders') await (await import('./commerce.js')).renderOrders(); else if(path==='/favorites') await renderFavorites(); else if(path.startsWith('/admin-messages/'))await renderAdminMessages(path.split('/')[2],path.split('/')[3]);else if(path.startsWith('/admin-message/')){if(state.user?.role!=='admin'){go('/');return;}state.selectedConversation=Number(path.split('/')[2]);await renderMessages();}else if(path==='/notifications') await (await import('./shopping-notifications.js')).renderShoppingNotifications(); else if(path==='/messages') await renderMessages(); else if(path==='/mine') await renderListingsDashboard(); else if(path==='/manage') await renderManage(); else if(path==='/account'){await loadUniversities();renderAccount();} else if(path==='/support') await renderSupport(); else if(path==='/admin') await renderAdmin(); else go('/'); } catch(error){ if(sequence===navigationSequence){toast(error.message);pageFrame(`<main class="shell page">${empty('Sayfa yüklenemedi',error.message)}</main>`,'/');} } finally {clearTimeout(loadingTimer);} }
async function refreshUser(){const result=await api('/api/me');if(state.user?.id&&state.user.id!==result.user?.id){clearMessageMedia();responseCache.clear();cacheGeneration++;}state.user=result.user;if(state.user?.avatarUrl){const photo=new Image();photo.src=state.user.avatarUrl;}state.emailVerificationAvailable=result.emailVerificationAvailable;state.phoneVerificationAvailable=!!result.phoneVerificationAvailable;state.contactVerificationRequired=!!result.contactVerificationRequired;state.sellerPhoneVerificationRequired=!!result.sellerPhoneVerificationRequired;state.emailVerificationRequired=!!result.emailVerificationRequired;state.googleClientId=result.googleClientId||'';state.legalVersion=result.legalVersion||null;connectMessageStream();if(!state.user)warmGoogleSignIn().catch(()=>{});}
async function refreshUnread(){
  state.unreadCount=state.user?(await api('/api/unread-count')).count:0;
  document.querySelectorAll('.message-count').forEach(badge=>{badge.hidden=state.unreadCount===0;badge.textContent=state.unreadCount>99?'99+':String(state.unreadCount);});
}
let messageStream=null, streamUserId=null, liveNeedsMessages=false;
const liveRefreshQueue=createRefreshQueue(async()=>{
 const needsMessages=liveNeedsMessages;liveNeedsMessages=false;
 if(needsMessages&&(route()==='/messages'||route().startsWith('/admin-message/'))&&!document.hidden&&voiceRecorder?.state!=='recording')await renderMessages();
 else await refreshUnread();
},{onError:error=>toast(error.message)});
function connectMessageStream(){
 if(streamUserId===state.user?.id && messageStream)return;
 messageStream?.close();messageStream=null;chatMessages.clear();chatDrafts.clear();chatConversations=[];chatRenderedId=null;streamUserId=state.user?.id||null;
 chatHistoryBefore.clear();
 liveRefreshQueue.cancel();liveNeedsMessages=false;
 if(!streamUserId)return;
 messageStream=new EventSource('/api/message-events');
 messageStream.onopen=()=>{
  responseCache.delete('/api/conversations');chatMessages.clear();
  liveNeedsMessages=true;liveRefreshQueue.request();
 };
 messageStream.onmessage=event=>{
  let payload;try{payload=JSON.parse(event.data)}catch{return;}
  document.dispatchEvent(new CustomEvent('unisatis-message-event',{detail:payload}));
  if(payload.type==='typing'){
   if(Number(payload.conversationId)===Number(state.selectedConversation)&&payload.senderId!==state.user?.id){
    document.querySelector('.chat-typing')?.remove();
    if(payload.typing){const indicator=document.createElement('div');indicator.className='bubble chat-typing';indicator.setAttribute('aria-label','Yazıyor');indicator.innerHTML='<i></i><i></i><i></i>';document.querySelector('.messages')?.append(indicator);document.querySelector('.messages')?.scrollTo(0,document.querySelector('.messages').scrollHeight);clearTimeout(window.__unisatisTypingTimer);window.__unisatisTypingTimer=setTimeout(()=>indicator.remove(),2600);}
   }
   return;
  }
  responseCache.delete('/api/conversations');chatMessages.delete(payload.conversationId);
  const person=chatConversations.find(c=>c.conversationIds?.includes(payload.conversationId));if(person)chatMessages.delete(person.id);
  if(payload.resync)chatMessages.clear();
  if(payload.senderId!==state.user?.id||payload.resync)liveNeedsMessages=true;
  liveRefreshQueue.request();
 };
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden||!state.user)return;
 responseCache.delete('/api/conversations');
 if(route()==='/messages'&&voiceRecorder?.state!=='recording')renderMessages().catch(error=>toast(error.message));
 else refreshUnread().catch(()=>{});
});
document.addEventListener('click',async event=>{
 const accountLink=event.target.closest('.guest-profile-menu a');
 if(accountLink&&!state.user){event.preventDefault();return showAuth();}
 const target=event.target.closest('[data-action]');
 if(target){event.preventDefault();document.querySelectorAll('.message-menu[open]').forEach(menu=>menu.removeAttribute('open')); const action=target.dataset.action,id=target.dataset.id;
  try{
   if(action==='close-modal') return closeModal();
   if(action==='open-notification-chat'){state.selectedConversation=Number(id);state.openConversationOnNavigation=true;return go('/messages');}
   if(action==='chat-back'){state.selectedConversation=null;return renderMessages();}
   if(action==='older-messages'){chatHistoryBefore.set(state.selectedConversation,Number(target.dataset.before));chatMessages.delete(state.selectedConversation);return await renderMessages();}
   if(action==='latest-messages'){chatHistoryBefore.delete(state.selectedConversation);chatMessages.delete(state.selectedConversation);return await renderMessages();}
   if(action==='faq'){showSimpleModal('Yardım merkezi','',faqContent());$('#modal-root .modal')?.classList.add('faq-modal');return;}
   if(action==='view-avatar'){if(state.user?.avatarUrl)showPhotoViewer(state.user.avatarUrl,'Profil fotoğrafı',true);else showProfilePhotoOptions();return;}
   if(action==='verify-phone')return showPhoneVerification();
   if(action==='send-phone-code'){target.disabled=true;try{const result=await api('/api/me/phone/send-code',{method:'POST'});showPhoneVerification(true);toast(result.message);}finally{target.disabled=false;}return;}
   if(action==='preview-listing-photo'){const file=selectedListingPhotos[Number(target.dataset.index)];if(file)showPhotoViewer(listingPreview(file),'Ürün fotoğrafı');return;}
   if(action==='remove-listing-photo'){const [file]=selectedListingPhotos.splice(Number(target.dataset.index),1);if(file){URL.revokeObjectURL(listingPreviewUrls.get(file));listingPreviewUrls.delete(file);}renderListingPhotos();return;}
   if(action==='reload-app'){location.reload();return;}
   if(action==='seller-listings'){closeModal();go('/seller/'+id);return;}
   if(action==='report-conversation')return showSimpleModal('Kullanıcıyı şikâyet et','Şikâyetin yöneticinin inceleme listesine gönderilecek.',`<form data-form="report-conversation" data-id="${id}"><div class="field"><label for="conversationReportReason">Şikâyet nedeni</label><textarea id="conversationReportReason" name="reason" maxlength="500" required></textarea></div><button class="btn btn-primary">Şikâyeti gönder</button></form>`);
   if(action==='conversation-options')return showConversationOptions(Number(id));
   if(action==='view-chat-photo'){const uid=state.user.id,src=await messagePhotoURL(id,uid);if(state.user?.id!==uid)return;const decoded=new Image();decoded.src=src;await decoded.decode();const message=chatMessages.get(state.selectedConversation)?.find(item=>String(item.id)===String(id));const peer=chatConversations.find(c=>c.id===state.selectedConversation);const mine=message?.sender_id===uid;const sender={name:mine?state.user.name:(peer?.other_name||'Gönderen'),avatar:mine?state.user.avatarUrl:peer?.other_avatar_url};showPhotoViewer(src,sender.name);const title=$('#modal-root .modal-top h2');if(title)title.innerHTML=`<span class="photo-sender">${avatarMarkup(sender.name,sender.avatar,'avatar')}<span>${escapeHtml(sender.name)}</span></span>`;$('.app-photo-viewer').insertAdjacentHTML('beforeend',`<a class="photo-download btn btn-outline" href="${src}" download="unisatis-fotograf-${id}" aria-label="Fotoğrafı indir" title="Fotoğrafı indir"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg></a>`);return;}
   if(action==='clear-chat')return showSimpleModal('Sohbeti sil','Bu konuşmadaki eski mesajlar yalnızca senin ekranından kaldırılır. Karşı tarafın mesajları korunur.',`<form data-form="clear-chat" data-id="${id}"><button class="btn btn-danger">Sohbeti sil</button></form>`);
   if(action==='profile-photo')return showProfilePhotoOptions();
   if(action==='profile-camera'){state.cameraPurpose='avatar';state.modal='camera';drawModal();return;}
   if(action==='remove-avatar'){const result=await api('/api/me/avatar',{method:'DELETE'});state.user=result.user;closeModal();return render();}
   if(action==='block-user'){await api(`/api/users/${id}/block`,{method:'POST',body:{}});toast('Kullanıcı engellendi.');closeModal();return renderMessages();}
   if(action==='unblock-user'){await api(`/api/users/${id}/block`,{method:'DELETE'});toast('Engel kaldırıldı.');closeModal();return renderMessages();}
   if(action==='forgot-password'){state.resetEmail=$('[data-form="login"] input[name="email"]')?.value || state.resetEmail || '';state.resetDevCode='';state.authTab='reset-request';state.modal='auth';return drawModal();}
   if(action==='resend-code'){await resendVerificationCode();return;}
   if(action==='photo-menu'){state.cameraPurpose='chat';discardVoiceRecording();state.modal='camera';drawModal();return;}
   if(action==='edit-message')return showSimpleModal('Mesajı düzenle','',`<form data-form="edit-message" data-id="${id}"><textarea name="body" maxlength="2000" required>${escapeHtml(target.dataset.body)}</textarea><button class="btn btn-primary">Kaydet</button></form>`);
   if(action==='delete-message'){await api('/api/messages/'+id,{method:'DELETE'});return renderMessages();}
   if(action==='voice-start'){await startVoiceRecording();return;}
   if(action==='voice-stop'){if(voiceRecorder?.state==='recording'){voiceFinishing=true;voiceRecorder.stop();}return;}
   if(action==='remove-voice'){discardVoiceRecording();return;}
   if(action==='remove-chat-photo'){chatPhoto=null;updateChatPhotoStatus();return;}
   if(action==='camera-start'){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Bu tarayıcıda canlı kamera açılamıyor. Galeriden seçebilirsin.');
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:state.cameraPurpose==='avatar'?'user':'environment'}},audio:false});
    const video=$('#cameraPreview');video.srcObject=cameraStream;video.hidden=false;try{await video.play();}catch(error){stopCamera();throw error;}
    $('#cameraStart').hidden=true;$('#cameraCapture').hidden=false;return;
   }
   if(action==='camera-capture'){
    const video=$('#cameraPreview');if(!video?.videoWidth)throw new Error('Kamera görüntüsü henüz hazır değil.');
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    canvas.getContext('2d').drawImage(video,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
    if(!blob || blob.size>12*1024*1024)throw new Error('Fotoğraf 12 MB sınırını aşıyor.');
    if(state.cameraPurpose==='avatar'){await uploadAvatar(new File([blob],'profil.jpg',{type:'image/jpeg'}));return;}
    chatPhoto=new File([blob],`kamera-${Date.now()}.jpg`,{type:'image/jpeg'});discardVoiceRecording();closeModal();updateChatPhotoStatus();return;
   }
   if(action==='login-required') return showAuth(target.dataset.tab==='register'?'register':'login');
   if(action==='choose-university'){
    await universityLogosReady;warmUniversityLogos();
    showSimpleModal('Üniversite seç','İlanlarını görmek istediğin üniversiteyi seç.',state.universities.length?universityPickerForm():'<p class="muted" role="status">Üniversiteler yükleniyor…</p>');
    const picker=state.modal;
    if(!state.universities.length){
     try{await loadUniversities();}catch(error){if(state.modal===picker)closeModal();throw error;}
     if(state.modal!==picker)return;
     picker.form=universityPickerForm();drawModal();
    }
    $('#universityPickerSearch')?.focus();return;
   }
   if(action==='select-university'){
    state.filters.university=target.dataset.university;
    closeModal();
    const label=$('.campus-picker span');
    if(label){label.textContent=translateText(state.filters.university==='*'?'Tüm üniversiteler':state.filters.university,language);$('.campus-picker .university-logo')?.remove();label.insertAdjacentHTML('afterend',universityLogo(state.filters.university,true));}
    return refreshSearchResults(state.filters.q);
   }
   if(action==='retry-universities'){const form=target.closest('form');showRegistrationErrors(form,{});return populateRegistrationUniversities(form);}
   if(action==='auth-tab'){state.googleProfile=null;state.authTab=target.dataset.tab;return drawModal();}
   if(action==='sell') return go('/sell');
   if(action==='sell-donation') return go('/sell-donation');
   if(action==='filter-category'){state.filters.category=target.dataset.category;const menu=target.closest('.category-menu');if(menu){menu.open=false;menu.querySelector('summary').innerHTML=escapeHtml(state.filters.category||'Tüm kategoriler')+' <span>⌄</span>';}return refreshSearchResults(state.filters.q||'');}
   if(action==='toggle-theme'){const change=()=>{theme=theme==='dark'?'light':'dark';localStorage.setItem('unipazar-theme',theme);applyTheme();const button=document.querySelector('.theme-toggle');button.innerHTML=themeIcon();button.setAttribute('aria-label',theme==='dark'?'Açık moda geç':'Karanlık moda geç');button.title=theme==='dark'?'Açık mod':'Karanlık mod';};change();return;}
   if(action==='set-language'){language=target.dataset.language;localStorage.setItem('unipazar-language',language);return render();}
   if(action==='carousel-prev')return showDetailPhoto(detailPhotoIndex-1);
   if(action==='carousel-next')return showDetailPhoto(detailPhotoIndex+1);
   if(action==='carousel-show')return showDetailPhoto(Number(target.dataset.index));
   if(action==='owner-menu'){const menu=$('.owner-menu');menu.hidden=!menu.hidden;target.setAttribute('aria-expanded',String(!menu.hidden));return;}
   if(action==='cancel-listing'){localStorage.removeItem('unipazar-listing-draft');clearListingPhotos();const form=target.closest('[data-form="listing"]');form?.reset();go('/');return;}
   if(action==='account'){ const menu=$('.profile-menu'); menu.hidden=!menu.hidden; target.setAttribute('aria-expanded',String(!menu.hidden)); return; }
   if(action==='change-email') return showSimpleModal('E-postamı değiştir','Yeni e-postanı doğrulaman gerekecek.',`<form data-form="change-email"><div class="field"><label>Yeni e-posta</label><input name="email" type="email" required></div><div class="field"><label>Mevcut şifren</label><input name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary">E-postayı değiştir</button></form>`);
   if(action==='change-phone') return showSimpleModal(state.user.phone?'Telefon numaramı değiştir':'Telefon numarası ekle','Numaran yalnızca hesap bilgilerinde görünür.',`<form data-form="change-phone"><div class="field"><label>Telefon numarası</label><input name="phone" type="tel" autocomplete="tel" placeholder="05xx xxx xx xx" required></div>${state.user.phone?'<div class="field"><label>Mevcut şifren</label><input name="password" type="password" autocomplete="current-password" required></div>':''}<button class="btn btn-primary">Numarayı kaydet</button></form>`);
   if(action==='delete-account')return showSimpleModal('Hesabı kalıcı olarak sil','İlanların, mesajların ve fotoğrafların silinecek. Bu işlem geri alınamaz.',`<form data-form="delete-account"><div class="field"><label>Onaylamak için SİL yaz</label><input name="confirmation" autocomplete="off" required></div><button class="btn btn-danger">Hesabımı kalıcı olarak sil</button></form>`);
   if(action==='logout'){await api('/api/logout',{method:'POST'});state.user=null;clearMessageMedia();connectMessageStream();state.unreadCount=0;state.filters.university='*';saleUniversityFilter='*';go('/');toast('Çıkış yapıldı.');return render();}
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
   if(action==='start-chat'){const data=await api(`/api/listings/${id}/conversation`,{method:'POST'});state.selectedConversation=data.id;if(!chatDrafts.get(data.id)&&data.title)chatDrafts.set(data.id,`${data.title} ilanı hakkında: `);state.openConversationOnNavigation=true;return go('/messages');}
   if(action==='request-donation') return showSimpleModal('Ürünü talep et','Kısa bir not yaz. İhtiyaç durumun bağışçıya gösterilmez.',`<form data-form="donation-request" data-id="${id}"><div class="field"><label>Talep notu</label><textarea name="note" maxlength="500" required></textarea></div><button class="btn btn-primary">Talep gönder</button></form>`);
   if(action==='report') return showSimpleModal('İlanı bildir','Sorunu kısaca açıkla; yönetici inceleyecek.',`<form data-form="report" data-id="${id}"><div class="field"><label>Bildirim nedeni</label><textarea name="reason" maxlength="500" required></textarea></div><button class="btn btn-primary">Bildir</button></form>`);
   if(action==='report-message')return showSimpleModal('Mesajı bildir','Yönetici bildirilen konuşmayı inceleyebilir.',`<form data-form="report-message" data-id="${id}"><div class="field"><label>Bildirim nedeni</label><textarea name="reason" maxlength="500" required></textarea></div><button class="btn btn-primary">Bildir</button></form>`);
   if(action==='edit-listing'){
    const {listing:l}=await api(`/api/listings/${id}`);
    clearEditPhotos();keptEditPhotos=l.images.map(image=>image.filename);
    const conditions=['Yeni','Az kullanılmış','Kullanılmış','Onarım gerektirir'];
    showSimpleModal('İlanı düzenle','İlan bilgilerini ve fotoğraflarını güncelleyebilirsin.',`<form data-form="edit-listing" data-id="${id}" enctype="multipart/form-data"><div class="field"><label>Ürün adı</label><input name="title" maxlength="100" value="${escapeHtml(l.title)}" required></div><div class="form-grid"><div class="field"><label>Kategori</label><select name="category" required>${categories.map(category=>`<option value="${escapeHtml(category)}" ${category===l.category?'selected':''}>${escapeHtml(category)}</option>`).join('')}</select></div><div class="field"><label>Durumu</label><select name="condition" required>${conditions.map(condition=>`<option value="${escapeHtml(condition)}" ${condition===l.condition?'selected':''}>${condition}</option>`).join('')}</select></div></div>${l.kind==='sale'?`<div class="field"><label>Fiyat (₺)</label><input name="price" type="text" inputmode="numeric" pattern="[0-9]+" maxlength="9" value="${l.price/100}" required></div>`:''}<div class="field"><label>Açıklama</label><textarea name="description" maxlength="2000" required>${escapeHtml(l.description)}</textarea></div><div class="field"><label>Fotoğraflar</label><div id="editPhotoList" class="edit-photo-list"></div><label class="photo-picker edit-photo-picker" for="editPhotos"><span class="photo-picker-icon">＋</span><span><strong>Fotoğraf ekle</strong><small id="editPhotoCount"></small></span><input id="editPhotos" type="file" accept="image/*,.heic,.heif" multiple></label><span class="hint">En çok 6 fotoğraf; her biri en fazla 12 MB. İlk fotoğraf kapak olur.</span></div><button class="btn btn-primary">Kaydet</button></form>`);
    $('#modal-root .modal').classList.add('edit-listing-modal');renderEditPhotos();return;
   }
   if(action==='remove-edit-photo'){const index=Number(target.dataset.index);if(target.dataset.kind==='kept')keptEditPhotos.splice(index,1);else{const [photo]=newEditPhotos.splice(index,1);if(photo)URL.revokeObjectURL(photo.url);}return renderEditPhotos();}
   if(action==='handoff') return showSimpleModal('Güvenli buluşma öner','Kalabalık ve bilinen bir noktayı tercih et.',`<form data-form="handoff"><div class="field"><label>Buluşma noktası</label><input name="place" required maxlength="120" placeholder="Örn. Kütüphane girişi"></div><div class="field"><label>Tarih ve saat</label><input name="meetingAt" type="datetime-local" required></div><button class="btn btn-primary">Öneriyi gönder</button></form>`);
   if(action==='handoff-status'){await api(`/api/conversations/${state.selectedConversation}/handoff`,{method:'PATCH',body:{status:target.dataset.status}});toast('Buluşma güncellendi.');return render();}
   if(action==='mark-sold') return showSimpleModal('İlanı tamamla','Bu ilanı satıldı veya verildi olarak işaretlemek istediğine emin misin?',`<form data-form="confirm-sold" data-id="${id}"><div class="inline-actions"><button class="btn btn-primary">Evet, tamamla</button><button type="button" class="btn btn-light" data-action="close-modal">Vazgeç</button></div></form>`);
   if(action==='remove')return showSimpleModal('İlanı silmek istediğine emin misin?','İlanın satıştan kaldırılacak. Eski ilanını İlanlarım ekranından inceleyebilirsin.',`<form data-form="remove-listing" data-id="${id}"><div class="inline-actions"><button class="btn btn-danger">Evet, ilanı sil</button><button type="button" class="btn btn-outline" data-action="close-modal">Vazgeç</button></div></form>`);
   if(['reserve','reactivate'].includes(action)){const status={'mark-sold':'sold',reserve:'reserved',reactivate:'active',remove:'removed'}[action];await api(`/api/listings/${id}`,{method:'PATCH',body:{status}});toast('İlan güncellendi.');return render();}
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
   if(action==='remove-support-form')return showSimpleModal('Başvuruyu kaldır','Destek erişimi kapatılacak ve sonuçlanan başvuru listeden kaldırılacak.',`<form data-form="remove-support" data-id="${id}"><div class="inline-actions"><button class="btn btn-danger">Onayla ve kaldır</button><button type="button" class="btn btn-outline" data-action="close-modal">Vazgeç</button></div></form>`);
   if(action==='admin-support'){await api(`/api/admin/support/${id}`,{method:'PATCH',body:{status:target.dataset.status}});toast('Destek başvurusu güncellendi.');return render();}
   if(action==='admin-report'){showSimpleModal('Şikâyet sonucu gönder','Açıklaman şikâyeti gönderen kullanıcıya iletilir.',`<form data-product-form="report-status" data-id="${id}"><input type="hidden" name="removeListing" value="${target.dataset.remove?'1':''}"><label class="field">Durum<select name="status"><option value="reviewing">İnceleniyor</option><option value="closed">Sonuçlandı</option></select></label><label class="field">Kullanıcıya açıklama<textarea name="note" minlength="5" maxlength="500" required></textarea></label><button class="btn btn-primary">Sonucu gönder</button></form>`);return;}
   if(action==='resend-profile-code'){const result=await api('/api/resend-code',{method:'POST',body:{email:state.user.email}});state.devCode=result.devCode||'';toast(result.message);return render();}
  }catch(error){toast(error.message);}
 }
 const conversation=event.target.closest('[data-conversation]'); if(conversation){event.preventDefault();switchConversation(Number(conversation.dataset.conversation));}
 if(event.target.closest('a[href="#/messages"]') && !conversation){state.selectedConversation=null;if(state.user&&route()==='/messages')renderMessages().catch(error=>toast(error.message));}
});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-form]'); if(!form)return; event.preventDefault();
 const type=form.dataset.form, data=Object.fromEntries(new FormData(form).entries()); const submit=form.querySelector('[type="submit"],button:not([type])'); if(submit)submit.disabled=true;
 try{
  if(type==='register'){const validation=registrationValidation(data);showRegistrationErrors(form,validation.fields,Object.keys(validation.fields).length?'Lütfen işaretli alanları kontrol et.':'',true);if(Object.keys(validation.fields).length)return;Object.assign(data,validation.values);data.rememberMe=false;data.google=!!state.googleProfile;const result=await api('/api/register',{method:'POST',body:data});if(result.user){state.user=result.user;connectMessageStream();refreshUnread().catch(()=>{});closeModal();toast(result.message);return render();}state.pendingEmail=data.email;state.pendingRememberMe=data.rememberMe;state.devCode=result.devCode||'';state.verificationMessage='Doğrulama kodu e-postana gönderildi. Gelen kutunu ve spam klasörünü kontrol et.';state.verificationError=false;state.verificationResendEmail=data.email.toLowerCase();state.verificationResendUntil=Date.now()+60000;state.authTab='verify';drawModal();toast(result.message);return;}
  if(type==='verify'){data.rememberMe=state.pendingRememberMe;const result=await api('/api/verify-email',{method:'POST',body:data});state.user=result.user;connectMessageStream();closeModal();toast('E-posta doğrulandı.');return render();}
  if(type==='login'){data.rememberMe=data.rememberMe==='true';const result=await api('/api/login',{method:'POST',body:data});state.user=result.user;connectMessageStream();refreshUnread().catch(()=>{});closeModal();toast('Hoş geldin!');return render();}
  if(type==='reset-request'){const result=await api('/api/password-reset/request',{method:'POST',body:data});state.resetEmail=data.email;state.resetDevCode=result.devCode||'';state.authTab='reset-password';drawModal();return;}
  if(type==='reset-password'){const result=await api('/api/password-reset/confirm',{method:'POST',body:data});state.resetDevCode='';state.googleProfile=null;state.authTab='login';drawModal();toast(result.message);return;}
  if(type==='listing'){if(!selectedListingPhotos.length)throw new Error('En az bir ürün fotoğrafı ekle.');const body=new FormData(form);body.delete('photos');for(const photo of selectedListingPhotos){const compact=await optimizePhoto(photo);body.append('photos',compact,compact.name);}if(body.get('kind')==='donation')body.set('price','0');const result=await api('/api/listings',{method:'POST',body});localStorage.removeItem('unipazar-listing-draft');clearListingPhotos();toast('İlan yayınlandı.');return go('/listing/'+result.id);}
  if(type==='remove-support'){await api('/api/admin/support/'+form.dataset.id,{method:'DELETE',body:{confirmation:true}});closeModal();toast('Başvuru kaldırıldı; destek erişimi kapatıldı.');return render();}
  if(type==='remove-listing'){await api('/api/listings/'+form.dataset.id,{method:'PATCH',body:{status:'removed'}});closeModal();toast('İlan kaldırıldı.');return render();}
  if(type==='admin-remove-listing'){await api('/api/listings/'+form.dataset.id,{method:'PATCH',body:{status:'removed'}});closeModal();toast('İlan kaldırıldı.');return render();}
  if(type==='edit-listing'){if(keptEditPhotos.length+newEditPhotos.length<1)throw new Error('En az bir fotoğraf gerekli.');const body=new FormData(form);body.set('keepPhotos',JSON.stringify(keptEditPhotos));for(const photo of newEditPhotos){const compact=await optimizePhoto(photo.file);body.append('photos',compact,compact.name);}await api(`/api/listings/${form.dataset.id}`,{method:'PATCH',body});closeModal();toast('İlan güncellendi.');return render();}
  if(type==='clear-chat'){await api(`/api/conversations/${form.dataset.id}/clear`,{method:'POST',body:{confirmation:true}});chatMessages.delete(Number(form.dataset.id));chatDrafts.delete(Number(form.dataset.id));if(state.selectedConversation===Number(form.dataset.id)){state.selectedConversation=null;chatRenderedId=null;}closeModal();toast('Sohbet silindi.');return renderMessages();}
  if(type==='report-conversation'){await api('/api/reports',{method:'POST',body:{conversationId:Number(form.dataset.id),reason:data.reason}});closeModal();toast('Şikâyetin yöneticiye gönderildi.');return;}
  if(type==='profile'){const result=await api('/api/me/profile',{method:'PATCH',body:data});state.user=result.user;toast('Bilgiler kaydedildi.');return render();}
  if(type==='delete-account'){await api('/api/me',{method:'DELETE',body:data});state.user=null;connectMessageStream();state.unreadCount=0;state.filters.university='*';saleUniversityFilter='*';localStorage.removeItem('unipazar-listing-draft');closeModal();go('/');toast('Hesabın ve verilerin silindi.');return render();}
  if(type==='change-email'){const result=await api('/api/me/email',{method:'PATCH',body:data});state.user=result.user;state.devCode=result.devCode||'';closeModal();toast('E-posta değiştirildi. Yeni adresini doğrula.');return render();}
  if(type==='change-phone'){const result=await api('/api/me/phone',{method:'PATCH',body:data});state.user=result.user;closeModal();toast('Telefon numarası kaydedildi.');return render();}
  if(type==='support'){await api('/api/support-application',{method:'POST',body:data});toast('Başvurun gönderildi.');return render();}
  if(type==='admin-close-account'){await api(`/api/admin/accounts/${form.dataset.id}`,{method:'PATCH',body:{closed:true}});closeModal();toast('Hesap kapatıldı.');return render();}
  if(type==='edit-message'){await api('/api/messages/'+form.dataset.id,{method:'PATCH',body:{body:data.body}});closeModal();return renderMessages();}
  if(type==='admin-review'){const {messages}=await api(`/api/admin/conversations/${form.dataset.id}/review`,{method:'POST',body:{reason:data.reason}});return showSimpleModal('Konuşma incelemesi','İnceleme gerekçesi kaydedildi. Mesajlar yalnızca okunabilir.',`<div class="admin-review-messages">${messages.length?messages.map(m=>`<div class="admin-review-message"><strong>${escapeHtml(m.sender_name)}</strong><small>${escapeHtml(m.created_at)}</small>${m.body?`<p>${escapeHtml(m.body)}</p>`:''}${m.photo_filename?`<img class="chat-photo" src="/api/admin/messages/${m.id}/photo" alt="Gönderilen fotoğraf">`:''}${m.voice_filename?`<audio controls preload="none" src="/api/admin/messages/${m.id}/voice" aria-label="Sesli mesaj"></audio>`:''}</div>`).join(''):empty('Mesaj yok','')}</div>`);}
  if(type==='confirm-sold'){await api(`/api/listings/${form.dataset.id}`,{method:'PATCH',body:{status:'sold'}});closeModal();toast('İlan tamamlandı.');return render();}
  if(type==='verify-phone'){const result=await api('/api/me/phone/verify',{method:'POST',body:data});state.user=result.user;closeModal();toast('Telefonun SMS koduyla doğrulandı.');return render();}
  if(type==='profile-verify'){const result=await api('/api/me/verify-email',{method:'POST',body:data});state.user=result.user;state.pendingEmailVerification=false;state.devCode='';toast('E-posta doğrulandı.');return render();}
  if(type==='message'){
   const body=new FormData(form);if(chatPhoto)body.set('photo',chatPhoto);
   if(voiceRecorder?.state==='recording')throw new Error('Önce ses kaydını bitir.');
   if(voiceClip)body.set('voice',voiceClip);
   if(!String(body.get('body')||'').trim() && !chatPhoto && !voiceClip)throw new Error('Mesaj yaz, fotoğraf veya ses kaydı ekle.');
   await api(`/api/conversations/${state.selectedConversation}/messages`,{method:'POST',body});
   typingSent=false;clearTimeout(typingStopTimer);api(`/api/conversations/${state.selectedConversation}/typing`,{method:'POST',body:{typing:false}}).catch(()=>{});
   document.dispatchEvent(new Event('unisatis-message-sent'));
   chatHistoryBefore.delete(state.selectedConversation);chatMessages.delete(state.selectedConversation);
   chatPhoto=null;chatDrafts.delete(state.selectedConversation);discardVoiceRecording();form.reset();return renderMessages();
  }
  if(type==='handoff'){await api(`/api/conversations/${state.selectedConversation}/handoff`,{method:'POST',body:data});closeModal();toast('Buluşma önerisi gönderildi.');return render();}
  if(type==='donation-request'){await api(`/api/listings/${form.dataset.id}/requests`,{method:'POST',body:data});closeModal();toast('Talep gönderildi.');return;}
  if(type==='report'){await api('/api/reports',{method:'POST',body:{listingId:Number(form.dataset.id),reason:data.reason}});closeModal();toast('Bildirim alındı.');return;}
  if(type==='report-message'){await api('/api/reports',{method:'POST',body:{messageId:Number(form.dataset.id),reason:data.reason}});closeModal();toast('Mesaj bildirildi.');return;}
 }catch(error){if(type==='register'){showRegistrationErrors(form,error.fields||{},error.message,true);}else toast(error.message);}finally{if(submit)submit.disabled=false;}
});
let searchTimer; document.addEventListener('input',event=>{if(event.target.id==='adminAccountSearch'){const query=event.target.value.toLocaleLowerCase('tr-TR');document.querySelectorAll('[data-admin-account]').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase('tr-TR').includes(query)});return;}if(event.target.id==='universityPickerSearch'){const q=event.target.value.toLocaleLowerCase('tr-TR');document.querySelectorAll('.university-option').forEach(option=>{option.hidden=!option.textContent.toLocaleLowerCase('tr-TR').includes(q)});return;}if(event.target.name==='price')event.target.value=event.target.value.replace(/[^0-9]/g,'');if(event.target.id==='searchInput'){clearTimeout(searchTimer);const query=event.target.value;state.filters.q=query;$('.grid')?.setAttribute('aria-busy','true');searchTimer=setTimeout(()=>refreshSearchResults(query),250);} const form=event.target.closest('[data-form="listing"]');if(form){const draft=Object.fromEntries([...new FormData(form).entries()].filter(([,value])=>typeof value==='string'));localStorage.setItem('unipazar-listing-draft',JSON.stringify(draft));}});
document.addEventListener('change',event=>{if(event.target.id==='chatGalleryInput'){const file=event.target.files?.[0];if(file){if(state.cameraPurpose==='avatar'){uploadAvatar(file);return;}if(file.size>12*1024*1024){toast('Fotoğraf en fazla 12 MB olabilir.');return;}chatPhoto=file;discardVoiceRecording();closeModal();updateChatPhotoStatus();}return;}if(event.target.id==='editPhotos'){const incoming=[...event.target.files];event.target.value='';if(keptEditPhotos.length+newEditPhotos.length+incoming.length>6){toast('En fazla 6 fotoğraf ekleyebilirsin.');return;}if(incoming.some(file=>file.size>12*1024*1024)){toast('Her fotoğraf en fazla 12 MB olabilir.');return;}newEditPhotos.push(...incoming.map(file=>({file,url:URL.createObjectURL(file)})));renderEditPhotos();return;}if(event.target.id==='photos'){const incoming=[...event.target.files];event.target.value='';if(selectedListingPhotos.length+incoming.length>6){toast('En fazla 6 fotoğraf ekleyebilirsin.');return;}if(incoming.some(file=>file.size>12*1024*1024)){toast('Her fotoğraf en fazla 12 MB olabilir.');return;}if(incoming.some(file=>!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)&&!/[.](jpe?g|png|webp|heic|heif)$/i.test(file.name))){toast('JPG, PNG, WebP veya HEIC fotoğraf seç.');return;}selectedListingPhotos.push(...incoming);renderListingPhotos();$('#photoCount').textContent=translateText(selectedListingPhotos.length?`${selectedListingPhotos.length}/6 fotoğraf seçildi`:'Henüz fotoğraf seçilmedi',language);return;}if(event.target.id==='categoryFilter'){state.filters.category=event.target.value;render();} if(event.target.id==='browseUniversity'){state.filters.university=event.target.value;render();} if(event.target.id==='kind'){const donation=event.target.value==='donation';$('#priceField').hidden=donation;$('#price').required=!donation;}});
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
// Start the public home request alongside session restoration. On signed-out
// launches renderBrowse() reuses this cached promise instead of waiting for a
// second network round trip after /api/me completes.
api('/api/listings?kind=sale').catch(()=>{});
refreshUser().then(async()=>{refreshUnread().catch(()=>{});await render();}).catch(error=>{pageFrame(`<main class="shell page"><section class="panel"><h2>Bağlantı kurulamadı</h2><p>İnternet bağlantını kontrol edip tekrar deneyebilirsin.</p><button class="btn btn-primary" data-action="reload-app">Tekrar dene</button></section></main>`,route());toast(error.message);}).finally(()=>document.dispatchEvent(new Event('unisatis-ready')));
// SSE delivers updates immediately; periodic reads only recover lost connections.
setInterval(()=>{if(state.user&&!document.hidden&&messageStream?.readyState!==EventSource.OPEN)refreshUnread().catch(()=>{});},30000);
export {api,state,render,go,showSimpleModal,closeModal,toast,escapeHtml,listingCard,refreshUser,refreshSearchResults,pageFrame,showAuth};
