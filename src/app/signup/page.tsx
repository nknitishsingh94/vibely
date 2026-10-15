'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Mail,
  Lock,
  User,
  AtSign,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  LogIn,
} from 'lucide-react';
import { signupSchema, SignupFormData } from '@/lib/validations/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandLogo } from '@/components/ui/brand-logo';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { useAuth } from '@/context/auth-context';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const initialError = searchParams.get('error_description') || searchParams.get('error') || null;
  const { user } = useAuth();

  const [showPassword, setShowPassword] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(initialError);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [signupSuccess, setSignupSuccess] = React.useState(false);

  // Auto-redirect if already logged in
  React.useEffect(() => {
    if (user) {
      router.replace('/chat');
    }
  }, [user, router]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: '',
      username: '',
      email: initialEmail,
      password: '',
      confirmPassword: '',
    },
  });

  const passwordVal = watch('password', '');

  const hasLength = passwordVal.length >= 8;
  const hasUpper = /[A-Z]/.test(passwordVal);
  const hasLower = /[a-z]/.test(passwordVal);
  const hasNumber = /[0-9]/.test(passwordVal);

  const onFormError = (formErrors: any) => {
    const firstKey = Object.keys(formErrors)[0];
    const firstMsg =
      formErrors.displayName?.message ||
      formErrors.username?.message ||
      formErrors.email?.message ||
      formErrors.password?.message ||
      formErrors.confirmPassword?.message ||
      (firstKey ? formErrors[firstKey]?.message : 'Please complete all required fields correctly.');

    setAuthError(firstMsg);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setAuthError(null);
    setIsAlreadyRegistered(false);

    try {
      const cleanEmail = data.email.trim().toLowerCase();
      const cleanUsername = data.username.trim().toLowerCase();
      const cleanDisplayName = data.displayName.trim();

      // 1. Server-side registration attempt (bypasses confirmation emails if service role key is present)
      let signupSucceeded = false;
      let serverErrorMsg: string | null = null;

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: data.password,
            displayName: cleanDisplayName,
            username: cleanUsername,
          }),
        });

        const resData = await res.json().catch(() => null);

        if (res.ok && resData?.success) {
          signupSucceeded = true;
        } else {
          const errorType = resData?.error;
          const msg = resData?.message || resData?.error;

          if (errorType === 'both_exist' || errorType === 'email_exists') {
            setIsAlreadyRegistered(true);
            setAuthError(msg || 'An account with this email already exists. Please sign in instead.');
            setIsLoading(false);
            return;
          }

          if (errorType === 'username_exists') {
            setIsAlreadyRegistered(false);
            setAuthError(msg || 'This username is already taken. Please choose another username.');
            setIsLoading(false);
            return;
          }

          if (errorType === 'rate_limited') {
            setAuthError(msg || 'Too many attempts. Please wait a moment and try again.');
            setIsLoading(false);
            return;
          }

          serverErrorMsg = msg || null;
        }
      } catch (err) {
        console.warn('Server signup request failed, trying client fallback:', err);
      }

      // 2. If server signup was not successful, attempt direct client-side Supabase signup fallback
      if (!signupSucceeded) {
        const supabase = getSupabaseBrowserClient();
        const { data: directData, error: directError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: data.password,
          options: {
            data: {
              display_name: cleanDisplayName,
              username: cleanUsername,
            },
          },
        });

        if (directError) {
          const lower = (directError.message || '').toLowerCase();
          if (lower.includes('already registered') || lower.includes('user already exists')) {
            setIsAlreadyRegistered(true);
            setAuthError('An account with this email already exists. Please sign in instead.');
          } else {
            setAuthError(serverErrorMsg || directError.message || 'Registration failed. Please try again.');
          }
          setIsLoading(false);
          return;
        }

        // Auto-confirm via server API in background
        try {
          await fetch('/api/auth/check-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, autoConfirm: true }),
          });
        } catch (autoConfirmErr) {
          console.warn('Auto-confirm attempt warning:', autoConfirmErr);
        }

        if (directData?.session) {
          router.replace('/chat');
          if (typeof window !== 'undefined') {
            window.location.href = '/chat';
          }
          return;
        }

        signupSucceeded = true;
      }

      // 3. Account successfully created & auto-confirmed: log in directly
      const supabase = getSupabaseBrowserClient();
      let { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: data.password,
      });

      if (signInError) {
        const lower = (signInError.message || '').toLowerCase();
        if (lower.includes('email not confirmed')) {
          try {
            await fetch('/api/auth/check-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: cleanEmail, autoConfirm: true }),
            });
            const retryRes = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: data.password,
            });
            if (!retryRes.error) {
              router.replace('/chat');
              if (typeof window !== 'undefined') {
                window.location.href = '/chat';
              }
              return;
            }
          } catch (autoErr) {
            console.warn('Auto-confirm retry error:', autoErr);
          }
        }
      } else {
        router.replace('/chat');
        if (typeof window !== 'undefined') {
          window.location.href = '/chat';
        }
        return;
      }

      // If session couldn't auto-start, show quick sign-in link
      setSignupSuccess(true);
      setIsLoading(false);
    } catch (err: unknown) {
      setAuthError((err as Error)?.message || 'Sign up failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-[#0C3B2E]/15">
      {/* Sleek Top Bar */}
      <header className="px-4 sm:px-6 h-12 flex items-center justify-between border-b border-[#0C3B2E]/10 bg-white/90 backdrop-blur-xl">
        <BrandLogo size="sm" href={user ? '/chat' : '/signup'} />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Soft Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[380px] bg-gradient-to-tr from-[#0C3B2E]/15 via-emerald-600/10 to-[#0C3B2E]/15 dark:from-[#0C3B2E]/30 dark:via-emerald-950/40 dark:to-[#0C3B2E]/20 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-sans font-black tracking-tight text-[#0C3B2E] dark:text-white">
              Sync your world on Vibely.
            </h1>
            <p className="text-xs text-stone-600 dark:text-emerald-100/70 font-sans">
              A private space for the notes, memories, and moments you share.
            </p>
          </div>

          <div className="p-6 sm:p-7 rounded-3xl bg-white/95 dark:bg-[#09241B]/95 border border-[#0C3B2E]/15 dark:border-white/15 shadow-2xl space-y-5 backdrop-blur-xl">
            {signupSuccess ? (
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">Account Created!</h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  Your account is registered. You can now sign in to connect with your partner.
                </p>
                <Link href="/login" className="inline-block mt-2">
                  <Button size="sm" className="rounded-xl font-bold bg-[#0C3B2E] hover:bg-[#155E49] text-white">
                    Go to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {authError && (
                  <div className="p-4 rounded-2xl bg-destructive/10 text-destructive text-xs border border-destructive/20 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="font-medium leading-relaxed">{authError}</p>
                    </div>

                    {isAlreadyRegistered && (
                      <div className="pt-1">
                        <Link
                          href="/login"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-xs hover:opacity-90"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Go to Sign In</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Google Sign Up Option */}
                <div className="space-y-4">
                  <GoogleSignInButton
                    text="Sign up with Google"
                    redirectTo="/chat"
                    onError={(err) => {
                      setIsAlreadyRegistered(false);
                      setAuthError(err);
                    }}
                  />

                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/60" />
                    </div>
                    <div className="relative px-3 bg-white dark:bg-[#09241B] text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                      or register with email
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit, onFormError)} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Your Name / Nickname
                    </label>
                    <Input
                      type="text"
                      placeholder="Enter your name"
                      leftIcon={<User className="w-4 h-4 text-muted-foreground" />}
                      error={errors.displayName?.message}
                      className="rounded-xl"
                      {...register('displayName')}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Username
                    </label>
                    <Input
                      type="text"
                      placeholder="choose_username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      leftIcon={<AtSign className="w-4 h-4 text-muted-foreground" />}
                      error={errors.username?.message}
                      className="rounded-xl"
                      {...register('username')}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      leftIcon={<Mail className="w-4 h-4 text-muted-foreground" />}
                      error={errors.email?.message}
                      className="rounded-xl"
                      {...register('email')}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Password
                    </label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
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

                    {/* Password Strength Checklist */}
                    {passwordVal && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                        <span className={`flex items-center gap-1 font-medium transition-colors ${hasLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500'}`}>
                          {hasLength ? '✓' : '○'} 8+ characters
                        </span>
                        <span className={`flex items-center gap-1 font-medium transition-colors ${hasUpper ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500'}`}>
                          {hasUpper ? '✓' : '○'} 1 Uppercase (A-Z)
                        </span>
                        <span className={`flex items-center gap-1 font-medium transition-colors ${hasLower ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500'}`}>
                          {hasLower ? '✓' : '○'} 1 Lowercase (a-z)
                        </span>
                        <span className={`flex items-center gap-1 font-medium transition-colors ${hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500'}`}>
                          {hasNumber ? '✓' : '○'} 1 Number (0-9)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Confirm Password
                    </label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      leftIcon={<Lock className="w-4 h-4 text-muted-foreground" />}
                      error={errors.confirmPassword?.message}
                      className="rounded-xl"
                      {...register('confirmPassword')}
                    />
                  </div>

                  <Button
                    type="submit"
                    isLoading={isLoading}
                    className="w-full rounded-2xl font-bold shadow-md shadow-[#0C3B2E]/25 mt-4 bg-[#0C3B2E] text-white hover:bg-[#155E49] cursor-pointer"
                  >
                    Create My Vibely Space
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </form>

                <div className="text-center pt-2 border-t border-stone-200/80 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400">
                  Already have an account?{' '}
                  <Link href="/login" className="font-semibold text-[#0C3B2E] dark:text-emerald-300 hover:underline">
                    Sign in here
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground text-sm">
          Loading sign up...
        </div>
      }
    >
      <SignupForm />
    </React.Suspense>
  );
}
