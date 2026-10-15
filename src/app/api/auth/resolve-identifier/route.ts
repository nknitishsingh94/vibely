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

          // Auto-heal missing profile for email user if needed
          try {
            const { data: prof } = await admin.from('profiles').select('id').eq('id', matched.id).maybeSingle();
            if (!prof) {
              const displayName =
                matched.user_metadata?.display_name ||
                matched.user_metadata?.full_name ||
                matched.email?.split('@')[0] ||
                'User';
              const username =
                matched.user_metadata?.username ||
                `${matched.email?.split('@')[0] || 'user'}`.toLowerCase();

              await admin.from('profiles').upsert(
                {
                  id: matched.id,
                  display_name: displayName,
                  username: username,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'id' }
              );
            }
          } catch (profErr) {
            console.warn('Profile sync on email resolve warning:', profErr);
          }

          // If user is unconfirmed, auto-confirm them
          if (!matched.email_confirmed_at) {
            try {
              await admin.auth.admin.updateUserById(matched.id, { email_confirm: true });
            } catch (confirmErr) {
              console.warn('Auto-confirm in resolve-identifier email warning:', confirmErr);
            }
          }
        }
      } catch (listErr) {
        console.warn('User search error in resolve-identifier email:', listErr);
      }

      // Always allow email login attempts through so Supabase can verify credentials
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
    const { data: profile, error: pError } = await admin
      .from('profiles')
      .select('id, username, display_name')
      .ilike('username', cleanUsername)
      .maybeSingle();

    let targetUserId = profile?.id;
    let targetUsername = profile?.username || cleanUsername;
    let targetDisplayName = profile?.display_name;

    // 2. If not found in profiles, search auth.users user_metadata->username as fallback!
    if (!targetUserId) {
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matchedUser = usersData?.users?.find(
        (u) => (u.user_metadata?.username || '').toLowerCase() === cleanUsername
      );

      if (matchedUser) {
        targetUserId = matchedUser.id;
        targetDisplayName = matchedUser.user_metadata?.display_name || cleanUsername;

        // Auto-heal missing profile in profiles table
        try {
          await admin.from('profiles').upsert(
            {
              id: matchedUser.id,
              username: cleanUsername,
              display_name: targetDisplayName,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );
        } catch (healErr) {
          console.warn('Auto-healing profile error in resolve-identifier:', healErr);
        }
      }
    }

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
