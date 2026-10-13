import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const { identifier } = await req.json();
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

    // If identifier contains '@' and looks like an email address
    if (clean.includes('@') && clean.includes('.')) {
      const email = clean.toLowerCase();
      // Check if user exists
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matched = usersData?.users?.find(
        (u) => (u.email || '').toLowerCase() === email
      );

      const providers =
        matched?.app_metadata?.providers ||
        (matched?.app_metadata?.provider ? [matched.app_metadata.provider] : []);
      const isGoogle = providers.includes('google');

      return NextResponse.json({
        exists: Boolean(matched),
        email,
        isUsername: false,
        isGoogle,
      });
    }

    // It's a username (e.g. 'alex' or '@alex')
    const cleanUsername = clean.replace(/^@/, '').toLowerCase();

    // Lookup profile by username (case-insensitive)
    const { data: profile, error: pError } = await admin
      .from('profiles')
      .select('id, username, display_name')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (pError || !profile) {
      return NextResponse.json(
        { exists: false, error: `No Vibely account found with username @${cleanUsername}. Please check the username or sign up.` },
        { status: 404 }
      );
    }

    // Lookup user email in auth.users by user ID
    const { data: userData, error: uError } = await admin.auth.admin.getUserById(profile.id);
    if (uError || !userData?.user?.email) {
      return NextResponse.json(
        { exists: false, error: 'Could not resolve email for this username' },
        { status: 404 }
      );
    }

    const user = userData.user;
    const providers =
      user.app_metadata?.providers ||
      (user.app_metadata?.provider ? [user.app_metadata.provider] : []);
    const isGoogle = providers.includes('google');

    // If user is unconfirmed, auto-confirm them
    if (!user.email_confirmed_at) {
      try {
        await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
      } catch (confirmErr) {
        console.warn('Auto-confirm in resolve-identifier warning:', confirmErr);
      }
    }

    return NextResponse.json({
      exists: true,
      email: user.email,
      username: profile.username,
      displayName: profile.display_name,
      isGoogle,
      isUsername: true,
    });
  } catch (err: any) {
    console.error('Error resolving identifier:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
