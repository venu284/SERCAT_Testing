import { beforeEach, describe, expect, it, vi } from 'vitest';

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
