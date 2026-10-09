import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
test('feed cursors return all public items without duplicates and preserve privacy and sort order',async t=>{
 const temp=mkdtempSync(path.join(os.tmpdir(),'unisatis-pages-')),port=35500+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['server.js','--local'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),NODE_ENV:'test',DATA_DIR:path.join(temp,'data'),UPLOAD_DIR:path.join(temp,'uploads'),BACKUP_ENABLED:'0'},stdio:'ignore'});let db;
 t.after(async()=>{db?.close();server.kill();await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,1500);});rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 let ready=false;for(let i=0;i<150;i++){try{if((await fetch(base+'/api/me')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready);
 db=new DatabaseSync(path.join(temp,'data','unipazar.sqlite'));db.exec("INSERT INTO users(id,name,email,password_hash,university,campus) VALUES(1,'Synthetic seller','pages@example.invalid','unused','İstanbul Teknik Üniversitesi','');");
 const insert=db.prepare("INSERT INTO listings(id,seller_id,kind,title,description,category,condition,price,university,campus) VALUES(?,1,?,'Ders kitabı','Temiz kitap','Ders kitapları','İyi',?,'İstanbul Teknik Üniversitesi','')");
 db.exec('BEGIN');for(let id=1;id<=60;id++)insert.run(id,'sale',(id%7)*100);insert.run(100,'donation',0);db.exec('COMMIT');
 for(const sort of ['newest','oldest','price-asc','price-desc']){
  let cursor=null;const ids=[],prices=[];
  do{const params=new URLSearchParams({sort});if(cursor)params.set('after',cursor);const response=await fetch(base+'/api/listings?'+params);assert.equal(response.status,200);const data=await response.json();assert.ok(data.listings.length<=24);for(const row of data.listings){ids.push(row.id);prices.push(row.price);assert.equal(row.kind,'sale');}cursor=data.page.nextCursor;}while(cursor);
  assert.equal(ids.length,60);assert.equal(new Set(ids).size,60);assert.ok(!ids.includes(100));
  if(sort==='newest')assert.deepEqual(ids,Array.from({length:60},(_,i)=>60-i));if(sort==='oldest')assert.deepEqual(ids,Array.from({length:60},(_,i)=>i+1));
  if(sort.startsWith('price'))assert.deepEqual(prices,[...prices].sort((a,b)=>sort==='price-asc'?a-b:b-a));
 }
 assert.equal((await fetch(base+'/api/listings?after=invalid')).status,400);
 assert.equal((await fetch(base+'/api/listings?limit=0')).status,400);
 db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update('campus-preview').digest('hex'),1,Date.now()+600000);
 db.exec("INSERT INTO users(id,name,email,password_hash,university,campus) VALUES(2,'Other campus seller','other@example.invalid','unused','Munzur Üniversitesi',''); INSERT INTO listings(id,seller_id,kind,title,description,category,condition,price,university,campus) VALUES(200,2,'sale','Other university book','Clean','Ders kitapları','İyi',10000,'Munzur Üniversitesi',''),(201,2,'donation','Private gift','Clean','Ders kitapları','İyi',0,'Munzur Üniversitesi','');");
 const headers={cookie:'up_session=campus-preview'};
 const all=(await (await fetch(base+'/api/listings?kind=sale',{headers})).json()).listings;
 assert.ok(all.some(row=>row.university==='Munzur Üniversitesi'));assert.ok(all.some(row=>row.university==='İstanbul Teknik Üniversitesi'));assert.ok(!all.some(row=>row.kind==='donation'));
 const campus=(await (await fetch(base+'/api/listings?kind=sale&university='+encodeURIComponent('Munzur Üniversitesi'),{headers})).json()).listings;
 assert.deepEqual(campus.map(row=>row.id),[200]);
});
