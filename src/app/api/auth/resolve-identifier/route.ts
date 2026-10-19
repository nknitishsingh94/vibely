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

    // Anti-scraping rate limit: max 15 requests per minute per IP
    const rateLimit = checkRateLimit(`resolve-id:${ip}`, 15, 60000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const { identifier } = await req.json().catch(() => ({}));
    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'Please enter a username or email' }, { status: 400 });
    }

    const clean = identifier.trim();

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const admin = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Check if identifier is an email address
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);

    if (isEmail) {
      const email = clean.toLowerCase();
      let isGoogle = false;

      try {
        const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const matched = usersData?.users?.find(
          (u) => (u.email || '').toLowerCase() === email
        );

        if (matched) {
          const providers =
            matched.app_metadata?.providers ||
            (matched.app_metadata?.provider ? [matched.app_metadata.provider] : []);
          isGoogle = providers.includes('google') && !matched.app_metadata?.provider?.includes('email');

          // Check that profile still exists in public.profiles (has not been deleted)
          const { data: prof } = await admin.from('profiles').select('id, username, display_name').eq('id', matched.id).maybeSingle();
          if (!prof) {
            return NextResponse.json(
              { exists: false, error: 'This account was deleted from the database. Please sign up to create a new account.' },
              { status: 404 }
            );
          }
        }
      } catch (listErr) {
        console.warn('User search error in resolve-identifier email:', listErr);
      }

      return NextResponse.json({
        exists: true,
        email,
        isUsername: false,
        isGoogle,
      });
    }

    // It's a username (e.g. 'alex' or '@alex')
    const cleanUsername = clean.replace(/^@/, '').toLowerCase().trim();

    // 1. Lookup profile by username (case-insensitive)
    const { data: profile } = await admin
      .from('profiles')
      .select('id, username, display_name')
      .ilike('username', cleanUsername)
      .maybeSingle();

    const targetUserId = profile?.id;
    const targetUsername = profile?.username || cleanUsername;
    const targetDisplayName = profile?.display_name;

    if (!targetUserId) {
      return NextResponse.json(
        { exists: false, error: `No Vibely account found with username @${cleanUsername}. Please check the username or sign up.` },
        { status: 404 }
      );
    }

    // Lookup user email in auth.users by user ID
    const { data: userData, error: uError } = await admin.auth.admin.getUserById(targetUserId);
    if (uError || !userData?.user?.email) {
      return NextResponse.json(
        { exists: false, error: 'Could not resolve account for this username' },
        { status: 404 }
      );
    }

    const user = userData.user;
    const providers =
      user.app_metadata?.providers ||
      (user.app_metadata?.provider ? [user.app_metadata.provider] : []);
    const isGoogle = providers.includes('google');

    return NextResponse.json({
      exists: true,
      email: user.email,
      username: targetUsername,
      displayName: targetDisplayName,
      isGoogle,
      isUsername: true,
    });
  } catch (err: any) {
    console.error('Error resolving identifier:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
