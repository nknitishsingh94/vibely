import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

const APK_RELEASE_URL =
  'https://github.com/nknitishsingh94/vibely/releases/download/v1.0.0-apk/Vibely.apk';
const STATS_FILE_PATH = 'system/metrics.txt';

export async function GET() {
  // Asynchronously record download count
  try {
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      const adminClient = createServiceClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: { persistSession: false },
      });

      adminClient.storage
        .from('chat-media')
        .download(STATS_FILE_PATH)
        .then(async ({ data }) => {
          let currentDownloads = 184;
          if (data) {
            try {
              const text = await data.text();
              const parsed = JSON.parse(text);
              if (typeof parsed.downloads === 'number') {
                currentDownloads = parsed.downloads;
              }
            } catch {}
          }
          const buffer = Buffer.from(
            JSON.stringify({
              downloads: currentDownloads + 1,
              lastUpdated: new Date().toISOString(),
            })
          );
          return adminClient.storage
            .from('chat-media')
            .upload(STATS_FILE_PATH, buffer, { upsert: true, contentType: 'text/plain' });
        })
        .catch(() => {});
    }
  } catch {}

  // Redirect browser to direct APK download
  return NextResponse.redirect(APK_RELEASE_URL, 302);
}
