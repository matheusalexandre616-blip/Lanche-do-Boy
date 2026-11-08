/* Lanches do Boy: notificações de pedido novo (Web Push) */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(x){d={body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'Lanches do Boy',{
    body:d.body||'',icon:'/icon-192.png',badge:'/icon-192.png',tag:d.tag||'lb',renotify:true,requireInteraction:true,
    vibrate:[300,120,300,120,300],data:{url:d.url||'/hamburgueria'}}))});
self.addEventListener('notificationclick',e=>{
  e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'/hamburgueria';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){try{if(new URL(c.url).pathname.replace(/\/$/,'')===url.replace(/\/$/,'')&&'focus' in c)return c.focus()}catch(x){}}
    return self.clients.openWindow(url)}))});
