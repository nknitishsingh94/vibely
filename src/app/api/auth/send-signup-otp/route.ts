import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateSixDigitOtp, sendOtpEmail } from '@/lib/email-service';

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
      }
    }

    // 4. Check if username is already taken by a profile
    const { data: profileWithUsername } = await adminClient
      .from('profiles')
      .select('id, username')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (profileWithUsername && (!existingAuthUser || profileWithUsername.id !== existingAuthUser.id)) {
      return NextResponse.json(
        {
          error: 'username_exists',
          message: 'This username is already taken. Please choose another username.',
        },
        { status: 400 }
      );
    }

    // 5. Generate 6-digit OTP and store with 10-minute expiry
    const generatedOtp = generateSixDigitOtp();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    if (existingAuthUser) {
      await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
        user_metadata: {
          ...existingAuthUser.user_metadata,
          signup_otp: generatedOtp,
          signup_otp_expires: expiry,
          display_name: cleanDisplayName,
          username: cleanUsername,
        },
      });
    } else {
      await adminClient.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: false,
        user_metadata: {
          signup_otp: generatedOtp,
          signup_otp_expires: expiry,
          display_name: cleanDisplayName,
          username: cleanUsername,
        },
      });
    }

    // 6. Deliver the OTP email (via Free Gmail/Custom SMTP or fallback)
    const emailResult = await sendOtpEmail({
      to: cleanEmail,
      otp: generatedOtp,
      displayName: cleanDisplayName,
    });

    // If custom SMTP is not set, also trigger Supabase's signInWithOtp as dual delivery
    if (emailResult.provider === 'supabase') {
      const anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: false },
      });
      await anonClient.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          data: {
            display_name: cleanDisplayName,
            username: cleanUsername,
          },
        },
      }).catch((e) => console.warn('Supabase signInWithOtp notice:', e?.message));
    }

    console.log(`[Signup OTP] Generated code for ${cleanEmail} (delivery: ${emailResult.provider})`);

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      provider: emailResult.provider,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter the code to complete registration.`,
    });
  } catch (err: any) {
    console.error('Unexpected error in send-signup-otp:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
