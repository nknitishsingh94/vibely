import { describe, it, expect } from 'vitest';

describe('OAuth Callback & Redirect Logic', () => {
  it('correctly builds OAuth callback URL with destination parameter', () => {
    const origin = 'http://localhost:3000';
    const destination = '/chat';
    const callbackUrl = `${origin}/auth/callback?redirectTo=${encodeURIComponent(destination)}`;

    expect(callbackUrl).toBe('http://localhost:3000/auth/callback?redirectTo=%2Fchat');
  });

  it('safely handles relative vs absolute redirect paths', () => {
    const sanitizeRedirect = (target: string | null): string => {
      if (!target || !target.startsWith('/') || target.startsWith('//')) {
        return '/chat';
      }
      return target;
    };

    expect(sanitizeRedirect('/chat')).toBe('/chat');
    expect(sanitizeRedirect('/settings/profile')).toBe('/settings/profile');
    expect(sanitizeRedirect('https://malicious.com')).toBe('/chat');
    expect(sanitizeRedirect('//evil.com')).toBe('/chat');
    expect(sanitizeRedirect(null)).toBe('/chat');
  });

  it('correctly constructs error redirect URL when OAuth fails', () => {
    const baseUrl = 'http://localhost:3000';
    const errorMessage = 'User denied consent';
    const redirectUrl = `${baseUrl}/login?error=${encodeURIComponent(errorMessage)}`;

    expect(redirectUrl).toBe('http://localhost:3000/login?error=User%20denied%20consent');
  });
});
