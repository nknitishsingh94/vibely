import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Rate limit: max 15 checks per minute to stop user enumeration bots
    const rateLimit = checkRateLimit(`check-user:${ip}`, 15, 60000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ exists: false, error: 'Email is required' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json({ exists: null, error: 'Server configuration missing' }, { status: 500 });
    }

    const adminClient = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      console.error('Error checking user existence:', error);
      return NextResponse.json({ exists: null, error: error.message }, { status: 500 });
    }

    const matchedUser = data?.users?.find(
      (u) => (u.email || '').toLowerCase() === normalizedEmail
    );

    if (!matchedUser) {
      return NextResponse.json({
        exists: false,
        isGoogle: false,
        provider: null,
      });
    }

    // Check if user was registered with Google OAuth
    const providers: string[] =
      matchedUser.app_metadata?.providers ||
      (matchedUser.app_metadata?.provider ? [matchedUser.app_metadata.provider] : []);
    const isGoogle = providers.includes('google');

    return NextResponse.json({
      exists: true,
      isGoogle,
      provider: isGoogle ? 'google' : 'email',
      confirmed: Boolean(matchedUser.email_confirmed_at),
    });
  } catch (err: any) {
    console.error('Unexpected error in check-user route:', err);
    return NextResponse.json({ exists: null, error: err?.message || 'Internal error' }, { status: 500 });
  }
}
