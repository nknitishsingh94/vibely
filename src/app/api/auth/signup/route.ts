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

    const existingAuthUser = usersData?.users?.find(
      (u) => (u.email || '').toLowerCase() === cleanEmail
    );

    let emailExists = false;
    if (existingAuthUser) {
      // Check if this auth user still has a valid row in public.profiles
      const { data: prof } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', existingAuthUser.id)
        .maybeSingle();

      if (!prof) {
        // User was deleted from database profiles! Clean up orphaned auth user so fresh signup succeeds!
        console.log('Cleaning up orphaned auth user whose profile was deleted in DB:', existingAuthUser.id);
        try {
          await adminClient.auth.admin.deleteUser(existingAuthUser.id);
        } catch (delErr) {
          console.warn('Error deleting orphaned auth user:', delErr);
        }
      } else {
        emailExists = true;
      }
    }

    // 3. Check if username is already present in database (public.profiles or auth.users metadata)
    const { data: profileWithUsername, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, username')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (profileErr && profileErr.code !== 'PGRST116') {
      console.error('Error checking username in profiles:', profileErr);
    }

    const usernameExistsInProfiles = Boolean(profileWithUsername);

    // Also check auth.users metadata, cleaning up any orphaned zombie records
    const usernameAuthUser = usersData?.users?.find(
      (u) => (u.user_metadata?.username || '').toLowerCase() === cleanUsername && u.id !== existingAuthUser?.id
    );

    let usernameExistsInUsers = false;
    if (usernameAuthUser) {
      const { data: uProf } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', usernameAuthUser.id)
        .maybeSingle();

      if (!uProf) {
        // Orphaned username record: delete from auth.users
        try {
          await adminClient.auth.admin.deleteUser(usernameAuthUser.id);
        } catch {}
      } else {
        usernameExistsInUsers = true;
      }
    }

    const usernameExists = usernameExistsInProfiles || usernameExistsInUsers;

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

    // 5. Check if OTP was provided to complete verification
    const otp = body.otp ? String(body.otp).trim() : null;

    const anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey || '', {
      auth: { persistSession: false },
    });

    if (otp) {
      // Step B: Verify the provided OTP code
      const { data: verifyData, error: verifyErr } = await anonClient.auth.verifyOtp({
        email: cleanEmail,
        token: otp,
        type: 'email',
      });

      if (verifyErr || !verifyData?.user) {
        return NextResponse.json(
          {
            error: 'invalid_otp',
            message: 'Invalid or expired verification code. Please check your email.',
          },
          { status: 400 }
        );
      }

      const verifiedUserId = verifyData.user.id;

      // Finalize password and profile
      await adminClient.auth.admin.updateUserById(verifiedUserId, {
        password,
        email_confirm: true,
        user_metadata: {
          display_name: cleanDisplayName,
          username: cleanUsername,
        },
      });

      await adminClient.from('profiles').upsert(
        {
          id: verifiedUserId,
          display_name: cleanDisplayName,
          username: cleanUsername,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      await adminClient.from('user_preferences').upsert(
        { user_id: verifiedUserId },
        { onConflict: 'user_id' }
      );

      return NextResponse.json({
        success: true,
        verified: true,
        user: {
          id: verifiedUserId,
          email: cleanEmail,
          username: cleanUsername,
          displayName: cleanDisplayName,
        },
        session: verifyData.session,
      });
    }

    // Step A: No OTP provided yet -> Send OTP to verify email ownership!
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
      console.error('Error sending signup OTP:', otpError);
      return NextResponse.json(
        { error: 'otp_failed', message: otpError.message || 'Failed to send verification code to email.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      requiresOtp: true,
      email: cleanEmail,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter the code to complete registration.`,
    });
  } catch (err: any) {
    console.error('Error in signup route:', err);
    return NextResponse.json(
      { error: 'server_error', message: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
