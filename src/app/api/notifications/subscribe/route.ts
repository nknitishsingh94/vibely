import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, subscription } = body;

    if (!userId || !subscription?.endpoint) {
      return NextResponse.json({ error: 'Missing userId or subscription endpoint' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const adminClient = createServiceClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Fetch current user metadata
    const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
    if (getUserError || !userData?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentMetadata = userData.user.user_metadata || {};
    const existingSubscriptions: any[] = Array.isArray(currentMetadata.push_subscriptions)
      ? currentMetadata.push_subscriptions
      : [];

    // 2. Deduplicate and upsert subscription
    const filtered = existingSubscriptions.filter(s => s.endpoint !== subscription.endpoint);
    filtered.push({
      ...subscription,
      updated_at: new Date().toISOString(),
    });

    // Keep at most 5 active device subscriptions per user
    const trimmed = filtered.slice(-5);

    // 3. Save back to user_metadata
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentMetadata,
        push_subscriptions: trimmed,
      },
    });

    if (updateError) {
      console.error('Error updating push subscription metadata:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: trimmed.length });
  } catch (err: any) {
    console.error('Push subscription API error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
