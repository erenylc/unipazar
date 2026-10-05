import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

test('direct uploads cannot bypass photo checks or overwrite an approved profile/listing',async t=>{
 const temp=mkdtempSync(path.join(os.tmpdir(),'unisatis-moderation-'));
 const port=33500+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
 const sharpUrl=pathToFileURL(createRequire(import.meta.url).resolve('sharp')).href;
 // Synthetic solid colours exercise provider outcomes; no inappropriate images.
 const fixture=`import sharp from ${JSON.stringify(sharpUrl)};globalThis.fetch=async(url,options)=>{if(url!=='https://api.openai.com/v1/moderations')throw new Error('unexpected provider');const body=JSON.parse(options.body);const buffer=Buffer.from(body.input[0].image_url.url.split(',')[1],'base64');const stats=await sharp(buffer).stats();const reject=stats.channels[0].mean>200;const outage=stats.channels[1].mean>200;if(outage)return new Response('',{status:503});return Response.json({results:[{flagged:reject,categories:{sexual:reject,violence:false,'violence/graphic':false,'self-harm':false}}]});};`;
 const server=spawn(process.execPath,['--import','data:text/javascript;base64,'+Buffer.from(fixture).toString('base64'),'server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:path.join(temp,'data'),UPLOAD_DIR:path.join(temp,'uploads'),NODE_ENV:'test',TEST_EMAIL_CODES:'1',LEGAL_ENABLED:'0',OPENAI_API_KEY:'test-only',PHOTO_MODERATION_ENABLED:'1',BREVO_API_KEY:'',SMTP_HOST:''},stdio:'ignore'});
 let db;
 t.after(async()=>{db?.close();server.kill();await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,1500);});rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 let ready=false;for(let i=0;i<150;i++){try{if((await fetch(base+'/api/me')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready,'test server started');
 let cookie='';
 async function request(url,body,method='POST'){
  const headers={cookie};if(body&&!(body instanceof FormData))headers['Content-Type']='application/json';
  const response=await fetch(base+url,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  return {status:response.status,data:await response.json()};
 }
 const registered=await request('/api/register',{name:'Deneme Kullanıcı',email:'moderation@example.com',phone:'05551234567',password:'test-password-123',university:'İstanbul Teknik Üniversitesi'});
 assert.equal(registered.status,201);
 const verified=await request('/api/verify-email',{email:'moderation@example.com',code:registered.data.devCode});assert.equal(verified.status,200);
 const images={};for(const [name,background] of Object.entries({allow:'#0000ff',reject:'#ff0000',outage:'#00ff00'}))images[name]=await sharp({create:{width:40,height:40,channels:3,background}}).jpeg().toBuffer();
 function form(kind,field='photos'){
  const body=new FormData();body.append(field,new Blob([images[kind]],{type:'image/jpeg'}),'photo.jpg');
  if(field==='photos')for(const [key,value] of Object.entries({kind:'sale',title:'Test kitap',description:'İyi durumda ders kitabı',category:'Ders kitapları',condition:'İyi',price:'100'}))body.set(key,value);
  return body;
 }
 assert.equal((await request('/api/photos/check',form('reject','photo'))).status,422);
 assert.equal((await request('/api/listings',form('reject'))).status,422);
 assert.equal((await request('/api/listings',form('outage'))).status,503);
 assert.equal((await request('/api/me/avatar',form('reject','photo'))).status,422);
 db=new DatabaseSync(path.join(temp,'data','unipazar.sqlite'));
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM listings').get().n,0);
 assert.equal(readdirSync(path.join(temp,'uploads')).length,0);
 assert.equal(readdirSync(path.join(temp,'data','profile-photos')).length,0);
 const created=await request('/api/listings',form('allow'));assert.equal(created.status,201);
 const id=created.data.id,oldPhoto=db.prepare('SELECT filename FROM listing_images WHERE listing_id=?').get(id).filename;
 const edit=form('reject');edit.set('keepPhotos','[]');edit.set('title','Must not persist');
 assert.equal((await request('/api/listings/'+id,edit,'PATCH')).status,422);
 assert.equal(db.prepare('SELECT title FROM listings WHERE id=?').get(id).title,'Test kitap');
 assert.equal(db.prepare('SELECT filename FROM listing_images WHERE listing_id=?').get(id).filename,oldPhoto);
 const avatar=await request('/api/me/avatar',form('allow','photo'));assert.equal(avatar.status,200);
 assert.equal((await request('/api/me/avatar',form('outage','photo'))).status,503);
 assert.equal((await request('/api/me/avatar',form('reject','photo'))).status,422);
 const current=await request('/api/me',undefined,'GET');assert.equal(current.data.user.avatarUrl,avatar.data.user.avatarUrl);
 assert.equal(readdirSync(path.join(temp,'data','profile-photos')).length,1);
});
