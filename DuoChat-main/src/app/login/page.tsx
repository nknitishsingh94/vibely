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
import { ThemeToggle } from '@/components/theme-toggle';
import { BrandLogo } from '@/components/ui/brand-logo';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/chat';
  const initialEmail = searchParams.get('email') || '';
  const initialError = searchParams.get('error_description') || searchParams.get('error') || null;
  const { isConfigured } = useAuth();

  const [showPassword, setShowPassword] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(initialError);
  const [isNotRegistered, setIsNotRegistered] = React.useState(false);
  const [attemptedEmail, setAttemptedEmail] = React.useState(initialEmail);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
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
    const cleanEmail = data.email.trim();
    setAttemptedEmail(cleanEmail);


    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: data.password,
      });

      if (error) {
        // Check if the user exists in database
        try {
          const checkRes = await fetch('/api/auth/check-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail }),
          });
          const checkData = await checkRes.json();

          if (checkData.exists === false) {
            setIsNotRegistered(true);
            setAuthError(
              'No account found with this email. You are not registered yet. Please create an account first before logging in.'
            );
            setIsLoading(false);
            return;
          }
        } catch (checkErr) {
          console.warn('Unable to verify user registration status:', checkErr);
        }

        // User is registered, but credentials failed
        const lowerMsg = (error.message || '').toLowerCase();
        if (lowerMsg.includes('invalid login credentials')) {
          setAuthError('Incorrect password. Please verify your password and try again.');
        } else if (lowerMsg.includes('email not confirmed')) {
          setAuthError('Your email address has not been confirmed yet. Please check your inbox.');
        } else {
          setAuthError(error.message);
        }
        setIsLoading(false);
      } else {
        router.push(redirectTo);
      }
    } catch (err: unknown) {
      setAuthError((err as Error)?.message || 'Sign in failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-rose-500/20">
      {/* Top Bar */}
      <header className="p-4 flex items-center justify-between border-b border-border/40">
        <BrandLogo size="md" href="/" />
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Soft Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-rose-500/10 dark:bg-rose-950/20 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-xs text-muted-foreground font-sans">
              Sign in to your private conversation space
            </p>
          </div>

          <div className="p-6 sm:p-7 rounded-3xl bg-card/90 border border-border/80 shadow-2xl space-y-5 backdrop-blur-md">
            {authError && (
              <div
                className={`p-4 rounded-2xl text-xs border space-y-2.5 ${
                  isNotRegistered
                    ? 'bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/30'
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 text-white dark:bg-amber-500 hover:opacity-95 font-semibold text-xs shadow-xs transition-opacity cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Account Now</span>
                    </Link>
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
                  setAuthError(err);
                }}
              />

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60" />
                </div>
                <div className="relative px-3 bg-card text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
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
                    className="text-xs text-primary hover:underline font-medium"
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
                className="w-full rounded-2xl font-semibold shadow-md mt-3 bg-gradient-to-tr from-[#702C45] to-[#C96B83] text-white hover:opacity-95 cursor-pointer"
              >
                Sign In to Our Space
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>

            <div className="text-center pt-2 border-t border-border/50 text-xs text-muted-foreground">
              Don&apos;t have an account yet?{' '}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
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
