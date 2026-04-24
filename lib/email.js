import { getEnvOrDefault, getRequiredEnv } from './env.js';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const FROM_NAME = 'SER-CAT Scheduler';

function getFromEmail() {
  return getEnvOrDefault('EMAIL_FROM', 'scheduler@sercat.org');
}

function getReplyToEmail() {
  return getEnvOrDefault('EMAIL_REPLY_TO', 'admin@sercat.org');
}

export async function sendEmail({ to, subject, html, text }) {
  let apiKey;
  try {
    apiKey = getRequiredEnv('BREVO_API_KEY');
  } catch {
    console.error('[EMAIL ERROR] BREVO_API_KEY is not set');
    return { ok: false, error: 'BREVO_API_KEY is not configured' };
  }

  const recipients = Array.isArray(to)
    ? to.map((email) => ({ email }))
    : [{ email: to }];

  const body = {
    sender: { name: FROM_NAME, email: getFromEmail() },
    to: recipients,
    replyTo: { email: getReplyToEmail() },
    subject,
    htmlContent: html,
  };

  if (text) {
    body.textContent = text;
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.message || `HTTP ${response.status}`;
      console.error(`[EMAIL ERROR] Failed to send "${subject}" to ${to}: ${errorMsg}`);
      return { ok: false, error: errorMsg };
    }

    const data = await response.json();
    return { ok: true, messageId: data.messageId || null };
  } catch (err) {
    const error = err?.message || String(err);
    console.error(`[EMAIL ERROR] Failed to send "${subject}" to ${to}:`, error);
    return { ok: false, error };
  }
}
