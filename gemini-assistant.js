// Credentials stay on the server. This adapter never switches to a paid provider.
let connection={state:'untested'};
let resolvedModel={requested:'',selected:''};
export const geminiConnectionStatus=()=>({...connection});
const freeTextModels=['gemini-3.6-flash','gemini-3.8-flash'];
async function availableFreeModels(apiKey,fetchImpl){
 const response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{
  headers:{'x-goog-api-key':apiKey},signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)return [];
 const data=await response.json().catch(()=>({}));
 const available=new Set((data.models||[])
  .filter(item=>item.supportedGenerationMethods?.includes('generateContent'))
  .map(item=>String(item.name||'').replace(/^models\//,'')));
 return freeTextModels.filter(model=>available.has(model));
}
async function generate(model,message,{apiKey,fetchImpl,history,instructions}){
 return fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{
  method:'POST',headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),
  body:JSON.stringify({
   systemInstruction:{parts:[{text:instructions}]},
   contents:[...history,{role:'user',content:message}].map(item=>({role:item.role==='assistant'?'model':'user',parts:[{text:item.content}]})),
   generationConfig:{maxOutputTokens:600,thinkingConfig:{thinkingLevel:'low'}}
  })
 });
}
export async function answerGeminiQuestion(message,{env,fetchImpl,history,instructions}){
 const requestedModel=env.GEMINI_ASSISTANT_MODEL?.trim()||freeTextModels[0];
 let model=resolvedModel.requested===requestedModel?resolvedModel.selected:requestedModel;
 if(!/^gemini-[a-z0-9.-]+$/.test(model))throw new Error('invalid assistant model');
 const apiKey=env.GEMINI_API_KEY.trim();
 let response=await generate(model,message,{apiKey,fetchImpl,history,instructions});
 if(response.status===404){
  const alternatives=(await availableFreeModels(apiKey,fetchImpl)).filter(item=>item!==model);
  if(alternatives.length){model=alternatives[0];response=await generate(model,message,{apiKey,fetchImpl,history,instructions});}
 }
 for(let retry=0;response.status===503&&retry<2;retry++){
  await new Promise(resolve=>setTimeout(resolve,250*(retry+1)));
  response=await generate(model,message,{apiKey,fetchImpl,history,instructions});
 }
 if(!response.ok){const data=await response.json().catch(()=>({}));const code=data.error?.status;connection={state:'unavailable',httpStatus:response.status,errorCode:typeof code==='string'&&/^[A-Z_]+$/.test(code)?code:'PROVIDER_ERROR'};throw Object.assign(new Error('assistant unavailable'),{status:response.status});}
 const data=await response.json(),candidate=data.candidates?.[0];
 const answer=(candidate?.content?.parts||[]).filter(part=>!part.thought&&typeof part.text==='string').map(part=>part.text).join('\n').trim();
 if(candidate?.finishReason!=='STOP'||!answer||answer.length>12000)throw new Error('invalid answer');
 resolvedModel={requested:requestedModel,selected:model};connection={state:'ready',model};
 return {answer,sources:[],mode:'ai',provider:'gemini'};
}
