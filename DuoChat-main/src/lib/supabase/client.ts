import { createBrowserClient } from '@supabase/ssr';
import { env, isSupabaseConfigured } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (client) return client;

  if (!isSupabaseConfigured()) {
    // Return a dummy client instance pointing to localhost dummy to prevent crashes during preview
    return createBrowserClient(
      'https://placeholder-project.supabase.co',
      'placeholder-anon-key-placeholder-anon-key-placeholder-anon-key'
    );
  }

  client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}

export const supabase = getSupabaseBrowserClient();
