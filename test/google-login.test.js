import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyGoogleCredential} from '../google-login.js';

test('Google credentials require a verified token, matching nonce and email',async()=>{
 const payload={sub:'google-user',name:'Deniz',email:'deniz@gmail.com',email_verified:true,nonce:'expected-nonce'};
 const client={verifyIdToken:async options=>{assert.equal(options.audience,'expected-client');return {getPayload:()=>payload};}};
 const profile=await verifyGoogleCredential('signed-token','expected-client','expected-nonce',client);
 assert.equal(profile.sub,'google-user');assert.equal(profile.authoritative,true);
 await assert.rejects(verifyGoogleCredential('signed-token','expected-client','different-nonce',client));
 payload.email_verified=false;await assert.rejects(verifyGoogleCredential('signed-token','expected-client','expected-nonce',client));
 payload.email_verified=true;payload.email='deniz@example.com';assert.equal((await verifyGoogleCredential('signed-token','expected-client','expected-nonce',client)).authoritative,false);
 await assert.rejects(verifyGoogleCredential('not-a-signed-google-token','expected-client','expected-nonce'));
});
