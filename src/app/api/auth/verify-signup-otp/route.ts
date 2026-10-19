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

    // Anti brute-force rate limit: max 5 OTP verification attempts per 10 minutes per IP
    const ipLimit = checkRateLimit(`verify-otp-ip:${ip}`, 5, 10 * 60 * 1000);
    if (!ipLimit.success) {
      return NextResponse.json(
        {
          error: 'too_many_attempts',
          message: 'Too many verification attempts. Please wait 10 minutes before trying again.',
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, otp, password, displayName, username } = body;

    if (!email || !otp || !password || !displayName || !username) {
      return NextResponse.json(
        { error: 'missing_fields', message: 'All fields (email, OTP, password, display name, username) are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();
    const cleanUsername = String(username).trim().toLowerCase();
    const cleanDisplayName = String(displayName).trim();

    // Check per-email rate limit: max 5 attempts per email
    const emailLimit = checkRateLimit(`verify-otp-email:${cleanEmail}`, 5, 10 * 60 * 1000);
    if (!emailLimit.success) {
      return NextResponse.json(
        {
          error: 'too_many_attempts',
          message: 'Too many failed verification attempts for this email. Please request a new code.',
        },
        { status: 429 }
      );
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      return NextResponse.json(
        { error: 'invalid_format', message: 'Verification code must be exactly 6 digits.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'weak_password', message: 'Password must be at least 8 characters long.' },
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

    // 1. Find user in auth.users
    const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const userRecord = usersData?.users?.find(
      (u) => (u.email || '').toLowerCase() === cleanEmail
    );

    let isOtpValid = false;

    // Check our stored OTP in user_metadata
    if (userRecord?.user_metadata?.signup_otp) {
      const storedOtp = String(userRecord.user_metadata.signup_otp).trim();
      const expires = Number(userRecord.user_metadata.signup_otp_expires || 0);
      if (storedOtp === cleanOtp && Date.now() < expires) {
        isOtpValid = true;
      }
    }

    // Fallback: also check Supabase verifyOtp
    if (!isOtpValid) {
      const anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: false },
      });
      const { data: verifyData } = await anonClient.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: 'email',
      });
      if (verifyData?.user) {
        isOtpValid = true;
      }
    }

    if (!isOtpValid || !userRecord) {
      return NextResponse.json(
        {
          error: 'invalid_otp',
          message: 'Invalid or expired verification code. Please check your email and try again.',
        },
        { status: 400 }
      );
    }

    const verifiedUserId = userRecord.id;

    // 2. Set the permanent password, display name, and clear the signup OTP
    const updatedMetadata = {
      ...(userRecord.user_metadata || {}),
      display_name: cleanDisplayName,
      username: cleanUsername,
    };
    delete (updatedMetadata as any).signup_otp;
    delete (updatedMetadata as any).signup_otp_expires;

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(verifiedUserId, {
      password,
      email_confirm: true,
      user_metadata: updatedMetadata,
    });

    if (updateErr) {
      console.error('Error updating user on OTP verification:', updateErr);
      return NextResponse.json(
        { error: 'update_failed', message: updateErr.message || 'Failed to finalize account.' },
        { status: 500 }
      );
    }

    // 3. Create or update profile in public.profiles table
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: verifiedUserId,
          display_name: cleanDisplayName,
          username: cleanUsername,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (profileErr) {
      console.error('Error creating profile for verified user:', profileErr);
    }

    // 4. Create user preferences row
    await adminClient
      .from('user_preferences')
      .upsert({ user_id: verifiedUserId }, { onConflict: 'user_id' });

    return NextResponse.json({
      success: true,
      verified: true,
      user: {
        id: verifiedUserId,
        email: cleanEmail,
        displayName: cleanDisplayName,
        username: cleanUsername,
      },
      profile: profile || {
        id: verifiedUserId,
        display_name: cleanDisplayName,
        username: cleanUsername,
      },
      message: 'Email successfully verified! Welcome to Vibely.',
    });
  } catch (err: any) {
    console.error('Unexpected error in verify-signup-otp:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
