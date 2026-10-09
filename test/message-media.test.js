import test from 'node:test';import assert from 'node:assert/strict';
import {messagePhotoURL,clearMessageMedia} from '../public/message-media.js';
test('private photo cache deduplicates requests, bounds concurrent downloads and separates accounts',async()=>{
 const original=globalThis.fetch;let calls=0,active=0,peak=0;
 globalThis.fetch=async (_url,options)=>{assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');calls++;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,8));active--;return {ok:true,blob:async()=>new Blob(['synthetic'],{type:'image/png'})};};
 try{const first=await Promise.all([messagePhotoURL(1,10),messagePhotoURL(1,10)]);assert.equal(first[0],first[1]);assert.equal(calls,1);await Promise.all(Array.from({length:9},(_,i)=>messagePhotoURL(i+2,10)));assert.ok(peak<=3);const old=first[0],fresh=await messagePhotoURL(1,20);assert.notEqual(old,fresh);assert.equal(calls,11);}finally{clearMessageMedia();globalThis.fetch=original;}
});
