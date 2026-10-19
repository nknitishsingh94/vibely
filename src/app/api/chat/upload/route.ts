import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { getAuthenticatedUser } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB max
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'php', 'py', 'js', 'mjs', 'cjs', 'html', 'htm', 'svg', 'vbs', 'scr', 'msi', 'dll'
]);

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'audio/',
  'video/',
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.',
  'application/zip',
  'application/x-zip-compressed',
];

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce Authentication
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in to upload files.' }, { status: 401 });
    }

    const userId = user.id;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;

    if (!file || !conversationId) {
      return NextResponse.json({ error: 'Missing file or conversationId' }, { status: 400 });
    }

    // 2. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum allowed limit (25 MB).' },
        { status: 400 }
      );
    }

    const originalName = file.name || 'attachment';
    const cleanExt = (originalName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-zA-Z0-9]/g, '');

    // 3. Security check: Disallow dangerous file extensions (Stored XSS, malware)
    if (DANGEROUS_EXTENSIONS.has(cleanExt)) {
      return NextResponse.json(
        { error: `Uploading .${cleanExt} files is not permitted for security reasons.` },
        { status: 400 }
      );
    }

    const contentType = file.type && file.type.trim() !== '' ? file.type.toLowerCase() : 'application/octet-stream';
    const isAllowedMime = ALLOWED_MIME_PREFIXES.some(prefix => contentType.startsWith(prefix));

    // Specifically block svg and html mimes
    if (contentType.includes('html') || contentType.includes('svg') || !isAllowedMime) {
      return NextResponse.json(
        { error: 'File type not supported or contains insecure content.' },
        { status: 400 }
      );
    }

    const admin = createServiceClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // 4. Validate user is an actual member of this conversation
    const { data: membership } = await admin
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: 'Forbidden: You are not a participant in this conversation.' },
        { status: 403 }
      );
    }

    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${cleanExt}`;
    const filePath = `${conversationId}/${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload with service role key
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
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
