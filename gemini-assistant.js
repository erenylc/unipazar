// Credentials stay on the server. This adapter never switches to a paid provider.
export async function answerGeminiQuestion(message,{env,fetchImpl,history,instructions}){
 const model=env.GEMINI_ASSISTANT_MODEL?.trim()||'gemini-2.5-flash-lite';
 if(!/^gemini-[a-z0-9.-]+$/.test(model))throw new Error('invalid assistant model');
 const response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{
  method:'POST',headers:{'x-goog-api-key':env.GEMINI_API_KEY.trim(),'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),
  body:JSON.stringify({
   systemInstruction:{parts:[{text:instructions}]},
   contents:[...history,{role:'user',content:message}].map(item=>({role:item.role==='assistant'?'model':'user',parts:[{text:item.content}]})),
   generationConfig:{maxOutputTokens:800,temperature:.5}
  })
 });
 if(!response.ok)throw Object.assign(new Error('assistant unavailable'),{status:response.status});
 const data=await response.json(),candidate=data.candidates?.[0];
 const answer=(candidate?.content?.parts||[]).filter(part=>!part.thought&&typeof part.text==='string').map(part=>part.text).join('\n').trim();
 if(candidate?.finishReason!=='STOP'||!answer||answer.length>12000)throw new Error('invalid answer');
 return {answer,sources:[],mode:'ai',provider:'gemini'};
}
