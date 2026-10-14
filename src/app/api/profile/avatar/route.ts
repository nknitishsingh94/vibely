import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, avatarData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const serviceKey = env.supabaseServiceRoleKey;
    if (!serviceKey || !env.supabaseUrl) {
      return NextResponse.json(
        { error: 'Server configuration missing' },
        { status: 500 }
      );
    }

    const adminClient = createServiceClient(env.supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    let finalAvatarUrl: string | null = null;

    if (avatarData) {
      // If it's a data URL, try uploading to Supabase Storage, or fallback to data URL directly
      if (typeof avatarData === 'string' && avatarData.startsWith('data:image/')) {
        try {
          const match = avatarData.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const fileExt = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
            const storagePath = `avatars/${userId}_${Date.now()}.${fileExt}`;

            // Try uploading to 'chat-media' bucket
            const { error: uploadError } = await adminClient.storage
              .from('chat-media')
              .upload(storagePath, buffer, {
                contentType: mimeType,
                upsert: true,
              });

            if (!uploadError) {
              const { data: publicUrlData } = adminClient.storage
                .from('chat-media')
                .getPublicUrl(storagePath);

              if (publicUrlData?.publicUrl) {
                finalAvatarUrl = publicUrlData.publicUrl;
              }
            }
          }
        } catch (storageErr) {
          console.warn('Supabase storage upload error, falling back to data URL:', storageErr);
        }

        // If storage didn't succeed, use avatarData directly
        if (!finalAvatarUrl) {
          finalAvatarUrl = avatarData;
        }
      } else {
        // Direct URL or null
        finalAvatarUrl = avatarData;
      }
    } else {
      // Remove avatar
      finalAvatarUrl = null;
    }

    // Update profiles table
    const { data: updatedProfile, error: dbError } = await adminClient
      .from('profiles')
      .update({
        avatar_path: finalAvatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, display_name, username, avatar_path, bio')
      .single();

    if (dbError) {
      return NextResponse.json(
        { error: dbError.message || 'Failed to update profile avatar' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      avatarUrl: finalAvatarUrl,
      profile: updatedProfile,
    });
  } catch (err: any) {
    console.error('Error in profile avatar API:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
