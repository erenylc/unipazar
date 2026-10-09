import {api,state,showSimpleModal,closeModal,toast,escapeHtml as esc,pageFrame,showAuth,go} from './app.js';
const price=value=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(value/100);
const button=(action,text,attrs='')=>`<button type="button" class="btn btn-outline" data-commerce-action="${action}" ${attrs}>${text}</button>`;
const notice='<div class="commerce-notice"><strong>Ödeme ve kargo henüz etkin değil</strong><p>Taslak oluşturmak ürünü ayırmaz, satın alma işlemi yapmaz ve satıcıya sipariş göndermez. Kart veya adres bilgisi istemiyoruz.</p></div>';
function process(){return `<ol class="commerce-steps"><li><strong>Sipariş hazırlığı</strong><span>Ürün ve teslimat tercihi</span></li><li><strong>Ödeme</strong><span>Ödeme kuruluşu bağlantısı bekleniyor</span></li><li><strong>Kargo ve teslimat</strong><span>Kargo anlaşması bekleniyor</span></li><li><strong>Kontrol ve sonuç</strong><span>İade / itiraz kuralları hazırlanıyor</span></li></ol>`;}
function summary(s){return `<dl class="commerce-summary"><div><dt>Ürün</dt><dd>${esc(s.title)}</dd></div><div><dt>Satıcı</dt><dd>${esc(s.sellerName)}</dd></div><div><dt>Üniversite</dt><dd>${esc(s.university)}</dd></div><div><dt>Ürün fiyatı</dt><dd>${price(s.price)}</dd></div><div><dt>Kargo</dt><dd>Henüz belirlenmedi</dd></div><div><dt>Hizmet bedeli</dt><dd>Henüz belirlenmedi</dd></div><div><dt>Ödenecek toplam</dt><dd>Henüz hesaplanamaz</dd></div></dl>`;}
async function prepare(id){
  if(!state.user){toast('Sipariş hazırlığı için giriş yapmalısın.');return;}
  const {listing}=await api('/api/listings/'+id);
  showSimpleModal('Sipariş hazırlığı','Üniversiteler arasında alışveriş için ürününü ve teslimat tercihini incele.',`${notice}${summary({title:listing.title,sellerName:listing.seller_name,university:listing.university,price:listing.price})}<form data-commerce-form="draft" data-id="${listing.id}"><div class="field"><label for="commerce-delivery">Teslimat tercihi</label><select name="delivery" id="commerce-delivery"><option value="campus">Kampüste elden teslim tercihi</option><option value="shipping">Başka üniversiteye kargo tercihi</option></select><p class="small muted">Bu seçim satıcının teslimat onayı değildir.</p></div><button class="btn btn-primary">Taslağı kaydet</button></form>`);
}
async function drafts(){
  const {drafts}=await api('/api/commerce/drafts');
  showSimpleModal('Sipariş hazırlıklarım','Kayıtlı taslaklar satın alma işlemi değildir. Fiyat ve ürünün satış durumu değişebilir.',`${notice}<div class="commerce-drafts">${drafts.length?drafts.map(d=>`<article class="commerce-draft"><h3>${esc(d.snapshot.title)}</h3><p>${price(d.snapshot.price)} · ${d.delivery==='shipping'?'Kargo tercihi':'Kampüste teslim tercihi'}</p><p class="small muted">Kaydedilen fiyat · Ürün ayrılmadı</p><div class="inline-actions">${button('prepare','Güncel ilanı incele',`data-id="${d.listingId}"`)}${button('delete','Taslağı sil',`data-id="${d.id}"`)}</div></article>`).join(''):'<p>Henüz taslağın yok. Satış ilanından sipariş hazırlığı oluşturabilirsin.</p>'}</div>${process()}`);
}
export async function renderOrders(){
  if(!state.user){go('/');showAuth();return;}
  const userId=state.user.id;
  const {drafts}=await api('/api/commerce/drafts');
  if(location.hash!=='#/orders'||state.user?.id!==userId)return;
  pageFrame(`<main class="shell page orders-page"><a class="back-link" href="#/account">← Hesabıma dön</a><section class="orders-intro"><div class="eyebrow">ÜNİ SATIŞ · ALIŞVERİŞLERİN</div><h1>Siparişlerim</h1><p>Alışveriş hazırlıklarını ve teslimat tercihlerini tek yerden takip et.</p></section>${notice}<section class="panel"><h2>Alışveriş hazırlıklarım</h2>${drafts.length?drafts.map(d=>`<article class="commerce-draft"><div class="commerce-order-heading"><h3>${esc(d.snapshot.title)}</h3><span class="status">Taslak</span></div><p>${price(d.snapshot.price)} · ${d.delivery==='shipping'?'Kargo tercihi':'Kampüste teslim tercihi'}</p><p class="small muted">${esc(d.snapshot.sellerName)} · ${esc(d.snapshot.university)}</p><div class="inline-actions"><a class="btn btn-outline" href="#/listing/${d.listingId}">İlana git</a>${button('prepare','Hazırlığı düzenle',`data-id="${d.listingId}"`)}${button('delete','Taslağı sil',`data-id="${d.id}"`)}</div></article>`).join(''):'<div class="orders-empty"><h3>Henüz siparişin yok</h3><p>İlgilendiğin satış ilanından alışveriş hazırlığı oluşturabilirsin.</p><a class="btn btn-primary" href="#/">İlanları keşfet →</a></div>'}</section><section class="panel commerce-panel"><h2>Güvenli alışveriş nasıl işleyecek?</h2>${process()}<p>Ödeme kuruluşu ve kargo bağlantısı tamamlandığında teslimat, ürün kontrolü ve iade başvuruları bu bölümden takip edilecek.</p></section></main>`,'/orders');
}
function decorate(){
  const main=document.querySelector('main');if(!main)return;
  if(location.hash==='#/account'&&state.user&&!document.querySelector('#commerce-account'))main.insertAdjacentHTML('beforeend',`<section class="panel commerce-panel" id="commerce-account"><div class="eyebrow">ÜNİVERSİTELER ARASI ALIŞVERİŞ</div><h2>Sipariş hazırlıklarım</h2><p>İlgilendiğin ürünleri ve teslimat tercihlerini bir arada tut.</p>${button('drafts','Kayıtlı taslaklarım')}${button('about','Alışveriş nasıl işleyecek?')}</section>`);
  const side=document.querySelector('.detail-side');
  if(side?.dataset.listingStatus==='active'&&side.querySelector('[data-action="start-chat"]')&&!side.querySelector('[data-commerce-action]')){
    const id=location.hash.match(/^#\/listing\/(\d+)$/)?.[1];if(id)side.querySelector('[data-action="start-chat"]').insertAdjacentHTML('afterend',`<div class="commerce-detail">${button('prepare','Sipariş hazırlığı',`data-id="${id}"`)}<small>Ödeme henüz etkin değil</small></div>`);
  }
}
document.addEventListener('unisatis-render',decorate);decorate();
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-commerce-action]');if(!target)return;event.preventDefault();if(target.disabled)return;target.disabled=true;
  try{
    if(target.dataset.commerceAction==='prepare')await prepare(Number(target.dataset.id));
    if(target.dataset.commerceAction==='drafts')go('/orders');
    if(target.dataset.commerceAction==='delete'){await api('/api/commerce/drafts/'+target.dataset.id,{method:'DELETE'});if(location.hash==='#/orders')await renderOrders();else await drafts();toast('Taslak silindi.');}
    if(target.dataset.commerceAction==='about')showSimpleModal('Üniversiteler arası alışveriş','İlk sürüm öğrencilerin kendi eşyalarını satması için hazırlanıyor.',`${notice}${process()}<p>Ödeme açıldığında ürün, kargo ve hizmet bedelini işlem öncesinde görebileceksin. Sorunlu ürünler için uygulama içinden iade ve itiraz başvurusu planlanıyor.</p><p>Üniversite e-postası doğrulaması e-posta erişimini gösterir; kimlik veya ürün garantisi değildir. Şifre ve doğrulama kodunu paylaşma.</p><p>Destek: <a href="mailto:unisatis06@gmail.com">unisatis06@gmail.com</a></p>`);
  }catch(error){toast(error.message);}finally{target.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-commerce-form="draft"]');if(!form)return;event.preventDefault();const submit=form.querySelector('button');if(submit.disabled)return;submit.disabled=true;
  try{await api('/api/commerce/drafts',{method:'POST',body:{listingId:Number(form.dataset.id),delivery:form.elements.delivery.value}});closeModal();toast('Taslak kaydedildi. Ürün ayrılmadı ve ödeme yapılmadı.');}catch(error){toast(error.message);}finally{submit.disabled=false;}
});
