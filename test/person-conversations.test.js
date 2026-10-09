import test from 'node:test';
import assert from 'node:assert/strict';
import {groupConversationRows} from '../person-conversations.js';
test('person groups have stable IDs, sum unread and never merge users just because names match',()=>{
 const rows=[{id:8,other_id:2,other_name:'Same name',last_message:'New',unread_count:2},{id:4,other_id:3,other_name:'Same name',last_message:'Other',unread_count:1},{id:1,other_id:2,other_name:'Same name',last_message:'Old',unread_count:3}];
 const result=groupConversationRows(rows);assert.equal(result.length,2);assert.equal(result[0].id,1);assert.equal(result[0].last_message,'New');assert.equal(result[0].unread_count,5);assert.deepEqual(result[0].conversationIds,[8,1]);assert.equal(rows[0].id,8);
});
