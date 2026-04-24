import { BrevoClient } from '@getbrevo/brevo';
import { getEnvOrDefault, getRequiredEnv } from './env.js';

let brevo;

function getApi() {
  if (!brevo) {
    brevo = new BrevoClient({
      apiKey: getRequiredEnv('BREVO_API_KEY'),
    });
  }
  return brevo;
}

const FROM_NAME = 'SER-CAT Scheduler';

function getFromEmail() {
  return getEnvOrDefault('EMAIL_FROM', 'scheduler@sercat.org');
}

function getReplyToEmail() {
  return getEnvOrDefault('EMAIL_REPLY_TO', 'admin@sercat.org');
}

export async function sendEmail({ to, subject, html, text }) {
  try {
    const result = await getApi().transactionalEmails.sendTransacEmail({
      sender: { name: FROM_NAME, email: getFromEmail() },
      to: (Array.isArray(to) ? to : [to]).map((email) => ({ email })),
      replyTo: { email: getReplyToEmail() },
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {}),
    });

    return {
      ok: true,
      messageId: result?.data?.messageId || result?.messageId || result?.body?.messageId || null,
    };
  } catch (err) {
    const error = err?.message || String(err);
    console.error(`[EMAIL ERROR] Failed to send "${subject}" to ${to}:`, error);
    return { ok: false, error };
  }
}
