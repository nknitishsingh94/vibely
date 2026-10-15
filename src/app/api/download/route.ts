import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

const APK_RELEASE_URL =
  'https://github.com/nknitishsingh94/vibely/releases/download/v1.0.0-apk/Vibely.apk';
const STATS_FILE_PATH = 'system/metrics.txt';

export async function GET() {
  // 1. Asynchronously record download count & broadcast real-time update
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
          const newCount = currentDownloads + 1;
          const buffer = Buffer.from(
            JSON.stringify({
              downloads: newCount,
              lastUpdated: new Date().toISOString(),
            })
          );

          // Broadcast real-time update to all open web browsers
          try {
            const statsChan = adminClient.channel('vibely-live-stats');
            statsChan.send({
              type: 'broadcast',
              event: 'download_increment',
              payload: { downloads: newCount },
            }).finally(() => {
              setTimeout(() => adminClient.removeChannel(statsChan), 2000);
            });
          } catch {}

          return adminClient.storage
            .from('chat-media')
            .upload(STATS_FILE_PATH, buffer, { upsert: true, contentType: 'text/plain' });
        })
        .catch(() => {});
    }
  } catch {}

  // 2. Fetch APK binary and stream directly with proper Android package MIME type
  try {
    const upstreamRes = await fetch(APK_RELEASE_URL, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Vibely-APK-Downloader',
      },
    });

    if (upstreamRes.ok && upstreamRes.body) {
      const contentLength = upstreamRes.headers.get('content-length');
      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', 'application/vnd.android.package-archive');
      responseHeaders.set('Content-Disposition', 'attachment; filename="Vibely.apk"');
      if (contentLength) {
        responseHeaders.set('Content-Length', contentLength);
      }
      responseHeaders.set('Cache-Control', 'public, max-age=300');

      return new Response(upstreamRes.body, {
        status: 200,
        headers: responseHeaders,
      });
    }
  } catch (err) {
    console.warn('Direct APK streaming fallback to redirect:', err);
  }

  // 3. Fallback: 302 redirect directly to GitHub Release APK
  return NextResponse.redirect(APK_RELEASE_URL, 302);
}
