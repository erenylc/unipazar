import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('install manifest points to usable PNG icons and the same app',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'/#/');
 for(const icon of manifest.icons){
  const png=await fs.readFile(new URL('../public'+icon.src,import.meta.url));
  assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,icon.sizes);
 }
});

test('offline worker never intercepts private APIs or uploaded media',async()=>{
 const listeners={};
 const cached=[];
 const fallback={offline:true};
 const context=vm.createContext({URL,self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>listeners[name]=fn,clients:{claim:async()=>{}}},caches:{open:async()=>({add:async url=>cached.push(url)}),match:async()=>fallback},fetch:async()=>{throw new Error('offline');}});
 vm.runInContext(await fs.readFile(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 let install;
 listeners.install({waitUntil:promise=>install=promise});await install;
 assert.deepEqual(cached,['/offline.html']);
 for(const path of ['/api/me','/api/conversations','/uploads/photo.jpg']){
  for(const mode of ['navigate','cors'])listeners.fetch({request:{url:'https://example.test'+path,method:'GET',mode},respondWith:()=>assert.fail('Private request intercepted')});
 }
 listeners.fetch({request:{url:'https://example.test/api/listings',method:'POST',mode:'cors'},respondWith:()=>assert.fail('Write intercepted')});
 let response;
 listeners.fetch({request:{url:'https://example.test/',method:'GET',mode:'navigate'},respondWith:promise=>response=promise});
 assert.equal(await response,fallback);
});

test('Android Digital Asset Links serves the configured signing fingerprint',async t=>{
 const temp=mkdtempSync(path.join(os.tmpdir(),'unisatis-assetlinks-'));
 const port=33000+Math.floor(Math.random()*1000);
 const fingerprint=Array(32).fill('AB').join(':');
 const server=spawn(process.execPath,['server.js'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(port),DATA_DIR:path.join(temp,'data'),UPLOAD_DIR:path.join(temp,'uploads'),PLAY_APP_SIGNING_SHA256:fingerprint,NODE_ENV:'test'},
  stdio:'ignore'
 });
 t.after(async()=>{
  await new Promise(resolve=>{server.once('exit',resolve);server.kill();setTimeout(resolve,1500);});
  rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 });
 let response;
 for(let i=0;i<50;i++){
  try {response=await fetch(`http://127.0.0.1:${port}/.well-known/assetlinks.json`);break;} catch {}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(response,'server did not start');
 assert.equal(response.status,200);
 const [statement]=await response.json();
 assert.deepEqual(statement.relation,['delegate_permission/common.handle_all_urls']);
 assert.equal(statement.target.package_name,'com.unisatis.app');
 assert.ok(statement.target.sha256_cert_fingerprints.includes(fingerprint));
 assert.ok(statement.target.sha256_cert_fingerprints.includes('74:98:7F:18:19:17:39:56:26:D6:96:AF:1A:9E:B6:C9:F2:BC:DA:F6:D7:57:0E:9A:EF:86:4E:18:F8:94:44:E9'));
 const contact=await fetch(`http://127.0.0.1:${port}/api/public-contact`);
 assert.equal(contact.status,200);
 assert.deepEqual(await contact.json(),{email:'unisatis06@gmail.com'});
 const deletionPage=await fetch(`http://127.0.0.1:${port}/delete-account.html`);
 assert.equal(deletionPage.status,200);
 assert.match(await deletionPage.text(),/unisatis06@gmail\.com/);
});
