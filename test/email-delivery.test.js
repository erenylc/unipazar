import test from 'node:test';
import assert from 'node:assert/strict';
import {sendBrevoVerificationCode} from '../email-delivery.js';

test('Brevo verification email uses the recipient and code without exposing the API key in the body', async () => {
  const previousKey = process.env.BREVO_API_KEY;
  const previousFrom = process.env.BREVO_FROM;
  process.env.BREVO_API_KEY = 'test-api-key';
  process.env.BREVO_FROM = 'sender@example.com';
  try {
    let request;
    await sendBrevoVerificationCode('friend@example.com', '123456', async (url, options) => {
      request = {url, options};
      return {ok: true, status: 201};
    });
    assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(request.options.headers['api-key'], 'test-api-key');
    const body = JSON.parse(request.options.body);
    assert.equal(body.sender.email, 'sender@example.com');
    assert.deepEqual(body.to, [{email: 'friend@example.com'}]);
    assert.match(body.textContent, /123456/);
    assert.ok(!request.options.body.includes('test-api-key'));
    await assert.rejects(
      sendBrevoVerificationCode('friend@example.com', '123456', async () => ({ok: false, status: 401})),
      /rejected verification email \(401\)/
    );
  } finally {
    if (previousKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.BREVO_FROM;
    else process.env.BREVO_FROM = previousFrom;
  }
});
