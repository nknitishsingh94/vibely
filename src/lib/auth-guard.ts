import { NextResponse } from 'next/server';
import { User, createClient as createServiceClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { env, isSupabaseConfigured } from '@/lib/env';

/**
 * Extracts and cryptographically verifies the authenticated Supabase user.
 * Supports:
 * 1. Authorization: Bearer <token> (Native apps, API requests)
 * 2. Supabase SSR cookies (Web browser requests)
 * 
 * NEVER trusts spoofed headers (like x-user-id) or unverified request bodies!
 */
export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const adminClient = createServiceClient(env.supabaseUrl, env.supabaseAnonKey, {
          auth: { persistSession: false },
        });
        const { data: { user }, error } = await adminClient.auth.getUser(token);
        if (!error && user) {
          return user;
        }
      } catch (err) {
        console.warn('Bearer token verification error:', err);
      }
    }
  }

  // 2. Check Cookie-based session via Supabase SSR
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const cookieMap = new Map<string, string>();
    cookieHeader.split(';').forEach((pair) => {
      const idx = pair.indexOf('=');
      if (idx !== -1) {
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        cookieMap.set(key, decodeURIComponent(val));
      }
    });

    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
        },
        setAll() {},
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return user;
    }
  } catch (cookieErr) {
    console.warn('Cookie session verification error:', cookieErr);
  }

  return null;
}

/**
 * Helper to enforce authentication on protected API endpoints.
 * Returns { user, error: null } if verified, or { user: null, error: NextResponse } if unauthorized.
 */
export async function requireAuth(req: Request): Promise<
  | { user: User; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Valid authentication session or bearer token is required.',
        },
        { status: 401 }
      ),
    };
  }

  return { user, error: null };
}

/**
 * Utility to mask private email addresses to protect against user harvesting/scraping.
 * Example: 'alex.rivera@example.com' -> 'a***a@example.com'
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
