import {api,state,listingCard,toast} from './app.js';
let pages=[null],current=0,busy=false,filters='';
function draw(){
 document.querySelector('.feed-pagination')?.remove();
 const grid=document.querySelector('main .grid');if(!grid||!['#/','#/donation'].includes(location.hash)||(!state.feedPage?.hasMore&&!current))return;
 const controls=document.createElement('nav');controls.className='feed-pagination';controls.setAttribute('aria-label','İlan sayfaları');
 controls.innerHTML=`<button type="button" class="btn btn-outline" ${current===0||busy?'disabled':''}>← Önceki ilanlar</button><span>${current+1}. sayfa</span><button type="button" class="btn btn-primary" ${!state.feedPage?.hasMore||busy?'disabled':''}>Sonraki ilanlar →</button>`;
 const buttons=controls.querySelectorAll('button');buttons[0].addEventListener('click',()=>load(current-1));buttons[1].addEventListener('click',()=>{pages[current+1]=state.feedPage.nextCursor;load(current+1);});grid.after(controls);
}
async function load(index){
 if(busy||index<0)return;busy=true;draw();const snapshot=JSON.stringify(state.filters),route=location.hash;
 const params=new URLSearchParams();for(const [key,value] of Object.entries(state.filters))if(value&&!(key==='university'&&value==='*'))params.set(key,value);if(pages[index])params.set('after',pages[index]);
 try{const data=await api('/api/listings?'+params);if(snapshot!==JSON.stringify(state.filters)||route!==location.hash)return;state.listings=data.listings;state.feedPage=data.page;current=index;const grid=document.querySelector('main .grid');if(grid){grid.innerHTML=data.listings.map(listingCard).join('');document.querySelector('.result-count').textContent=`${data.listings.length} ilan`;grid.scrollIntoView({block:'start',behavior:'auto'});}}
 catch(error){toast(error.message);}finally{busy=false;draw();}
}
function reset(){const next=JSON.stringify(state.filters);if(next!==filters||!busy){filters=next;pages=[null];current=0;}draw();}
document.addEventListener('unisatis-render',reset);document.addEventListener('unisatis-feed-reset',reset);draw();
