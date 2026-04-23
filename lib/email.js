import { BrevoClient } from '@getbrevo/brevo';

let brevo;

function getApi() {
  if (!brevo) {
    brevo = new BrevoClient({
      apiKey: process.env.BREVO_API_KEY,
    });
  }
  return brevo;
}

const FROM_NAME = 'SER-CAT Scheduler';
const FROM_EMAIL = process.env.EMAIL_FROM || 'scheduler@sercat.org';
const REPLY_TO_EMAIL = process.env.EMAIL_REPLY_TO || 'admin@sercat.org';

export async function sendEmail({ to, subject, html, text }) {
  try {
    const result = await getApi().transactionalEmails.sendTransacEmail({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: (Array.isArray(to) ? to : [to]).map((email) => ({ email })),
      replyTo: { email: REPLY_TO_EMAIL },
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
