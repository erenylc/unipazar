import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {cachePreparedStatements} from '../database-performance.js';
test('statement reuse preserves committed writes and invalidates evicted SQL',()=>{
 const db=cachePreparedStatements(new DatabaseSync(':memory:'),2);
 try{db.exec('CREATE TABLE items(id INTEGER PRIMARY KEY,value TEXT)');const insert=db.prepare('INSERT INTO items(value) VALUES(?)');insert.run('first');insert.run('second');assert.equal(db.prepare('INSERT INTO items(value) VALUES(?)'),insert);const query=db.prepare('SELECT value FROM items ORDER BY id');assert.deepEqual(query.all().map(row=>row.value),['first','second']);db.prepare('SELECT COUNT(*) FROM items');assert.notEqual(db.prepare('INSERT INTO items(value) VALUES(?)'),insert);}finally{db.close();}
});
