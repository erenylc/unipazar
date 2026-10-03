import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {validateRegistration} from '../public/registration-validation.js';

test('Google signup can omit phone but still validates supplied phone and university',()=>{
 const user={name:'Deniz',email:'deniz@gmail.com',university:'İstanbul Teknik Üniversitesi'};
 const options={passwordRequired:false,phoneRequired:false};
 assert.deepEqual(validateRegistration(user,[user.university],options).fields,{});
 assert.ok(validateRegistration({...user,phone:'123'},[user.university],options).fields.phone);
 assert.ok(validateRegistration({...user,university:''},[user.university],options).fields.university);
 assert.ok(validateRegistration(user,[user.university]).fields.phone);
});

test('missing phone blocks selling; first phone can be added without an unusable Google password',async t=>{
 const temp=mkdtempSync(path.join(os.tmpdir(),'unisatis-google-phone-'));
 const port=34000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['server.js','--local'],{env:{...process.env,PORT:String(port),DATA_DIR:path.join(temp,'data'),UPLOAD_DIR:path.join(temp,'uploads'),LEGAL_ENABLED:'0'},stdio:'ignore'});
 t.after(async()=>{await new Promise(resolve=>{server.once('exit',resolve);server.kill();setTimeout(resolve,1500);});rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 for(let i=0;i<50;i++){try{if((await fetch(base+'/api/me')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 const registered=await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Google Öğrenci',email:'phone-test@gmail.com',university:'İstanbul Teknik Üniversitesi',phone:'05551234567',password:'initial-test-password'})});
 assert.equal(registered.status,201);
 const user=(await registered.json()).user,cookie=registered.headers.get('set-cookie').split(';')[0];
 const db=new DatabaseSync(path.join(temp,'data','unipazar.sqlite'));
 db.prepare('UPDATE users SET phone=NULL WHERE id=?').run(user.id);
 db.prepare('INSERT INTO google_accounts(sub,user_id) VALUES(?,?)').run('fixture-google-id',user.id);
 db.close();
 const me=await fetch(base+'/api/me',{headers:{cookie}});assert.equal((await me.json()).user.phone,'');
 const blocked=await fetch(base+'/api/listings',{method:'POST',headers:{cookie}});assert.equal(blocked.status,400);assert.ok((await blocked.json()).fields.phone);
 const add=await fetch(base+'/api/me/phone',{method:'PATCH',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({phone:'05559876543'})});
 assert.equal(add.status,200);assert.equal((await add.json()).user.phone,'05559876543');
 const change=await fetch(base+'/api/me/phone',{method:'PATCH',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({phone:'05551112233'})});assert.equal(change.status,403);
 const unblocked=await fetch(base+'/api/listings',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(unblocked.status,400);assert.equal((await unblocked.json()).fields,undefined);
 const listing=new FormData();
 for(const [key,value] of Object.entries({kind:'sale',title:'Ders kitabı',description:'Temiz kitap',category:'Ders kitapları',condition:'Az kullanılmış',price:'100'}))listing.set(key,value);
 listing.append('photos',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'book.png');
 const published=await fetch(base+'/api/listings',{method:'POST',headers:{cookie},body:listing});assert.equal(published.status,201);
});
