import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFilterPrice} from '../public/filter-price.js';
test('filter prices accept Turkish amounts and cents without interpreting invalid input as money',()=>{
 for(const [input,value] of [['1.250,50','1250.5'],['5.000','5000'],['250.75','250.75'],['0','0'],['',''],['₺ 1 250,50','1250.5']])assert.deepEqual(parseFilterPrice(input),{valid:true,value});
 for(const input of ['-1','1e5','12abc','1,2,3','0.1234','10000001'])assert.equal(parseFilterPrice(input).valid,false);
});
