import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { env, isSupabaseConfigured } from '@/lib/env';

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const code = request.nextUrl.searchParams.get('code');

  // If OAuth code landed on root or any non-callback path (e.g. /?code=... from Supabase default redirect),
  // immediately forward to /auth/callback with all parameters preserved so session is exchanged seamlessly!
  if (code && !pathname.startsWith('/auth/callback')) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    return NextResponse.redirect(callbackUrl);
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!isSupabaseConfigured()) {
    // Supabase is not configured yet - allow browsing with notice
    return response;
  }

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedPath = pathname.startsWith('/chat') || pathname.startsWith('/settings');
  const isAuthPath = pathname === '/login' || pathname === '/signup';

  // Check if request is from native Android APK / WebView
  const userAgent = request.headers.get('user-agent') || '';
  const isNativeCookie = request.cookies.get('vibely_is_native')?.value === 'true';
  const isNativeApp =
    isNativeCookie ||
    userAgent.includes('VibelyApp') ||
    userAgent.includes('wv') ||
    request.headers.get('x-requested-with') === 'com.vibely.app';

  // CRITICAL: Inside the mobile Android APK, NEVER show the marketing landing page!
  // Immediately forward to /chat if authenticated or /login if not authenticated.
  if (pathname === '/' && isNativeApp) {
    const url = request.nextUrl.clone();
    url.pathname = user ? '/chat' : '/login';
    return NextResponse.redirect(url);
  }

  // If user is accessing protected path without session cookies:
  // On native app, do not prematurely redirect so client-side localStorage session can hydrate!
  if (!user && isProtectedPath && !isNativeApp) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/chat';
    return NextResponse.redirect(url);
  }

  return response;
}
