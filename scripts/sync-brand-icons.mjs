import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'..');
const svg=await fs.readFile(path.join(root,'public/logo-mark.svg'),'utf8');
const render=async(file,size,maskable=false)=>{
 const source=maskable?`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 80 80"><rect width="80" height="80" fill="#494077"/><svg x="8" y="8" width="64" height="64" viewBox="0 0 64 64">${svg.replace(/^.*?<svg[^>]*>/s,'').replace(/<\/svg>\s*$/,'')}</svg></svg>`:svg;
 await sharp(Buffer.from(source)).resize(size,size).png().toFile(path.join(root,file));
};
for(const [name,size,mask] of [['icon-192',192,false],['icon-512',512,false],['icon-maskable',512,true],['apple-touch-icon',180,false]])await render(`public/icons/${name}.png`,size,mask);
for(const [density,size,splash] of [['mdpi',48,128],['hdpi',72,192],['xhdpi',96,256],['xxhdpi',144,384],['xxxhdpi',192,512]]){
 await render(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`,size);
 await render(`android/app/src/main/res/mipmap-${density}/ic_maskable.png`,size,true);
 await render(`android/app/src/main/res/drawable-${density}/splash.png`,splash);
}
await render('android/store_icon.png',512);
