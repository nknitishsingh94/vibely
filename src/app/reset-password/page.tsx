'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound, Mail, ArrowLeft } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandLogo } from '@/components/ui/brand-logo';

const resetFormSchema = z.object({
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  code: z.string().optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ResetFormValues = z.infer<typeof resetFormSchema>;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramEmail = searchParams.get('email') || '';
  const paramError = searchParams.get('error');

  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(
    paramError === 'cross_device'
      ? 'Your reset link was opened on a different browser or device. Please enter the 6-digit code from your email below to update your password securely.'
      : null
  );
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [hasSession, setHasSession] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: {
      email: paramEmail,
      code: '',
      password: '',
      confirmPassword: '',
    },
  });

  // 1. Check for token in URL hash (from implicit recovery or deep link)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.location.hash.includes('access_token=')) {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const supabase = getSupabaseBrowserClient();
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(({ data, error }: { data: any; error: any }) => {
            if (data?.session && !error) {
              setHasSession(true);
              setErrorMessage(null);
            }
          });
        }
      } catch (err) {
        console.warn('Hash token parse error:', err);
      }
    } else {
      // Check existing session
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data }: { data: any }) => {
        if (data?.session?.user) {
          setHasSession(true);
        }
      });
    }
  }, []);

  const onSubmit = async (data: ResetFormValues) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      // Case A: User has active session (authenticated via recovery link or token hash)
      if (hasSession) {
        const { error } = await supabase.auth.updateUser({
          password: data.password,
        });

        if (!error) {
          setIsSuccess(true);
          return;
        }
        console.warn('Session updateUser error, trying API fallback:', error);
      }

      // Case B: Cross-device or unauthenticated recovery code
      const emailToUse = data.email || paramEmail;
      if (!emailToUse) {
        setErrorMessage('Please enter your email address to verify your reset code.');
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToUse,
          code: data.code,
          newPassword: data.password,
        }),
      });

      const resData = await res.json();
      if (!res.ok || resData.error) {
        setErrorMessage(resData.error || 'Failed to update password');
      } else {
        setIsSuccess(true);
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-sans font-black tracking-tight text-[#0C3B2E] dark:text-white">
          Set New Password
        </h1>
        <p className="text-xs text-stone-600 dark:text-emerald-100/70">
          {hasSession
            ? 'Enter and confirm your new password below'
            : 'Enter your email, reset code from your email, and new password'}
        </p>
      </div>

      <div className="p-6 sm:p-7 rounded-3xl bg-white/95 dark:bg-[#09241B]/95 border border-[#0C3B2E]/15 dark:border-white/15 shadow-2xl space-y-5 backdrop-blur-xl">
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/30 text-xs flex items-start gap-2.5 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isSuccess ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-sm text-[#0C3B2E] dark:text-white">Password Updated!</h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Your password has been changed successfully. You can now sign in with your new credentials.
            </p>
            <Link href="/login">
              <Button size="sm" className="mt-2 w-full rounded-xl font-bold bg-[#0C3B2E] hover:bg-[#155E49] text-white">
                Go to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!hasSession && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Your Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    leftIcon={<Mail className="w-4 h-4 text-muted-foreground" />}
                    error={errors.email?.message}
                    className="rounded-xl"
                    {...register('email')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>6-Digit Code / Token (from email)</span>
                    <Link
                      href="/forgot-password"
                      className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Resend email
                    </Link>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. 123456 or token"
                    leftIcon={<KeyRound className="w-4 h-4 text-muted-foreground" />}
                    error={errors.code?.message}
                    className="rounded-xl"
                    {...register('code')}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                New Password
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                leftIcon={<Lock className="w-4 h-4 text-muted-foreground" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                error={errors.password?.message}
                className="rounded-xl"
                {...register('password')}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Confirm New Password
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter new password"
                leftIcon={<Lock className="w-4 h-4 text-muted-foreground" />}
                error={errors.confirmPassword?.message}
                className="rounded-xl"
                {...register('confirmPassword')}
              />
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full rounded-2xl font-bold shadow-md shadow-[#0C3B2E]/25 mt-2 bg-[#0C3B2E] text-white hover:bg-[#155E49] cursor-pointer"
            >
              Update Password
            </Button>
          </form>
        )}

        <div className="text-center pt-2 border-t border-stone-200/80 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-[#0C3B2E] dark:text-emerald-300 hover:underline transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-[#0C3B2E]/15">
      {/* Sleek Top Bar */}
      <header className="px-4 sm:px-6 h-12 flex items-center justify-between border-b border-[#0C3B2E]/10 bg-white/90 backdrop-blur-xl">
        <BrandLogo size="sm" href="/login" />
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Soft Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-gradient-to-tr from-[#0C3B2E]/15 via-emerald-600/10 to-[#0C3B2E]/15 dark:from-[#0C3B2E]/30 dark:via-emerald-950/40 dark:to-[#0C3B2E]/20 blur-[130px] rounded-full pointer-events-none -z-10" />

        <React.Suspense fallback={<div className="text-xs font-semibold text-stone-500">Loading...</div>}>
          <ResetPasswordContent />
        </React.Suspense>
      </div>
    </div>
  );
}
