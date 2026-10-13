const DEFAULT_SUPABASE_URL = 'https://tidjfwnvoidnslyilhbl.supabase.co';
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZGpmd252b2lkbnNseWlsaGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTI5OTAsImV4cCI6MjEwNzQ4ODk5MH0.RAae1AyzaIzt_iGn8ZN9F34McN35w_P9zZAmGZZLgjM';
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZGpmd252b2lkbnNseWlsaGJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTkxMjk5MCwiZXhwIjoyMTA3NDg4OTkwfQ.VY3A5S5SExqZvIgeUmnGo86Z5GdAsSvQaowy_0jP0dE';

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
