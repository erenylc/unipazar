export const brevoConfigured = () => Boolean(process.env.BREVO_API_KEY && process.env.BREVO_FROM);

export async function sendBrevoVerificationCode(email, code, fetchImpl = fetch) {
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
      subject: 'Üni Satış e-posta doğrulama kodu',
      textContent: `Doğrulama kodun: ${code}. Kod 15 dakika geçerlidir.`
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Brevo rejected verification email (${response.status})`);
}
