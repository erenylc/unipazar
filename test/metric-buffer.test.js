import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createMetricBuffer} from '../metric-buffer.js';
test('telemetry writes are batched, bounded and cannot interrupt application requests',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE operation_metrics(id INTEGER PRIMARY KEY,kind TEXT,route TEXT,duration REAL,status INTEGER,device TEXT)');const buffer=createMetricBuffer(db,{capacity:2});
 try{buffer.record('api','/api/me',1,200,'server');buffer.record('api','/api/me',2,200,'server');buffer.record('api','/api/me',3,200,'server');assert.equal(buffer.dropped,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM operation_metrics').get().n,0);buffer.flush();assert.equal(db.prepare('SELECT COUNT(*) n FROM operation_metrics').get().n,2);db.exec('DROP TABLE operation_metrics');buffer.record('api','/api/me',4,200,'server');assert.doesNotThrow(()=>buffer.flush());assert.equal(buffer.failures,1);}finally{buffer.close();db.close();}
});
