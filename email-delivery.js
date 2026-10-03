export const brevoConfigured = () => Boolean(process.env.BREVO_API_KEY && process.env.BREVO_FROM);

export async function sendBrevoVerificationCode(email, code, fetchImpl = fetch) {
  return sendBrevoTextEmail(email,'Üni Satış e-posta doğrulama kodu',`Doğrulama kodun: ${code}. Kod 15 dakika geçerlidir.`,fetchImpl);
}

export async function sendBrevoTextEmail(email, subject, textContent, fetchImpl = fetch) {
  if (!brevoConfigured()) throw new Error('Brevo is not configured');
  const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': process.env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_FROM, name: 'Üni Satış' },
      to: [{ email }],
      subject,
      textContent
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Brevo rejected verification email (${response.status})`);
}
