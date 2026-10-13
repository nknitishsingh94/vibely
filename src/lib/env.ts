const DEFAULT_SUPABASE_URL = 'https://kyzvkxzjuarwwuaymobe.supabase.co';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5enZreHpqdWFyd3d1YXltb2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MDQ5NTUsImV4cCI6MjEwNzM4MDk1NX0.BazRNkKssIKh2MK99TbcaO5X5ghdTrdLT_sLpkOZyuc';
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5enZreHpqdWFyd3d1YXltb2JlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTgwNDk1NSwiZXhwIjoyMTA3MzgwOTU1fQ.ZxmSBwtnsvVWOPyCbgeCpUxSKUdy3LJXEeUAKAI7MCU';

function cleanSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return DEFAULT_SUPABASE_URL;
  return rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

export const env = {
  supabaseUrl: cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL),
  supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY).trim(),
  supabaseServiceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY).trim(),
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
};

export const isSupabaseConfigured = (): boolean => {
  return true;
};
