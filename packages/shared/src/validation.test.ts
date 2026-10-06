import { describe, it, expect } from 'vitest';
import { registerSchema } from './validation.js';

describe('validation', () => {
  it('rejects reserved usernames', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com', password: 'longenough1', username: 'admin', displayName: 'A',
    });
    expect(r.success).toBe(false);
  });
  it('accepts valid registration', () => {
    const r = registerSchema.safeParse({
      email: 'A@B.com ', password: 'longenough1', username: 'Alice_1', displayName: 'Alice',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe('a@b.com');
      expect(r.data.username).toBe('alice_1');
    }
  });
  it('rejects short passwords', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com', password: 'short', username: 'alice', displayName: 'A',
    });
    expect(r.success).toBe(false);
  });
});
