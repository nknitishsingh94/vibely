import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    // 1. Rate limiting: 100 requests per second per IP
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateLimit = checkRateLimit(ip, 100, 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'Rate limit exceeded. Maximum 100 signups per second allowed.',
          retryAfter: Math.ceil(rateLimit.resetMs / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, Math.ceil(rateLimit.resetMs / 1000))),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetMs),
          },
        }
      );
    }

    const body = await req.json();
    const { email, password, displayName, username } = body;

    if (!email || !password || !displayName || !username) {
      return NextResponse.json(
        { error: 'missing_fields', message: 'All fields (email, password, displayName, username) are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json(
        { error: 'server_config', message: 'Server configuration missing. Check SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    const adminClient = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 2. Check if email is already present in database (auth.users)
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error('Error listing users for duplicate check:', listError);
    }

    const emailExists = Boolean(
      usersData?.users?.some((u) => (u.email || '').toLowerCase() === cleanEmail)
    );

    // 3. Check if username is already present in database (public.profiles)
    const { data: profileWithUsername, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, username')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (profileErr && profileErr.code !== 'PGRST116') {
      console.error('Error checking username in profiles:', profileErr);
    }

    const usernameExists = Boolean(profileWithUsername);

    // 4. Strict matching and explicit error messaging
    if (emailExists && usernameExists) {
      return NextResponse.json(
        {
          error: 'both_exist',
          message: 'Both this email and username already exist. Please choose different credentials or sign in.',
        },
        { status: 400 }
      );
    }

    if (emailExists) {
      return NextResponse.json(
        {
          error: 'email_exists',
          message: 'An account with this email already exists. Please sign in instead.',
        },
        { status: 400 }
      );
    }

    if (usernameExists) {
      return NextResponse.json(
        {
          error: 'username_exists',
          message: 'This username is already taken. Please choose another username.',
        },
        { status: 400 }
      );
    }

    // 5. Neither exists: create account directly with email_confirm: true (NO confirmation email sent!)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: cleanDisplayName,
        username: cleanUsername,
      },
    });

    if (createError) {
      return NextResponse.json(
        { error: 'create_failed', message: createError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.user?.id,
          email: newUser.user?.email,
          username: cleanUsername,
          displayName: cleanDisplayName,
        },
      },
      {
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  } catch (err: any) {
    console.error('Error in signup route:', err);
    return NextResponse.json(
      { error: 'server_error', message: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
