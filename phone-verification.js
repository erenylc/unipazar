export function normalizePhone(value){const digits=String(value||'').replace(/[\s()+-]/g,'');const national=digits.replace(/^(90|0)/,'');return /^5\d{9}$/.test(national)?'+90'+national:null;}
export const smsConfigured=(env=process.env)=>Boolean(env.NETGSM_USERCODE?.trim()&&env.NETGSM_PASSWORD?.trim()&&env.NETGSM_HEADER?.trim());
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export async function sendPhoneCode(phone,code,{env=process.env,fetchImpl=fetch}={}){
 if(!smsConfigured(env))throw new Error('SMS unavailable');
 if(!normalizePhone(phone)||!/^\d{6}$/.test(code))throw new Error('Invalid SMS input');
 const body=`<?xml version="1.0"?><mainbody><header><usercode>${xml(env.NETGSM_USERCODE)}</usercode><password>${xml(env.NETGSM_PASSWORD)}</password><msgheader>${xml(env.NETGSM_HEADER)}</msgheader></header><body><msg>UniSatis dogrulama kodunuz: ${code}. 3 dakika gecerlidir. Kodu kimseyle paylasmayin.</msg><no>${normalizePhone(phone).slice(3)}</no></body></mainbody>`;
 const response=await fetchImpl('https://api.netgsm.com.tr/sms/send/otp',{method:'POST',headers:{'Content-Type':'application/xml; charset=utf-8'},body,signal:AbortSignal.timeout(10000)});
 const result=await response.text();if(!response.ok||!/<code>\s*0\s*<\/code>/.test(result))throw new Error('SMS delivery failed');
}
