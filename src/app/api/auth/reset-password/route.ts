import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    // 1. IP & Identifier Rate Limiting (anti brute-force / credential attack)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const ipLimit = checkRateLimit(`reset-pwd-ip:${ip}`, 10, 15 * 60 * 1000); // 10 attempts per 15 mins per IP
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: 'Too many password reset attempts from this IP. Please wait 15 minutes.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, code, newPassword } = body;

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password are required' }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = (code ? String(code) : '').trim();

    // Check per-account rate limit
    const emailLimit = checkRateLimit(`reset-pwd-email:${cleanEmail}`, 5, 15 * 60 * 1000); // 5 attempts per 15 mins per email
    if (!emailLimit.success) {
      return NextResponse.json(
        { error: 'Too many verification attempts for this account. Please wait 15 minutes.' },
        { status: 429 }
      );
    }

    // Password strength check: min 8 characters
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // CRITICAL SECURITY ENFORCEMENT:
    // A password reset MUST have a valid verification code/OTP from the user's email.
    // Unauthenticated reset requests without a valid code are strictly blocked.
    if (!cleanCode) {
      return NextResponse.json(
        { error: 'A valid verification code from your email is required to reset your password.' },
        { status: 400 }
      );
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl || !env.supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const adminClient = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const publicClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false },
    });

    // Verify OTP token with Supabase Auth
    let verifiedUserId: string | null = null;

    // 1. Try recovery OTP type
    const { data: otpData, error: otpError } = await publicClient.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: 'recovery',
    });

    if (!otpError && otpData?.user?.id) {
      verifiedUserId = otpData.user.id;
    } else {
      // 2. Try email OTP type fallback
      const { data: fallbackData, error: fallbackError } = await publicClient.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      });

      if (!fallbackError && fallbackData?.user?.id) {
        verifiedUserId = fallbackData.user.id;
      }
    }

    if (!verifiedUserId) {
      return NextResponse.json(
        {
          error: 'Invalid or expired reset code. Please check the code in your email or request a new one.',
        },
        { status: 400 }
      );
    }

    // Update password only for the cryptographically verified user
    const { error: updateError } = await adminClient.auth.admin.updateUserById(verifiedUserId, {
      password: newPassword,
    });

    if (updateError) {
      console.error('Password update failure:', updateError);
      return NextResponse.json({ error: updateError.message || 'Failed to update password' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully! You can now log in with your new password.',
    });
  } catch (err: unknown) {
    console.error('Reset password error:', err);
    return NextResponse.json({ error: (err as Error)?.message || 'Failed to update password' }, { status: 500 });
  }
}
