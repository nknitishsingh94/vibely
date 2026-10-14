import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { sendWebPushToUser } from '@/lib/push-sender';

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

    const sendToChannel = (channelName: string) => {
      const channel = adminClient.channel(channelName);
      if (typeof channel.httpSend === 'function') {
        return channel.httpSend(event, enrichedPayload).catch(err => {
          console.warn(`httpSend to ${channelName} failed:`, err);
        });
      } else {
        return channel
          .send({
            type: 'broadcast',
            event,
            payload: enrichedPayload,
          })
          .catch(() => {});
      }
    };

    // 1. Direct user call channel
    if (targetUserId) {
      broadcastPromises.push(sendToChannel(`call-user:${targetUserId}`));
      // 2. Direct user notification channel
      broadcastPromises.push(sendToChannel(`user-notifications:${targetUserId}`));

      // 3. High-Priority Background Web Push (Wakes up mobile phone when app is closed / locked)
      if (event === 'incoming_call' || event === 'new_message' || event === 'call_cancelled') {
        broadcastPromises.push(sendWebPushToUser(targetUserId, event, enrichedPayload));
      }
    }

    // 4. Conversation channel (if present)
    if (conversationId) {
      broadcastPromises.push(sendToChannel(`conversation:${conversationId}`));
    }

    // 5. Room channel (if present)
    if (roomId) {
      broadcastPromises.push(sendToChannel(`call-room:${roomId}`));
    }

    await Promise.allSettled(broadcastPromises);

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (err: any) {
    console.error('Call signal API error:', err);
    return NextResponse.json({ error: err?.message || 'Signal error' }, { status: 500 });
  }
}
