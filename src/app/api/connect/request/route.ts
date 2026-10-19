import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cleanDuoIdentifier } from '@/lib/duo-id';
import { env } from '@/lib/env';
import { requireAuth } from '@/lib/auth-guard';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const senderId = auth.user.id; // Cryptographically verified caller ID

    // Rate limit connection requests per user: max 20 requests per hour
    const limit = checkRateLimit(`connect-req:${senderId}`, 20, 60 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Connection request rate limit reached. Please wait before sending more requests.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { identifier } = body;

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { error: 'Please enter a valid username' },
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

    const clean = cleanDuoIdentifier(identifier);
    const rawTrimmed = identifier.trim();

    // Search for target profile (receiver)
    let targetProfile = null;

    // Search by username
    const { data: byUsername } = await db
      .from('profiles')
      .select('id, username, display_name, avatar_path')
      .ilike('username', clean)
      .maybeSingle();

    if (byUsername) {
      targetProfile = byUsername;
    }

    // Search by full UUID
    if (!targetProfile && rawTrimmed.length >= 32) {
      const { data: byFullId } = await db
        .from('profiles')
        .select('id, username, display_name, avatar_path')
        .eq('id', rawTrimmed)
        .maybeSingle();
      if (byFullId) targetProfile = byFullId;
    }

    // Search by ID prefix (from #DUO-XXXXXXXX)
    if (!targetProfile && clean.length >= 4) {
      const { data: allProfiles } = await db
        .from('profiles')
        .select('id, username, display_name, avatar_path')
        .limit(100);

      if (allProfiles) {
        targetProfile = allProfiles.find((p: any) => {
          const strippedId = (p.id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          return (
            strippedId.startsWith(clean.toLowerCase()) ||
            (p.username && p.username.toLowerCase() === clean.toLowerCase())
          );
        });
      }
    }

    if (!targetProfile) {
      return NextResponse.json(
        { error: `No user found with username "${identifier}"` },
        { status: 404 }
      );
    }

    // Cannot connect with oneself
    if (targetProfile.id === senderId) {
      return NextResponse.json(
        { error: 'You cannot connect with your own username. Share it with your partner!' },
        { status: 400 }
      );
    }

    // Check if direct conversation already exists between current user & target
    const { data: userMemberships } = await db
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', senderId);

    if (userMemberships && userMemberships.length > 0) {
      const convIds = userMemberships.map((m: any) => m.conversation_id);

      const { data: partnerMemberships } = await db
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', targetProfile.id)
        .in('conversation_id', convIds);

      if (partnerMemberships && partnerMemberships.length > 0) {
        return NextResponse.json({
          alreadyConnected: true,
          conversationId: partnerMemberships[0].conversation_id,
          message: `You are already connected with ${targetProfile.display_name}!`,
        });
      }
    }

    const tokenHash = `req:${senderId}:${targetProfile.id}`;
    const reverseTokenHash = `req:${targetProfile.id}:${senderId}`;

    // Check if target user has ALREADY sent a pending request to current user (Auto-accept)
    const { data: existingReverseReq } = await db
      .from('invitations')
      .select('id, used_at, revoked_at')
      .eq('token_hash', reverseTokenHash)
      .is('used_at', null)
      .is('revoked_at', null)
      .maybeSingle();

    if (existingReverseReq) {
      await db
        .from('invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('id', existingReverseReq.id);

      const { data: newConv } = await db
        .from('conversations')
        .insert({ type: 'direct' })
        .select('id')
        .single();

      if (newConv) {
        await db.from('conversation_members').insert([
          { conversation_id: newConv.id, user_id: senderId, role: 'member' },
          { conversation_id: newConv.id, user_id: targetProfile.id, role: 'member' },
        ]);

        return NextResponse.json({
          success: true,
          autoAccepted: true,
          conversationId: newConv.id,
          message: `${targetProfile.display_name} had already sent you a request! You are now connected!`,
        });
      }
    }

    // Check if current user already sent a pending request
    const { data: existingReq } = await db
      .from('invitations')
      .select('id, used_at, revoked_at')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .is('revoked_at', null)
      .maybeSingle();

    if (existingReq) {
      return NextResponse.json(
        { error: `You have already sent a pending connection request to ${targetProfile.display_name}.` },
        { status: 400 }
      );
    }

    // Insert the pending connection request with 30-day expiry
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await db.from('invitations').upsert(
      {
        created_by: senderId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        used_at: null,
        revoked_at: null,
      },
      { onConflict: 'token_hash' }
    );

    if (insertError) {
      console.error('Error creating connection request:', insertError);
      return NextResponse.json(
        { error: 'Failed to send connection request. Please try again.' },
        { status: 500 }
      );
    }

    // Realtime broadcast to recipient's notification channel
    try {
      const channel = db.channel(`user-notifications:${targetProfile.id}`);
      await channel.subscribe();
      await channel.send({
        type: 'broadcast',
        event: 'new-request',
        payload: { senderId, receiverId: targetProfile.id },
      });
      db.removeChannel(channel);
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      partner: targetProfile,
      message: `Connection request sent to ${targetProfile.display_name}! Once they accept, they will appear in your friend list.`,
    });
  } catch (err: any) {
    console.error('Connection request API error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
