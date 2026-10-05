import convertHeic from 'heic-convert';
import sharp from 'sharp';

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

export function imageType(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

function isHeic(buffer) {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString() === 'ftyp' &&
    ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(buffer.subarray(8, 12).toString());
}

export async function preparePhoto(file) {
  if (file.buffer.length > MAX_PHOTO_BYTES) throw new Error('Her fotoğraf en fazla 12 MB olabilir.');
  const type = imageType(file.buffer);
  if (type) return optimizeStoredPhoto(file.buffer);
  if (!isHeic(file.buffer)) throw new Error('JPG, PNG, WebP veya HEIC fotoğraf yükle.');
  let buffer;
  try { buffer = Buffer.from(await convertHeic({ buffer: file.buffer, format: 'JPEG', quality: 0.8 })); }
  catch { throw new Error('HEIC fotoğraf dönüştürülemedi. Başka bir fotoğraf dene.'); }
  if (imageType(buffer) !== 'jpg' || buffer.length > MAX_PHOTO_BYTES) throw new Error('HEIC fotoğraf işlenemedi. Başka bir fotoğraf dene.');
  return optimizeStoredPhoto(buffer);
}

async function optimizeStoredPhoto(buffer){
 try{
  const optimized=await sharp(buffer,{limitInputPixels:60000000,failOn:'error'}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:82}).toBuffer();
  return {buffer:optimized,type:'jpg'};
 }catch{throw new Error('Fotoğraf okunamadı. Geçerli bir JPG, PNG, WebP veya HEIC fotoğraf seç.');}
}
