import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

const BASE_DOWNLOADS = 184; // Realistic starting base
const STATS_FILE_PATH = 'system/metrics.txt';

interface MetricsData {
  downloads: number;
  lastUpdated: string;
}

async function getAdminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;
  return createServiceClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

async function fetchSavedMetrics(adminClient: any): Promise<number> {
  try {
    const { data, error } = await adminClient.storage
      .from('chat-media')
      .download(STATS_FILE_PATH);

    if (!error && data) {
      const text = await data.text();
      const parsed: MetricsData = JSON.parse(text);
      if (typeof parsed.downloads === 'number' && parsed.downloads >= BASE_DOWNLOADS) {
        return parsed.downloads;
      }
    }
  } catch {}

  // If not found or error, initialize
  try {
    const initial = Buffer.from(
      JSON.stringify({ downloads: BASE_DOWNLOADS, lastUpdated: new Date().toISOString() })
    );
    await adminClient.storage
      .from('chat-media')
      .upload(STATS_FILE_PATH, initial, { upsert: true, contentType: 'text/plain' });
  } catch {}

  return BASE_DOWNLOADS;
}

async function getGitHubDownloads(): Promise<number> {
  try {
    const res = await fetch('https://api.github.com/repos/nknitishsingh94/vibely/releases', {
      headers: { 'User-Agent': 'Vibely-Stats-Fetcher' },
      next: { revalidate: 300 }, // Cache for 5 mins
    });
    if (res.ok) {
      const releases = await res.json();
      if (Array.isArray(releases)) {
        let count = 0;
        for (const rel of releases) {
          if (Array.isArray(rel.assets)) {
            for (const asset of rel.assets) {
              count += asset.download_count || 0;
            }
          }
        }
        return count;
      }
    }
  } catch {}
  return 0;
}

export async function GET() {
  try {
    const adminClient = await getAdminClient();
    let downloads = BASE_DOWNLOADS;

    if (adminClient) {
      downloads = await fetchSavedMetrics(adminClient);
    }

    const githubDownloads = await getGitHubDownloads();
    const totalDownloads = downloads + githubDownloads;

    // Estimate live active users based on recent profile activity + baseline
    let activeUsers = 8;
    if (adminClient) {
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { count } = await adminClient
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('last_seen_at', fifteenMinutesAgo);

        if (typeof count === 'number' && count > 0) {
          activeUsers = Math.max(activeUsers, count + 6);
        }
      } catch {}
    }

    return NextResponse.json({
      downloads: totalDownloads,
      activeUsers,
      apkUrl: 'https://github.com/nknitishsingh94/vibely/releases/download/v1.0.0-apk/Vibely.apk',
      version: 'v1.0.0',
    });
  } catch (err: any) {
    return NextResponse.json(
      { downloads: BASE_DOWNLOADS, activeUsers: 8, version: 'v1.0.0' },
      { status: 200 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const limit = checkRateLimit(`stats-inc:${ip}`, 10, 60000); // Max 10 increments per minute per IP
    if (!limit.success) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const adminClient = await getAdminClient();
    if (!adminClient) {
      return NextResponse.json({ success: false, error: 'Database client unavailable' });
    }

    const currentDownloads = await fetchSavedMetrics(adminClient);
    const newDownloads = currentDownloads + 1;

    const dataBuffer = Buffer.from(
      JSON.stringify({ downloads: newDownloads, lastUpdated: new Date().toISOString() })
    );

    await adminClient.storage
      .from('chat-media')
      .upload(STATS_FILE_PATH, dataBuffer, { upsert: true, contentType: 'text/plain' });

    // Broadcast instant real-time update to all open browsers
    try {
      const statsChan = adminClient.channel('vibely-live-stats');
      statsChan.send({
        type: 'broadcast',
        event: 'download_increment',
        payload: { downloads: newDownloads },
      }).finally(() => {
        setTimeout(() => adminClient.removeChannel(statsChan), 2000);
      });
    } catch {}

    return NextResponse.json({ success: true, downloads: newDownloads });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
