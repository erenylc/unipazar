import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createMessageHub} from '../message-hub.js';
function client(){const request=new EventEmitter(),response=new EventEmitter();Object.assign(response,{writes:[],allow:true,write(value){this.writes.push(value);return this.allow;},end(){this.writableEnded=true;this.emit('close');},destroy(){this.destroyed=true;this.emit('close');}});return {request,response};}
test('slow message clients coalesce notifications and release resources on close',()=>{
 let now=100;const hub=createMessageHub({clock:()=>now});
 try{const {request,response}=client();hub.add(1,request,response);response.allow=false;hub.notify({id:1,buyer_id:1,seller_id:2},2);const count=response.writes.length;for(let i=0;i<1000;i++)hub.notify({id:i,buyer_id:1,seller_id:2},2);assert.equal(response.writes.length,count);response.allow=true;response.emit('drain');assert.equal(response.writes.at(-1),'data: {"resync":true}\n\n');request.emit('close');assert.equal(hub.size,0);assert.equal(hub.streams.size,0);}finally{hub.close();}
});
test('connection bounds and stalled clients cannot retain unbounded buffers',()=>{
 let now=100;const hub=createMessageHub({maxConnections:2,maxPerUser:1,clock:()=>now});
 try{const first=client(),second=client(),third=client();assert.equal(hub.add(1,first.request,first.response),true);assert.equal(hub.add(1,second.request,second.response),false);assert.equal(hub.add(2,second.request,second.response),true);assert.equal(hub.add(3,third.request,third.response),false);first.response.allow=false;hub.notify({id:1,buyer_id:1,seller_id:2},2);now+=61000;hub.heartbeat();assert.equal(first.response.destroyed,true);assert.equal(hub.size,1);}finally{hub.close();}
});
