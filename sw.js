/* Web Push receiver. Payload must contain only data suitable for a lock screen. */
self.addEventListener('push',event=>{
 let data={};try{if(event.data)data=event.data.json()}catch{}
 const title=typeof data.title==='string'?data.title.slice(0,100):'RSI 2 알림';
 const body=typeof data.body==='string'?data.body.slice(0,240):'앱에서 최신 결과를 확인하세요.';
 const type=data.type==='exit'?'exit':'buy';
 event.waitUntil(self.registration.showNotification(title,{body,tag:`rsi2-${type}`,data:{path:'/'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const client=windows.find(w=>new URL(w.url).origin===self.location.origin);
  if(client)return client.focus();
  return self.clients.openWindow('/');
 })());
});
