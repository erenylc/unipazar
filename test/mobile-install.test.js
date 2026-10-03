import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

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
