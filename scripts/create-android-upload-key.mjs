import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const androidDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../android');
const keyPath=path.join(androidDir,'android.keystore');
const passwordPath=path.join(androidDir,'signing-password.txt');
if(existsSync(keyPath)||existsSync(passwordPath)){
  console.error('İmzalama anahtarı veya parola dosyası zaten var; üzerine yazılmadı.');
  process.exit(1);
}

const password=randomBytes(32).toString('base64url');
const env={...process.env,UNISATIS_KEY_PASSWORD:password};
const result=spawnSync('keytool',[
  '-genkeypair','-storetype','PKCS12','-keystore',keyPath,'-alias','unisatis',
  '-keyalg','RSA','-keysize','3072','-validity','10000',
  '-dname','CN=Uni Satis, OU=Mobile, O=Uni Satis, C=TR',
  '-storepass:env','UNISATIS_KEY_PASSWORD','-keypass:env','UNISATIS_KEY_PASSWORD'
],{env,encoding:'utf8'});
if(result.status!==0){console.error(result.stderr||result.error?.message||'keytool başarısız.');process.exit(1);}
writeFileSync(passwordPath,password+'\n',{mode:0o600,flag:'wx'});
const certificate=spawnSync('keytool',[
  '-list','-v','-keystore',keyPath,'-alias','unisatis',
  '-storepass:env','UNISATIS_KEY_PASSWORD','-J-Duser.language=en'
],{env,encoding:'utf8'});
const fingerprint=certificate.stdout.match(/SHA256:\s*([A-F0-9:]{95})/i)?.[1];
if(fingerprint)writeFileSync(path.join(androidDir,'upload-certificate-sha256.txt'),fingerprint.toUpperCase()+'\n');
console.log(`Anahtar oluşturuldu: ${keyPath}`);
console.log(`Parola dosyası: ${passwordPath} (Git dışında tutulur; güvenli yedek al)`);
if(fingerprint)console.log(`Upload sertifikası SHA-256: ${fingerprint.toUpperCase()}`);
