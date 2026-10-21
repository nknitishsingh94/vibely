import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const creatorId = auth.user.id;

    const body = await req.json().catch(() => ({}));
    const { name, memberIds, avatarPath } = body;

    const trimmedName = typeof name === 'string' ? name.trim().slice(0, 60) : '';
    if (!trimmedName) {
      return NextResponse.json(
        { error: 'Please provide a valid group name (1-60 characters)' },
        { status: 400 }
      );
    }

    if (!Array.isArray(memberIds)) {
      return NextResponse.json(
        { error: 'Please select at least one friend to add to the group' },
        { status: 400 }
      );
    }

    // Deduplicate and exclude creator
    const validMemberIds = Array.from(new Set(memberIds.filter(id => typeof id === 'string' && id !== creatorId)));

    if (validMemberIds.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one friend to create a group' },
        { status: 400 }
      );
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

    // 1. Create conversation row (with fallback if new columns are not yet in database)
    let convId: string | null = null;
    let createWithMetaErr = false;

    try {
      const { data: convData, error: convErr } = await db
        .from('conversations')
        .insert({
          type: 'group',
          name: trimmedName,
          avatar_path: typeof avatarPath === 'string' ? avatarPath : null,
          created_by: creatorId,
        })
        .select('id')
        .single();

      if (convErr || !convData) {
        createWithMetaErr = true;
      } else {
        convId = convData.id;
      }
    } catch {
      createWithMetaErr = true;
    }

    if (createWithMetaErr || !convId) {
      // Fallback to inserting base conversation
      const { data: baseConv, error: baseErr } = await db
        .from('conversations')
        .insert({ type: 'group' })
        .select('id')
        .single();

      if (baseErr || !baseConv) {
        console.error('Failed to create group conversation:', baseErr);
        return NextResponse.json(
          { error: 'Failed to create group conversation in database' },
          { status: 500 }
        );
      }
      convId = baseConv.id;
    }

    // 2. Add members
    const now = new Date().toISOString();
    const membersToInsert = [
      {
        conversation_id: convId,
        user_id: creatorId,
        role: 'admin',
        joined_at: now,
        last_read_at: now,
      },
      ...validMemberIds.map(uid => ({
        conversation_id: convId,
        user_id: uid,
        role: 'member',
        joined_at: now,
        last_read_at: now,
      })),
    ];

    const { error: memberInsertErr } = await db
      .from('conversation_members')
      .insert(membersToInsert);

    if (memberInsertErr) {
      console.error('Failed to insert group members:', memberInsertErr);
      return NextResponse.json(
        { error: 'Failed to add members to group conversation' },
        { status: 500 }
      );
    }

    // 3. Fetch creator profile for initial system message
    const { data: creatorProfile } = await db
      .from('profiles')
      .select('display_name')
      .eq('id', creatorId)
      .maybeSingle();

    const creatorName = creatorProfile?.display_name || 'Admin';

    // 4. Create an initial message
    await db.from('messages').insert({
      conversation_id: convId,
      sender_id: creatorId,
      message_type: 'text',
      body: `✨ ${creatorName} created group "${trimmedName}"`,
    });

    // 5. Broadcast to all members so their UI refreshes immediately
    const allMemberIds = [creatorId, ...validMemberIds];
    for (const uid of allMemberIds) {
      try {
        const notifChannel = db.channel(`user-notifications:${uid}`);
        await notifChannel.subscribe();
        await notifChannel.send({
          type: 'broadcast',
          event: 'new-group',
          payload: {
            conversationId: convId,
            name: trimmedName,
            createdBy: creatorId,
          },
        });
        db.removeChannel(notifChannel);
      } catch {
        // non-blocking broadcast
      }
    }

    return NextResponse.json({
      success: true,
      conversationId: convId,
      name: trimmedName,
      memberCount: allMemberIds.length,
    });
  } catch (err: any) {
    console.error('Unexpected error in create-group route:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
