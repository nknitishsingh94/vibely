import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => ({}));
    const { friendId, conversationId } = body;
    const userId = auth.user.id; // Strictly bound to verified caller

    if (!friendId) {
      return NextResponse.json({ error: 'Friend ID is required' }, { status: 400 });
    }

    if (friendId === userId) {
      return NextResponse.json({ error: 'Cannot remove oneself' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json(
        { error: 'Server configuration missing. Check SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    const db = createServiceClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Locate the direct conversation between userId and friendId
    let targetConvId: string | null = conversationId || null;

    if (!targetConvId) {
      const { data: userMemberships } = await db
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId);

      const convIds = (userMemberships || []).map((m: any) => m.conversation_id);

      if (convIds.length > 0) {
        const { data: friendMembership } = await db
          .from('conversation_members')
          .select('conversation_id')
          .in('conversation_id', convIds)
          .eq('user_id', friendId)
          .maybeSingle();

        if (friendMembership) {
          targetConvId = friendMembership.conversation_id;
        }
      }
    } else {
      // If conversationId was provided, verify user is actually a member of it
      const { data: isMember } = await db
        .from('conversation_members')
        .select('id')
        .eq('conversation_id', targetConvId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!isMember) {
        return NextResponse.json(
          { error: 'Unauthorized: You are not a member of this conversation' },
          { status: 403 }
        );
      }
    }

    // 2. If a conversation exists, delete it cleanly
    if (targetConvId) {
      // A. Delete all uploaded media files from Supabase Storage ('chat-media' bucket)
      try {
        const { data: fileList } = await db.storage
          .from('chat-media')
          .list(targetConvId);

        if (fileList && fileList.length > 0) {
          const filePaths = fileList.map(f => `${targetConvId}/${f.name}`);
          await db.storage.from('chat-media').remove(filePaths);
        }
      } catch (storageErr) {
        console.error('Failed to clean up conversation media files in storage:', storageErr);
      }

      // B. Permanently delete all message records for this conversation
      await db
        .from('messages')
        .delete()
        .eq('conversation_id', targetConvId);

      // C. Delete conversation members
      await db
        .from('conversation_members')
        .delete()
        .eq('conversation_id', targetConvId);

      // D. Delete the conversation record
      await db
        .from('conversations')
        .delete()
        .eq('id', targetConvId);
    }

    // 3. Remove or revoke invitation records between these two users
    await db
      .from('invitations')
      .delete()
      .or(`token_hash.eq.req:${userId}:${friendId},token_hash.eq.req:${friendId}:${userId}`);

    await db
      .from('invitations')
      .update({ revoked_at: new Date().toISOString() })
      .or(`token_hash.eq.req:${userId}:${friendId},token_hash.eq.req:${friendId}:${userId}`);

    // 4. Real-time broadcast to both users so their lists update immediately
    const channelUsers = [userId, friendId];
    for (const uid of channelUsers) {
      try {
        const channel = db.channel(`user-notifications:${uid}`);
        await channel.subscribe();
        await channel.send({
          type: 'broadcast',
          event: 'friend-removed',
          payload: {
            friendId,
            conversationId: targetConvId,
            removedBy: userId,
          },
        });
        db.removeChannel(channel);
      } catch {
        // Non-blocking broadcast
      }
    }

    return NextResponse.json({
      success: true,
      conversationId: targetConvId,
      message: 'Friend removed successfully',
    });
  } catch (err: any) {
    console.error('Error in remove-friend route:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to remove friend' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  return POST(req);
}
