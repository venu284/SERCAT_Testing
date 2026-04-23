const APP_URL = process.env.APP_URL || 'https://sercat-testing.vercel.app';

const BRAND = {
  navy: '#0f2a4a',
  gold: '#c8982a',
  teal: '#1a8a7d',
  gray: '#64748b',
  bg: '#faf8f5',
  white: '#ffffff',
};

function layout(title, bodyContent) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.white};border-radius:16px;border:1px solid #e5e1d8;overflow:hidden;">
  <tr><td style="background:${BRAND.navy};padding:24px 32px;">
    <span style="color:${BRAND.gold};font-size:20px;font-weight:700;letter-spacing:1px;">SERCAT</span>
    <span style="color:rgba(255,255,255,0.7);font-size:12px;margin-left:12px;letter-spacing:2px;text-transform:uppercase;">Scheduler</span>
  </td></tr>
  <tr><td style="padding:32px;">
    <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND.navy};">${title}</h1>
    ${bodyContent}
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #e5e1d8;">
    <p style="margin:0;font-size:12px;color:${BRAND.gray};">
      SER-CAT Beamline Scheduling System &bull; Advanced Photon Source &bull; Argonne National Laboratory
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(href, label) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td>
    <a href="${href}" style="display:inline-block;padding:12px 28px;background:${BRAND.navy};color:${BRAND.white};text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">${label}</a>
  </td></tr></table>`;
}

function p(text) {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155;">${text}</p>`;
}

