import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { targetUserId, event, payload, conversationId, roomId } = body;

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 });
    }

    const adminClient = createServiceClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const enrichedPayload = {
      ...payload,
      timestamp: payload?.timestamp || Date.now(),
    };

    const broadcastPromises: Promise<any>[] = [];

    // 1. Direct user call channel
    if (targetUserId) {
      const callChannel = adminClient.channel(`call-user:${targetUserId}`);
      broadcastPromises.push(
        callChannel.send({
          type: 'broadcast',
          event,
          payload: enrichedPayload,
        }).catch(() => {})
      );

      // 2. Direct user notification channel
      const notifChannel = adminClient.channel(`user-notifications:${targetUserId}`);
      broadcastPromises.push(
        notifChannel.send({
          type: 'broadcast',
          event,
          payload: enrichedPayload,
        }).catch(() => {})
      );
    }

    // 3. Conversation channel (if present)
    if (conversationId) {
      const convChannel = adminClient.channel(`conversation:${conversationId}`);
      broadcastPromises.push(
        convChannel.send({
          type: 'broadcast',
          event,
          payload: enrichedPayload,
        }).catch(() => {})
      );
    }

    // 4. Room channel (if present)
    if (roomId) {
      const roomChannel = adminClient.channel(`call-room:${roomId}`);
      broadcastPromises.push(
        roomChannel.send({
          type: 'broadcast',
          event,
          payload: enrichedPayload,
        }).catch(() => {})
      );
    }

    await Promise.allSettled(broadcastPromises);

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (err: any) {
    console.error('Call signal API error:', err);
    return NextResponse.json({ error: err?.message || 'Signal error' }, { status: 500 });
  }
}
