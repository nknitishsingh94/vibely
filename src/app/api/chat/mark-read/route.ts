import { NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { conversationId } = body;

    let userId: string | null = body.userId || req.headers.get('x-user-id') || null;

    if (!userId) {
      try {
        const userClient = await createServerSupabase();
        const {
          data: { user },
        } = await userClient.auth.getUser();
        if (user) {
          userId = user.id;
        }
      } catch {
        // Fallback check
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: User ID required' }, { status: 401 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json(
        { error: 'Server configuration missing.' },
        { status: 500 }
      );
    }

    const db = createServiceClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const nowIso = new Date().toISOString();

    // 1. Update last_read_at in conversation_members
    await db
      .from('conversation_members')
      .update({ last_read_at: nowIso })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    // 2. Mark partner messages as read in message_receipts
    const { data: unreadPartnerMessages } = await db
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadPartnerMessages && unreadPartnerMessages.length > 0) {
      const receiptRows = unreadPartnerMessages.map((m: any) => ({
        message_id: m.id,
        user_id: userId,
        delivered_at: nowIso,
        read_at: nowIso,
      }));

      await db
        .from('message_receipts')
        .upsert(receiptRows, { onConflict: 'message_id,user_id' });
    }

    return NextResponse.json({ success: true, readAt: nowIso });
  } catch (err: any) {
    console.error('Error in mark-read route:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to mark conversation read' },
      { status: 500 }
    );
  }
}
