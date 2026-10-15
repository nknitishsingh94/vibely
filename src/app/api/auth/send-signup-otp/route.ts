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

    const rateLimit = checkRateLimit(`send-otp:${ip}`, 10, 60000); // 10 per minute max per IP
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'Too many requests. Please wait a minute before requesting another verification code.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, username, displayName } = body;

    if (!email || !username || !displayName) {
      return NextResponse.json(
        { error: 'missing_fields', message: 'Name, username, and email are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    // 1. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { error: 'invalid_email', message: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // 2. Validate username format
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: 'invalid_username', message: 'Username must be 3-30 characters (letters, numbers, underscores only).' },
        { status: 400 }
      );
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl || !env.supabaseAnonKey) {
      return NextResponse.json(
        { error: 'server_config', message: 'Server configuration missing.' },
        { status: 500 }
      );
    }

    const adminClient = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 3. Check if email is already taken by an active profile
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error('Error listing users in send-signup-otp:', listError);
    }

    const existingAuthUser = usersData?.users?.find(
      (u) => (u.email || '').toLowerCase() === cleanEmail
    );

    if (existingAuthUser) {
      const { data: prof } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', existingAuthUser.id)
        .maybeSingle();

      if (prof) {
        return NextResponse.json(
          {
            error: 'email_exists',
            message: 'An account with this email already exists. Please sign in instead.',
          },
          { status: 400 }
        );
      } else {
        // Orphaned unconfirmed/deleted user without profile: delete so fresh OTP signup proceeds smoothly
        try {
          await adminClient.auth.admin.deleteUser(existingAuthUser.id);
        } catch (delErr) {
          console.warn('Error deleting orphaned user in send-signup-otp:', delErr);
        }
      }
    }

    // 4. Check if username is already taken by a profile
    const { data: profileWithUsername, error: pError } = await adminClient
      .from('profiles')
      .select('id, username')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (profileWithUsername) {
      return NextResponse.json(
        {
          error: 'username_exists',
          message: 'This username is already taken. Please choose another username.',
        },
        { status: 400 }
      );
    }

    // 5. Send 6-digit OTP code to the email address via Supabase Auth
    const anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { error: otpError } = await anonClient.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        data: {
          display_name: cleanDisplayName,
          username: cleanUsername,
        },
      },
    });

    if (otpError) {
      console.error('Error sending OTP via Supabase:', otpError);
      return NextResponse.json(
        {
          error: 'otp_failed',
          message: otpError.message || 'Failed to send verification code. Please check the email address.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter it to verify your email.`,
    });
  } catch (err: any) {
    console.error('Unexpected error in send-signup-otp:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
