import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, otp, password, displayName, username } = body;

    if (!email || !otp || !password || !displayName || !username) {
      return NextResponse.json(
        { error: 'missing_fields', message: 'All fields (email, OTP, password, display name, username) are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      return NextResponse.json(
        { error: 'invalid_format', message: 'Verification code must be exactly 6 digits.' },
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

    const anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false },
    });

    // 1. Verify OTP code with Supabase Auth
    const { data: verifyData, error: verifyErr } = await anonClient.auth.verifyOtp({
      email: cleanEmail,
      token: cleanOtp,
      type: 'email',
    });

    if (verifyErr || !verifyData?.user) {
      console.warn('verifyOtp error for email:', cleanEmail, verifyErr?.message);
      return NextResponse.json(
        {
          error: 'invalid_otp',
          message: 'Invalid or expired verification code. Please check your email and try again.',
        },
        { status: 400 }
      );
    }

    const verifiedUserId = verifyData.user.id;
    const adminClient = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 2. Set the permanent password, display name, and username on the verified account
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(verifiedUserId, {
      password,
      email_confirm: true,
      user_metadata: {
        display_name: cleanDisplayName,
        username: cleanUsername,
      },
    });

    if (updateErr) {
      console.error('Error setting password on verified user:', updateErr);
      return NextResponse.json(
        { error: 'update_failed', message: updateErr.message || 'Failed to finalize account security.' },
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
      session: verifyData.session,
      message: 'Email successfully verified! Welcome to Vibely.',
    });
  } catch (err: any) {
    console.error('Unexpected error in verify-signup-otp:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
