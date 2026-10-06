export function createMetricBuffer(db,{capacity=5000,intervalMs=1000}={}){
 const insert=db.prepare('INSERT INTO operation_metrics(kind,route,duration,status,device) VALUES(?,?,?,?,?)');
 let pending=[],dropped=0,failures=0;
 function record(...values){if(pending.length>=capacity){dropped++;return;}pending.push(values);}
 function flush(){
  if(!pending.length)return;const batch=pending;pending=[];
  try{db.exec('SAVEPOINT metric_batch');for(const values of batch)insert.run(...values);db.exec('RELEASE metric_batch');}
  catch{try{db.exec('ROLLBACK TO metric_batch; RELEASE metric_batch');}catch{}failures++;dropped+=batch.length;}
 }
 const timer=setInterval(flush,intervalMs);timer.unref();
 return {record,flush,close(){clearInterval(timer);flush();},get dropped(){return dropped;},get pending(){return pending.length;},get failures(){return failures;}};
}
