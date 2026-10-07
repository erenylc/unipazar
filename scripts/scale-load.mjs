// Run explicitly; isolated load test never modifies live data.
import {spawn} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
function number(name,fallback,min,max){const value=Number(args[name]??fallback);if(!Number.isInteger(value)||value<min||value>max)throw new Error(`--${name} must be ${min}..${max}`);return value;}
const users=number('users',1000,2,10000),listings=number('listings',10000,1,100000),seconds=number('seconds',30,1,3600),rps=number('rps',Math.ceil(users/15),1,5000),concurrency=number('concurrency',128,1,1000);
const streamsEnabled=args.streams!=='0';
const diverseSearch=args['diverse-search']==='1';
const sharedIP=args['shared-ip']==='1';
const clientIP=user=>sharedIP?'10.0.0.1':`10.${Math.floor(user/65536)}.${Math.floor(user/256)%256}.${user%256}`;
const temp=mkdtempSync(path.join(os.tmpdir(),'unisatis-scale-'));
const port=await new Promise(resolve=>{const probe=net.createServer();probe.listen(0,'127.0.0.1',()=>{const value=probe.address().port;probe.close(()=>resolve(value));});});
const base=`http://127.0.0.1:${port}`;
const metrics=[];let serverLog='',seeded=false,cpuProfile=null;
const observer=`import {monitorEventLoopDelay} from 'node:perf_hooks';import {Session} from 'node:inspector';const profiler=new Session();profiler.connect();profiler.post('Profiler.enable');process.on('message',message=>{if(message.kind==='profile-start')profiler.post('Profiler.start');if(message.kind==='profile-stop')profiler.post('Profiler.stop',(error,result)=>{if(result)process.send?.({kind:'profile',profile:result.profile});});});const delay=monitorEventLoopDelay({resolution:10});delay.enable();setInterval(()=>{process.send?.({kind:'metrics',rss:process.memoryUsage().rss,heap:process.memoryUsage().heapUsed,loopP99Ms:delay.percentile(99)/1e6});delay.reset();},1000).unref();`;
const server=spawn(process.execPath,['--import','data:text/javascript;base64,'+Buffer.from(observer).toString('base64'),'server.js','--local'],{cwd:root,env:{...process.env,PORT:String(port),NODE_ENV:'test',DATA_DIR:path.join(temp,'data'),UPLOAD_DIR:path.join(temp,'uploads'),LEGAL_ENABLED:'0',PHOTO_MODERATION_ENABLED:'0',OPENAI_API_KEY:'',REQUIRE_CONTACT_VERIFICATION:'0',BREVO_API_KEY:'',SMTP_HOST:'',NETGSM_USERCODE:'',NETGSM_PASSWORD:''},stdio:['ignore','pipe','pipe','ipc']});
server.stdout.on('data',data=>{serverLog+=data.toString();});server.stderr.on('data',data=>{serverLog+=data.toString();});server.on('message',message=>{if(seeded&&message.kind==='metrics')metrics.push(message);if(message.kind==='profile')cpuProfile=message.profile;});
const agent=new http.Agent({keepAlive:true,maxSockets:concurrency});
const streams=[];const cookies=[];const hash=value=>createHash('sha256').update(value).digest('hex');
let db;
try{
 let ready=false;for(let i=0;i<150;i++){if(server.exitCode!==null)throw new Error(serverLog);try{if((await fetch(base+'/api/me')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}if(!ready)throw new Error('Local server did not start: '+serverLog);
 db=new DatabaseSync(path.join(temp,'data','unipazar.sqlite'));db.exec('PRAGMA foreign_keys=ON;BEGIN');
 const insertUser=db.prepare('INSERT INTO users(id,name,email,password_hash,university,campus,email_verified,phone) VALUES(?,?,?,?,?,?,1,?)');
 const insertSession=db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)');
 for(let id=1;id<=users;id++){const token=`scale-only-${id}`;cookies.push(`up_session=${token}`);insertUser.run(id,`Synthetic user ${id}`,`scale${id}@example.invalid`,'not-a-login-password','İstanbul Teknik Üniversitesi','','05551234567');insertSession.run(hash(token),id,Date.now()+86400000);}
 const insertListing=db.prepare("INSERT INTO listings(id,seller_id,kind,title,description,category,condition,price,university,campus) VALUES(?,?,'sale',?,?,'Ders kitapları','İyi',10000,'İstanbul Teknik Üniversitesi','')");
 const insertImage=db.prepare('INSERT INTO listing_images(listing_id,filename,position) VALUES(?,?,0)');
 for(let id=1;id<=listings;id++){insertListing.run(id,(id%users)+1,`Matematik ders kitabı ${id}`,'İkinci el ders kitabı, temiz durumda.');insertImage.run(id,'00000000000000000000000000000000.jpg');}
 const insertConversation=db.prepare('INSERT INTO conversations(id,listing_id,buyer_id,seller_id) VALUES(?,?,?,?)');
 const insertMessage=db.prepare('INSERT INTO messages(conversation_id,sender_id,body,read_at) VALUES(?,?,?,?)');
 for(let id=1;id<=users;id++){const listing=(id-1)%listings+1,seller=(listing%users)+1;insertConversation.run(id,listing,id,seller);for(let i=0;i<10;i++)insertMessage.run(id,i%2?id:seller,'Synthetic load test message',i<8?Date.now():null);}
 db.exec('COMMIT');db.close();db=null;seeded=true;
 const sseStats={requested:streamsEnabled?users:0,connected:0,active:0,errors:0,events:0};
 if(streamsEnabled){
  let next=0;
  await Promise.all(Array.from({length:Math.min(40,users)},async()=>{while(next<users){const user=next++;await new Promise(resolve=>{
   const request=http.get(base+'/api/message-events',{agent:false,headers:{cookie:cookies[user],'X-Forwarded-For':clientIP(user)}},response=>{
    if(response.statusCode!==200){sseStats.errors++;response.resume();resolve();return;}
    request.setTimeout(0);sseStats.connected++;sseStats.active++;let buffer='';response.on('data',chunk=>{buffer+=chunk.toString();const frames=buffer.split('\n\n');buffer=frames.pop();for(const frame of frames)if(frame.startsWith('data: '))sseStats.events++;});response.once('close',()=>sseStats.active--);response.on('error',()=>sseStats.errors++);resolve();
   });streams.push(request);request.setTimeout(20000,()=>request.destroy(new Error('connection timeout')));request.on('error',()=>{sseStats.errors++;resolve();});
  });}}));
 }
 const latency=[],status={},errors={},byRoute={};let completed=0,inflight=0,dropped=0,sequence=0;
 function issue(){
  if(inflight>=concurrency){dropped++;return;}inflight++;
  const n=sequence++,user=n%users,id=user+1,bucket=n%20;
  let url,body,route;
  if(bucket<8){url='/api/listings?kind=sale';route='browse';}
  else if(bucket<11){url='/api/unread-count';route='unread';}
  else if(bucket<14){url='/api/conversations';route='conversations';}
  else if(bucket<17){url=`/api/conversations/${id}/messages`;route='messages';}
  else if(bucket===17){url='/api/listings?kind=sale&q='+encodeURIComponent(diverseSearch?`matematik ${((Math.floor(n/20)*37)%listings)+1}`:'matematik');route='search';}
  else if(bucket===18){url=`/api/conversations/${id}/messages`;body=JSON.stringify({body:'Synthetic load-test message'});route='send';}
  else{url=`/api/listings/${(user%listings)+1}/offers`;body=JSON.stringify({amount:80});route='offer';}
  const start=performance.now();let settled=false;
  const finish=(code,error)=>{if(settled)return;settled=true;inflight--;completed++;const elapsed=performance.now()-start;latency.push(elapsed);const rows=byRoute[route]||={latency:[],errors:0};rows.latency.push(elapsed);status[code]=(status[code]||0)+1;if(error||code>=400){rows.errors++;const key=error||String(code);errors[key]=(errors[key]||0)+1;}};
  const request=http.request(base+url,{agent,method:body?'POST':'GET',headers:{cookie:cookies[user],'X-Forwarded-For':clientIP(user),...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{})}},response=>{response.resume();response.on('end',()=>finish(response.statusCode));});
  request.setTimeout(15000,()=>request.destroy(new Error('request timeout')));request.on('error',error=>finish(0,error.code||error.message));request.end(body);
 }
 console.log(`Testing isolated local service: ${users} users, ${listings} listings, ${rps} requests/sec, ${sseStats.connected} SSE connections.`);
 if(args.profile==='1')server.send({kind:'profile-start'});
 const start=performance.now();let scheduled=0;
 const timer=setInterval(()=>{const due=Math.min(rps*seconds,Math.floor((performance.now()-start)*rps/1000));while(scheduled<due){scheduled++;issue();}},10);
 await new Promise(resolve=>setTimeout(resolve,seconds*1000));clearInterval(timer);
 while(scheduled<rps*seconds){scheduled++;issue();}
 while(inflight)await new Promise(resolve=>setTimeout(resolve,50));
 if(args.profile==='1'&&server.connected){server.send({kind:'profile-stop'});const deadline=performance.now()+2000;while(!cpuProfile&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));}
 if(cpuProfile){const nodes=new Map(cpuProfile.nodes.map(node=>[node.id,node])),parents=new Map(),times=new Map();for(const node of cpuProfile.nodes)for(const id of node.children||[])parents.set(id,node.id);cpuProfile.samples.forEach((id,index)=>times.set(id,(times.get(id)||0)+(cpuProfile.timeDeltas[index]||0)));console.log('CPU profile:',[...times].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([id,time])=>({function:nodes.get(id).callFrame.functionName,line:nodes.get(id).callFrame.lineNumber+1,parent:nodes.get(parents.get(id))?.callFrame.functionName,parentLine:(nodes.get(parents.get(id))?.callFrame.lineNumber??-1)+1,ms:Math.round(time/1000)})));}
 const percentile=(items,p)=>items.length?[...items].sort((a,b)=>a-b)[Math.min(items.length-1,Math.floor(items.length*p))]:0;
 const routes=Object.fromEntries(Object.entries(byRoute).map(([name,rows])=>[name,{requests:rows.latency.length,errors:rows.errors,p95Ms:Math.round(percentile(rows.latency,.95)),p99Ms:Math.round(percentile(rows.latency,.99))}]));
 const expectedEvents=streamsEnabled?2*((byRoute.send?.latency.length||0)+(byRoute.offer?.latency.length||0)):0;
 const validationDB=new DatabaseSync(path.join(temp,'data','unipazar.sqlite'),{readOnly:true});
 const persistedMessages=validationDB.prepare('SELECT COUNT(*) AS count FROM messages').get().count;
 const persistedOffers=validationDB.prepare('SELECT COUNT(*) AS count FROM offers').get().count;validationDB.close();
 const expectedMessages=users*10+(byRoute.send?.latency.length||0)+(byRoute.offer?.latency.length||0);
 const integrity={persistedMessages,expectedMessages,persistedOffers,expectedOffers:byRoute.offer?.latency.length||0};
 const eventDeadline=performance.now()+1000;while(streamsEnabled&&sseStats.events<expectedEvents&&performance.now()<eventDeadline)await new Promise(resolve=>setTimeout(resolve,20));
 const report={at:new Date().toISOString(),node:process.version,host:{cpu:os.cpus()[0]?.model,cores:os.availableParallelism(),ramGB:Math.round(os.totalmem()/1024**3)},scope:'isolated loopback API test; not production, not browser/device smoothness or end-to-end SMS/image processing',config:{users,listings,messagesSeeded:users*10,seconds,rps,concurrency,diverseSearch,sharedIP},integrity,sse:{...sseStats,expectedEvents},http:{scheduled,completed,dropped,status,errors,p95Ms:Math.round(percentile(latency,.95)),p99Ms:Math.round(percentile(latency,.99))},routes,server:{peakRssMB:Math.round(Math.max(0,...metrics.map(row=>row.rss))/1024**2),peakLoopP99Ms:Math.round(Math.max(0,...metrics.map(row=>row.loopP99Ms)))},gate:{passes:integrity.persistedMessages===integrity.expectedMessages&&integrity.persistedOffers===integrity.expectedOffers&&completed>0&&dropped===0&&Object.keys(errors).length===0&&sseStats.errors===0&&(!streamsEnabled||(sseStats.active===users&&sseStats.events>=expectedEvents))&&percentile(latency,.95)<500,definition:'no HTTP/SSE errors, missing notifications or dropped offered load; all SSE streams remain active; p95 API latency below 500ms'}};
 const output=path.resolve(root,args.output||'scale-results/local-latest.json');mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 if(!report.gate.passes)process.exitCode=2;
}finally{
 db?.close();for(const stream of streams)stream.destroy();agent.destroy();server.kill();await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,1500);});
 // mkdtemp creates a known dedicated directory; never delete user data directories.
 if(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(temp).startsWith('unisatis-scale-'))rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
