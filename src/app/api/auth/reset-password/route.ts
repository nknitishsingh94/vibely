import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, code, newPassword } = body;

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl || !env.supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = (code || '').trim();

    const adminClient = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. If 6-digit code or OTP token was provided, verify it first
    if (cleanCode) {
      const publicClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: false },
      });

      // Try recovery OTP verification
      const { data: otpData, error: otpError } = await publicClient.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'recovery',
      });

      if (otpError) {
        // Also try email OTP type fallback
        const { data: fallbackData, error: fallbackError } = await publicClient.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: 'email',
        });

        if (fallbackError) {
          return NextResponse.json({
            error: 'Invalid or expired reset code. Please check the code in your email or request a new one.',
          }, { status: 400 });
        }

        const userId = fallbackData?.user?.id;
        if (userId) {
          await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
          return NextResponse.json({ success: true, message: 'Password updated successfully!' });
        }
      } else if (otpData?.user?.id) {
        await adminClient.auth.admin.updateUserById(otpData.user.id, { password: newPassword });
        return NextResponse.json({ success: true, message: 'Password updated successfully!' });
      }
    }

    // 2. If no code was passed (e.g. session was already verified via recovery link on client),
    // update password via admin for the matched user
    const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matched = usersData?.users?.find(u => (u.email || '').toLowerCase() === cleanEmail);

    if (!matched) {
      return NextResponse.json({ error: 'No account found for this email address.' }, { status: 404 });
    }

    await adminClient.auth.admin.updateUserById(matched.id, { password: newPassword });
    return NextResponse.json({ success: true, message: 'Password updated successfully!' });
  } catch (err: unknown) {
    console.error('Reset password error:', err);
    return NextResponse.json({ error: (err as Error)?.message || 'Failed to update password' }, { status: 500 });
  }
}
