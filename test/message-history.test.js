import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('large conversations show newest messages, page older ones without gaps and preserve cleared/private history',async t=>{
 const temp=mkdtempSync(path.join(os.tmpdir(),'unisatis-history-')),port=37500+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['server.js','--local'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),NODE_ENV:'test',DATA_DIR:path.join(temp,'data'),UPLOAD_DIR:path.join(temp,'uploads'),BACKUP_ENABLED:'0',REQUIRE_CONTACT_VERIFICATION:'0'},stdio:'ignore'});let db;
 t.after(async()=>{db?.close();server.kill();await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,1500);});rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 let ready=false;for(let i=0;i<150;i++){try{if((await fetch(base+'/api/me')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready);
 db=new DatabaseSync(path.join(temp,'data','unipazar.sqlite'));db.exec('BEGIN');
 for(let id=1;id<=3;id++){db.prepare('INSERT INTO users(id,name,email,password_hash,university,campus,email_verified,phone) VALUES(?,?,?,?,?,?,1,?)').run(id,'Synthetic user '+id,`history${id}@example.invalid`,'unused','İstanbul Teknik Üniversitesi','','05551234567');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update('history-'+id).digest('hex'),id,Date.now()+600000);}
 db.exec("INSERT INTO listings(id,seller_id,kind,title,description,category,condition,price,university,campus) VALUES(1,2,'sale','Kitap','Temiz kitap','Ders kitapları','İyi',1000,'İstanbul Teknik Üniversitesi','');INSERT INTO conversations(id,listing_id,buyer_id,seller_id) VALUES(1,1,1,2)");
 const insert=db.prepare('INSERT INTO messages(conversation_id,sender_id,body) VALUES(1,2,?)');for(let i=1;i<=650;i++)insert.run('Message '+i);db.exec('COMMIT');
 async function request(url,user=1,body){const response=await fetch(base+url,{headers:{cookie:'up_session=history-'+user,...(body?{'Content-Type':'application/json'}:{})},method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
 let page=await request('/api/conversations/1/messages');assert.equal(page.status,200);assert.equal(page.data.messages.length,200);assert.equal(page.data.messages[0].body,'Message 451');assert.equal(page.data.messages.at(-1).body,'Message 650');
 const ids=page.data.messages.map(row=>row.id);while(page.data.page.hasOlder){page=await request('/api/conversations/1/messages?before='+page.data.page.before);assert.ok(page.data.messages.length<=200);ids.push(...page.data.messages.map(row=>row.id));}
 assert.equal(ids.length,650);assert.equal(new Set(ids).size,650);
 assert.equal((await request('/api/conversations/1/messages',3)).status,404);
 assert.equal((await request('/api/conversations/1/messages?before=invalid')).status,400);
 assert.equal((await request('/api/conversations/1/messages',2,{body:'Newest message'})).status,201);
 assert.equal((await request('/api/conversations/1/messages')).data.messages.at(-1).body,'Newest message');
 await request('/api/conversations/1/clear',1,{confirmation:true});
 assert.equal((await request('/api/conversations/1/messages?before=500')).data.messages.length,0);
 await request('/api/conversations/1/messages',2,{body:'After clear'});
 const cleared=await request('/api/conversations/1/messages');assert.deepEqual(cleared.data.messages.map(row=>row.body),['After clear']);
 assert.equal((await request('/api/conversations/1/messages',2)).data.messages.length,200);
});
