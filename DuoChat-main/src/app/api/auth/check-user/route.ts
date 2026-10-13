import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ exists: false, error: 'Email is required' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json({ exists: null, error: 'Server configuration missing' }, { status: 500 });
    }

    const adminClient = createClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Check if user exists in auth.users
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      console.error('Error checking user existence:', error);
      return NextResponse.json({ exists: null, error: error.message }, { status: 500 });
    }

    const exists = Boolean(
      data?.users?.some((u) => (u.email || '').toLowerCase() === normalizedEmail)
    );

    return NextResponse.json({ exists });
  } catch (err: any) {
    console.error('Unexpected error in check-user route:', err);
    return NextResponse.json({ exists: null, error: err?.message || 'Internal error' }, { status: 500 });
  }
}
