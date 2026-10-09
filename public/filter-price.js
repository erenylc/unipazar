export function parseFilterPrice(input){
 let value=String(input??'').trim().replace(/[\s₺]/g,'');
 if(!value)return {valid:true,value:''};
 if(value.includes(','))value=value.replace(/\./g,'').replace(',','.');
 else if(/^\d{1,3}(\.\d{3})+$/.test(value))value=value.replace(/\./g,'');
 if(!/^\d+(\.\d{1,2})?$/.test(value))return {valid:false};
 const amount=Number(value);return Number.isFinite(amount)&&amount>=0&&amount<=10000000?{valid:true,value:String(amount)}:{valid:false};
}