export function accountInviteEmail({ name, email, activationToken, institutionName }) {
  const link = `${APP_URL}/activate?token=${activationToken}`;
  return {
    subject: 'SER-CAT Scheduler — Activate Your Account',
    html: layout('Welcome to SER-CAT Scheduler', `
      ${p(`Hello ${name},`)}
      ${p(`You've been invited to the SER-CAT beam time scheduling system${institutionName ? ` as the PI representative for <strong>${institutionName}</strong>` : ''}.`)}
      ${p('Click the button below to set your password and activate your account. This link expires in 72 hours.')}
      ${button(link, 'Activate Account')}
      ${p("If the button doesn't work, copy this URL into your browser:")}
      <p style="margin:0 0 12px;font-size:12px;color:${BRAND.gray};word-break:break-all;">${link}</p>
      ${p('If you did not expect this invitation, you can safely ignore this email.')}
    `),
    text: `Hello ${name},\n\nYou've been invited to the SER-CAT beam time scheduling system${institutionName ? ` for ${institutionName}` : ''}.\n\nActivate your account: ${link}\n\nThis link expires in 72 hours.\n\n— SER-CAT Scheduler`,
  };
}

export function passwordResetEmail({ name, email, resetToken }) {
  const link = `${APP_URL}/reset-password?token=${resetToken}`;
  void email;
  return {
    subject: 'SER-CAT Scheduler — Password Reset',
    html: layout('Reset Your Password', `
      ${p(`Hello ${name || 'there'},`)}
      ${p('A password reset was requested for your SER-CAT Scheduler account. Click below to set a new password. This link expires in 1 hour.')}
      ${button(link, 'Reset Password')}
      ${p("If the button doesn't work, copy this URL:")}
      <p style="margin:0 0 12px;font-size:12px;color:${BRAND.gray};word-break:break-all;">${link}</p>
      ${p('If you did not request this reset, you can safely ignore this email.')}
    `),
    text: `Hello ${name || 'there'},\n\nReset your password: ${link}\n\nThis link expires in 1 hour.\n\n— SER-CAT Scheduler`,
  };
}

export function preferenceConfirmationEmail({ name, cycleName, preferenceSummary }) {
  return {
    subject: `SER-CAT Scheduler — Preferences Received for ${cycleName}`,
    html: layout('Preferences Submitted', `
      ${p(`Hello ${name},`)}
      ${p(`Your scheduling preferences for <strong>${cycleName}</strong> have been saved.`)}
      ${preferenceSummary ? `<div style="margin:16px 0;padding:16px;background:${BRAND.bg};border-radius:10px;border:1px solid #e5e1d8;font-size:13px;color:#334155;">${preferenceSummary}</div>` : ''}
      ${p('You can update your preferences any time before the deadline.')}
      ${button(`${APP_URL}/member/preferences`, 'View Preferences')}
    `),
    text: `Hello ${name},\n\nYour preferences for ${cycleName} have been saved. You can update them before the deadline at ${APP_URL}/member/preferences\n\n— SER-CAT Scheduler`,
  };
}

export function deadlineReminderEmail({ name, cycleName, daysRemaining, deadlineDate }) {
  const urgency = daysRemaining <= 1 ? 'due tomorrow' : `due in ${daysRemaining} days`;
  return {
    subject: `SER-CAT Scheduler — Preferences ${urgency} (${cycleName})`,
    html: layout(`Preferences ${urgency}`, `
      ${p(`Hello ${name},`)}
      ${p(`This is a reminder that scheduling preferences for <strong>${cycleName}</strong> are <strong>${urgency}</strong> (${deadlineDate}).`)}
      ${p('Please submit your preferred beam time dates before the deadline.')}
      ${button(`${APP_URL}/member/preferences`, 'Submit Preferences')}
      ${p('If you have already submitted, you can ignore this reminder.')}
    `),
    text: `Hello ${name},\n\nPreferences for ${cycleName} are ${urgency} (${deadlineDate}). Submit at ${APP_URL}/member/preferences\n\n— SER-CAT Scheduler`,
  };
}

export function schedulePublishedEmail({ name, cycleName, assignmentSummary }) {
  return {
    subject: `SER-CAT Scheduler — Schedule Published for ${cycleName}`,
    html: layout('Schedule Published', `
      ${p(`Hello ${name},`)}
      ${p(`The beam time schedule for <strong>${cycleName}</strong> has been published.`)}
      ${assignmentSummary ? `<div style="margin:16px 0;padding:16px;background:${BRAND.bg};border-radius:10px;border:1px solid #e5e1d8;font-size:13px;color:#334155;">${assignmentSummary}</div>` : ''}
      ${p('View your full schedule and request changes if needed.')}
      ${button(`${APP_URL}/member/schedule`, 'View My Schedule')}
    `),
    text: `Hello ${name},\n\nThe schedule for ${cycleName} has been published. View it at ${APP_URL}/member/schedule\n\n— SER-CAT Scheduler`,
  };
}

export function swapRequestUpdateEmail({ name, cycleName, status, adminNotes }) {
  const statusLabel = status === 'approved' ? 'Approved' : 'Denied';
  return {
    subject: `SER-CAT Scheduler — Swap Request ${statusLabel} (${cycleName})`,
    html: layout(`Swap Request ${statusLabel}`, `
      ${p(`Hello ${name},`)}
      ${p(`Your shift swap request for <strong>${cycleName}</strong> has been <strong>${statusLabel.toLowerCase()}</strong>.`)}
      ${adminNotes ? p(`<strong>Admin notes:</strong> ${adminNotes}`) : ''}
      ${button(`${APP_URL}/member/shift-changes`, 'View Details')}
    `),
    text: `Hello ${name},\n\nYour swap request for ${cycleName} has been ${statusLabel.toLowerCase()}.${adminNotes ? `\nAdmin notes: ${adminNotes}` : ''}\n\nView details at ${APP_URL}/member/shift-changes\n\n— SER-CAT Scheduler`,
  };
}

export function adminAlertEmail({ subject: alertSubject, message }) {
  return {
    subject: `SER-CAT Admin Alert — ${alertSubject}`,
    html: layout('Admin Alert', `
      ${p(message)}
      ${button(`${APP_URL}/admin/dashboard`, 'Open Admin Dashboard')}
    `),
    text: `Admin Alert: ${alertSubject}\n\n${message}\n\n${APP_URL}/admin/dashboard\n\n— SER-CAT Scheduler`,
  };
}

export function manualReminderEmail({ name, cycleName, customMessage }) {
  return {
    subject: `SER-CAT Scheduler — Reminder from Admin (${cycleName})`,
    html: layout('Message from SER-CAT Admin', `
      ${p(`Hello ${name},`)}
      ${p(customMessage)}
      ${button(`${APP_URL}/member/preferences`, 'Go to Scheduler')}
    `),
    text: `Hello ${name},\n\n${customMessage}\n\n${APP_URL}/member/preferences\n\n— SER-CAT Scheduler`,
  };
}
