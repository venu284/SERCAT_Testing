import { beforeEach, describe, expect, it, vi } from 'vitest';

const brevoState = vi.hoisted(() => {
  const state = {
    sendTransacEmail: vi.fn(),
    clientArgs: [],
  };

  class BrevoClient {
    constructor(args) {
      state.clientArgs.push(args);
      this.transactionalEmails = {
        sendTransacEmail: state.sendTransacEmail,
      };
    }
  }

  return {
    state,
    BrevoClient,
  };
});

vi.mock('@getbrevo/brevo', () => ({
  BrevoClient: brevoState.BrevoClient,
}), { virtual: true });

describe('sendEmail', () => {
  beforeEach(() => {
    vi.resetModules();
    brevoState.state.sendTransacEmail.mockReset();
    brevoState.state.clientArgs.length = 0;
    delete process.env.BREVO_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_REPLY_TO;
  });

  it('maps the stable sendEmail contract into Brevo transactional email fields', async () => {
    process.env.BREVO_API_KEY = '  brevo-test-key  ';
    brevoState.state.sendTransacEmail.mockResolvedValue({
      body: { messageId: 'brevo-message-1' },
    });

    const { sendEmail } = await import('./email.js');

    const result = await sendEmail({
      to: ['ada@example.org', 'grace@example.org'],
      subject: 'Scheduler Notice',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(brevoState.state.clientArgs).toEqual([{ apiKey: 'brevo-test-key' }]);
    expect(brevoState.state.sendTransacEmail).toHaveBeenCalledTimes(1);
    expect(brevoState.state.sendTransacEmail).toHaveBeenCalledWith(expect.objectContaining({
      sender: { name: 'SER-CAT Scheduler', email: 'scheduler@sercat.org' },
      to: [{ email: 'ada@example.org' }, { email: 'grace@example.org' }],
      replyTo: { email: 'admin@sercat.org' },
      subject: 'Scheduler Notice',
      htmlContent: '<p>Hello</p>',
      textContent: 'Hello',
    }));
    expect(result).toEqual({ ok: true, messageId: 'brevo-message-1' });
  });

  it('uses configured sender settings and returns failures instead of throwing', async () => {
    process.env.BREVO_API_KEY = '  brevo-test-key  ';
    process.env.EMAIL_FROM = '  ops@sercat.org  ';
    process.env.EMAIL_REPLY_TO = '  support@sercat.org  ';
    brevoState.state.sendTransacEmail.mockRejectedValue(new Error('brevo down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendEmail } = await import('./email.js');

    const result = await sendEmail({
      to: 'pi@example.org',
      subject: 'Reminder',
      html: '<p>Reminder</p>',
    });

    expect(brevoState.state.sendTransacEmail).toHaveBeenCalledWith(expect.objectContaining({
      sender: { name: 'SER-CAT Scheduler', email: 'ops@sercat.org' },
      to: [{ email: 'pi@example.org' }],
      replyTo: { email: 'support@sercat.org' },
      htmlContent: '<p>Reminder</p>',
    }));
    expect(brevoState.state.sendTransacEmail.mock.calls[0][0]).not.toHaveProperty('textContent');
    expect(result).toEqual({ ok: false, error: 'brevo down' });
    expect(errorSpy).toHaveBeenCalledWith(
      '[EMAIL ERROR] Failed to send "Reminder" to pi@example.org:',
      'brevo down',
    );

    errorSpy.mockRestore();
  });
});
