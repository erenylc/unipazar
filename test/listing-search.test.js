import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createListingSearch} from '../listing-search.js';
test('search index follows inserts, edits and deletions, including Turkish dotless letters',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE listings(id INTEGER PRIMARY KEY,title TEXT,description TEXT)');
 try{const search=createListingSearch(db);const find=word=>db.prepare('SELECT rowid FROM listing_search WHERE listing_search MATCH ?').all(search.expression([word],()=>false)).map(row=>row.rowid);db.prepare('INSERT INTO listings VALUES(?,?,?)').run(1,'Kıralık örgü çanta','Temiz ürün');assert.deepEqual(find('kiralik'),[1]);assert.deepEqual(find('orgu'),[1]);assert.deepEqual(find('temiz'),[1]);db.prepare('UPDATE listings SET title=? WHERE id=1').run('Ders kitabı');assert.deepEqual(find('kiralik'),[]);assert.deepEqual(find('kitabi'),[1]);db.exec('DELETE FROM listings');assert.deepEqual(find('kitabi'),[]);}finally{db.close();}
});
