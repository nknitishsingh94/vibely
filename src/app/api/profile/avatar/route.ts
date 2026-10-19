import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { requireAuth } from '@/lib/auth-guard';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;

    const userId = auth.user.id; // Strictly bound to verified user

    const body = await req.json().catch(() => ({}));
    const { avatarData } = body;

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
      if (typeof avatarData === 'string' && avatarData.startsWith('data:image/')) {
        let uploadedUrl: string | null = null;
        try {
          const match = avatarData.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (!match) {
            return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
          }

          const mimeType = match[1].toLowerCase();
          if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            return NextResponse.json(
              { error: 'Unsupported image type. Only JPEG, PNG, WEBP, and GIF are allowed.' },
              { status: 400 }
            );
          }

          const base64Data = match[2];
          const buffer = Buffer.from(base64Data, 'base64');

          if (buffer.length > MAX_AVATAR_BYTES) {
            return NextResponse.json({ error: 'Avatar image must be smaller than 5MB.' }, { status: 400 });
          }

          const fileExt = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
          const storagePath = `${userId}_${Date.now()}.${fileExt}`;

          // Ensure avatars bucket exists
          try {
            const { data: bucketData } = await adminClient.storage.getBucket('avatars');
            if (!bucketData) {
              await adminClient.storage.createBucket('avatars', {
                public: true,
                fileSizeLimit: MAX_AVATAR_BYTES,
                allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
              });
            }
          } catch {}

          // Upload to avatars bucket
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
          }
        } catch (storageErr) {
          console.warn('Avatar upload fallback error:', storageErr);
        }

        finalAvatarUrl = uploadedUrl || null;
      } else if (typeof avatarData === 'string' && avatarData.startsWith('https://')) {
        // Safe HTTPS URL
        finalAvatarUrl = avatarData;
      } else {
        return NextResponse.json({ error: 'Invalid avatar data supplied.' }, { status: 400 });
      }
    } else {
      // Remove avatar
      finalAvatarUrl = null;
    }

    // Update profiles table for the verified user only
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
