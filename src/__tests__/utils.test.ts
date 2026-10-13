import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatDuration,
  generateSecureToken,
  hashToken,
} from '@/lib/utils';

describe('Utility Functions', () => {
  it('should format bytes cleanly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(5242880)).toBe('5 MB');
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('should format audio durations into mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(42)).toBe('0:42');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(180)).toBe('3:00');
    expect(formatDuration(3675)).toBe('61:15');
  });

  it('should generate secure tokens with expected length', () => {
    const token = generateSecureToken(16);
    expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('should produce consistent SHA-256 hashes', async () => {
    const testString = 'vibely_secure_invitation_token';
    const hash1 = await hashToken(testString);
    const hash2 = await hashToken(testString);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
  });
});
