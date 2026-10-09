import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('seller phone policy blocks direct publishing and reactivation even when SMS is not configured',async t=>{
 const temp=mkdtempSync(path.join(os.tmpdir(),'unisatis-seller-phone-')),port=39900+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['server.js','--local'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),NODE_ENV:'test',DATA_DIR:path.join(temp,'data'),UPLOAD_DIR:path.join(temp,'uploads'),BACKUP_ENABLED:'0',REQUIRE_SELLER_PHONE_VERIFICATION:'1',REQUIRE_CONTACT_VERIFICATION:'0'},stdio:'ignore'});let db;
 t.after(async()=>{db?.close();server.kill();await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,1500);});rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 let ready=false;for(let i=0;i<150;i++){try{if((await fetch(base+'/api/me')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready);
 db=new DatabaseSync(path.join(temp,'data','unipazar.sqlite'));db.exec("INSERT INTO users(id,name,email,password_hash,university,campus,email_verified,phone,phone_verified) VALUES(1,'Seller','seller@example.invalid','unused','Munzur Üniversitesi','',1,'05551234567',0); INSERT INTO listings(id,seller_id,kind,title,description,category,condition,price,university,campus) VALUES(1,1,'sale','Book','Used','Ders kitapları','İyi',1000,'Munzur Üniversitesi','');");
 db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update('seller-phone').digest('hex'),1,Date.now()+600000);
 async function request(url,method='GET',body){const r=await fetch(base+url,{method,headers:{cookie:'up_session=seller-phone','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 assert.equal((await request('/api/me')).data.sellerPhoneVerificationRequired,true);
 const blocked=await request('/api/listings','POST',{});assert.equal(blocked.status,403);assert.equal(blocked.data.verificationRequired,'phone');
 assert.equal((await request('/api/listings/1','PATCH',{status:'active'})).status,403);
 db.exec('UPDATE users SET phone_verified=1 WHERE id=1');assert.equal((await request('/api/listings','POST',{})).status,400);
 db.exec('UPDATE users SET phone_verified=0 WHERE id=1');assert.equal((await request('/api/listings','POST',{})).status,403);
});
