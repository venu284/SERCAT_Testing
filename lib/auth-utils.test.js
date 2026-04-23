import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ABSOLUTE_MAX_SECONDS,
  generateToken,
  hashToken,
  signToken,
  verifyToken,
} from './auth-utils.js';

describe('auth-utils security hardening', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.JWT_SECRET;
  });

  it('hashes raw tokens with sha256', () => {
    expect(hashToken('invite-token')).toBe(
      crypto.createHash('sha256').update('invite-token').digest('hex'),
    );
  });

  it('generates 32-byte random hex tokens', () => {
    expect(generateToken()).toMatch(/^[a-f0-9]{64}$/);
  });

  it('accepts sessions within the absolute session cap', () => {
    const loginAt = Math.floor(Date.now() / 1000) - 60;
    const token = signToken({
      userId: 'user-1',
      role: 'admin',
      email: 'admin@example.org',
      institutionId: null,
      loginAt,
    });

    expect(verifyToken(token)).toMatchObject({
      userId: 'user-1',
      loginAt,
    });
  });

  it('rejects sessions older than the absolute session cap', () => {
    const loginAt = Math.floor(Date.now() / 1000) - ABSOLUTE_MAX_SECONDS - 1;
    const token = signToken({
      userId: 'user-1',
      role: 'admin',
      email: 'admin@example.org',
      institutionId: null,
      loginAt,
    });

    expect(() => verifyToken(token)).toThrow(/session/i);
  });
});
