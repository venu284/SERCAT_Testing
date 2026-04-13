// Placeholder — Step 6 will implement fully
import { Resend } from 'resend';

let resend;

export function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}
