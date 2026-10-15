import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;

    if (!file || !conversationId) {
      return NextResponse.json({ error: 'Missing file or conversationId' }, { status: 400 });
    }

    // Verify session
    let userId: string | null = null;
    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    }

    const admin = createServiceClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    if (userId) {
      // Validate membership in conversation
      const { data: membership } = await admin
        .from('conversation_members')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json({ error: 'Unauthorized for this conversation' }, { status: 403 });
      }
    }

    const originalName = file.name || 'document';
    const cleanExt = (originalName.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '');
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${cleanExt}`;
    const filePath = `${conversationId}/${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload with service role key - bypasses any MIME / RLS restrictions!
    const contentType = file.type && file.type.trim() !== '' ? file.type : 'application/octet-stream';
    const { error: uploadError } = await admin.storage
      .from('chat-media')
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Server upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      filePath,
      filename: originalName,
      fileSize: file.size,
      mimeType: contentType,
    });
  } catch (err: any) {
    console.error('API chat upload exception:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
