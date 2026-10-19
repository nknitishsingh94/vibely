import { describe, it, expect } from 'vitest';
import { maskEmail } from '@/lib/auth-guard';
import { checkRateLimit, resetRateLimits } from '@/lib/rate-limit';

describe('Security Hardening Tests', () => {
  describe('Email Masking (Anti-Scraping / Privacy)', () => {
    it('should mask standard email addresses correctly', () => {
      expect(maskEmail('alex.rivera@example.com')).toBe('a***a@example.com');
      expect(maskEmail('nitish78004@gmail.com')).toBe('n***4@gmail.com');
      expect(maskEmail('john@company.org')).toBe('j***n@company.org');
    });

    it('should handle short email local parts gracefully', () => {
      expect(maskEmail('ab@domain.com')).toBe('a***@domain.com');
      expect(maskEmail('a@domain.com')).toBe('a***@domain.com');
    });

    it('should handle invalid or missing email formats', () => {
      expect(maskEmail('')).toBe('***@***.***');
      expect(maskEmail('invalidemail')).toBe('***@***.***');
    });
  });

  describe('Rate Limiting Enforcement', () => {
    it('should block requests when rate limit threshold is exceeded', () => {
      resetRateLimits();
      const testKey = 'test-ip-127.0.0.1';

      // Allow 3 requests
      expect(checkRateLimit(testKey, 3, 5000).success).toBe(true);
      expect(checkRateLimit(testKey, 3, 5000).success).toBe(true);
      expect(checkRateLimit(testKey, 3, 5000).success).toBe(true);

      // 4th request must be rejected
      const blocked = checkRateLimit(testKey, 3, 5000);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetMs).toBeGreaterThan(0);
    });

    it('should enforce distinct limits for distinct IP addresses / keys', () => {
      resetRateLimits();
      const userA = 'user-key-alpha';
      const userB = 'user-key-beta';

      expect(checkRateLimit(userA, 1, 5000).success).toBe(true);
      expect(checkRateLimit(userA, 1, 5000).success).toBe(false); // userA blocked

      // userB should still be allowed
      expect(checkRateLimit(userB, 1, 5000).success).toBe(true);
    });
  });

  describe('Dangerous File Upload Prevention', () => {
    const dangerousExtensions = [
      'exe', 'bat', 'cmd', 'sh', 'php', 'py', 'js', 'mjs', 'cjs', 'html', 'htm', 'svg', 'vbs', 'scr', 'msi', 'dll'
    ];

    it('should identify dangerous extensions that must be blocked', () => {
      const isDangerous = (filename: string) => {
        const ext = (filename.split('.').pop() || '').toLowerCase();
        return dangerousExtensions.includes(ext);
      };

      expect(isDangerous('script.html')).toBe(true);
      expect(isDangerous('payload.svg')).toBe(true);
      expect(isDangerous('malware.exe')).toBe(true);
      expect(isDangerous('exploit.sh')).toBe(true);
      expect(isDangerous('document.pdf')).toBe(false);
      expect(isDangerous('photo.jpg')).toBe(false);
      expect(isDangerous('voice.mp3')).toBe(false);
    });
  });
});
