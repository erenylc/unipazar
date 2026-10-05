import {createHash} from 'node:crypto';
import {preparePhoto} from './image-upload.js';

export class PhotoModerationError extends Error{
 constructor(message,status=503){super(message);this.status=status;}
}
export const moderationEnabled=(env=process.env)=>env.PHOTO_MODERATION_ENABLED==='1';
const unavailable=()=>new PhotoModerationError('Fotoğraf güvenlik kontrolü şu anda tamamlanamıyor. Fotoğraf yayımlanmadı; biraz sonra tekrar dene.');
const cache=new Map();let active=0;

export async function checkPhoto(photo,{env=process.env,fetchImpl=fetch,useCache=true}={}){
 if(!moderationEnabled(env))return {checked:false};
 if(!env.OPENAI_API_KEY?.trim())throw unavailable();
 const key=createHash('sha256').update(photo.buffer).digest('hex');
 const previous=useCache?cache.get(key):null;
 if(previous&&previous.expires>Date.now()){
  if(previous.blocked)throw new PhotoModerationError('Bu fotoğraf cinsel veya uygunsuz içerik nedeniyle kabul edilmedi. Başka bir fotoğraf seç.',422);
  return {checked:true};
 }
 if(active>=4)throw new PhotoModerationError('Fotoğraf kontrolü yoğun. Biraz bekleyip tekrar dene.',503);
 active++;
 try{
  const response=await fetchImpl('https://api.openai.com/v1/moderations',{
   method:'POST',headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY.trim()}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),
   body:JSON.stringify({model:'omni-moderation-latest',input:[{type:'image_url',image_url:{url:`data:image/jpeg;base64,${photo.buffer.toString('base64')}`}}]})
  });
  if(!response.ok)throw unavailable();
  const data=await response.json(),result=data.results?.[0];
  // Missing classifications are failures, never implicit approvals.
  const supported=['sexual','violence','violence/graphic','self-harm'];
  if(!result||typeof result.flagged!=='boolean'||supported.some(category=>typeof result.categories?.[category]!=='boolean'))throw unavailable();
  const blocked=result.flagged||supported.some(category=>result.categories[category]);
  if(useCache){if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,{blocked,expires:Date.now()+5*60000});}
  if(blocked)throw new PhotoModerationError('Bu fotoğraf cinsel veya uygunsuz içerik nedeniyle kabul edilmedi. Başka bir fotoğraf seç.',422);
  return {checked:true};
 }catch(error){if(error instanceof PhotoModerationError)throw error;throw unavailable();}
 finally{active--;}
}

export async function prepareCheckedPhoto(file,options){
 const photo=await preparePhoto(file);
 await checkPhoto(photo,options);
 return photo;
}
