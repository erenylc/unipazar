import test from 'node:test';
import assert from 'node:assert/strict';
import {viewportState} from '../public/mobile-viewport.js';
test('mobile keyboard viewport follows reduced height and panned top',()=>{
 assert.deepEqual(viewportState({width:390,height:380,layoutHeight:844,offsetTop:120,editing:true}),{height:380,top:120,keyboard:true});
 assert.equal(viewportState({width:390,height:844,layoutHeight:844,editing:true}).keyboard,false);
 assert.equal(viewportState({width:390,height:380,layoutHeight:844,editing:false}).keyboard,false);
});
test('pinch zoom and desktop resizing do not enable the mobile keyboard layout',()=>{
 assert.equal(viewportState({width:390,height:380,layoutHeight:844,scale:2,editing:true}).keyboard,false);
 assert.equal(viewportState({width:1100,height:380,layoutHeight:844,editing:true}).keyboard,false);
});
