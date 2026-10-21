import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const callerId = auth.user.id;
    const body = await req.json().catch(() => ({}));
    const { action, conversationId, name, avatarPath, memberIds } = body;

    if (!conversationId || typeof conversationId !== 'string') {
      return NextResponse.json(
        { error: 'Valid conversationId is required' },
        { status: 400 }
      );
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

    // Check that caller is a member of this conversation
    const { data: callerMember, error: callerMemberErr } = await db
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', callerId)
      .maybeSingle();

    if (callerMemberErr || !callerMember) {
      return NextResponse.json(
        { error: 'You are not a member of this group' },
        { status: 403 }
      );
    }

    // 1. Action: Leave Group
    if (action === 'leave_group') {
      const { error: delErr } = await db
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', callerId);

      if (delErr) {
        return NextResponse.json(
          { error: 'Failed to leave group' },
          { status: 500 }
        );
      }

      // Check remaining members
      const { data: remainingMembers } = await db
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId);

      // If no members left, delete conversation
      if (!remainingMembers || remainingMembers.length === 0) {
        await db.from('conversations').delete().eq('id', conversationId);
      } else {
        // Fetch caller name for system notice
        const { data: callerProfile } = await db
          .from('profiles')
          .select('display_name')
          .eq('id', callerId)
          .maybeSingle();

        const leaverName = callerProfile?.display_name || 'A member';
        await db.from('messages').insert({
          conversation_id: conversationId,
          sender_id: callerId,
          message_type: 'text',
          body: `👋 ${leaverName} left the group`,
        });

        // Broadcast to remaining members
        for (const rem of remainingMembers) {
          try {
            const notifChannel = db.channel(`user-notifications:${rem.user_id}`);
            await notifChannel.subscribe();
            await notifChannel.send({
              type: 'broadcast',
              event: 'group-updated',
              payload: { conversationId, action: 'member_left', userId: callerId },
            });
            db.removeChannel(notifChannel);
          } catch {}
        }
      }

      return NextResponse.json({ success: true, message: 'Successfully left group' });
    }

    // 2. Action: Update Group (name / avatar)
    if (action === 'update_group') {
      const updates: Record<string, any> = {};
      if (typeof name === 'string' && name.trim()) {
        updates.name = name.trim().slice(0, 60);
      }
      if (typeof avatarPath === 'string') {
        updates.avatar_path = avatarPath;
      }

      if (Object.keys(updates).length > 0) {
        await db
          .from('conversations')
          .update(updates)
          .eq('id', conversationId);
      }

      // Broadcast update
      const { data: members } = await db
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (members) {
        for (const m of members) {
          try {
            const notifChannel = db.channel(`user-notifications:${m.user_id}`);
            await notifChannel.subscribe();
            await notifChannel.send({
              type: 'broadcast',
              event: 'group-updated',
              payload: { conversationId, updates },
            });
            db.removeChannel(notifChannel);
          } catch {}
        }
      }

      return NextResponse.json({ success: true, updates });
    }

    // 3. Action: Add Members
    if (action === 'add_members') {
      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return NextResponse.json(
          { error: 'No members provided to add' },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const newRows = memberIds.map(uid => ({
        conversation_id: conversationId,
        user_id: uid,
        role: 'member',
        joined_at: now,
        last_read_at: now,
      }));

      const { error: insErr } = await db
        .from('conversation_members')
        .upsert(newRows, { onConflict: 'conversation_id,user_id' });

      if (insErr) {
        return NextResponse.json(
          { error: 'Failed to add new members' },
          { status: 500 }
        );
      }

      // Broadcast to new members
      for (const uid of memberIds) {
        try {
          const notifChannel = db.channel(`user-notifications:${uid}`);
          await notifChannel.subscribe();
          await notifChannel.send({
            type: 'broadcast',
            event: 'new-group',
            payload: { conversationId },
          });
          db.removeChannel(notifChannel);
        } catch {}
      }

      return NextResponse.json({ success: true, addedCount: memberIds.length });
    }

    return NextResponse.json(
      { error: 'Invalid action provided' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Group details error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
