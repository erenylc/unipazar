import {validateRegistration} from './public/registration-validation.js';
import {brevoConfigured, sendBrevoVerificationCode, sendBrevoTextEmail} from './email-delivery.js';
import express from 'express';
import compression from 'compression';
import multer from 'multer';
import sharp from 'sharp';
import {preparePhoto, MAX_PHOTO_BYTES} from './image-upload.js';
import {prepareCheckedPhoto, checkPhoto, moderationEnabled} from './photo-moderation.js';
import {answerAppQuestion} from './app-assistant.js';
import {normalizePhone,smsConfigured,sendPhoneCode} from './phone-verification.js';
import {registerProductFeatures} from './product-features.js';
import {registerOperations} from './operations.js';
import {registerNotifications} from './notifications.js';
import {registerReportEmail} from './report-email.js';
import {legalDocuments, validateLegalAcceptance} from './legal-documents.js';
import {verifyGoogleCredential} from './google-login.js';
import nodemailer from 'nodemailer';
import { DatabaseSync } from 'node:sqlite';
import {cachePreparedStatements,addPerformanceIndexes} from './database-performance.js';
import {createMessageHub} from './message-hub.js';
import {createListingSearch} from './listing-search.js';
import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scrypt = promisify(scryptCallback);
const root = path.dirname(fileURLToPath(import.meta.url));
if (fs.existsSync(path.join(root,'.env'))) process.loadEnvFile(path.join(root,'.env'));
const localMode=process.argv.includes('--local');
const dev = localMode || process.env.NODE_ENV !== 'production';
const testEmailCodes = process.env.NODE_ENV === 'test' && process.env.TEST_EMAIL_CODES === '1';
const testPhoneCodes=process.env.NODE_ENV==='test'&&process.env.TEST_PHONE_CODES==='1';
const phoneVerificationRequired=()=>smsConfigured()||process.env.REQUIRE_CONTACT_VERIFICATION==='1';
const port = Number(process.env.PORT || 3000);
const universities = JSON.parse(fs.readFileSync(path.join(root, 'universities.json'), 'utf8'));
const universityNames = new Set(universities);
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const uploadDir = process.env.UPLOAD_DIR || path.join(root, 'uploads');
const messageUploadDir = path.join(dataDir, 'message-photos');
const voiceUploadDir = path.join(dataDir, 'message-voice');
const avatarDir = path.join(dataDir, 'profile-photos');
fs.mkdirSync(avatarDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(messageUploadDir, { recursive: true });
fs.mkdirSync(voiceUploadDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'unipazar.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
const transaction = fn => {
  db.exec('BEGIN');
  try { const result=fn(); db.exec('COMMIT'); return result; }
  catch(error) { db.exec('ROLLBACK'); throw error; }
};
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 university TEXT NOT NULL, campus TEXT NOT NULL, email_verified INTEGER NOT NULL DEFAULT 0,
 student_status TEXT NOT NULL DEFAULT 'pending', need_status TEXT NOT NULL DEFAULT 'none',
 need_reason TEXT, role TEXT NOT NULL DEFAULT 'student', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS verification_codes (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS listings (
 id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES users(id), kind TEXT NOT NULL CHECK(kind IN ('sale','donation')),
 title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, condition TEXT NOT NULL,
 price INTEGER NOT NULL DEFAULT 0, university TEXT NOT NULL, campus TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS listing_images (
 id INTEGER PRIMARY KEY, listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 filename TEXT NOT NULL, position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id, listing_id)
);
CREATE TABLE IF NOT EXISTS conversations (
 id INTEGER PRIMARY KEY, listing_id INTEGER NOT NULL REFERENCES listings(id), buyer_id INTEGER NOT NULL REFERENCES users(id),
 seller_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(listing_id,buyer_id)
);
CREATE TABLE IF NOT EXISTS messages (
 id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 sender_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS offers (
 id INTEGER PRIMARY KEY, listing_id INTEGER NOT NULL REFERENCES listings(id), buyer_id INTEGER NOT NULL REFERENCES users(id),
 amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS donation_requests (
 id INTEGER PRIMARY KEY, listing_id INTEGER NOT NULL REFERENCES listings(id), requester_id INTEGER NOT NULL REFERENCES users(id),
 note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(listing_id,requester_id)
);
CREATE TABLE IF NOT EXISTS reports (
 id INTEGER PRIMARY KEY, reporter_id INTEGER NOT NULL REFERENCES users(id), listing_id INTEGER REFERENCES listings(id),
 message_id INTEGER REFERENCES messages(id), reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_message_reviews (
 id INTEGER PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES users(id),
 conversation_id INTEGER NOT NULL REFERENCES conversations(id),
 reason TEXT NOT NULL, viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS handoffs (
 conversation_id INTEGER PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
 place TEXT NOT NULL, meeting_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed',
 proposed_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS support_applications (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 reason TEXT NOT NULL, family_income INTEGER NOT NULL, identity_last4 TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')) DEFAULT 'pending',
 submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS listings_scope ON listings(university,campus,status,created_at);
CREATE INDEX IF NOT EXISTS listings_recent ON listings(status,kind,created_at DESC);
CREATE INDEX IF NOT EXISTS listings_university_recent ON listings(university,status,kind,created_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id,id);
CREATE TABLE IF NOT EXISTS google_accounts (
 sub TEXT PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS registration_acceptances (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 version TEXT NOT NULL, documents TEXT NOT NULL, accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS password_reset_codes (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 requested_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS blocked_users (
 blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id<>blocked_id)
);
`);
if (!db.prepare('PRAGMA table_info(reports)').all().some(column=>column.name==='conversation_id'))db.exec('ALTER TABLE reports ADD COLUMN conversation_id INTEGER REFERENCES conversations(id)');
if (!db.prepare('PRAGMA table_info(users)').all().some(column=>column.name==='avatar_filename'))db.exec('ALTER TABLE users ADD COLUMN avatar_filename TEXT');
db.exec('CREATE TABLE IF NOT EXISTS conversation_views (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, cleared_through INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,conversation_id))');
if (!db.prepare("PRAGMA table_info(users)").all().some(column => column.name === 'need_expires_at')) {
  db.exec('ALTER TABLE users ADD COLUMN need_expires_at INTEGER');
}
if (!db.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'needs_support')) {
  db.exec('ALTER TABLE users ADD COLUMN needs_support INTEGER NOT NULL DEFAULT 0');
}
if (!db.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'phone')) {
  db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
}
if(!db.prepare('PRAGMA table_info(users)').all().some(column=>column.name==='phone_verified'))db.exec('ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0');
if(!db.prepare('PRAGMA table_info(verification_codes)').all().some(column=>column.name==='attempts'))db.exec('ALTER TABLE verification_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS verified_phone_unique ON users(phone) WHERE phone_verified=1;
CREATE TABLE IF NOT EXISTS phone_codes(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,phone TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,sent_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sms_attempts(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,phone TEXT NOT NULL,sent_at INTEGER NOT NULL);`);
if (!db.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'support_verified')) {
  db.exec('ALTER TABLE users ADD COLUMN support_verified INTEGER NOT NULL DEFAULT 0');
}
if (!db.prepare('PRAGMA table_info(users)').all().some(column => column.name === 'closed_at')) {
  db.exec('ALTER TABLE users ADD COLUMN closed_at TEXT');
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS one_admin_account ON users(role) WHERE role='admin'");
if (!db.prepare('PRAGMA table_info(messages)').all().some(column => column.name === 'read_at')) {
  db.exec('ALTER TABLE messages ADD COLUMN read_at INTEGER');
  db.prepare('UPDATE messages SET read_at=?').run(Date.now());
}
if (!db.prepare('PRAGMA table_info(messages)').all().some(column => column.name === 'photo_filename')) {
  db.exec('ALTER TABLE messages ADD COLUMN photo_filename TEXT');
}
if (!db.prepare('PRAGMA table_info(messages)').all().some(column => column.name === 'voice_filename')) {
  db.exec('ALTER TABLE messages ADD COLUMN voice_filename TEXT');
}
const expireListings = () => {
  if(!db.prepare("SELECT 1 FROM listings WHERE status IN ('active','reserved') AND created_at <= datetime('now','-180 days') LIMIT 1").get())return;
  db.prepare("UPDATE listings SET status='expired' WHERE status IN ('active','reserved') AND created_at <= datetime('now','-180 days')").run();
};
expireListings();
setInterval(expireListings, 60 * 60 * 1000).unref();

const messageHub=createMessageHub();
const messageStreams=messageHub.streams;
let pushNotifications=null;
const notifyConversation=(conversation,senderId)=>{messageHub.notify(conversation,senderId);pushNotifications?.notify(conversation,senderId).catch(()=>{});};

// Existing message IDs and foreign-key targets are preserved during this migration.
if (db.prepare('PRAGMA table_info(conversations)').all().find(c=>c.name==='listing_id').notnull) {
  db.exec('PRAGMA foreign_keys=OFF');
  try { transaction(()=>db.exec(`CREATE TABLE conversations_new (
    id INTEGER PRIMARY KEY, listing_id INTEGER REFERENCES listings(id), buyer_id INTEGER NOT NULL REFERENCES users(id),
    seller_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(listing_id,buyer_id));
    INSERT INTO conversations_new SELECT * FROM conversations;
    DROP TABLE conversations; ALTER TABLE conversations_new RENAME TO conversations;`)); }
  finally {db.exec('PRAGMA foreign_keys=ON');}
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS direct_admin_conversation ON conversations(buyer_id,seller_id) WHERE listing_id IS NULL');
addPerformanceIndexes(db);
const listingSearch=createListingSearch(db);
cachePreparedStatements(db);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression({filter(req,res){
  return req.path!=='/api/message-events' && compression.filter(req,res);
}}));
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  if(req.secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
  if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Geçersiz istek kaynağı.' });
  }
  next();
});
app.get('/.well-known/assetlinks.json', (_req, res) => {
  const localApkFingerprint='74:98:7F:18:19:17:39:56:26:D6:96:AF:1A:9E:B6:C9:F2:BC:DA:F6:D7:57:0E:9A:EF:86:4E:18:F8:94:44:E9';
  const fingerprints = [localApkFingerprint, process.env.PLAY_APP_SIGNING_SHA256, process.env.ANDROID_UPLOAD_SHA256]
    .filter(value => typeof value === 'string' && /^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(value))
    .map(value => value.toUpperCase());
  res.set('Cache-Control', 'public, max-age=300');
  res.json([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.unisatis.app',
      sha256_cert_fingerprints: [...new Set(fingerprints)]
    }
  }]);
});
app.get('/api/public-contact',(_req,res)=>{
  const email=String(process.env.LEGAL_CONTACT_EMAIL||'unisatis06@gmail.com').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(404).end();
  res.set('Cache-Control','public, max-age=300').json({email});
});
app.use('/api', (_req,_res,next) => { expireListings(); next(); });
const attempts = new Map();
function authLimit(req,res,next){
  const key=`${req.ip}:${req.path}`, now=Date.now();
  const entry=attempts.get(key) || {count:0,reset:now+15*60000};
  if(now>entry.reset){entry.count=0;entry.reset=now+15*60000;}
  entry.count++;attempts.set(key,entry);
  if(entry.count>30) return fail(res,429,'Çok fazla deneme yapıldı. Bir süre sonra tekrar dene.');
  next();
}
app.use(['/api/register','/api/login','/api/verify-email','/api/resend-code','/api/me/email','/api/me/phone','/api/me/verify-email'],authLimit);
app.use(['/api/password-reset/request','/api/password-reset/confirm'],authLimit);
const writeAttempts=new Map();
setInterval(()=>{const now=Date.now();for(const [key,entry] of attempts)if(now>entry.reset)attempts.delete(key);for(const [key,entry] of writeAttempts)if(now>entry.reset)writeAttempts.delete(key);},60000).unref();
app.use(['/api/reports','/api/listings','/api/conversations','/api/me/avatar','/api/photos/check'],(req,res,next)=>{
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 const user=currentUser(req),key=user?'user:'+user.id:'ip:'+req.ip;
 const now=Date.now();let entry=writeAttempts.get(key);if(!entry||now>entry.reset)entry={count:0,reset:now+60000};
 entry.count++;writeAttempts.set(key,entry);
 if(entry.count>120){res.set('Retry-After',String(Math.ceil((entry.reset-now)/1000)));return fail(res,429,'Çok fazla işlem yapıldı. Biraz bekleyip tekrar dene.');}
 next();
});

const hash = value => createHash('sha256').update(value).digest('hex');
const legal = legalDocuments();
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleChallenges = new Map(), googleSignups = new Map();
const cookieValue = (req,name) => req.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const temporaryCookie = (res,name,value) => res.cookie(name,value,{httpOnly:true,sameSite:'strict',secure:!dev,path:'/api',maxAge:10*60000});
setInterval(()=>{for(const store of [googleChallenges,googleSignups])for(const [key,value] of store)if(value.expires<Date.now())store.delete(key);},60000).unref();
function recordAcceptance(userId){if(legal)db.prepare('INSERT INTO registration_acceptances(user_id,version,documents) VALUES(?,?,?)').run(userId,legal.version,JSON.stringify(legal));}
const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const randomCode = () => String(randomInt(100000, 1000000));
const passwordHash = async password => {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
};
const verifyPassword = async (password, stored) => {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected || !/^[a-f0-9]{128}$/.test(expected)) return false;
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
};
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const fail = (res, code, error) => res.status(code).json({ error });
const publicUser = user => user && ({ id: user.id, name: user.name, email: user.email, phone:user.phone || '', phoneVerified:!!user.phone_verified,universityEmail:user.school_email||'',universityEmailVerified:!!user.school_verified, avatarUrl:user.avatar_filename?'/api/users/'+user.id+'/avatar?v='+encodeURIComponent(user.avatar_filename):null, university: user.university, emailVerified: !!user.email_verified, studentStatus: user.student_status, needsSupport: !!user.support_verified, supportStatus:db.prepare('SELECT status FROM support_applications WHERE user_id=?').get(user.id)?.status || 'none', role: user.role });
const currentUser = req => {
  const token = /(?:^|; )up_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (!token) return null;
  return db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.closed_at IS NULL`).get(hash(token), Date.now()) || null;
};
const requireUser = (req, res) => {
  const user = currentUser(req);
  if (!user) fail(res, 401, 'Önce giriş yapmalısın.');
  return user;
};
const requireAdmin = (req, res) => {
  const user = requireUser(req, res);
  if (user && user.role !== 'admin') fail(res, 403, 'Bu işlem için yönetici yetkisi gerekiyor.');
  return user?.role === 'admin' ? user : null;
};
app.use('/api',(req,res,next)=>{
 const trading=req.method==='POST'&&(/^\/listings(?:\/\d+\/(?:conversation|offers|requests))?$/.test(req.path)||/^\/conversations\/\d+\/messages$/.test(req.path));
 if(!trading)return next();const user=currentUser(req);if(!user)return next();
 if((!dev||phoneVerificationRequired())&&!user.email_verified)return res.status(403).json({error:'Bu işlem için Hesabım sayfasından e-postanı doğrula.',verificationRequired:'email'});
 if(phoneVerificationRequired()&&!user.phone_verified)return res.status(403).json({error:'Bu işlem için Hesabım sayfasından telefonunu SMS koduyla doğrula.',verificationRequired:'phone'});
 next();
});
const setSession = (res, userId, rememberMe = false) => {
  const token = randomBytes(32).toString('hex');
  const duration = rememberMe ? 30 * 86400000 : 12 * 3600000;
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token), userId, Date.now() + duration);
  res.cookie('up_session', token, { httpOnly: true, sameSite: 'strict', secure: !dev, ...(rememberMe ? { maxAge: duration } : {}), path: '/' });
};
const mailer = process.env.SMTP_HOST && process.env.SMTP_FROM ? nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT || 587) === 465,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
}) : null;
const emailVerificationAvailable = () => Boolean(mailer || brevoConfigured() || testEmailCodes);
const issueCode = async user => {
  const code = randomCode();
  db.prepare('INSERT OR REPLACE INTO verification_codes(user_id,code_hash,expires_at) VALUES(?,?,?)').run(user.id, hash(code), Date.now() + 15 * 60000);
  if (brevoConfigured()) await sendBrevoVerificationCode(user.email, code);
  else if (mailer) await mailer.sendMail({ from: process.env.SMTP_FROM, to: user.email, subject: 'Üni Satış e-posta doğrulama kodu', text: `Doğrulama kodun: ${code}. Kod 15 dakika geçerlidir.` });
  return testEmailCodes ? code : undefined;
};

function validEmailCode(user,code){
 if(!user)return false;const record=db.prepare('SELECT * FROM verification_codes WHERE user_id=?').get(user.id);
 if(!record||record.expires_at<Date.now()||record.attempts>=5)return false;
 if(!/^\d{6}$/.test(code)||record.code_hash!==hash(code)){db.prepare('UPDATE verification_codes SET attempts=attempts+1 WHERE user_id=?').run(user.id);return false;}
 return true;
}
app.use('/api/me/university-email',authLimit);
const reportEmails=registerReportEmail({db,sendMail:async(email,subject,text)=>{if(testEmailCodes)return;if(brevoConfigured())return sendBrevoTextEmail(email,subject,text,fetch,{senderEmail:'unisatis06@gmail.com'});if(mailer)return mailer.sendMail({from:'unisatis06@gmail.com',to:email,subject,text});throw new Error('Email unavailable');}});
registerProductFeatures({app,db,requireUser,requireAdmin,fail,hash,randomCode,universities,uploadDir,reportEmails,searchExpression:value=>listingSearch.expression(searchWords(value),closeWord),emailAvailable:emailVerificationAvailable,testEmailCodes,sendMail:async(email,subject,text)=>{if(testEmailCodes)return;if(brevoConfigured())return sendBrevoTextEmail(email,subject,text);if(mailer)return mailer.sendMail({from:process.env.SMTP_FROM,to:email,subject,text});throw new Error('Email unavailable');}});
registerOperations({app,db,requireAdmin,fail,dataDir,uploadDir});
pushNotifications=registerNotifications({app,db,requireUser,fail,hash});
app.get('/api/me', (req, res) => {res.set('Cache-Control','no-store');res.json({ user: publicUser(currentUser(req)),emailVerificationAvailable:emailVerificationAvailable(),phoneVerificationAvailable:smsConfigured()||testPhoneCodes,contactVerificationRequired:phoneVerificationRequired(),emailVerificationRequired:!dev||phoneVerificationRequired(),googleClientId,legalVersion:legal?.version || null });});
app.get('/legal/:document', (req,res)=>{
  const document=legal?.[req.params.document];
  if(!document || !['privacy','terms'].includes(req.params.document))return res.status(404).send('Metin henüz yayımlanmadı.');
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  res.type('html').send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(document.title)} — ÜniSatış</title><link rel="stylesheet" href="/styles.css"></head><body><main class="shell page legal-page"><a href="/#/">ÜniSatış</a><h1>${escape(document.title)}</h1><p>Sürüm: ${escape(legal.version)}</p>${document.sections.map(([title,text])=>`<section><h2>${escape(title)}</h2><p>${escape(text)}</p></section>`).join('')}</main></body></html>`);
});
app.get('/api/auth/google/nonce',authLimit,(req,res)=>{
  if(!googleClientId)return fail(res,503,'Google ile giriş henüz yapılandırılmadı.');
  const key=randomBytes(32).toString('hex'),nonce=randomBytes(32).toString('hex');
  googleChallenges.set(hash(key),{nonce,expires:Date.now()+10*60000});temporaryCookie(res,'up_google_nonce',key);
  res.set('Cache-Control','no-store').json({nonce});
});
app.post('/api/auth/google',authLimit,wrap(async(req,res)=>{
  const key=hash(cookieValue(req,'up_google_nonce') || ''),challenge=googleChallenges.get(key);
  if(!challenge || challenge.expires<Date.now())return fail(res,400,'Google girişinin süresi doldu. Tekrar dene.');
  let profile;
  try {profile=await verifyGoogleCredential(req.body.credential,googleClientId,challenge.nonce);}
  catch {return fail(res,401,'Google hesabı doğrulanamadı. Tekrar dene.');}
  googleChallenges.delete(key);res.clearCookie('up_google_nonce',{path:'/api'});
  let user=db.prepare('SELECT u.* FROM google_accounts g JOIN users u ON u.id=g.user_id WHERE g.sub=?').get(profile.sub);
  if(!user){
    user=db.prepare('SELECT * FROM users WHERE email=?').get(profile.email);
    if(user && !profile.authoritative)return fail(res,409,'Bu e-posta ile bir hesap var. E-posta ve şifrenle giriş yap.');
    if(user && !user.closed_at)db.prepare('INSERT INTO google_accounts(sub,user_id) VALUES(?,?)').run(profile.sub,user.id);
  }
  if(user){
    if(user.closed_at)return fail(res,403,'Bu hesap kapatılmış.');
    if(!user.email_verified && profile.authoritative && user.email===profile.email){
      db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(user.id);
      db.prepare('DELETE FROM verification_codes WHERE user_id=?').run(user.id);
      user={...user,email_verified:1};
    }
    setSession(res,user.id);return res.json({user:publicUser(user)});
  }
  const token=randomBytes(32).toString('hex');googleSignups.set(hash(token),{...profile,expires:Date.now()+10*60000});temporaryCookie(res,'up_google_signup',token);
  res.set('Cache-Control','no-store').json({profile:{name:profile.name,email:profile.email}});
}));
app.get('/api/universities', (_req, res) => res.json({ universities, emailVerificationAvailable: emailVerificationAvailable() }));
app.post('/api/register', wrap(async (req, res) => {
  const signupKey=hash(cookieValue(req,'up_google_signup') || ''),googleProfile=req.body.google===true ? googleSignups.get(signupKey) : null;
  if(req.body.google===true && (!googleProfile || googleProfile.expires<Date.now()))return fail(res,400,'Google kaydının süresi doldu. Google ile tekrar devam et.');
  const validation=validateRegistration(googleProfile ? {...req.body,email:googleProfile.email} : req.body, [...universityNames],{passwordRequired:!googleProfile,phoneRequired:!googleProfile});
  Object.assign(validation.fields,validateLegalAcceptance(req.body,legal));
  if(Object.keys(validation.fields).length)return res.status(400).json({error:'Lütfen işaretli alanları kontrol et.',fields:validation.fields});
  const {name,email,university,password,phone}=validation.values;
  if (!dev && !emailVerificationAvailable() && !googleProfile?.authoritative) return fail(res,503,'Kayıt şu anda açılamıyor. Lütfen daha sonra tekrar dene.');
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({error:'Bu e-posta zaten kayıtlı. Giriş yapabilir veya başka bir e-posta kullanabilirsin.',fields:{email:'Bu e-posta zaten kayıtlı.'}});
  const storedPassword=await passwordHash(googleProfile ? randomBytes(32).toString('hex') : password);
  let result;
  transaction(()=>{
    result=db.prepare('INSERT INTO users(name,email,password_hash,university,campus,role,student_status,phone,email_verified) VALUES(?,?,?,?,?,?,?,?,?)').run(name,email,storedPassword,university,'','student','pending',phone,googleProfile?.authoritative ? 1 : 0);
    if(googleProfile)db.prepare('INSERT INTO google_accounts(sub,user_id) VALUES(?,?)').run(googleProfile.sub,result.lastInsertRowid);
    recordAcceptance(result.lastInsertRowid);
  });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid);
  if(googleProfile){googleSignups.delete(signupKey);res.clearCookie('up_google_signup',{path:'/api'});}
  if (!emailVerificationAvailable() || user.email_verified) {
    setSession(res, user.id);
    return res.status(201).json({ message: 'Hesabın açıldı.', user: publicUser(user) });
  }
  let devCode;
  try { devCode = await issueCode(user); }
  catch (error) {
    db.prepare('DELETE FROM users WHERE id=?').run(user.id);
    return fail(res,503,'Doğrulama e-postası gönderilemedi. Lütfen tekrar dene.');
  }
  res.status(201).json({ message: 'Hesap açıldı. E-postanı doğrula.', devCode });
}));
app.post('/api/verify-email', (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase(), code = clean(req.body.code, 10);
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  const record = user && db.prepare('SELECT * FROM verification_codes WHERE user_id=?').get(user.id);
  if (!user || user.closed_at || !validEmailCode(user,code)) return fail(res, 400, 'Kod geçersiz, deneme sınırı dolmuş veya süresi geçmiş.');
  db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(user.id);
  db.prepare('DELETE FROM verification_codes WHERE user_id=?').run(user.id);
  setSession(res, user.id, req.body.rememberMe === true);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
});
app.post('/api/resend-code', wrap(async (req, res) => {
  const email=clean(req.body.email,160).toLowerCase();
  if(!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))return fail(res,400,'Geçerli bir e-posta adresi gir.');
  const message='Bu adresle doğrulanmamış bir hesap varsa yeni doğrulama kodu gönderildi. Gelen kutunu ve spam klasörünü kontrol et.';
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || user.closed_at || user.email_verified) return res.json({message,retryAfter:60});
  if (!emailVerificationAvailable()) return fail(res,503,'E-posta gönderim servisi henüz yapılandırılmadı.');
  const previous=db.prepare('SELECT expires_at FROM verification_codes WHERE user_id=?').get(user.id);
  const retryAfter=previous?Math.max(0,Math.ceil((previous.expires_at-15*60000+60000-Date.now())/1000)):0;
  if(retryAfter)return res.status(429).set('Retry-After',String(retryAfter)).json({error:'Yeni kod istemeden önce bekleme süresinin dolmasını bekle.',retryAfter});
  let devCode;
  try { devCode = await issueCode(user); }
  catch { return fail(res,503,'Doğrulama e-postası gönderilemedi. Lütfen tekrar dene.'); }
  res.json({message,devCode,retryAfter:60});
}));
app.post('/api/login', wrap(async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(clean(req.body.email, 160).toLowerCase());
  if (!user || !(await verifyPassword(String(req.body.password || ''), user.password_hash))) return fail(res, 401, 'E-posta veya şifre hatalı.');
  if (user.closed_at) return fail(res, 403, 'Bu hesap kapatılmış. Destek ile iletişime geç.');
  setSession(res, user.id, req.body.rememberMe === true);
  res.json({ user: publicUser(user) });
}));
app.post('/api/password-reset/request',wrap(async(req,res)=>{
  if(!emailVerificationAvailable())return fail(res,503,'Şifre yenileme servisine şu anda ulaşılamıyor. Daha sonra tekrar dene.');
  const email=clean(req.body.email,160).toLowerCase();
  if(!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))return fail(res,400,'Geçerli bir e-posta adresi gir.');
  const message='Bu e-posta ile bir hesap varsa şifre yenileme kodu gönderildi.';
  const user=db.prepare('SELECT * FROM users WHERE email=? AND closed_at IS NULL').get(email);
  if(!user)return res.json({message});
  const previous=db.prepare('SELECT requested_at FROM password_reset_codes WHERE user_id=?').get(user.id);
  if(previous && previous.requested_at>Date.now()-60000)return res.json({message});
  const code=randomCode();
  db.prepare('INSERT OR REPLACE INTO password_reset_codes(user_id,code_hash,expires_at,requested_at) VALUES(?,?,?,?)').run(user.id,hash(code),Date.now()+15*60000,Date.now());
  const subject='Üni Satış şifre yenileme kodu';
  const text=`Şifre yenileme kodun: ${code}. Kod 15 dakika geçerlidir. Bu işlemi sen istemediysen bu e-postayı dikkate alma. Kodunu kimseyle paylaşma.`;
  try{
    if(brevoConfigured())await sendBrevoTextEmail(email,subject,text);
    else if(mailer)await mailer.sendMail({from:process.env.SMTP_FROM,to:email,subject,text});
  }catch{
    db.prepare('DELETE FROM password_reset_codes WHERE user_id=?').run(user.id);
    // The public response is identical for existing and unknown accounts.
    console.error('Password reset email delivery failed');
  }
  res.set('Cache-Control','no-store').json({message,...(testEmailCodes?{devCode:code}:{})});
}));
app.post('/api/password-reset/confirm',wrap(async(req,res)=>{
  const email=clean(req.body.email,160).toLowerCase(),code=clean(req.body.code,10),password=String(req.body.password||'');
  if(password.length<6 || !password.trim())return fail(res,400,'Yeni şifren en az 6 karakter olmalı.');
  if(password.length>256)return fail(res,400,'Şifren en fazla 256 karakter olabilir.');
  const user=db.prepare('SELECT * FROM users WHERE email=? AND closed_at IS NULL').get(email);
  const record=user && db.prepare('SELECT * FROM password_reset_codes WHERE user_id=?').get(user.id);
  if(!record || record.expires_at<Date.now() || record.attempts>=5 || !/^[0-9]{6}$/.test(code) || record.code_hash!==hash(code)){
    if(record)db.prepare('UPDATE password_reset_codes SET attempts=attempts+1 WHERE user_id=?').run(user.id);
    return fail(res,400,'Kod geçersiz veya süresi dolmuş. Yeni kod iste.');
  }
  const storedPassword=await passwordHash(password);
  let changed=false;
  transaction(()=>{
    const consumed=db.prepare('DELETE FROM password_reset_codes WHERE user_id=? AND code_hash=? AND expires_at>? AND attempts<5').run(user.id,hash(code),Date.now());
    if(!consumed.changes)return;
    const updated=db.prepare('UPDATE users SET password_hash=? WHERE id=? AND closed_at IS NULL').run(storedPassword,user.id);
    if(!updated.changes)return;
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    changed=true;
  });
  if(!changed)return fail(res,400,'Kod kullanılmış veya süresi dolmuş. Yeni kod iste.');
  res.json({message:'Şifren yenilendi. Yeni şifrenle giriş yapabilirsin.'});
}));
app.post('/api/logout', (req, res) => {
  const token = /(?:^|; )up_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
  res.clearCookie('up_session', { path: '/' });
  res.json({ ok: true });
});
app.delete('/api/me', (req,res) => {
  const user=requireUser(req,res);if(!user)return;
  if(user.role==='admin')return fail(res,403,'Yönetici hesabı bu yoldan silinemez.');
  if(String(req.body?.confirmation||'').trim().toLocaleUpperCase('tr-TR')!=='SİL')return fail(res,400,'Hesabı silmek için SİL yaz.');
  const listingPhotos=db.prepare('SELECT i.filename FROM listing_images i JOIN listings l ON l.id=i.listing_id WHERE l.seller_id=?').all(user.id);
  const messageFiles=db.prepare(`SELECT photo_filename,voice_filename FROM messages WHERE sender_id=? OR conversation_id IN
    (SELECT id FROM conversations WHERE buyer_id=? OR seller_id=?)`).all(user.id,user.id,user.id);
  transaction(()=>{
    db.prepare(`DELETE FROM reports WHERE reporter_id=? OR listing_id IN (SELECT id FROM listings WHERE seller_id=?)
      OR message_id IN (SELECT id FROM messages WHERE sender_id=? OR conversation_id IN
      (SELECT id FROM conversations WHERE buyer_id=? OR seller_id=?))`).run(user.id,user.id,user.id,user.id,user.id);
    db.prepare('DELETE FROM reports WHERE conversation_id IN (SELECT id FROM conversations WHERE buyer_id=? OR seller_id=?)').run(user.id,user.id);
    db.prepare('DELETE FROM admin_message_reviews WHERE conversation_id IN (SELECT id FROM conversations WHERE buyer_id=? OR seller_id=?)').run(user.id,user.id);
    db.prepare('DELETE FROM handoffs WHERE proposed_by=? OR conversation_id IN (SELECT id FROM conversations WHERE buyer_id=? OR seller_id=?)').run(user.id,user.id,user.id);
    db.prepare('DELETE FROM messages WHERE sender_id=? OR conversation_id IN (SELECT id FROM conversations WHERE buyer_id=? OR seller_id=?)').run(user.id,user.id,user.id);
    db.prepare('DELETE FROM conversations WHERE buyer_id=? OR seller_id=?').run(user.id,user.id);
    db.prepare('DELETE FROM offers WHERE buyer_id=? OR listing_id IN (SELECT id FROM listings WHERE seller_id=?)').run(user.id,user.id);
    db.prepare('DELETE FROM donation_requests WHERE requester_id=? OR listing_id IN (SELECT id FROM listings WHERE seller_id=?)').run(user.id,user.id);
    db.prepare('DELETE FROM favorites WHERE user_id=? OR listing_id IN (SELECT id FROM listings WHERE seller_id=?)').run(user.id,user.id);
    db.prepare('DELETE FROM listing_images WHERE listing_id IN (SELECT id FROM listings WHERE seller_id=?)').run(user.id);
    db.prepare('DELETE FROM listings WHERE seller_id=?').run(user.id);
    db.prepare('DELETE FROM users WHERE id=?').run(user.id);
  });
  const removeStoredFile=(dir,name)=>{if(name&&path.basename(name)===name)fs.rmSync(path.join(dir,name),{force:true});};
  removeStoredFile(avatarDir,user.avatar_filename);
  for(const photo of listingPhotos)removeStoredFile(uploadDir,photo.filename);
  for(const message of messageFiles){removeStoredFile(messageUploadDir,message.photo_filename);removeStoredFile(voiceUploadDir,message.voice_filename);}
  for(const response of messageStreams.get(user.id)||[])response.end();messageStreams.delete(user.id);
  res.clearCookie('up_session',{path:'/'});
  res.json({ok:true});
});
app.patch('/api/me/profile', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const name = clean(req.body.name,80);
  const university = clean(req.body.university,100);
  if (name.length < 2 || !universityNames.has(university)) return fail(res,400,'Ad ve listeden üniversite seçimi gerekli.');
  db.prepare('UPDATE users SET name=?,university=? WHERE id=?').run(name,university,user.id);
  res.json({ user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
});
app.patch('/api/me/email', wrap(async (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const email = clean(req.body.email,160).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email === user.email) return fail(res,400,'Farklı ve geçerli bir e-posta gir.');
  if (!await verifyPassword(String(req.body.password || ''),user.password_hash)) return fail(res,403,'Mevcut şifreni doğru gir.');
  if (db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(email,user.id)) return fail(res,409,'Bu e-posta zaten kayıtlı.');
  db.prepare('UPDATE users SET email=?,email_verified=0 WHERE id=?').run(email,user.id);
  let devCode;
  if (emailVerificationAvailable()) {
    try { devCode = await issueCode(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)); }
    catch {
      db.prepare('DELETE FROM verification_codes WHERE user_id=?').run(user.id);
      db.prepare('UPDATE users SET email=?,email_verified=? WHERE id=?').run(user.email,user.email_verified,user.id);
      return fail(res,503,'Doğrulama e-postası gönderilemedi; e-posta değiştirilmedi.');
    }
  } else db.prepare('DELETE FROM verification_codes WHERE user_id=?').run(user.id);
  res.json({ user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)), verificationRequired:emailVerificationAvailable(), devCode });
}));
app.patch('/api/me/phone', wrap(async (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  if (user.phone && !await verifyPassword(String(req.body.password || ''),user.password_hash)) return fail(res,403,'Mevcut şifreni doğru gir.');
  const phone = clean(req.body.phone,20).replace(/\s/g,'');
  if (!/^(?:\+90|0)?5\d{9}$/.test(phone)) return fail(res,400,'Geçerli bir cep telefonu numarası gir.');
  db.prepare('UPDATE users SET phone=?,phone_verified=0 WHERE id=?').run(phone,user.id); db.prepare('DELETE FROM phone_codes WHERE user_id=?').run(user.id);
  res.json({ user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
}));
app.post('/api/me/phone/send-code',authLimit,wrap(async(req,res)=>{
 const user=requireUser(req,res);if(!user)return;
 const phone=normalizePhone(user.phone);if(!phone)return fail(res,400,'Önce geçerli bir telefon numarası ekle.');
 if(user.phone_verified)return res.json({message:'Telefonun zaten doğrulanmış.'});
 if(!smsConfigured()&&!testPhoneCodes)return fail(res,503,'SMS doğrulama hizmeti henüz etkin değil. Numaran doğrulanmış sayılmadı.');
 const now=Date.now(),previous=db.prepare('SELECT sent_at FROM phone_codes WHERE user_id=?').get(user.id);
 if(previous&&now-previous.sent_at<60000)return res.status(429).set('Retry-After','60').json({error:'Yeni SMS istemeden önce 60 saniye bekle.'});
 if(db.prepare('SELECT id FROM users WHERE phone=? AND phone_verified=1 AND id<>?').get(phone,user.id))return fail(res,409,'Bu numara başka bir hesaba bağlı.');
 db.prepare('DELETE FROM sms_attempts WHERE sent_at<?').run(now-86400000);
 const hour=db.prepare('SELECT count(*) AS n FROM sms_attempts WHERE (user_id=? OR phone=?) AND sent_at>?').get(user.id,phone,now-3600000).n;
 const daily=db.prepare('SELECT count(*) AS n FROM sms_attempts WHERE user_id=? OR phone=?').get(user.id,phone).n;
 const total=db.prepare('SELECT count(*) AS n FROM sms_attempts').get().n;
 if(hour>=3||daily>=6||total>=Math.max(1,Number(process.env.SMS_DAILY_LIMIT||100)))return fail(res,429,'SMS gönderim sınırına ulaşıldı. Daha sonra tekrar dene.');
 const code=randomCode();db.prepare('INSERT INTO sms_attempts(user_id,phone,sent_at) VALUES(?,?,?)').run(user.id,phone,now);
 db.prepare('INSERT OR REPLACE INTO phone_codes(user_id,phone,code_hash,expires_at,attempts,sent_at) VALUES(?,?,?,?,0,?)').run(user.id,phone,hash(code),now+180000,now);
 try{if(!testPhoneCodes)await sendPhoneCode(phone,code);}catch{db.prepare('DELETE FROM phone_codes WHERE user_id=? AND code_hash=?').run(user.id,hash(code));return fail(res,503,'SMS gönderilemedi. Telefonun doğrulanmadı.');}
 res.json({message:'Doğrulama kodu SMS ile gönderildi. Kod 3 dakika geçerli.',retryAfter:60,...(testPhoneCodes?{devCode:code}:{})});
}));
app.post('/api/me/phone/verify',authLimit,(req,res)=>{
 const user=requireUser(req,res);if(!user)return;const code=clean(req.body.code,10),record=db.prepare('SELECT * FROM phone_codes WHERE user_id=?').get(user.id);
 if(!record||record.expires_at<Date.now()||record.attempts>=5||record.phone!==normalizePhone(user.phone))return fail(res,400,'Kod geçersiz veya süresi dolmuş. Yeni kod iste.');
 if(!/^\d{6}$/.test(code)||record.code_hash!==hash(code)){db.prepare('UPDATE phone_codes SET attempts=attempts+1 WHERE user_id=?').run(user.id);return fail(res,400,'Kod yanlış. En fazla 5 deneme yapabilirsin.');}
 try{transaction(()=>{db.prepare('UPDATE users SET phone=?,phone_verified=1 WHERE id=?').run(record.phone,user.id);db.prepare('DELETE FROM phone_codes WHERE user_id=?').run(user.id);});}catch{return fail(res,409,'Bu numara başka bir hesapta doğrulanmış.');}
 res.json({user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))});
});
app.post('/api/me/verify-email', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const code = clean(req.body.code,10);
  const record = db.prepare('SELECT * FROM verification_codes WHERE user_id=?').get(user.id);
  if (!validEmailCode(user,code)) return fail(res,400,'Kod geçersiz, deneme sınırı dolmuş veya süresi geçmiş.');
  db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(user.id);
  db.prepare('DELETE FROM verification_codes WHERE user_id=?').run(user.id);
  res.json({ user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
});

app.get('/api/support-application', (req,res) => {
  const user=requireUser(req,res); if(!user)return;
  res.json({ application:db.prepare('SELECT reason,family_income,identity_last4,status,submitted_at,reviewed_at FROM support_applications WHERE user_id=?').get(user.id)||null });
});
app.post('/api/support-application', (req,res) => {
  const user=requireUser(req,res); if(!user)return;
  const reason=clean(req.body.reason,1000), incomeText=String(req.body.familyIncome ?? ''), income=Number(incomeText), last4=clean(req.body.identityLast4,4);
  if(reason.length<30 || !/^\d+$/.test(incomeText) || !Number.isSafeInteger(income) || income<0 || income>1000000 || !/^\d{4}$/.test(last4)) return fail(res,400,'En az 30 karakterlik açıklama, aylık aile geliri ve kimlik numaranın son 4 hanesi gerekli.');
  const existing=db.prepare('SELECT status FROM support_applications WHERE user_id=?').get(user.id);
  if(existing?.status==='approved') return fail(res,409,'Destek başvurun zaten kabul edildi.');
  db.prepare(`INSERT INTO support_applications(user_id,reason,family_income,identity_last4,status) VALUES(?,?,?,?, 'pending')
    ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason,family_income=excluded.family_income,identity_last4=excluded.identity_last4,status='pending',submitted_at=CURRENT_TIMESTAMP,reviewed_at=NULL`).run(user.id,reason,income,last4);
  db.prepare('UPDATE users SET support_verified=0 WHERE id=?').run(user.id);
  res.status(201).json({ok:true});
});

const normalizeSearch = value => String(value || '').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/œ/g,'oe');
const searchWords = value => normalizeSearch(value).split(/[^a-z0-9]+/).filter(Boolean);
const closeWord = (query, word) => {
  if (word.includes(query)) return true;
  const limit=query.length>=7?2:query.length>=4?1:0;
  if (!limit || Math.abs(query.length-word.length)>limit) return false;
  const rows=Array.from({length:query.length+1},()=>Array(word.length+1).fill(0));
  for(let i=0;i<=query.length;i++)rows[i][0]=i;
  for(let j=0;j<=word.length;j++)rows[0][j]=j;
  for(let i=1;i<=query.length;i++){
    let best=limit+1;
    for(let j=1;j<=word.length;j++){
      rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(query[i-1]===word[j-1]?0:1));
      if(i>1 && j>1 && query[i-1]===word[j-2] && query[i-2]===word[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
      best=Math.min(best,rows[i][j]);
    }
    if(best>limit)return false;
  }
  return rows[query.length][word.length]<=limit;
};
const searchContentCache=new Map();
const listingSearchScore = (row, normalizedQuery, queryWords) => {
  let content=searchContentCache.get(row.id);
  if(!content||content.originalTitle!==row.title||content.originalDescription!==row.description){
    content={originalTitle:row.title,originalDescription:row.description,title:normalizeSearch(row.title),description:normalizeSearch(row.description),titleWords:searchWords(row.title),descriptionWords:searchWords(row.description)};
    if(searchContentCache.size>=1000)searchContentCache.delete(searchContentCache.keys().next().value);searchContentCache.set(row.id,content);
  }
  const {title,description,titleWords,descriptionWords}=content;
  if(title.includes(normalizedQuery))return 0;
  if(description.includes(normalizedQuery))return 1;
  if(queryWords.every(query=>titleWords.some(word=>closeWord(query,word))))return 2;
  const allWords=titleWords.concat(descriptionWords);
  if(queryWords.every(query=>allWords.some(word=>closeWord(query,word))))return 3;
  return null;
};
const listingSelect = `SELECT l.*, u.name AS seller_name, u.closed_at AS seller_closed,u.school_verified AS seller_school_verified,u.email_verified AS seller_email_verified,u.phone_verified AS seller_phone_verified,
 (SELECT filename FROM listing_images i WHERE i.listing_id=l.id ORDER BY position LIMIT 1) AS cover,
 (SELECT COUNT(*) FROM listing_images i WHERE i.listing_id=l.id) AS image_count
 FROM listings l JOIN users u ON u.id=l.seller_id`;
const listingSearchSelect=listingSelect.replace('FROM listings l JOIN users u ON u.id=l.seller_id','FROM listing_search CROSS JOIN listings l ON l.id=listing_search.rowid JOIN users u ON u.id=l.seller_id');
app.get('/api/listings', (req, res) => {
  const me = currentUser(req);
  const where = [`l.status='active'`, 'u.closed_at IS NULL'], args = [];
  if(req.query.otherUniversities==='1'){
    if(!me)return fail(res,401,'Diğer üniversitelerdeki ilanları görmek için giriş yap.');
    where.push('l.university<>?',"l.kind='sale'");args.push(me.university);
  }
  if (!me?.support_verified) where.push("l.kind='sale'");
  else { where.push("(l.kind='sale' OR l.university=?)"); args.push(me.university); }
  for (const [param, column] of [['university','university'],['category','category'],['kind','kind']]) {
    if (req.query[param]) { where.push(`l.${column}=?`); args.push(clean(req.query[param], 100)); }
  }
  if(req.query.condition){where.push('l.condition=?');args.push(clean(req.query.condition,40));}
  for(const [key,operator] of [['minPrice','>='],['maxPrice','<=']])if(req.query[key]!==undefined&&req.query[key]!==''){const amount=Number(req.query[key]);if(!Number.isFinite(amount)||amount<0||amount>10000000)return fail(res,400,'Geçersiz fiyat aralığı.');where.push(`l.price${operator}?`);args.push(Math.round(amount*100));}
  if(req.query.minPrice!==undefined&&req.query.maxPrice!==undefined&&Number(req.query.minPrice)>Number(req.query.maxPrice))return fail(res,400,'En düşük fiyat en yüksek fiyatı geçemez.');
  const sortOrders={'price-asc':'l.price ASC,l.id DESC','price-desc':'l.price DESC,l.id DESC',oldest:'l.id ASC'};
  const order=Object.hasOwn(sortOrders,String(req.query.sort))?sortOrders[String(req.query.sort)]:'l.id DESC';
  const query = normalizeSearch(clean(req.query.q, 100)).trim();
  const terms=searchWords(query);
  const pageSize=terms.length?100:Number(req.query.limit??24);
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>100)return fail(res,400,'Geçersiz sayfa boyutu.');
  if(req.query.after&&!terms.length){
    let cursor;try{cursor=JSON.parse(Buffer.from(String(req.query.after).slice(0,300),'base64url').toString());}catch{return fail(res,400,'Geçersiz ilan sayfası.');}
    if(!Number.isSafeInteger(cursor.id)||cursor.id<1||!Number.isSafeInteger(cursor.price)||cursor.price<0||cursor.sort!==(req.query.sort||'newest'))return fail(res,400,'Geçersiz ilan sayfası.');
    if(req.query.sort==='price-asc'||req.query.sort==='price-desc'){const operator=req.query.sort==='price-asc'?'>':'<';where.push(`(l.price${operator}? OR (l.price=? AND l.id<?))`);args.push(cursor.price,cursor.price,cursor.id);}
    else{where.push(req.query.sort==='oldest'?'l.id>?':'l.id<?');args.push(cursor.id);}
  }
  if(terms.length){where.push('listing_search MATCH ?');args.push(listingSearch.expression(terms,closeWord));}
  const searchOrder=terms.length&&order.startsWith('l.id ')?order.replace('l.id','listing_search.rowid'):order;
  const candidates = db.prepare(`${terms.length?listingSearchSelect:listingSelect} WHERE ${where.join(' AND ')} ORDER BY ${searchOrder} LIMIT ${terms.length?300:pageSize+1}`).all(...args);
  const rows = (terms.length ? candidates.map(row=>({row,score:listingSearchScore(row,query,terms)})).filter(item=>item.score!==null).sort((a,b)=>!req.query.sort||req.query.sort==='newest'?a.score-b.score:0).map(item=>item.row) : candidates).slice(0,pageSize);
  const hasMore=!terms.length&&candidates.length>pageSize,last=rows.at(-1);
  const nextCursor=hasMore?Buffer.from(JSON.stringify({id:last.id,price:last.price,sort:req.query.sort||'newest'})).toString('base64url'):null;
  const favoriteIds = me ? new Set(db.prepare('SELECT listing_id FROM favorites WHERE user_id=?').all(me.id).map(row=>row.listing_id)) : new Set();
  res.json({ listings: rows.map(row=>({ ...row, favorite:favoriteIds.has(row.id) })),page:{hasMore,nextCursor} });
});
app.get('/api/listings/:id', (req, res) => {
  const row = db.prepare(`${listingSelect} WHERE l.id=?`).get(req.params.id);
  if (!row) return fail(res, 404, 'İlan bulunamadı.');
  const me = currentUser(req);
  if (row.seller_closed && me?.role !== 'admin') return fail(res,404,'İlan bulunamadı.');
  if (['expired','removed'].includes(row.status) && me?.id !== row.seller_id && me?.role !== 'admin') return fail(res,404,'İlan bulunamadı.');
  if (row.kind === 'donation' && !me?.support_verified && me?.id !== row.seller_id && me?.role !== 'admin') return fail(res,404,'İlan bulunamadı.');
  if (row.kind === 'donation' && me && row.university !== me.university && row.seller_id !== me.id && me.role !== 'admin') return fail(res,404,'İlan bulunamadı.');
  const images = db.prepare('SELECT filename,position FROM listing_images WHERE listing_id=? ORDER BY position').all(row.id);
  const favorite = me ? !!db.prepare('SELECT 1 FROM favorites WHERE user_id=? AND listing_id=?').get(me.id,row.id) : false;
  res.json({ listing: { ...row, images, favorite } });
});
app.get('/api/sellers/:id/listings', (req, res) => {
  const seller = db.prepare('SELECT id,name,university,avatar_filename,email_verified,phone_verified FROM users WHERE id=? AND closed_at IS NULL').get(req.params.id);
  if (!seller) return fail(res,404,'Satıcı bulunamadı.');
  const listings = db.prepare(`${listingSelect} WHERE l.seller_id=? AND l.kind='sale' AND l.status='active' ORDER BY l.created_at DESC`).all(seller.id);
  seller.avatarUrl=seller.avatar_filename?'/api/users/'+seller.id+'/avatar?v='+encodeURIComponent(seller.avatar_filename):null;delete seller.avatar_filename;const me=currentUser(req),favorites=me?new Set(db.prepare('SELECT listing_id FROM favorites WHERE user_id=?').all(me.id).map(r=>r.listing_id)):new Set();res.json({seller,listings:listings.map(l=>({...l,favorite:favorites.has(l.id)}))});
});
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 6, fileSize: MAX_PHOTO_BYTES } });
app.get('/api/assistant/config',(_req,res)=>res.set('Cache-Control','no-store').json({aiAvailable:!!process.env.OPENAI_API_KEY?.trim(),photoModerationEnabled:moderationEnabled()}));
const assistantAttempts=new Map();let assistantActive=0,assistantDay='',assistantDailyCount=0;
setInterval(()=>{for(const [key,entry] of assistantAttempts)if(entry.reset<Date.now())assistantAttempts.delete(key);},60000).unref();
app.post('/api/assistant',async(req,res)=>{
 const message=req.body?.message;
 const history=req.body?.history;
 if(history!==undefined&&(!Array.isArray(history)||history.length>10||history.some(item=>!item||!['user','assistant'].includes(item.role)||typeof item.content!=='string'||item.content.length>2400)))return fail(res,400,'Sohbet geçmişi geçersiz.');
 if(typeof message!=='string'||!message.trim()||message.length>600)return fail(res,400,'Sorunu 1 ile 600 karakter arasında yaz.');
 const now=Date.now(),entry=assistantAttempts.get(req.ip)||{count:0,reset:now+60000};
 if(now>entry.reset){entry.count=0;entry.reset=now+60000;}
 entry.count++;assistantAttempts.set(req.ip,entry);
 if(entry.count>12){res.set('Retry-After','60');return fail(res,429,'Asistana çok hızlı mesaj gönderildi. Bir dakika sonra tekrar dene.');}
 if(assistantActive>=4)return fail(res,503,'Asistan şu anda yoğun. Biraz sonra tekrar dene.');
 const day=new Date().toISOString().slice(0,10);if(day!==assistantDay){assistantDay=day;assistantDailyCount=0;}
 const useAI=assistantDailyCount<Math.max(0,Number(process.env.APP_ASSISTANT_DAILY_LIMIT||200));
 if(useAI&&process.env.OPENAI_API_KEY)assistantDailyCount++;
 assistantActive++;
 try{res.set('Cache-Control','no-store').json(await answerAppQuestion(message.trim(),{env:useAI?process.env:{},history}));}
 finally{assistantActive--;}
});
app.post('/api/photos/check',(req,res,next)=>{if(requireUser(req,res))next();},upload.single('photo'),async(req,res)=>{
 if(!req.file)return fail(res,400,'Bir fotoğraf seç.');
 try{const photo=await preparePhoto(req.file);res.set('Cache-Control','no-store').json(await checkPhoto(photo));}
 catch(error){return fail(res,error.status||400,error.message);}
});
app.post('/api/me/avatar', (req,res,next)=>{if(requireUser(req,res))next();}, upload.single('photo'), async(req,res)=>{
 const user=currentUser(req);if(!req.file)return fail(res,400,'Bir profil fotoğrafı seç.');
 let photo;try{photo=await prepareCheckedPhoto(req.file);}catch(error){return fail(res,error.status||400,error.message);}
 const filename=randomBytes(16).toString('hex')+'.'+photo.type;
 fs.writeFileSync(path.join(avatarDir,filename),photo.buffer);
 try{db.prepare('UPDATE users SET avatar_filename=? WHERE id=?').run(filename,user.id);}catch(error){fs.rmSync(path.join(avatarDir,filename),{force:true});throw error;}
 if(user.avatar_filename)fs.rmSync(path.join(avatarDir,path.basename(user.avatar_filename)),{force:true});
 res.json({user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))});
});
app.delete('/api/me/avatar',(req,res)=>{
 const user=requireUser(req,res);if(!user)return;
 db.prepare('UPDATE users SET avatar_filename=NULL WHERE id=?').run(user.id);
 if(user.avatar_filename)fs.rmSync(path.join(avatarDir,path.basename(user.avatar_filename)),{force:true});
 res.json({user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))});
});
app.get('/api/users/:id/avatar',(req,res)=>{
 const user=requireUser(req,res);if(!user)return;
 const photo=db.prepare('SELECT avatar_filename FROM users WHERE id=? AND closed_at IS NULL').get(req.params.id)?.avatar_filename;
 if(!photo)return res.sendStatus(404);
 if(req.query.v&&req.query.v!==photo)return res.sendStatus(404);
 const ownVersionedPhoto=user.id===Number(req.params.id)&&req.query.v===photo;
 res.set('Cache-Control',ownVersionedPhoto?'private, max-age=31536000, immutable':'private, no-store');
 res.sendFile(path.resolve(avatarDir,path.basename(photo)));
});

