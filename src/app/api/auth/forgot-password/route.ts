import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { maskEmail } from '@/lib/auth-guard';

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Anti-abuse rate limit: max 5 requests per 15 mins per IP
    const rateLimit = checkRateLimit(`forgot-pwd:${ip}`, 5, 15 * 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please wait 15 minutes before trying again.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { identifier } = body;

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'Username or email is required' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl || !env.supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const cleanInput = identifier.trim().toLowerCase().replace(/^@/, '');
    const adminClient = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    let targetEmail: string | null = null;
    let isGoogleUser = false;

    // 1. Check if input is direct email
    if (cleanInput.includes('@')) {
      targetEmail = cleanInput;
    } else {
      // 2. Resolve username to email from profiles table
      const { data: profile } = await adminClient
        .from('profiles')
        .select('id, username')
        .ilike('username', cleanInput)
        .maybeSingle();

      if (profile?.id) {
        const { data: userData } = await adminClient.auth.admin.getUserById(profile.id);
        if (userData?.user?.email) {
          targetEmail = userData.user.email.toLowerCase();
          const provider = userData.user.app_metadata?.provider;
          if (provider === 'google' && !(userData.user as any).encrypted_password) {
            isGoogleUser = true;
          }
        }
      }
    }

    if (!targetEmail) {
      // Find by email in auth.users
      const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matched = usersData?.users?.find(u => (u.email || '').toLowerCase() === cleanInput);
      if (matched?.email) {
        targetEmail = matched.email.toLowerCase();
        const provider = matched.app_metadata?.provider;
        if (provider === 'google' && !(matched as any).encrypted_password) {
          isGoogleUser = true;
        }
      }
    }

    if (isGoogleUser) {
      return NextResponse.json({
        error: 'This account was created with Google Sign-In. Please sign in using the "Continue with Google" button.',
        isGoogle: true,
      }, { status: 400 });
    }

    if (!targetEmail) {
      return NextResponse.json({
        error: 'No Vibely account found with this username or email.',
      }, { status: 404 });
    }

    // Determine site base URL for the password reset redirect
    const origin = req.headers.get('origin') || 'https://vibely-sigma-roan.vercel.app';
    const redirectUrl = `${origin}/reset-password`;

    // Send password recovery email using implicit flow
    const implicitClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error: resetError } = await implicitClient.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: redirectUrl,
    });

    if (resetError) {
      console.error('Password reset email error:', resetError);
      return NextResponse.json({ error: resetError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      maskedEmail: maskEmail(targetEmail),
      email: targetEmail,
      message: `Password reset link sent to ${maskEmail(targetEmail)}! Check your email to update your password.`,
    });
  } catch (err: unknown) {
    console.error('Unexpected error in forgot-password:', err);
    return NextResponse.json({ error: (err as Error)?.message || 'Internal server error' }, { status: 500 });
  }
}
