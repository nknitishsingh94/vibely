'use client';

import * as React from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface GoogleSignInButtonProps {
  text?: string;
  redirectTo?: string;
  onError?: (errorMessage: string) => void;
  className?: string;
}

export function GoogleSignInButton({
  text = 'Continue with Google',
  redirectTo = '/chat',
  onError,
  className,
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const origin =
        typeof window !== 'undefined' && !window.location.origin.includes('localhost')
          ? window.location.origin
          : 'https://vibely-sigma-roan.vercel.app';

      const isNative =
        typeof window !== 'undefined' &&
        Boolean(
          (window as any).Capacitor?.isNativePlatform?.() ||
          (window as any).AndroidBridge ||
          navigator.userAgent.includes('VibelyApp') ||
          (window as any).Capacitor?.getPlatform?.() === 'android'
        );

      const safeRedirect = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
      const callbackUrl = `${origin}/auth/callback?redirectTo=${encodeURIComponent(safeRedirect)}${
        isNative ? '&isNative=1' : ''
      }`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        setIsLoading(false);
        const lowerMsg = (error.message || '').toLowerCase();
        if (lowerMsg.includes('unsupported provider') || lowerMsg.includes('not enabled')) {
          onError?.(
            'Google authentication is not yet enabled in your Supabase project. Please enable Google provider in the Supabase Dashboard under Authentication > Providers.'
          );
        } else {
          onError?.(error.message || 'Failed to initialize Google Sign In');
        }
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setIsLoading(false);
      onError?.((err as Error)?.message || 'An unexpected error occurred during Google Sign In');
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleGoogleSignIn}
      isLoading={isLoading}
      className={cn(
        'w-full h-11 rounded-2xl border-border/80 bg-background/80 hover:bg-muted/70 text-foreground font-semibold text-xs sm:text-sm gap-2.5 shadow-xs hover:shadow-md transition-all active:scale-[0.99] cursor-pointer',
        className
      )}
      aria-label={text}
    >
      {!isLoading && (
        <svg
          className="w-4 h-4 shrink-0"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="#4a8bf3ff"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
      )}
      <span>{isLoading ? 'Connecting to Google...' : text}</span>
    </Button>
  );
}
