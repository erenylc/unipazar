import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefreshQueue} from '../public/live-refresh.js';
const wait=()=>new Promise(resolve=>setTimeout(resolve,15));
test('slow refreshes still finish under continuous events and fetch only one follow-up',async t=>{
 let calls=0,active=0,peak=0,release;
 const blocked=new Promise(resolve=>release=resolve);
 const queue=createRefreshQueue(async()=>{calls++;active++;peak=Math.max(peak,active);if(calls===1)await blocked;active--;},{delayMs:0});t.after(()=>queue.cancel());
 queue.request();await wait();for(let i=0;i<1000;i++)queue.request();await wait();assert.equal(calls,1);release();await wait();assert.equal(calls,2);assert.equal(peak,1);await wait();assert.equal(calls,2);
});
test('failed refreshes release the queue and cancellation discards stale pending work',async t=>{
 let calls=0,errors=0;const queue=createRefreshQueue(async()=>{calls++;if(calls===1)throw new Error('temporary failure');},{delayMs:0,onError:()=>errors++});t.after(()=>queue.cancel());queue.request();await wait();queue.request();await wait();assert.equal(calls,2);assert.equal(errors,1);queue.request();queue.cancel();await wait();assert.equal(calls,2);
});
