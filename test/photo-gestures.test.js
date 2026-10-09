import test from 'node:test';
import assert from 'node:assert/strict';
import {PhotoGestureState} from '../public/photo-gestures.js';
const model=()=>{const m=new PhotoGestureState();m.setBounds({width:300,height:300,imageWidth:300,imageHeight:300});return m;};
test('photo swipes navigate horizontally but ignore vertical moves and cancellation',()=>{
 const m=model();m.down(1,100,0);m.move(1,-10,4);assert.equal(m.up(1).direction,1);
 m.down(1,0,0);m.move(1,100,150);assert.equal(m.up(1).direction,0);
 m.down(1,0,0);m.move(1,100,0);assert.equal(m.up(1,true).direction,0);
});
test('pinch remains anchored, does not turn into a swipe when a finger lifts, and clamps zoom',()=>{
 const m=model();m.down(1,-50,0);m.down(2,50,0);m.move(1,-100,0);m.move(2,100,0);assert.equal(m.scale,2);assert.equal(m.x,0);
 assert.equal(m.up(2).direction,0);m.move(1,120,0);assert.equal(m.up(1).direction,0);
 m.zoomAt(99);assert.equal(m.scale,4);m.zoomAt(.2);assert.equal(m.scale,1);assert.equal(m.x,0);
});
test('zoomed photos pan within their bounds and navigate only after a deliberate edge swipe',()=>{
 const m=model();m.zoomAt(2);m.down(1,0,0);m.move(1,-80,0);assert.equal(m.x,-80);assert.equal(m.up(1).direction,0);
 m.down(1,0,0);m.move(1,-160,0);assert.equal(m.x,-150);assert.equal(m.up(1).direction,1);
 m.reset();assert.equal(m.scale,1);assert.equal(m.points.size,0);
});
