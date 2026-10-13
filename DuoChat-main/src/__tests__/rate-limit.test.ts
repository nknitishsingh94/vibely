import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimits } from '@/lib/rate-limit';

describe('Sliding Window Rate Limiter (100 req/sec)', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('allows requests up to 100 within a 1-second window', () => {
    const ip = '192.168.1.1';
    for (let i = 0; i < 100; i++) {
      const res = checkRateLimit(ip, 100, 1000);
      expect(res.success).toBe(true);
      expect(res.remaining).toBe(100 - (i + 1));
    }
  });

  it('rejects the 101st request within the 1-second window', () => {
    const ip = '192.168.1.2';
    for (let i = 0; i < 100; i++) {
      checkRateLimit(ip, 100, 1000);
    }

    const blocked = checkRateLimit(ip, 100, 1000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.limit).toBe(100);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it('tracks distinct users or IPs separately', () => {
    const userA = 'user-a';
    const userB = 'user-b';

    for (let i = 0; i < 100; i++) {
      checkRateLimit(userA, 100, 1000);
    }

    // userA is blocked on 101st
    expect(checkRateLimit(userA, 100, 1000).success).toBe(false);

    // userB is independent and succeeds
    expect(checkRateLimit(userB, 100, 1000).success).toBe(true);
  });
});
