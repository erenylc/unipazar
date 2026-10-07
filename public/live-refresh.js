// One fetch/render at a time, with one pending refresh for any size event burst.
export function createRefreshQueue(action,{delayMs=60,onError=()=>{}}={}){
 let running=false,pending=false,timer=null;
 function schedule(){
  if(running||timer!==null||!pending)return;
  timer=setTimeout(async()=>{
   timer=null;pending=false;running=true;
   try{await action();}catch(error){onError(error);}finally{running=false;schedule();}
  },delayMs);
 }
 return {request(){pending=true;schedule();},cancel(){if(timer!==null)clearTimeout(timer);timer=null;pending=false;}};
}
