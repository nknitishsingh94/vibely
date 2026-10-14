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
      // If it's a data URL, try uploading to public Supabase Storage 'avatars' bucket, or fallback to data URL directly
      if (typeof avatarData === 'string' && avatarData.startsWith('data:image/')) {
        let uploadedUrl: string | null = null;
        try {
          const match = avatarData.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const fileExt = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
            const storagePath = `${userId}_${Date.now()}.${fileExt}`;

            // Ensure public 'avatars' bucket exists in Supabase Storage
            try {
              const { data: bucketData } = await adminClient.storage.getBucket('avatars');
              if (!bucketData) {
                await adminClient.storage.createBucket('avatars', {
                  public: true,
                  fileSizeLimit: 5242880,
                  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
                });
              } else if (!bucketData.public) {
                await adminClient.storage.updateBucket('avatars', { public: true });
              }
            } catch (bErr) {
              console.warn('Avatars bucket check/create notice:', bErr);
            }

            // Upload to public 'avatars' bucket
            const { error: uploadError } = await adminClient.storage
              .from('avatars')
              .upload(storagePath, buffer, {
                contentType: mimeType,
                upsert: true,
              });

            if (!uploadError) {
              const { data: publicUrlData } = adminClient.storage
                .from('avatars')
                .getPublicUrl(storagePath);

              if (publicUrlData?.publicUrl) {
                uploadedUrl = publicUrlData.publicUrl;
              }
            } else {
              console.warn('Avatars upload error, will use direct data URL fallback:', uploadError.message);
            }
          }
        } catch (storageErr) {
          console.warn('Supabase storage upload error, falling back to data URL:', storageErr);
        }

        // If storage upload succeeded, use that URL; otherwise, fallback directly to the data URL
        finalAvatarUrl = uploadedUrl || avatarData;
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
