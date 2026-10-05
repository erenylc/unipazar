const prepared=new WeakMap();
export function optimizePhoto(file,maxEdge=1600){
 if(!/^image\/(jpeg|png|webp)$/i.test(file.type)&&!/\.(jpe?g|png|webp)$/i.test(file.name))return Promise.resolve(file);
 let sizes=prepared.get(file);if(!sizes){sizes=new Map();prepared.set(file,sizes);}
 if(!sizes.has(maxEdge))sizes.set(maxEdge,resize(file,maxEdge));
 return sizes.get(maxEdge);
}
async function resize(file,maxEdge){
 const url=URL.createObjectURL(file),image=new Image();let timer;
 try{
  await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('decode timeout')),10000);image.onload=resolve;image.onerror=reject;image.src=url;});
  const scale=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
  canvas.width=canvas.height=1;
  return blob&&blob.size<file.size?new File([blob],file.name.replace(/\.[^.]+$/, '')+'.jpg',{type:'image/jpeg'}):file;
 }catch{return file;}finally{clearTimeout(timer);image.src='';URL.revokeObjectURL(url);}
}
