import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('emailVerifyEmail', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.APP_URL;
  });

  it('builds verify url with token and falls back to production domain', async () => {
    const { emailVerifyEmail } = await import('./email-templates.js');
    const result = emailVerifyEmail({ name: 'Ada', verifyUrl: 'https://sercat.org/verify-email?token=abc123' });

    expect(result.subject).toContain('Confirm');
    expect(result.html).toContain('https://sercat.org/verify-email?token=abc123');
    expect(result.text).toContain('https://sercat.org/verify-email?token=abc123');
  });

  it('includes the user name in the greeting', async () => {
    const { emailVerifyEmail } = await import('./email-templates.js');
    const result = emailVerifyEmail({ name: 'Dr. Smith', verifyUrl: 'https://sercat.org/verify-email?token=xyz' });

    expect(result.html).toContain('Dr. Smith');
    expect(result.text).toContain('Dr. Smith');
  });

  it('falls back to "there" when name is omitted', async () => {
    const { emailVerifyEmail } = await import('./email-templates.js');
    const result = emailVerifyEmail({ verifyUrl: 'https://sercat.org/verify-email?token=xyz' });

    expect(result.text).toContain('Hello there');
  });
});

describe('email template fallbacks', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.APP_URL;
  });

  it('uses the production site as the fallback app url', async () => {
    const { accountInviteEmail, passwordResetEmail } = await import('./email-templates.js');

    const invite = accountInviteEmail({
      name: 'Ada',
      email: 'ada@example.org',
      activationToken: 'invite-token',
      institutionName: 'Example Lab',
    });
    const reset = passwordResetEmail({
      name: 'Ada',
      email: 'ada@example.org',
      resetToken: 'reset-token',
    });

    expect(invite.html).toContain('https://sercat.org/activate?token=invite-token');
    expect(invite.text).toContain('https://sercat.org/activate?token=invite-token');
    expect(reset.html).toContain('https://sercat.org/reset-password?token=reset-token');
    expect(reset.text).toContain('https://sercat.org/reset-password?token=reset-token');
  });

  it('trims APP_URL before building email links', async () => {
    process.env.APP_URL = '  https://preview.sercat.org  ';

    const { accountInviteEmail } = await import('./email-templates.js');

    const invite = accountInviteEmail({
      name: 'Ada',
      email: 'ada@example.org',
      activationToken: 'invite-token',
      institutionName: 'Example Lab',
    });

    expect(invite.html).toContain('https://preview.sercat.org/activate?token=invite-token');
    expect(invite.text).toContain('https://preview.sercat.org/activate?token=invite-token');
  });
});
