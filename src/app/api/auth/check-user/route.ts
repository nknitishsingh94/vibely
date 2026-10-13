import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, autoConfirm = true } = body;

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

    // Check if user exists in auth.users
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

    // If user exists and is unconfirmed, auto-confirm their email immediately
    if (!matchedUser.email_confirmed_at && autoConfirm) {
      try {
        await adminClient.auth.admin.updateUserById(matchedUser.id, {
          email_confirm: true,
        });
      } catch (confirmErr) {
        console.warn('Failed to auto-confirm user email:', confirmErr);
      }
    }

    // Check if user was registered with Google OAuth
    const providers: string[] =
      matchedUser.app_metadata?.providers ||
      (matchedUser.app_metadata?.provider ? [matchedUser.app_metadata.provider] : []);
    const isGoogle = providers.includes('google');

    // Ensure profile row exists
    try {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('id, username')
        .eq('id', matchedUser.id)
        .maybeSingle();

      if (!profile) {
        const displayName =
          matchedUser.user_metadata?.display_name ||
          matchedUser.user_metadata?.full_name ||
          matchedUser.email?.split('@')[0] ||
          'User';
        const username =
          matchedUser.user_metadata?.username ||
          `${matchedUser.email?.split('@')[0] || 'user'}_${matchedUser.id.slice(0, 4)}`;

        await adminClient.from('profiles').insert({
          id: matchedUser.id,
          display_name: displayName,
          username: username.toLowerCase(),
        });
      }
    } catch (profileErr) {
      console.warn('Profile sync warning in check-user:', profileErr);
    }

    return NextResponse.json({
      exists: true,
      isGoogle,
      provider: isGoogle ? 'google' : 'email',
      providers,
      confirmed: true,
      userId: matchedUser.id,
    });
  } catch (err: any) {
    console.error('Unexpected error in check-user route:', err);
    return NextResponse.json({ exists: null, error: err?.message || 'Internal error' }, { status: 500 });
  }
}
