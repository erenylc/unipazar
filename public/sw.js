const OFFLINE_CACHE='unisatis-offline-v2';
const OFFLINE_URL='/offline.html';
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(OFFLINE_CACHE).then(cache=>cache.add(OFFLINE_URL)).then(()=>self.skipWaiting?.()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('unisatis-offline-')&&key!==OFFLINE_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('push',event=>{let data;try{data=event.data.json();}catch{return;}const id=Number(data.conversationId);if(!Number.isSafeInteger(id)||id<1)return;event.waitUntil(self.registration.showNotification('Üni Satış · Yeni mesaj',{body:'Üni Satış’ta yeni bir mesajın var.',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:'unisatis-message-'+id,renotify:true,data:{conversationId:id,url:'/?conversation='+id+'#/messages'},actions:[{action:'open',title:'Mesajı aç'}]}));});
self.addEventListener('notificationclick',event=>{event.notification.close();if(event.action&&event.action!=='open')return;const id=Number(event.notification.data?.conversationId);if(!Number.isSafeInteger(id)||id<1)return;event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(c=>new URL(c.url).origin===self.location.origin);if(client){await client.focus();client.postMessage({type:'open-conversation',conversationId:id});}else await self.clients.openWindow('/?conversation='+id+'#/messages');}));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 // Only public page navigation has an offline fallback. Account data, messages,
 // API responses and uploads always go directly to the server.
 if(event.request.method!=='GET'||event.request.mode!=='navigate'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/uploads/'))return;
 event.respondWith(fetch(event.request).catch(()=>caches.match(OFFLINE_URL)));
});
