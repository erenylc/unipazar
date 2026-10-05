import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {preparePhoto} from '../image-upload.js';

test('large phone photos are resized, oriented and stripped of private metadata',async()=>{
 const buffer=await sharp({create:{width:3200,height:2400,channels:3,background:'#6699aa'}}).jpeg().withMetadata({orientation:6}).toBuffer();
 const photo=await preparePhoto({buffer});const metadata=await sharp(photo.buffer).metadata();
 assert.equal(photo.type,'jpg');assert.equal(metadata.width,1200);assert.equal(metadata.height,1600);
 assert.equal(metadata.exif,undefined);assert.equal(metadata.orientation,undefined);assert.ok(photo.buffer.length<buffer.length);
});
test('truncated images are rejected before they can become broken uploads',async()=>{
 await assert.rejects(preparePhoto({buffer:Buffer.from([137,80,78,71,13,10,26,10,0])}),/Fotoğraf okunamadı/);
});
