import {OAuth2Client} from 'google-auth-library';

export async function verifyGoogleCredential(credential, clientId, nonce, client = new OAuth2Client()) {
  if (!clientId || typeof credential !== 'string' || credential.length > 12000 || !nonce) throw new Error('Google doğrulaması geçersiz.');
  const ticket = await client.verifyIdToken({idToken:credential, audience:clientId});
  const payload = ticket.getPayload();
  if (!payload?.sub || payload.nonce !== nonce || !payload.email || payload.email_verified !== true) throw new Error('Google hesabının e-postası doğrulanamadı.');
  return {sub:payload.sub, name:String(payload.name || '').slice(0,80), email:payload.email.toLowerCase(), authoritative:payload.email.toLowerCase().endsWith('@gmail.com') || Boolean(payload.hd)};
}
