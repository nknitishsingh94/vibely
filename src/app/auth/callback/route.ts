import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error') || searchParams.get('error_code');
  const errorDescription = searchParams.get('error_description');

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const baseUrl = !isLocalEnv && forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  // Handle OAuth provider error (e.g. user canceled consent or provider disabled)
  if (errorParam || errorDescription) {
    const errorMsg = errorDescription || errorParam || 'Authentication failed';
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  const rawRedirectTo = searchParams.get('redirectTo') || searchParams.get('next') || '/chat';
  const safeRedirectTo = rawRedirectTo.startsWith('/') ? rawRedirectTo : '/chat';
  const redirectTarget = `${baseUrl}${safeRedirectTo}`;

  // Initialize response FIRST so auth cookies can be written directly to it
  const response = NextResponse.redirect(redirectTarget);

  if (code) {
    const supabase = createServerClient(
      env.supabaseUrl,
      env.supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Failed to exchange auth code for session:', error);
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent(error.message || 'Authentication code exchange failed')}`
      );
    }

    const user = data?.user;
    if (user) {
      // Synchronize profile and preferences using Service Role client
      try {
        const serviceKey = env.supabaseServiceRoleKey;
        const adminClient =
          serviceKey && env.supabaseUrl
            ? createServiceClient(env.supabaseUrl, serviceKey, {
                auth: { persistSession: false },
              })
            : supabase;

        // Ensure user email is confirmed
        if (!user.email_confirmed_at && serviceKey) {
          try {
            await adminClient.auth.admin.updateUserById(user.id, {
              email_confirm: true,
            });
          } catch (confirmErr) {
            console.warn('Auto-confirm in callback warning:', confirmErr);
          }
        }

        // Check if profile exists
        const { data: existingProfile } = await adminClient
          .from('profiles')
          .select('id, username, display_name, avatar_path')
          .eq('id', user.id)
          .maybeSingle();

        const meta = user.user_metadata || {};
        const fullName =
          meta.full_name ||
          meta.name ||
          meta.display_name ||
          (user.email ? user.email.split('@')[0] : 'Vibely User');
        const avatarUrl = meta.avatar_url || meta.picture || null;

        if (!existingProfile) {
          // Generate clean username from email or name
          let baseUsername = (
            meta.preferred_username ||
            meta.user_name ||
            (user.email ? user.email.split('@')[0] : 'user')
          )
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 18);

          if (baseUsername.length < 3) {
            baseUsername = `user_${user.id.slice(0, 4)}`;
          }

          // Check if username taken
          let finalUsername = baseUsername;
          const { data: taken } = await adminClient
            .from('profiles')
            .select('id')
            .eq('username', finalUsername)
            .maybeSingle();

          if (taken) {
            finalUsername = `${baseUsername.slice(0, 13)}_${Math.floor(1000 + Math.random() * 9000)}`;
          }

          await adminClient.from('profiles').upsert(
            {
              id: user.id,
              display_name: fullName,
              username: finalUsername,
              avatar_path: avatarUrl,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );

          await adminClient.from('user_preferences').upsert(
            { user_id: user.id },
            { onConflict: 'user_id' }
          );
        } else {
          // Update profile with avatar or display_name if missing
          const updates: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (!existingProfile.avatar_path && avatarUrl) {
            updates.avatar_path = avatarUrl;
          }
          if (!existingProfile.display_name && fullName) {
            updates.display_name = fullName;
          }
          if (Object.keys(updates).length > 1) {
            await adminClient.from('profiles').update(updates).eq('id', user.id);
          }
        }
      } catch (profileErr) {
        console.error('Error synchronizing Google user profile:', profileErr);
      }
    }

    // Return the response WITH the Set-Cookie headers
    return response;
  }

  return response;
}
