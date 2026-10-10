import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {DatabaseSync,backup as sqliteBackup} from 'node:sqlite';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {createMetricBuffer} from './metric-buffer.js';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function createBackup({db,dataDir,uploadDir,backupDir=path.join(dataDir,'backups')}){
 const root=path.resolve(backupDir);await fs.mkdir(root,{recursive:true,mode:0o700});const name=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(3).toString('hex'),folder=path.join(root,'.pending-'+name);
 if(!folder.startsWith(root+path.sep))throw new Error('Invalid backup path');await fs.mkdir(folder,{mode:0o700});let snapshot;
 try{
  const database=path.join(folder,'data/unipazar.sqlite');await fs.mkdir(path.dirname(database),{recursive:true});await sqliteBackup(db,database,{rate:100});snapshot=new DatabaseSync(database,{readOnly:true});
  if(snapshot.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Snapshot integrity failed');
  const entries=[{source:database,target:'data/unipazar.sqlite'}];
  const add=(rows,key,sourceRoot,targetRoot)=>{for(const row of rows){const filename=row[key];if(!filename)continue;if(path.basename(filename)!==filename)throw new Error('Unsafe media path');entries.push({source:path.join(sourceRoot,filename),target:targetRoot+'/'+filename});}};
  add(snapshot.prepare('SELECT filename FROM listing_images').all(),'filename',uploadDir,'uploads');
  add(snapshot.prepare('SELECT avatar_filename FROM users WHERE avatar_filename IS NOT NULL').all(),'avatar_filename',path.join(dataDir,'profile-photos'),'data/profile-photos');
  add(snapshot.prepare('SELECT photo_filename,voice_filename FROM messages').all(),'photo_filename',path.join(dataDir,'message-photos'),'data/message-photos');
  add(snapshot.prepare('SELECT voice_filename FROM messages').all(),'voice_filename',path.join(dataDir,'message-voice'),'data/message-voice');snapshot.close();snapshot=null;
  const files=[];for(const entry of [...new Map(entries.map(e=>[e.target,e])).values()]){const target=path.join(folder,entry.target);if(target!==entry.source){await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(entry.source,target);}const bytes=await fs.readFile(target);files.push({path:entry.target,sha256:digest(bytes),size:bytes.length});}
  const manifest={version:1,created_at:new Date().toISOString(),files};await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});const completed=path.join(root,name);await fs.rename(folder,completed);return {folder:completed,created_at:manifest.created_at,fileCount:files.length,size:files.reduce((n,f)=>n+f.size,0)};
 }catch(error){snapshot?.close();if(path.resolve(folder).startsWith(root+path.sep))await fs.rm(folder,{recursive:true,force:true});throw error;}
}
export async function validateBackup(folder){
 const root=path.resolve(folder),manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));if(manifest.version!==1||!Array.isArray(manifest.files)||!manifest.files.some(f=>f.path==='data/unipazar.sqlite'))throw new Error('Invalid manifest');
 for(const file of manifest.files){const target=path.resolve(root,file.path);if(!target.startsWith(root+path.sep))throw new Error('Unsafe backup entry');const bytes=await fs.readFile(target);if(bytes.length!==file.size||digest(bytes)!==file.sha256)throw new Error('Backup checksum mismatch');}
 const db=new DatabaseSync(path.join(root,'data/unipazar.sqlite'),{readOnly:true});try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Database integrity failed');}finally{db.close();}return manifest;
}
export async function restoreBackup(folder,target){
 const manifest=await validateBackup(folder),root=path.resolve(target);try{await fs.stat(root);throw new Error('Restore target must not exist');}catch(error){if(error.code!=='ENOENT')throw error;}
 await fs.mkdir(root,{recursive:true,mode:0o700});for(const file of manifest.files){const dest=path.resolve(root,file.path);if(!dest.startsWith(root+path.sep))throw new Error('Unsafe restore target');await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.resolve(folder,file.path),dest);}return {dataDir:path.join(root,'data'),uploadDir:path.join(root,'uploads'),fileCount:manifest.files.length};
}
const safeRoute=value=>String(value||'').split('?')[0].replace(/\d+/g,':id').replace(/[^a-zA-Z/:_-]/g,'').slice(0,100);
export function registerOperations({app,db,requireAdmin,fail,dataDir,uploadDir}){
 db.exec(`CREATE TABLE IF NOT EXISTS operation_metrics(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,route TEXT NOT NULL,duration REAL NOT NULL,status INTEGER NOT NULL,device TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS backup_history(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,status TEXT NOT NULL,file_count INTEGER NOT NULL DEFAULT 0,size INTEGER NOT NULL DEFAULT 0);`);
 const metricBuffer=createMetricBuffer(db);const loop=monitorEventLoopDelay({resolution:40});loop.enable();let backupRunning=false,lastBackup=null;
 const record=(kind,route,duration,status=0,device='server')=>{if(!Number.isFinite(duration)||duration<0||duration>600000)return;metricBuffer.record(kind,safeRoute(route),Math.round(duration),status,device);};
 app.use((req,res,next)=>{const started=performance.now();res.on('finish',()=>{if(req.path.startsWith('/api/')&&req.path!=='/api/metrics')record('api',req.path,performance.now()-started,res.statusCode);});next();});
 const metricLimits=new Map();
 app.post('/api/metrics',(req,res)=>{const now=Date.now(),prior=metricLimits.get(req.ip)||0;if(now-prior<30000)return res.sendStatus(204);metricLimits.set(req.ip,now);const items=req.body?.metrics;if(!Array.isArray(items)||items.length>12)return fail(res,400,'Geçersiz ölçüm.');for(const item of items){if(!['fcp','lcp','cls','image','error'].includes(item.kind))continue;record(item.kind,item.route,Number(item.duration),0,item.device==='mobile'?'mobile':'desktop');}res.sendStatus(204);});
 async function backup(){if(backupRunning)throw new Error('Backup busy');backupRunning=true;try{lastBackup=await createBackup({db,dataDir,uploadDir,backupDir:process.env.BACKUP_DIR||path.join(dataDir,'backups')});db.prepare("INSERT INTO backup_history(created_at,status,file_count,size) VALUES(?,'complete',?,?)").run(lastBackup.created_at,lastBackup.fileCount,lastBackup.size);const root=path.resolve(process.env.BACKUP_DIR||path.join(dataDir,'backups')),folders=(await fs.readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()&&/^\d{4}-\d{2}-\d{2}T/.test(e.name)).sort((a,b)=>b.name.localeCompare(a.name));for(const entry of folders.slice(7)){const target=path.resolve(root,entry.name);if(target.startsWith(root+path.sep))await fs.rm(target,{recursive:true,force:true});}return lastBackup;}catch(error){db.prepare("INSERT INTO backup_history(created_at,status) VALUES(?,'failed')").run(new Date().toISOString());throw error;}finally{backupRunning=false;}}
 const automatic=process.env.BACKUP_ENABLED!=='0';
 if(automatic){setTimeout(()=>backup().catch(()=>{}),30000).unref();setInterval(()=>backup().catch(()=>{}),6*3600000).unref();}
 setInterval(()=>{db.prepare("DELETE FROM operation_metrics WHERE created_at<datetime('now','-14 days') OR id<(SELECT COALESCE(max(id),0)-10000 FROM operation_metrics)").run();db.prepare('DELETE FROM backup_history WHERE id<(SELECT COALESCE(max(id),0)-100 FROM backup_history)').run();for(const [key,time] of metricLimits)if(Date.now()-time>600000)metricLimits.delete(key);},600000).unref();
 app.get('/api/admin/health',(req,res)=>{if(!requireAdmin(req,res))return;const metrics=db.prepare("SELECT kind,device,count(*) AS count,round(avg(duration)) AS average,max(duration) AS maximum FROM operation_metrics WHERE created_at>datetime('now','-24 hours') GROUP BY kind,device").all();const errors=db.prepare("SELECT route,status,count(*) AS count FROM operation_metrics WHERE kind='api' AND status>=500 AND created_at>datetime('now','-24 hours') GROUP BY route,status ORDER BY count(*) DESC LIMIT 20").all();res.json({uptime:Math.round(process.uptime()),memoryMB:Math.round(process.memoryUsage().rss/1024/1024),eventLoopMS:Math.round(loop.mean/1e6)||0,metrics,errors,backupRunning,automaticBackup:automatic,backups:db.prepare('SELECT * FROM backup_history ORDER BY id DESC LIMIT 10').all(),notice:'Yedekler varsayılan olarak yerel disktedir; tam disk kaybı için ayrı depolama gerekir.'});});
 app.post('/api/admin/backups',async(req,res)=>{if(!requireAdmin(req,res))return;if(backupRunning)return fail(res,409,'Yedekleme zaten sürüyor.');try{const result=await backup();res.json({created_at:result.created_at,fileCount:result.fileCount,size:result.size});}catch{return fail(res,503,'Yedekleme tamamlanamadı; eski yedekler korundu.');}});
 return {record,backup};
}