const voiceType = buffer => buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])) ? 'webm' : buffer.subarray(0,4).toString() === 'OggS' ? 'ogg' : buffer.length >= 12 && buffer.subarray(4,8).toString() === 'ftyp' ? 'mp4' : null;
app.post('/api/listings', (req,res,next)=>{
  const user=requireUser(req,res);if(!user)return;
  if(!user.phone)return res.status(400).json({error:'İlan vermek için telefon numaranı eklemelisin.',fields:{phone:'Telefon numaranı ekle.'}});
  next();
}, upload.array('photos',6), async (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const kind = clean(req.body.kind), title = clean(req.body.title,100), description = clean(req.body.description,2000), category = clean(req.body.category,60), condition = clean(req.body.condition,40);
  const priceText = String(req.body.price ?? '');
  const price = kind === 'donation' ? 0 : Number(priceText) * 100;
  if (!['sale','donation'].includes(kind) || !title || !description || !category || !condition || (kind === 'sale' && !/^\d{1,9}$/.test(priceText)) || !Number.isSafeInteger(price) || price < 0) return fail(res,400,'İlan bilgilerini kontrol et.');
  if (!req.files?.length) return fail(res,400,'En az bir ürün fotoğrafı ekle.');
  let photos;
  try { photos = []; for(const file of req.files) photos.push(await prepareCheckedPhoto(file)); }
  catch(error){ return fail(res,error.status||400,error.message); }
  const result = db.prepare('INSERT INTO listings(seller_id,kind,title,description,category,condition,price,university,campus) VALUES(?,?,?,?,?,?,?,?,?)').run(user.id,kind,title,description,category,condition,price,user.university,'');
  photos.forEach((photo,index) => {
    const filename = `${randomBytes(16).toString('hex')}.${photo.type}`;
    fs.writeFileSync(path.join(uploadDir,filename),photo.buffer);
    db.prepare('INSERT INTO listing_images(listing_id,filename,position) VALUES(?,?,?)').run(result.lastInsertRowid,filename,index);
  });
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});
app.patch('/api/listings/:id', (req,res,next)=>{
 const user=requireUser(req,res);if(!user)return;
 const listing=db.prepare('SELECT seller_id FROM listings WHERE id=?').get(req.params.id);
 if(!listing||(listing.seller_id!==user.id&&user.role!=='admin'))return fail(res,404,'İlan bulunamadı.');
 next();
}, upload.array('photos',6), async (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const listing = db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.id);
  if (!listing || (listing.seller_id !== user.id && user.role !== 'admin')) return fail(res,404,'İlan bulunamadı.');
  const status = clean(req.body.status,20);
  if (listing.status === 'expired' && status && status !== 'removed') return fail(res,409,'Süresi dolan ilan yeniden yayına alınamaz. Yeni bir ilan oluştur.');
  if (status && !['active','reserved','sold','removed'].includes(status)) return fail(res,400,'Geçersiz durum.');
  const title = clean(req.body.title ?? listing.title,100), description = clean(req.body.description ?? listing.description,2000);
  const category=clean(req.body.category ?? listing.category,60),condition=clean(req.body.condition ?? listing.condition,40);
  const priceText = req.body.price === undefined ? null : String(req.body.price);
  const price = priceText === null ? listing.price : Number(priceText)*100;
  if (!title || !description || !category || !condition || (listing.kind==='sale' && priceText !== null && !/^\d{1,9}$/.test(priceText)) || !Number.isSafeInteger(price) || price < 0) return fail(res,400,'İlan bilgilerini kontrol et.');
  const existing=db.prepare('SELECT filename FROM listing_images WHERE listing_id=? ORDER BY position').all(listing.id).map(row=>row.filename);
  let kept=existing;
  if(req.body.keepPhotos!==undefined){
    try{kept=JSON.parse(String(req.body.keepPhotos));}catch{return fail(res,400,'Fotoğraf seçimini kontrol et.');}
    if(!Array.isArray(kept)||kept.some(name=>typeof name!=='string'||!existing.includes(name))||new Set(kept).size!==kept.length)return fail(res,400,'Fotoğraf seçimini kontrol et.');
  }
  const files=req.files||[];
  if(kept.length+files.length<1||kept.length+files.length>6)return fail(res,400,'İlanda 1 ile 6 fotoğraf olmalı.');
  let photos;
  try { photos = []; for(const file of files) photos.push(await prepareCheckedPhoto(file)); }
  catch(error){ return fail(res,error.status||400,error.message); }
  const added=[];
  try{
    photos.forEach(photo=>{const filename=`${randomBytes(16).toString('hex')}.${photo.type}`;fs.writeFileSync(path.join(uploadDir,filename),photo.buffer);added.push(filename);});
    transaction(()=>{
      db.prepare('UPDATE listings SET title=?,description=?,category=?,condition=?,price=?,status=? WHERE id=?').run(title,description,category,condition,listing.kind === 'donation' ? 0 : price,status || listing.status,listing.id);
      db.prepare('DELETE FROM listing_images WHERE listing_id=?').run(listing.id);
      [...kept,...added].forEach((filename,position)=>db.prepare('INSERT INTO listing_images(listing_id,filename,position) VALUES(?,?,?)').run(listing.id,filename,position));
    });
  }catch(error){added.forEach(filename=>fs.rmSync(path.join(uploadDir,filename),{force:true}));throw error;}
  existing.filter(filename=>!kept.includes(filename)).forEach(filename=>fs.rmSync(path.join(uploadDir,filename),{force:true}));
  res.json({ ok:true });
});
app.get('/api/mine', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  res.json({ listings: db.prepare(`${listingSelect} WHERE l.seller_id=? ORDER BY l.created_at DESC`).all(user.id) });
});
app.get('/api/favorites', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  res.json({ listings: db.prepare(`${listingSelect} JOIN favorites f ON f.listing_id=l.id WHERE f.user_id=? AND l.status NOT IN ('expired','removed') AND u.closed_at IS NULL AND (l.kind='sale' OR ?=1 OR l.seller_id=?) ORDER BY f.rowid DESC`).all(user.id,user.support_verified,user.id).map(row=>({ ...row, favorite:true })) });
});
app.post('/api/listings/:id/favorite', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const listing = db.prepare('SELECT kind,seller_id,status FROM listings WHERE id=?').get(req.params.id);
  if (!listing || listing.status === 'expired' || (listing.kind === 'donation' && !user.support_verified && listing.seller_id !== user.id)) return fail(res,404,'İlan bulunamadı.');
  db.prepare('INSERT OR IGNORE INTO favorites(user_id,listing_id) VALUES(?,?)').run(user.id,req.params.id);
  res.json({ favorite:true });
});
app.delete('/api/listings/:id/favorite', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  db.prepare('DELETE FROM favorites WHERE user_id=? AND listing_id=?').run(user.id,req.params.id);
  res.json({ favorite:false });
});
const usersBlocked = (first, second) => !!db.prepare('SELECT 1 FROM blocked_users WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').get(first,second,second,first);
app.post('/api/users/:id/block', (req,res) => {
  const user=requireUser(req,res);if(!user)return;
  const blockedId=Number(req.params.id);
  const target=Number.isSafeInteger(blockedId)?db.prepare('SELECT id,role FROM users WHERE id=? AND closed_at IS NULL').get(blockedId):null;
  if(!target || target.id===user.id || target.role==='admin')return fail(res,400,'Bu kullanıcı engellenemez.');
  db.prepare('INSERT OR IGNORE INTO blocked_users(blocker_id,blocked_id) VALUES(?,?)').run(user.id,target.id);
  res.json({blocked:true});
});
app.delete('/api/users/:id/block', (req,res) => {
  const user=requireUser(req,res);if(!user)return;
  db.prepare('DELETE FROM blocked_users WHERE blocker_id=? AND blocked_id=?').run(user.id,req.params.id);
  res.json({blocked:false});
});
app.post('/api/listings/:id/conversation', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const listing = db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.id);
  if (!listing || listing.status !== 'active' || listing.kind !== 'sale') return fail(res,404,'Aktif ilan bulunamadı.');
  if (listing.seller_id === user.id) return fail(res,400,'Kendi ilanına mesaj gönderemezsin.');
  if (usersBlocked(user.id,listing.seller_id)) return fail(res,403,'Bu kullanıcıyla mesajlaşma kapalı.');
  db.prepare('INSERT OR IGNORE INTO conversations(listing_id,buyer_id,seller_id) VALUES(?,?,?)').run(listing.id,user.id,listing.seller_id);
  const conversation = db.prepare('SELECT id FROM conversations WHERE listing_id=? AND buyer_id=?').get(listing.id,user.id);
  res.json({ id: conversation.id });
});
app.get('/api/conversations', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const rows = db.prepare(`SELECT c.id,c.listing_id,COALESCE(l.title,'Yönetim mesajı') AS title,l.status,u.id AS other_id,u.name AS other_name,u.university AS other_university,u.avatar_filename AS other_avatar,
    (SELECT CASE WHEN m.voice_filename IS NOT NULL THEN CASE WHEN m.body='' THEN '🎤 Sesli mesaj' ELSE '🎤 ' || m.body END WHEN m.photo_filename IS NOT NULL THEN CASE WHEN m.body='' THEN '📷 Fotoğraf' ELSE '📷 ' || m.body END ELSE m.body END FROM messages m WHERE m.conversation_id=c.id ORDER BY id DESC LIMIT 1) AS last_message,
    (SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY id DESC LIMIT 1) AS last_at,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.read_at IS NULL) AS unread_count
    FROM conversations c LEFT JOIN listings l ON l.id=c.listing_id JOIN users u ON u.id=CASE WHEN c.buyer_id=? THEN c.seller_id ELSE c.buyer_id END
     WHERE (c.buyer_id=? OR c.seller_id=?) AND (c.listing_id IS NULL OR l.kind='sale' OR ?=1 OR l.seller_id=?) ORDER BY COALESCE(last_at,c.created_at) DESC`).all(user.id,user.id,user.id,user.id,user.support_verified,user.id);
  const blockedByMe=db.prepare('SELECT 1 FROM blocked_users WHERE blocker_id=? AND blocked_id=?');
  const clearedRows=db.prepare('SELECT conversation_id,cleared_through FROM conversation_views WHERE user_id=?').all(user.id);
  const clearedMap=new Map(clearedRows.map(row=>[row.conversation_id,row.cleared_through]));
  for(const row of rows){const cleared=clearedMap.get(row.id);if(cleared){const latest=db.prepare('SELECT id FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT 1').get(row.id);if(!latest||latest.id<=cleared){row.last_message='';row.unread_count=0;}}}
  res.json({ conversations:rows.map(row=>({...row,other_avatar_url:row.other_avatar?'/api/users/'+row.other_id+'/avatar?v='+encodeURIComponent(row.other_avatar):null,blockedByMe:!!blockedByMe.get(user.id,row.other_id),messagesClosed:usersBlocked(user.id,row.other_id)})) });
});
app.get('/api/message-events', (req,res) => {
  const user=requireUser(req,res); if(!user)return;
  if(messageHub.size>=20000||(messageStreams.get(user.id)?.size||0)>=4){res.set('Retry-After','10');return fail(res,503,'Mesaj bağlantısı şu anda yoğun. Biraz sonra tekrar dene.');}
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache, no-transform');
  res.setHeader('Connection','keep-alive');
  res.setHeader('X-Accel-Buffering','no');
  res.flushHeaders();
  messageHub.add(user.id,req,res);
});
app.get('/api/unread-count', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const count = db.prepare(`SELECT COUNT(*) AS count FROM messages m
    JOIN conversations c ON c.id=m.conversation_id LEFT JOIN listings l ON l.id=c.listing_id
    WHERE (c.buyer_id=? OR c.seller_id=?) AND m.sender_id<>? AND m.read_at IS NULL
    AND (c.listing_id IS NULL OR l.kind='sale' OR ?=1 OR l.seller_id=?)`).get(user.id,user.id,user.id,user.support_verified,user.id).count;
  res.json({ count });
});
app.get('/api/conversations/:id/messages', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const conversation = db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.id);
  if (!conversation || ![conversation.buyer_id,conversation.seller_id].includes(user.id)) return fail(res,404,'Konuşma bulunamadı.');
  const before=req.query.before===undefined?null:Number(req.query.before);
  if(before!==null&&(!Number.isSafeInteger(before)||before<1||typeof req.query.before!=='string'))return fail(res,400,'Geçersiz mesaj sayfası.');
  const hasUnread=req.query.preview!=='1'&&db.prepare('SELECT 1 FROM messages WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL LIMIT 1').get(conversation.id,user.id);
  const readResult=hasUnread?db.prepare('UPDATE messages SET read_at=? WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL').run(Date.now(),conversation.id,user.id):{changes:0};
  if(readResult.changes)notifyConversation(conversation,user.id);
  const cleared=db.prepare('SELECT cleared_through FROM conversation_views WHERE user_id=? AND conversation_id=?').get(user.id,conversation.id)?.cleared_through||0;
  const args=before===null?[conversation.id,cleared]:[conversation.id,cleared,before];
  const rows=db.prepare(`SELECT id,sender_id,body,created_at,photo_filename,voice_filename,read_at FROM messages WHERE conversation_id=? AND id>?${before===null?'':' AND id<?'} ORDER BY id DESC LIMIT 201`).all(...args);
  const hasOlder=rows.length>200,messages=rows.slice(0,200).reverse();
  res.json({messages,page:{hasOlder,before:hasOlder?messages[0].id:null,viewBefore:before}});
});
app.post('/api/conversations/:id/clear',(req,res)=>{
 const user=requireUser(req,res);if(!user)return;
 const conversation=db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.id);
 if(!conversation||![conversation.buyer_id,conversation.seller_id].includes(user.id))return fail(res,404,'Konuşma bulunamadı.');
 if(req.body?.confirmation!==true)return fail(res,400,'Sohbeti temizlemeyi onayla.');
 const last=db.prepare('SELECT COALESCE(MAX(id),0) AS id FROM messages WHERE conversation_id=?').get(conversation.id).id;
 db.prepare('INSERT INTO conversation_views(user_id,conversation_id,cleared_through) VALUES(?,?,?) ON CONFLICT(user_id,conversation_id) DO UPDATE SET cleared_through=excluded.cleared_through').run(user.id,conversation.id,last);
 db.prepare('UPDATE messages SET read_at=? WHERE conversation_id=? AND sender_id<>? AND read_at IS NULL AND id<=?').run(Date.now(),conversation.id,user.id,last);
 res.json({ok:true});
});
app.post('/api/conversations/:id/messages', (req,res,next)=>{
 const user=requireUser(req,res);if(!user)return;
 const conversation=db.prepare('SELECT buyer_id,seller_id FROM conversations WHERE id=?').get(req.params.id);
 if(!conversation||![conversation.buyer_id,conversation.seller_id].includes(user.id))return fail(res,404,'Konuşma bulunamadı.');
 next();
}, upload.fields([{name:'photo',maxCount:1},{name:'voice',maxCount:1}]), async (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const conversation = db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.id);
  if (!conversation || ![conversation.buyer_id,conversation.seller_id].includes(user.id)) return fail(res,404,'Konuşma bulunamadı.');
  const recipientId = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;
  if (db.prepare('SELECT closed_at FROM users WHERE id=?').get(recipientId)?.closed_at) return fail(res,409,'Bu hesap artık mesaj alamıyor.');
  if (usersBlocked(user.id,recipientId)) return fail(res,403,'Bu kullanıcıyla mesajlaşma kapalı.');
  const body = clean(req.body?.body,2000);
  const photo=req.files?.photo?.[0], voice=req.files?.voice?.[0];
  if (!body && !photo && !voice) return fail(res,400,'Boş mesaj gönderilemez.');
  if (photo && voice) return fail(res,400,'Bir mesajda yalnızca bir fotoğraf veya ses kaydı gönder.');
  let preparedPhoto=null;
  try { if(photo) preparedPhoto=await preparePhoto(photo); }
  catch(error){ return fail(res,400,error.message); }
  const photoType=preparedPhoto?.type, audioType=voice?voiceType(voice.buffer):null;
  if(voice && !audioType)return fail(res,400,'Desteklenmeyen ses kaydı biçimi.');
  const filename=photoType?`${randomBytes(16).toString('hex')}.${photoType}`:null;
  const voiceFilename=audioType?`${randomBytes(16).toString('hex')}.${audioType}`:null;
  if(filename)fs.writeFileSync(path.join(messageUploadDir,filename),preparedPhoto.buffer);
  if(voiceFilename)fs.writeFileSync(path.join(voiceUploadDir,voiceFilename),voice.buffer);
  let messageId;
  try { messageId=db.prepare('INSERT INTO messages(conversation_id,sender_id,body,photo_filename,voice_filename) VALUES(?,?,?,?,?)').run(conversation.id,user.id,body,filename,voiceFilename).lastInsertRowid; }
  catch(error){if(filename)fs.rmSync(path.join(messageUploadDir,filename),{force:true});if(voiceFilename)fs.rmSync(path.join(voiceUploadDir,voiceFilename),{force:true});throw error;}
  notifyConversation(conversation,user.id);
  res.status(201).json({ ok:true,id:Number(messageId) });
});
app.patch('/api/messages/:id', (req,res)=>{
 const user=requireUser(req,res);if(!user)return;
 const message=db.prepare('SELECT * FROM messages WHERE id=? AND sender_id=?').get(req.params.id,user.id);
 if(!message)return fail(res,404,'Mesaj bulunamadı.');
 const body=clean(req.body?.body,2000);if(!body)return fail(res,400,'Mesaj boş olamaz.');
 db.prepare('UPDATE messages SET body=? WHERE id=?').run(body,message.id);
 const conversation=db.prepare('SELECT * FROM conversations WHERE id=?').get(message.conversation_id);notifyConversation(conversation,user.id);res.json({ok:true});
});
app.delete('/api/messages/:id', (req,res)=>{
 const user=requireUser(req,res);if(!user)return;
 const message=db.prepare('SELECT * FROM messages WHERE id=? AND sender_id=?').get(req.params.id,user.id);
 if(!message)return fail(res,404,'Mesaj bulunamadı.');
 db.prepare("UPDATE messages SET body='Bu mesaj silindi.',photo_filename=NULL,voice_filename=NULL WHERE id=?").run(message.id);
 const conversation=db.prepare('SELECT * FROM conversations WHERE id=?').get(message.conversation_id);notifyConversation(conversation,user.id);res.json({ok:true});
});
app.get('/api/messages/:id/photo', (req,res) => {
  const user=requireUser(req,res);if(!user)return;
  const image=db.prepare(`SELECT m.photo_filename,c.buyer_id,c.seller_id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=?`).get(req.params.id);
  if(!image?.photo_filename || ![image.buyer_id,image.seller_id].includes(user.id))return res.sendStatus(404);
  res.setHeader('Cache-Control','private, no-store');
  res.type(path.extname(image.photo_filename));
  res.sendFile(path.join(messageUploadDir,image.photo_filename));
});
app.get('/api/conversations/:id/handoff', (req,res) => {
  const user=requireUser(req,res);if(!user)return;
  const conversation=db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.id);
  if(!conversation || ![conversation.buyer_id,conversation.seller_id].includes(user.id)) return fail(res,404,'Konuşma bulunamadı.');
  res.json({handoff:db.prepare('SELECT * FROM handoffs WHERE conversation_id=?').get(conversation.id)||null});
});
app.post('/api/conversations/:id/handoff', (req,res) => {
  const user=requireUser(req,res);if(!user)return;
  const conversation=db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.id);
  if(!conversation || ![conversation.buyer_id,conversation.seller_id].includes(user.id)) return fail(res,404,'Konuşma bulunamadı.');
  const place=clean(req.body.place,120), meetingAt=clean(req.body.meetingAt,40);
  if(!place || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(meetingAt) || !Number.isFinite(Date.parse(meetingAt)) || Date.parse(meetingAt)<Date.now()) return fail(res,400,'Gelecekte bir zaman ve buluşma noktası seç.');
  db.prepare(`INSERT INTO handoffs(conversation_id,place,meeting_at,proposed_by,status) VALUES(?,?,?,?, 'proposed')
    ON CONFLICT(conversation_id) DO UPDATE SET place=excluded.place,meeting_at=excluded.meeting_at,proposed_by=excluded.proposed_by,status='proposed'`).run(conversation.id,place,meetingAt,user.id);
  res.json({ok:true});
});
app.patch('/api/conversations/:id/handoff', (req,res) => {
  const user=requireUser(req,res);if(!user)return;
  const conversation=db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.id);
  if(!conversation || ![conversation.buyer_id,conversation.seller_id].includes(user.id)) return fail(res,404,'Konuşma bulunamadı.');
  const handoff=db.prepare('SELECT * FROM handoffs WHERE conversation_id=?').get(conversation.id);
  if(!handoff) return fail(res,404,'Buluşma önerisi bulunamadı.');
  const status=clean(req.body.status,20);
  if(status==='confirmed' && (handoff.status!=='proposed' || handoff.proposed_by===user.id)) return fail(res,409,'Buluşmayı diğer taraf onaylamalı.');
  if(status==='completed' && handoff.status!=='confirmed') return fail(res,409,'Önce buluşmayı onaylayın.');
  if(!['confirmed','completed','cancelled'].includes(status)) return fail(res,400,'Geçersiz durum.');
  db.prepare('UPDATE handoffs SET status=? WHERE conversation_id=?').run(status,conversation.id);
  res.json({ok:true});
});
app.post('/api/listings/:id/offers', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const listing = db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.id);
  const amount = Math.round(Number(req.body.amount)*100);
  if (!listing || listing.kind !== 'sale' || listing.status !== 'active') return fail(res,404,'Satış ilanı bulunamadı.');
  if (listing.seller_id === user.id) return fail(res,403,'Bu ilana teklif veremezsin.');
  if (!Number.isInteger(amount) || amount <= 0) return fail(res,400,'Geçerli bir teklif tutarı gir.');
  const conversationId = transaction(() => {
    db.prepare('INSERT INTO offers(listing_id,buyer_id,amount) VALUES(?,?,?)').run(listing.id,user.id,amount);
    db.prepare('INSERT OR IGNORE INTO conversations(listing_id,buyer_id,seller_id) VALUES(?,?,?)').run(listing.id,user.id,listing.seller_id);
    const conversation = db.prepare('SELECT id FROM conversations WHERE listing_id=? AND buyer_id=?').get(listing.id,user.id);
    db.prepare('INSERT INTO messages(conversation_id,sender_id,body) VALUES(?,?,?)').run(conversation.id,user.id,`${new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(amount/100)} fiyat teklifi gönderdi.`);
    return conversation.id;
  });
  notifyConversation({id:conversationId,buyer_id:user.id,seller_id:listing.seller_id},user.id);
  res.status(201).json({ ok:true, conversationId });
});
app.get('/api/offers', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  res.json({ offers:db.prepare(`SELECT o.*,l.title,u.name AS buyer_name FROM offers o JOIN listings l ON l.id=o.listing_id JOIN users u ON u.id=o.buyer_id WHERE l.seller_id=? ORDER BY o.id DESC`).all(user.id) });
});
app.patch('/api/offers/:id', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const offer = db.prepare('SELECT o.*,l.seller_id,l.status AS listing_status FROM offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=?').get(req.params.id);
  if (!offer || offer.seller_id !== user.id) return fail(res,404,'Teklif bulunamadı.');
  const status = clean(req.body.status);
  if (!['accepted','rejected'].includes(status) || offer.status !== 'pending' || (status==='accepted' && offer.listing_status!=='active')) return fail(res,400,'Teklif yanıtlanamıyor.');
  db.prepare('UPDATE offers SET status=? WHERE id=?').run(status,offer.id);
  if (status === 'accepted') db.prepare("UPDATE listings SET status='reserved' WHERE id=? AND status='active'").run(offer.listing_id);
  res.json({ ok:true });
});
app.post('/api/listings/:id/requests', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  if (!user.support_verified) return fail(res,403,'Ücretsiz ürünleri yalnızca destek başvurusu kabul edilen hesaplar talep edebilir.');
  const listing = db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.id);
  if (!listing || listing.kind !== 'donation' || listing.status !== 'active') return fail(res,404,'Ücretsiz ilan bulunamadı.');
  if (listing.seller_id === user.id || listing.university !== user.university) return fail(res,403,'Bu ürünü talep edemezsin.');
  const pendingCount = db.prepare("SELECT COUNT(*) AS count FROM donation_requests WHERE requester_id=? AND status IN ('pending','accepted')").get(user.id).count;
  if (pendingCount >= 3) return fail(res,429,'Aynı anda en fazla 3 açık Dayanışma talebin olabilir.');
  const note = clean(req.body.note,500);
  if (!note) return fail(res,400,'Kısa bir talep notu yaz.');
  try { db.prepare('INSERT INTO donation_requests(listing_id,requester_id,note) VALUES(?,?,?)').run(listing.id,user.id,note); }
  catch { return fail(res,409,'Bu ürüne zaten talep gönderdin.'); }
  res.status(201).json({ ok:true });
});
app.get('/api/donation-requests', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const rows = db.prepare(`SELECT r.id,r.listing_id,r.note,r.status,r.created_at,l.title,u.name AS requester_name
    FROM donation_requests r JOIN listings l ON l.id=r.listing_id JOIN users u ON u.id=r.requester_id
    WHERE l.seller_id=? ORDER BY r.id DESC`).all(user.id);
  res.json({ requests:rows });
});
app.get('/api/my-donation-requests', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const requests = db.prepare(`SELECT r.id,r.listing_id,r.status,r.created_at,l.title,l.university
    FROM donation_requests r JOIN listings l ON l.id=r.listing_id
    WHERE r.requester_id=? ORDER BY r.id DESC`).all(user.id);
  res.json({ requests });
});
app.patch('/api/donation-requests/:id', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const request = db.prepare('SELECT r.*,l.seller_id,l.status AS listing_status FROM donation_requests r JOIN listings l ON l.id=r.listing_id WHERE r.id=?').get(req.params.id);
  if (!request || request.seller_id !== user.id) return fail(res,404,'Talep bulunamadı.');
  const status = clean(req.body.status);
  if (!['accepted','rejected','completed'].includes(status)) return fail(res,400,'Geçersiz durum.');
  if (status === 'accepted' && (request.status !== 'pending' || request.listing_status !== 'active')) return fail(res,409,'Ürün artık uygun değil.');
  if (status === 'completed' && request.status !== 'accepted') return fail(res,409,'Önce talebi kabul et.');
  db.prepare('UPDATE donation_requests SET status=? WHERE id=?').run(status,request.id);
  if (status === 'accepted') {
    db.prepare("UPDATE listings SET status='reserved' WHERE id=?").run(request.listing_id);
    db.prepare("UPDATE donation_requests SET status='rejected' WHERE listing_id=? AND id<>? AND status='pending'").run(request.listing_id,request.id);
  }
  if (status === 'completed') db.prepare("UPDATE listings SET status='sold' WHERE id=?").run(request.listing_id);
  res.json({ ok:true });
});
app.post('/api/reports', (req, res) => {
  const user = requireUser(req,res); if (!user) return;
  const reason = clean(req.body.reason,500), listingId = Number(req.body.listingId), messageId=Number(req.body.messageId),conversationId=Number(req.body.conversationId);
  if(!reason)return fail(res,400,'Şikâyet nedeni gerekli.');
  if(conversationId){
    const conversation=db.prepare('SELECT buyer_id,seller_id FROM conversations WHERE id=?').get(conversationId);
    if(!conversation||![conversation.buyer_id,conversation.seller_id].includes(user.id))return fail(res,404,'Sohbet bulunamadı.');
    db.prepare('INSERT INTO reports(reporter_id,conversation_id,reason) VALUES(?,?,?)').run(user.id,conversationId,reason);
  }else if(messageId){
    const message=db.prepare('SELECT m.sender_id,c.buyer_id,c.seller_id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=?').get(messageId);
    if(!message || ![message.buyer_id,message.seller_id].includes(user.id) || message.sender_id===user.id)return fail(res,404,'Mesaj bulunamadı.');
    db.prepare('INSERT INTO reports(reporter_id,message_id,reason) VALUES(?,?,?)').run(user.id,messageId,reason);
  }else{
    if(!db.prepare('SELECT 1 FROM listings WHERE id=?').get(listingId))return fail(res,400,'İlan gerekli.');
    db.prepare('INSERT INTO reports(reporter_id,listing_id,reason) VALUES(?,?,?)').run(user.id,listingId,reason);
  }
  res.status(201).json({ ok:true });
});
app.get('/api/admin/queue', (req, res) => {
  if (!requireAdmin(req,res)) return;
  res.json({ support:db.prepare("SELECT a.user_id,a.reason,a.family_income,a.identity_last4,a.status,a.submitted_at,a.reviewed_at,u.name,u.email,u.phone,u.university,u.email_verified,u.created_at FROM support_applications a JOIN users u ON u.id=a.user_id WHERE u.closed_at IS NULL ORDER BY CASE WHEN a.status='pending' THEN 0 ELSE 1 END,a.submitted_at DESC").all(), reports:db.prepare("SELECT r.*,COALESCE(r.conversation_id,m.conversation_id) AS conversation_id,m.sender_id AS message_sender_id FROM reports r LEFT JOIN messages m ON m.id=r.message_id WHERE r.status='open' ORDER BY r.id DESC").all() });
});
app.get('/api/messages/:id/voice', (req,res) => {
  const user=requireUser(req,res);if(!user)return;
  const audio=db.prepare('SELECT m.voice_filename,c.buyer_id,c.seller_id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=?').get(req.params.id);
  if(!audio?.voice_filename || ![audio.buyer_id,audio.seller_id].includes(user.id))return res.sendStatus(404);
  const type={webm:'audio/webm',ogg:'audio/ogg',mp4:'audio/mp4'}[path.extname(audio.voice_filename).slice(1)];
  if(!type)return res.sendStatus(404);
  res.setHeader('Cache-Control','private, no-store');
  res.type(type);
  res.sendFile(path.join(voiceUploadDir,audio.voice_filename));
});
app.post('/api/admin/accounts/:id/message', (req,res)=>{
  const admin=requireAdmin(req,res);if(!admin)return;
  const account=db.prepare('SELECT id,closed_at FROM users WHERE id=?').get(req.params.id);
  if(!account || account.closed_at || account.id===admin.id)return fail(res,400,'Bu hesaba mesaj gönderilemez.');
  let conversation=db.prepare('SELECT * FROM conversations WHERE listing_id IS NULL AND buyer_id=? AND seller_id=?').get(account.id,admin.id);
  if(!conversation){const result=db.prepare('INSERT INTO conversations(listing_id,buyer_id,seller_id) VALUES(NULL,?,?)').run(account.id,admin.id);conversation=db.prepare('SELECT * FROM conversations WHERE id=?').get(result.lastInsertRowid);}
  res.json({conversationId:conversation.id});
});
app.get('/api/admin/accounts/:id/listings',(req,res)=>{
  if(!requireAdmin(req,res))return;
  const listings=db.prepare('SELECT id,title,price,kind,status FROM listings WHERE seller_id=? ORDER BY id DESC').all(req.params.id);
  res.json({listings});
});
app.get('/api/admin/accounts', (req, res) => {
  if (!requireAdmin(req,res)) return;
  const accounts = db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.university,u.role,u.email_verified,u.created_at,u.closed_at,
    (SELECT COUNT(*) FROM listings l WHERE l.seller_id=u.id) AS listing_count,
    (SELECT status FROM support_applications a WHERE a.user_id=u.id) AS support_status
    FROM users u ORDER BY u.id DESC`).all();
  res.json({ total:accounts.length, active:accounts.filter(account=>!account.closed_at).length, accounts });
});
app.get('/api/admin/accounts/:id/conversations', (req,res) => {
  if(!requireAdmin(req,res))return;
  const account=db.prepare('SELECT id,name FROM users WHERE id=?').get(req.params.id);
  if(!account)return fail(res,404,'Hesap bulunamadı.');
  const conversations=db.prepare(`SELECT c.id,c.listing_id,COALESCE(l.title,'Yönetim mesajı') AS title,
    CASE WHEN c.buyer_id=? THEN seller.name ELSE buyer.name END AS other_name,
    (SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id=c.id) AS last_at,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) AS message_count
    FROM conversations c LEFT JOIN listings l ON l.id=c.listing_id
    JOIN users buyer ON buyer.id=c.buyer_id JOIN users seller ON seller.id=c.seller_id
    WHERE c.buyer_id=? OR c.seller_id=? ORDER BY last_at DESC,c.id DESC`).all(account.id,account.id,account.id);
  res.json({account,conversations});
});
app.post('/api/admin/conversations/:id/review', (req,res) => {
  const admin=requireAdmin(req,res);if(!admin)return;
  const reason=clean(req.body?.reason,500);
  if(reason.length<10)return fail(res,400,'İnceleme gerekçesini en az 10 karakterle yaz.');
  const conversation=db.prepare('SELECT id FROM conversations WHERE id=?').get(req.params.id);
  if(!conversation)return fail(res,404,'Konuşma bulunamadı.');
  db.prepare('INSERT INTO admin_message_reviews(admin_id,conversation_id,reason) VALUES(?,?,?)').run(admin.id,conversation.id,reason);
  const messages=db.prepare(`SELECT m.id,m.sender_id,u.name AS sender_name,m.body,m.photo_filename,m.voice_filename,m.created_at
    FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? ORDER BY m.id ASC`).all(conversation.id);
  res.json({messages});
});
app.get('/api/admin/messages/:id/:kind', (req,res) => {
  const admin=requireAdmin(req,res);if(!admin)return;
  if(!['photo','voice'].includes(req.params.kind))return res.sendStatus(404);
  const message=db.prepare(`SELECT m.conversation_id,m.photo_filename,m.voice_filename FROM messages m WHERE m.id=?`).get(req.params.id);
  if(!message || !db.prepare('SELECT 1 FROM admin_message_reviews WHERE admin_id=? AND conversation_id=?').get(admin.id,message.conversation_id))return res.sendStatus(404);
  const filename=req.params.kind==='photo'?message.photo_filename:message.voice_filename;
  if(!filename)return res.sendStatus(404);
  res.setHeader('Cache-Control','private, no-store');
  res.type(path.extname(filename));
  res.sendFile(path.join(req.params.kind==='photo'?messageUploadDir:voiceUploadDir,filename));
});
app.patch('/api/admin/accounts/:id', (req, res) => {
  const admin=requireAdmin(req,res); if(!admin)return;
  const account=db.prepare('SELECT id,role,closed_at FROM users WHERE id=?').get(req.params.id);
  if(!account)return fail(res,404,'Hesap bulunamadı.');
  if(account.role==='admin' || account.id===admin.id)return fail(res,403,'Yönetici hesabı kapatılamaz.');
  if(typeof req.body.closed !== 'boolean')return fail(res,400,'Geçersiz hesap durumu.');
  if(req.body.closed===!!account.closed_at)return res.json({ok:true});
  transaction(()=>{
    db.prepare('UPDATE users SET closed_at=? WHERE id=?').run(req.body.closed?new Date().toISOString():null,account.id);
    if(req.body.closed){
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(account.id);
      db.prepare("UPDATE listings SET status='removed' WHERE seller_id=? AND status IN ('active','reserved')").run(account.id);
    }
  });
  if(req.body.closed){for(const response of messageStreams.get(account.id)||[])response.end();messageStreams.delete(account.id);}
  res.json({ok:true});
});
app.patch('/api/admin/support/:id', (req,res) => {
  if(!requireAdmin(req,res))return;
  const status=clean(req.body.status,20);
  if(!['approved','rejected'].includes(status))return fail(res,400,'Geçersiz karar.');
  const application=db.prepare("SELECT user_id FROM support_applications WHERE user_id=? AND status='pending'").get(req.params.id);
  if(!application)return fail(res,404,'Bekleyen başvuru bulunamadı.');
  transaction(()=>{
    db.prepare('UPDATE support_applications SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE user_id=?').run(status,application.user_id);
    db.prepare('UPDATE users SET support_verified=? WHERE id=?').run(status==='approved'?1:0,application.user_id);
  });
  res.json({ok:true});
});
app.delete('/api/admin/support/:id',(req,res)=>{
 if(!requireAdmin(req,res))return;
 if(req.body.confirmation!==true)return fail(res,400,'İşlemi onaylamalısın.');
 const application=db.prepare('SELECT status FROM support_applications WHERE user_id=?').get(req.params.id);
 if(!application)return fail(res,404,'Başvuru bulunamadı.');
 if(application.status==='pending')return fail(res,409,'Önce başvuruyu değerlendir.');
 transaction(()=>{
  db.prepare('UPDATE users SET support_verified=0 WHERE id=?').run(req.params.id);
  db.prepare('DELETE FROM support_applications WHERE user_id=?').run(req.params.id);
 });
 res.json({ok:true});
});
app.patch('/api/admin/reports/:id', (req, res) => {
  if (!requireAdmin(req,res)) return;
  const report = db.prepare('SELECT * FROM reports WHERE id=?').get(req.params.id);
  if (!report) return fail(res,404,'Şikâyet bulunamadı.');
  if (req.body.removeListing && report.listing_id) db.prepare("UPDATE listings SET status='removed' WHERE id=?").run(report.listing_id);
  db.prepare("UPDATE reports SET status='closed' WHERE id=?").run(report.id);
  res.json({ ok:true });
});

const listingPhotoCache=new Map();
app.get('/uploads/:filename', async (req, res) => {
  expireListings();
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(req.params.filename)) return res.sendStatus(404);
  const image = db.prepare('SELECT l.kind,l.seller_id,l.university,l.status,u.closed_at AS seller_closed FROM listing_images i JOIN listings l ON l.id=i.listing_id JOIN users u ON u.id=l.seller_id WHERE i.filename=?').get(req.params.filename);
  if (!image) return res.sendStatus(404);
  if (image.seller_closed) return res.sendStatus(404);
  const user = currentUser(req);
  if (['expired','removed'].includes(image.status) && user?.id !== image.seller_id && user?.role !== 'admin') return res.sendStatus(404);
  if (image.kind === 'donation' && !user?.support_verified && user?.id !== image.seller_id) return res.sendStatus(404);
  if (image.kind === 'donation' && user && image.university !== user.university && user.id !== image.seller_id) return res.sendStatus(404);
  res.setHeader('Cache-Control',image.kind==='donation'||image.status!=='active'?'private, no-store':'public, max-age=86400');
  const width=Number(req.query.width);
  if([160,480,1600].includes(width)){
    const key=req.params.filename+':'+width;
    let buffer=listingPhotoCache.get(key);
    if(!buffer){
      try{buffer=await sharp(path.join(uploadDir,req.params.filename),{limitInputPixels:60000000}).rotate().resize({width,height:width,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:80}).toBuffer();}
      catch{return res.sendFile(path.join(uploadDir,req.params.filename));}
      if(buffer.length<1024*1024){if(listingPhotoCache.size>=32)listingPhotoCache.delete(listingPhotoCache.keys().next().value);listingPhotoCache.set(key,buffer);}
    }
    return res.type('image/jpeg').send(buffer);
  }
  res.sendFile(path.join(uploadDir,req.params.filename));
});
app.use('/api', (req,res) => fail(res,404,'API yolu bulunamadı.'));
app.use('/university-logos',express.static(path.join(root,'public','university-logos'),{maxAge:'7d',fallthrough:false}));
app.use(express.static(path.join(root,'public')));
app.use((req, res) => res.sendFile(path.join(root,'public','index.html')));
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) return fail(res,400,'Dosya sınırı aşıldı (en çok 6 fotoğraf; dosya başına 12 MB).');
  return fail(res,500,'Beklenmeyen bir hata oluştu.');
});
app.listen(port, localMode?'127.0.0.1':undefined, () => console.log(`Üni Satış hazır: http://localhost:${port}`));
