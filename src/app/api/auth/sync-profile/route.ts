import { NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let userId: string | null = body.userId || null;
    let userEmail: string | null = body.email || null;
    let userMetadata: any = body.userMetadata || {};

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json(
        { error: 'Server configuration missing.' },
        { status: 500 }
      );
    }

    const adminClient = createServiceClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    if (!userId) {
      try {
        const userClient = await createServerSupabase();
        const {
          data: { user },
        } = await userClient.auth.getUser();
        if (user) {
          userId = user.id;
          userEmail = user.email || userEmail;
          userMetadata = user.user_metadata || userMetadata;
        }
      } catch {}
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    let authUserRecord: any = null;
    const { data: authUserData } = await adminClient.auth.admin.getUserById(userId);
    if (authUserData?.user) {
      authUserRecord = authUserData.user;
      userEmail = userEmail || authUserData.user.email || null;
      userMetadata = { ...authUserData.user.user_metadata, ...userMetadata };
    }

    const cleanEmail = userEmail ? userEmail.trim().toLowerCase() : null;

    // 2. Cross-Device Account Merge Check:
    // If user logged in on one device via Google and another via Email with the SAME email address,
    // merge conversation_members, messages, and partner connections so chat history shows up on all devices!
    if (cleanEmail) {
      const { data: allUsers } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      const sameEmailUsers = (allUsers?.users || []).filter(
        (u) => (u.email || '').toLowerCase() === cleanEmail && u.id !== userId
      );

      for (const olderUser of sameEmailUsers) {
        try {
          // Merge conversation_members from older user to current user
          const { data: olderMemberships } = await adminClient
            .from('conversation_members')
            .select('conversation_id, role, joined_at, last_read_at')
            .eq('user_id', olderUser.id);

          if (olderMemberships && olderMemberships.length > 0) {
            for (const mem of olderMemberships) {
              await adminClient
                .from('conversation_members')
                .upsert(
                  {
                    conversation_id: mem.conversation_id,
                    user_id: userId,
                    role: mem.role,
                    joined_at: mem.joined_at,
                    last_read_at: mem.last_read_at,
                  },
                  { onConflict: 'conversation_id,user_id' }
                );
            }
          }

          // Transfer messages sent by older user
          await adminClient
            .from('messages')
            .update({ sender_id: userId })
            .eq('sender_id', olderUser.id);

          // Transfer message receipts
          await adminClient
            .from('message_receipts')
            .update({ user_id: userId })
            .eq('user_id', olderUser.id);

          // Transfer invitations
          await adminClient
            .from('invitations')
            .update({ inviter_id: userId })
            .eq('inviter_id', olderUser.id);

          // Copy older profile display name or username if current profile is default
          const { data: olderProfile } = await adminClient
            .from('profiles')
            .select('*')
            .eq('id', olderUser.id)
            .maybeSingle();

          if (olderProfile) {
            const { data: currentProfile } = await adminClient
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();

            if (!currentProfile || !currentProfile.username) {
              await adminClient.from('profiles').upsert(
                {
                  id: userId,
                  display_name: olderProfile.display_name,
                  username: olderProfile.username,
                  avatar_path: olderProfile.avatar_path,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'id' }
              );
            }
          }
        } catch (mergeErr) {
          console.warn('Cross-device account merge warning for older user:', olderUser.id, mergeErr);
        }
      }
    }

    // 3. Ensure profile exists for the active userId
    const { data: profile, error: profErr } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      return NextResponse.json({ success: true, profile });
    }

    // If profile is missing, check if this is an immediate signup/OAuth flow
    const createdAt = userMetadata?.created_at || (authUserRecord?.created_at ? new Date(authUserRecord.created_at).getTime() : 0);
    const isBrandNewUser = createdAt ? (Date.now() - new Date(createdAt).getTime()) < 180000 : false;

    if (!body.isInitialSignup && !isBrandNewUser) {
      console.warn(`User ${userId} profile was deleted from database. Rejecting recreation.`);
      return NextResponse.json(
        { error: 'User profile was deleted in database.', deleted: true },
        { status: 404 }
      );
    }

    // Auto-create profile only for new signups
    const fullName =
      userMetadata.full_name ||
      userMetadata.name ||
      userMetadata.display_name ||
      (cleanEmail ? cleanEmail.split('@')[0] : 'Vibely User');

    let baseUsername = (
      userMetadata.username ||
      userMetadata.preferred_username ||
      userMetadata.user_name ||
      (cleanEmail ? cleanEmail.split('@')[0] : 'user')
    )
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 18);

    if (baseUsername.length < 3) {
      baseUsername = `user_${userId.slice(0, 4)}`;
    }

    let finalUsername = baseUsername;
    const { data: taken } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', finalUsername)
      .maybeSingle();

    if (taken && taken.id !== userId) {
      finalUsername = `${baseUsername.slice(0, 13)}_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const { data: newProfile, error: insertErr } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: userId,
          display_name: fullName,
          username: finalUsername,
          avatar_path: userMetadata.avatar_url || userMetadata.picture || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (insertErr) {
      console.error('Failed to create profile in sync-profile:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    await adminClient
      .from('user_preferences')
      .upsert({ user_id: userId }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true, profile: newProfile });
  } catch (err: any) {
    console.error('Error in sync-profile route:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to sync profile' },
      { status: 500 }
    );
  }
}
