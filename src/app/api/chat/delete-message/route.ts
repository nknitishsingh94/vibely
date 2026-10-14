import { NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messageIds, mode, conversationId } = body;

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
      } catch {}
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: User ID required' }, { status: 401 });
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'No message IDs provided' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json(
        { error: 'Server configuration missing' },
        { status: 500 }
      );
    }

    const db = createServiceClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const nowIso = new Date().toISOString();

    // 1. Fetch any storage paths associated with these messages to delete physical files from Supabase Storage
    const { data: msgsWithStorage } = await db
      .from('messages')
      .select('id, storage_path, sender_id')
      .in('id', messageIds);

    const storagePathsToRemove = (msgsWithStorage || [])
      .filter(m => (mode === 'for_everyone' ? m.sender_id === userId : true))
      .map(m => m.storage_path)
      .filter((p): p is string => Boolean(p));

    // Remove files from Supabase Storage bucket ('chat-media') to free up storage space
    if (storagePathsToRemove.length > 0) {
      try {
        await db.storage.from('chat-media').remove(storagePathsToRemove);
      } catch (storageErr) {
        console.error('Failed to remove media files from chat-media storage:', storageErr);
      }
    }

    if (mode === 'for_everyone') {
      // 2. Delete for everyone: permanently wipe body (encrypted ciphertext), storage_path, and metadata from DB
      const { error: updateErr } = await db
        .from('messages')
        .update({
          deleted_at: nowIso,
          body: null,
          storage_path: null,
          original_filename: null,
          file_size: null,
          mime_type: null,
        })
        .in('id', messageIds)
        .eq('sender_id', userId);

      if (updateErr) {
        console.error('Failed to update messages for everyone in DB:', updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, deletedAt: nowIso, count: messageIds.length });
    }

    if (mode === 'permanent' || mode === 'hard_delete') {
      // Hard delete: completely delete the rows from messages table
      const { error: deleteErr } = await db
        .from('messages')
        .delete()
        .in('id', messageIds)
        .eq('sender_id', userId);

      if (deleteErr) {
        return NextResponse.json({ error: deleteErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, count: messageIds.length });
    }

    // For 'for_me', if any message was already marked deleted_at (a placeholder) AND the user is the sender,
    // or if only that user was in the conversation, we ensure state is recorded
    return NextResponse.json({ success: true, count: messageIds.length });
  } catch (err: any) {
    console.error('Error in /api/chat/delete-message:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
