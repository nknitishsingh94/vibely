'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, UserPlus } from 'lucide-react';
import { loginSchema, LoginFormData } from '@/lib/validations/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandLogo } from '@/components/ui/brand-logo';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/chat';
  const initialEmail = searchParams.get('email') || '';
  const initialError = searchParams.get('error_description') || searchParams.get('error') || null;
  const { user } = useAuth();

  const [showPassword, setShowPassword] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(initialError);
  const [isNotRegistered, setIsNotRegistered] = React.useState(false);
  const [isGoogleAccount, setIsGoogleAccount] = React.useState(false);
  const [attemptedEmail, setAttemptedEmail] = React.useState(initialEmail);
  const [isLoading, setIsLoading] = React.useState(false);

  // Auto-redirect if already logged in
  React.useEffect(() => {
    if (user) {
      window.location.href = redirectTo;
    }
  }, [user, redirectTo]);

  // If OAuth code landed on /login, forward immediately to /auth/callback
  React.useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      window.location.href = `/auth/callback?${searchParams.toString()}`;
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: initialEmail,
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setAuthError(null);
    setIsNotRegistered(false);
    setIsGoogleAccount(false);
    const cleanEmail = data.email.trim();
    setAttemptedEmail(cleanEmail);

    try {
      const supabase = getSupabaseBrowserClient();
      let { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: data.password,
      });

      if (error) {
        const lowerMsg = (error.message || '').toLowerCase();

        // 1. If unconfirmed email, automatically confirm it via server admin API and retry!
        if (lowerMsg.includes('email not confirmed')) {
          try {
            const confirmRes = await fetch('/api/auth/check-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: cleanEmail, autoConfirm: true }),
            });
            const confirmData = await confirmRes.json();
            if (confirmData?.confirmed) {
              const retryRes = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: data.password,
              });
              if (!retryRes.error) {
                window.location.href = redirectTo;
                return;
              }
              error = retryRes.error;
            }
          } catch (autoErr) {
            console.warn('Auto-confirm attempt error:', autoErr);
          }
        }

        // 2. Check user details from server (Google OAuth check, existence check)
        try {
          const checkRes = await fetch('/api/auth/check-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, autoConfirm: true }),
          });
          const checkData = await checkRes.json();

          if (checkData.exists === false) {
            setIsNotRegistered(true);
            setAuthError(
              'No Vibely account found with this email. Please create an account first before logging in.'
            );
            setIsLoading(false);
            return;
          }

          if (checkData.isGoogle) {
            setIsGoogleAccount(true);
            setAuthError(
              'This account was created with Google. Click "Sign in with Google" below to log in instantly.'
            );
            setIsLoading(false);
            return;
          }
        } catch (checkErr) {
          console.warn('Unable to verify user registration status:', checkErr);
        }

        const finalLower = (error.message || '').toLowerCase();
        if (finalLower.includes('invalid login credentials')) {
          setAuthError('Incorrect password. Please verify your password and try again.');
        } else if (finalLower.includes('email not confirmed')) {
          setAuthError('Your email address was just verified. Please try signing in again.');
        } else {
          setAuthError(error.message);
        }
        setIsLoading(false);
      } else {
        window.location.href = redirectTo;
      }
    } catch (err: unknown) {
      setAuthError((err as Error)?.message || 'Sign in failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setAuthError(null);
    setIsNotRegistered(false);
    setIsGoogleAccount(false);
    setValue('email', 'demo@vibely.app');
    setValue('password', 'Password123!');

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: 'demo@vibely.app',
        password: 'Password123!',
      });

      if (error) {
        setAuthError(error.message);
        setIsLoading(false);
      } else {
        window.location.href = redirectTo;
      }
    } catch (err: unknown) {
      setAuthError((err as Error)?.message || 'Demo sign in failed.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-[#0C3B2E]/15">
      {/* Sleek Top Bar */}
      <header className="px-4 sm:px-6 h-12 flex items-center justify-between border-b border-[#0C3B2E]/10 bg-white/90 backdrop-blur-xl">
        <BrandLogo size="sm" href="/" />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Soft Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-gradient-to-tr from-[#0C3B2E]/15 via-emerald-600/10 to-[#0C3B2E]/15 dark:from-[#0C3B2E]/30 dark:via-emerald-950/40 dark:to-[#0C3B2E]/20 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-sans font-black tracking-tight text-[#0C3B2E] dark:text-white">
              Welcome back
            </h1>
            <p className="text-xs text-stone-600 dark:text-emerald-100/70 font-sans">
              Sign in to your private Vibely sanctuary
            </p>
          </div>

          <div className="p-6 sm:p-7 rounded-3xl bg-white/95 dark:bg-[#09241B]/95 border border-[#0C3B2E]/15 dark:border-white/15 shadow-2xl space-y-5 backdrop-blur-xl">
            {/* Quick 1-Click Demo Login */}
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#0C3B2E]/5 hover:bg-[#0C3B2E]/10 dark:bg-white/5 dark:hover:bg-white/10 border border-[#0C3B2E]/20 dark:border-white/20 text-[#0C3B2E] dark:text-white transition-all text-xs font-semibold cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-[#0C3B2E] text-white flex items-center justify-center text-xs shadow-xs font-bold">
                  ⚡
                </span>
                <div className="text-left">
                  <p className="font-bold text-xs text-[#0C3B2E] dark:text-white">1-Click Instant Demo Login</p>
                  <p className="text-[11px] text-stone-500 dark:text-emerald-100/70 font-normal">Jump straight into demo sanctuary</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#0C3B2E] dark:text-emerald-300 group-hover:translate-x-1 transition-transform" />
            </button>

            {authError && (
              <div
                className={`p-4 rounded-2xl text-xs border space-y-2.5 ${
                  isNotRegistered
                    ? 'bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/30'
                    : isGoogleAccount
                    ? 'bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 border-emerald-500/30'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-current" />
                  <p className="font-medium leading-relaxed">{authError}</p>
                </div>

                {isNotRegistered && (
                  <div className="pt-1 flex items-center gap-2">
                    <Link
                      href={`/signup?email=${encodeURIComponent(attemptedEmail)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0C3B2E] text-white hover:bg-[#155E49] font-semibold text-xs shadow-xs transition-all cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Account Now</span>
                    </Link>
                  </div>
                )}

                {isGoogleAccount && (
                  <div className="pt-1">
                    <GoogleSignInButton
                      text="Sign in with Google Now"
                      redirectTo={redirectTo}
                      onError={(err) => setAuthError(err)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Google Sign In Option */}
            <div className="space-y-4">
              <GoogleSignInButton
                text="Continue with Google"
                redirectTo={redirectTo}
                onError={(err) => {
                  setIsNotRegistered(false);
                  setIsGoogleAccount(false);
                  setAuthError(err);
                }}
              />

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200/80 dark:border-stone-800" />
                </div>
                <div className="relative px-3 bg-white dark:bg-[#09241B] text-[11px] uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400">
                  or sign in with email
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Email Address
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-[#0C3B2E] dark:text-emerald-300 hover:underline font-semibold"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
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

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full rounded-2xl font-bold shadow-md shadow-[#0C3B2E]/25 mt-3 bg-[#0C3B2E] text-white hover:bg-[#155E49] cursor-pointer"
              >
                Sign In to Vibely
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>

            <div className="text-center pt-2 border-t border-stone-200/80 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400">
              Don&apos;t have an account yet?{' '}
              <Link href="/signup" className="font-semibold text-[#0C3B2E] dark:text-emerald-300 hover:underline">
                Create one together
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground text-sm">
          Loading sign in...
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
