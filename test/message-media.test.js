import test from 'node:test';import assert from 'node:assert/strict';
import {messagePhotoURL,clearMessageMedia,mountVoicePreview,clearVoicePreview} from '../public/message-media.js';
test('private photo cache deduplicates requests, bounds concurrent downloads and separates accounts',async()=>{
 const original=globalThis.fetch;let calls=0,active=0,peak=0;
 globalThis.fetch=async (_url,options)=>{assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');calls++;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,8));active--;return {ok:true,blob:async()=>new Blob(['synthetic'],{type:'image/png'})};};
 try{const first=await Promise.all([messagePhotoURL(1,10),messagePhotoURL(1,10)]);assert.equal(first[0],first[1]);assert.equal(calls,1);await Promise.all(Array.from({length:9},(_,i)=>messagePhotoURL(i+2,10)));assert.ok(peak<=3);const old=first[0],fresh=await messagePhotoURL(1,20);assert.notEqual(old,fresh);assert.equal(calls,11);}finally{clearMessageMedia();globalThis.fetch=original;}
});
test('voice preview uses the local recording and keeps playback when its controls are redrawn',async()=>{
 const original=globalThis.Audio,instances=[];
 class TestAudio{
  constructor(){this.paused=true;this.currentTime=0;this.duration=2;this.playbackRate=1;this.events=new Map();instances.push(this);}
  addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);}
  removeEventListener(name,fn){this.events.get(name)?.delete(fn);}
  emit(name){for(const fn of this.events.get(name)||[])fn();}
  async play(){this.paused=false;this.emit('play');}
  pause(){this.paused=true;this.emit('pause');}
  getAttribute(name){return name==='src'?this.src:null;}
  removeAttribute(name){if(name==='src')this.src='';}
 }
 const node=()=>({listeners:new Map(),classList:{toggle(){}},addEventListener(name,fn){this.listeners.set(name,fn);},setAttribute(name,value){this[name]=value;}});
 const view=()=>{const nodes=new Map(['.voice-play','.voice-seek','.voice-speed','.voice-time'].map(name=>[name,node()]));return {nodes,classList:{toggle(){}},querySelector:name=>nodes.get(name),querySelectorAll:()=>[]};};
 globalThis.Audio=TestAudio;
 try{const first=view();mountVoicePreview(first,'blob:local-recording');await first.nodes.get('.voice-play').listeners.get('click')();assert.equal(instances[0].src,'blob:local-recording');assert.equal(instances[0].paused,false);const second=view();mountVoicePreview(second,'blob:local-recording');assert.equal(instances.length,1);assert.equal(instances[0].paused,false);assert.equal(second.nodes.get('.voice-play')['aria-label'],'Sesli mesajı duraklat');assert.equal(instances[0].events.get('timeupdate').size,1);clearVoicePreview();assert.equal(instances[0].paused,true);assert.equal(instances[0].src,'');}finally{clearMessageMedia();globalThis.Audio=original;}
});
