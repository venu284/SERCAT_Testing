import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

describe('sendEmail', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.BREVO_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_REPLY_TO;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends email via Brevo REST API with correct field mapping', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test-key';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messageId: '<msg-001@brevo>' }),
    });

    const { sendEmail } = await import('./email.js');

    const result = await sendEmail({
      to: ['ada@example.org', 'grace@example.org'],
      subject: 'Scheduler Notice',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.method).toBe('POST');
    expect(options.headers['api-key']).toBe('xkeysib-test-key');

    const body = JSON.parse(options.body);
    expect(body.sender).toEqual({ name: 'SER-CAT Scheduler', email: 'scheduler@sercat.org' });
    expect(body.to).toEqual([{ email: 'ada@example.org' }, { email: 'grace@example.org' }]);
    expect(body.replyTo).toEqual({ email: 'admin@sercat.org' });
    expect(body.subject).toBe('Scheduler Notice');
    expect(body.htmlContent).toBe('<p>Hello</p>');
    expect(body.textContent).toBe('Hello');

    expect(result).toEqual({ ok: true, messageId: '<msg-001@brevo>' });
  });

  it('accepts a single string for the to field', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test-key';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messageId: '<msg-002@brevo>' }),
    });

    const { sendEmail } = await import('./email.js');
    await sendEmail({ to: 'pi@example.org', subject: 'Test', html: '<p>Hi</p>' });

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.to).toEqual([{ email: 'pi@example.org' }]);
    expect(body).not.toHaveProperty('textContent');
  });

  it('uses configured sender overrides from env vars', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test-key';
    process.env.EMAIL_FROM = 'ops@sercat.org';
    process.env.EMAIL_REPLY_TO = 'support@sercat.org';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messageId: '<msg-003@brevo>' }),
    });

    const { sendEmail } = await import('./email.js');
    await sendEmail({ to: 'pi@example.org', subject: 'Test', html: '<p>Hi</p>' });

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.sender.email).toBe('ops@sercat.org');
    expect(body.replyTo.email).toBe('support@sercat.org');
  });

  it('returns failure without throwing when Brevo returns an error', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test-key';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'unauthorized' }),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendEmail } = await import('./email.js');
    const result = await sendEmail({ to: 'pi@example.org', subject: 'Reminder', html: '<p>R</p>' });

    expect(result).toEqual({ ok: false, error: 'unauthorized' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns failure without throwing when fetch itself throws', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test-key';
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendEmail } = await import('./email.js');
    const result = await sendEmail({ to: 'pi@example.org', subject: 'Reminder', html: '<p>R</p>' });

    expect(result).toEqual({ ok: false, error: 'network down' });
    errorSpy.mockRestore();
  });

  it('returns failure when BREVO_API_KEY is not set', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendEmail } = await import('./email.js');
    const result = await sendEmail({ to: 'pi@example.org', subject: 'Test', html: '<p>Hi</p>' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/BREVO_API_KEY/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
