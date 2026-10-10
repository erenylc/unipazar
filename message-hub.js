// Notifications are hints; committed messages remain in the database.
// Slow clients get one resync hint instead of an unbounded notification queue.
export function createMessageHub({heartbeatMs=25000,maxConnections=20000,maxPerUser=4,clock=Date.now}={}){
 const streams=new Map(),clients=new Map();
 function remove(response){const client=clients.get(response);if(!client)return;clients.delete(response);streams.get(client.userId)?.delete(response);if(!streams.get(client.userId)?.size)streams.delete(client.userId);}
 function write(response,data){
  const client=clients.get(response);if(!client||response.destroyed||response.writableEnded){remove(response);return;}
  if(client.blockedAt){client.pending=true;return;}
  try{if(!response.write(data))client.blockedAt=clock()||1;}catch{remove(response);response.destroy();}
 }
 function add(userId,request,response){
  if(clients.size>=maxConnections||(streams.get(userId)?.size||0)>=maxPerUser)return false;
  if(!streams.has(userId))streams.set(userId,new Set());streams.get(userId).add(response);
  // Spread keep-alives across the interval instead of waking 10k sockets together.
  const phase=((Math.imul(userId,2654435761)>>>0)%1000)/1000;
  const client={userId,blockedAt:0,pending:false,nextHeartbeat:clock()+heartbeatMs*(1+phase)};clients.set(response,client);
  const drain=()=>{client.blockedAt=0;if(client.pending){client.pending=false;write(response,'data: {"resync":true}\n\n');}};
  const cleanup=()=>{remove(response);response.off('drain',drain);};
  request.once('close',cleanup);response.once('close',cleanup);response.on('drain',drain);
  write(response,': connected\n\n');return true;
 }
 function notify(conversation,senderId){
  const data=`data: ${JSON.stringify({conversationId:conversation.id,senderId})}\n\n`;
  for(const userId of new Set([conversation.buyer_id,conversation.seller_id]))for(const response of streams.get(userId)||[])write(response,data);
 }
 function sendTo(userId,payload){
  const data=`data: ${JSON.stringify(payload)}\n\n`;
  for(const response of streams.get(userId)||[])write(response,data);
 }
 function heartbeat(){const now=clock();for(const [response,client] of clients){
  if(client.blockedAt&&now-client.blockedAt>60000){remove(response);response.destroy();continue;}
  if(now>=client.nextHeartbeat){client.nextHeartbeat=now+heartbeatMs;if(!client.blockedAt)write(response,': ping\n\n');}
 }}
 const timer=setInterval(heartbeat,1000);timer.unref();
 return {streams,add,notify,sendTo,heartbeat,close(){clearInterval(timer);for(const response of clients.keys())response.end();clients.clear();streams.clear();},get size(){return clients.size;}};
}
