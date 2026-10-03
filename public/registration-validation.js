export function validateRegistration(values, universities, options={}){
 const fields={};
 const name=String(values.name||'').trim(), email=String(values.email||'').trim().toLowerCase();
 const university=String(values.university||'').trim(), password=String(values.password||'');
 const phone=String(values.phone||'').trim().replace(/[\s()-]/g,'');
 if(!name)fields.name='Adını ve soyadını gir.';
 else if(name.length>80)fields.name='Ad ve soyad en fazla 80 karakter olabilir.';
 if(!university)fields.university='Üniversiteni seç.';
 else if(!universities.includes(university))fields.university='Listede bulunan bir üniversiteyi seç.';
 if(!email)fields.email='E-posta adresini gir.';
 else if(email.length>160||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))fields.email='Geçerli bir e-posta adresi gir (ornek@eposta.com).';
 if(!phone)fields.phone='Cep telefonu numaranı gir.';
 else if(!/^(?:\+90|0)?5\d{9}$/.test(phone))fields.phone='Geçerli bir cep telefonu numarası gir (05xx xxx xx xx).';
 if(options.passwordRequired!==false){
  if(!password)fields.password='Şifreni gir.';
  else if(password.length<10||!password.trim())fields.password='Şifren en az 10 karakter olmalı.';
 }
 return {fields,values:{name,email,university,password,phone}};
}
