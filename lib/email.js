import { Resend } from 'resend';

let resend;

function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'SER-CAT Scheduler <onboarding@resend.dev>';

export async function sendEmail({ to, subject, html, text }) {
  try {
    const result = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    });
    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.error(`[EMAIL ERROR] Failed to send "${subject}" to ${to}:`, err.message);
    return { ok: false, error: err.message };
  }
}
