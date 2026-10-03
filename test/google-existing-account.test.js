import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';

test('Google login resolves existing accounts without registering again',async()=>{
 const source=await fs.readFile(new URL('../server.js',import.meta.url),'utf8');
 const start=source.indexOf("app.post('/api/auth/google',");
 const handlerSource=source.slice(start,source.indexOf("app.get('/api/universities'",start));
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,email_verified INTEGER,closed_at TEXT);CREATE TABLE google_accounts(sub TEXT PRIMARY KEY,user_id INTEGER);CREATE TABLE verification_codes(user_id INTEGER);');
 db.prepare('INSERT INTO users VALUES(1,?,0,NULL)').run('student@gmail.com');
 db.prepare('INSERT INTO verification_codes VALUES(1)').run();
 let handler,sessionId,profile={sub:'google-student',email:'student@gmail.com',authoritative:true};
 const challenges=new Map();
 const context=vm.createContext({db,app:{post:(_path,_limit,fn)=>handler=fn},authLimit:()=>{},wrap:fn=>fn,hash:key=>key,cookieValue:()=> 'challenge',googleChallenges:challenges,googleSignups:new Map(),googleClientId:'client',verifyGoogleCredential:async()=>profile,setSession:(_res,id)=>sessionId=id,publicUser:user=>user,fail:(res,status,error)=>res.status(status).json({error}),randomBytes:()=>({toString:()=> 'signup-token'}),temporaryCookie:()=>{}});
 vm.runInContext(handlerSource,context);
 async function login(){
  sessionId=null;challenges.set('challenge',{nonce:'nonce',expires:Date.now()+60000});
  const result={status:200,body:null};
  const res={clearCookie:()=>{},set(){return this;},status(code){result.status=code;return this;},json(body){result.body=body;return this;}};
  await handler({body:{credential:'verified-by-test-double'}},res);return result;
 }
 const existing=await login();assert.equal(existing.status,200);assert.equal(sessionId,1);assert.equal(existing.body.user.id,1);assert.equal(existing.body.user.email_verified,1);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM verification_codes').get().n,0);
 assert.equal(db.prepare('SELECT user_id FROM google_accounts WHERE sub=?').get(profile.sub).user_id,1);
 const repeat=await login();assert.equal(repeat.body.user.id,1);assert.equal(sessionId,1);
 db.prepare('INSERT INTO users VALUES(2,?,1,NULL)').run('other@example.com');
 profile={sub:'external-google',email:'other@example.com',authoritative:false};assert.equal((await login()).status,409);assert.equal(sessionId,null);
 profile={sub:'new-google',email:'new@gmail.com',name:'Yeni',authoritative:true};const fresh=await login();assert.equal(fresh.body.profile.email,'new@gmail.com');assert.equal(sessionId,null);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,2);
 db.prepare('UPDATE users SET closed_at=? WHERE id=1').run('2026-10-03');profile={sub:'google-student',email:'student@gmail.com',authoritative:true};assert.equal((await login()).status,403);assert.equal(sessionId,null);
 db.close();
});
