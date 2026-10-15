'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageSquare, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { forgotPasswordSchema, ForgotPasswordFormData } from '@/lib/validations/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandLogo } from '@/components/ui/brand-logo';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [sentEmail, setSentEmail] = React.useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSentEmail(data.email);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: data.email }),
      });

      const resData = await res.json();
      if (!res.ok || resData.error) {
        setErrorMessage(resData.error || 'Failed to send password reset email');
      } else {
        setIsSent(true);
      }
    } catch {
      // Fallback to client SDK if network error
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          setErrorMessage(error.message);
        } else {
          setIsSent(true);
        }
      } catch (clientErr: unknown) {
        setErrorMessage((clientErr as Error)?.message || 'Password reset request failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-[#0C3B2E]/15">
      {/* Sleek Top Bar */}
      <header className="px-4 sm:px-6 h-12 flex items-center justify-between border-b border-[#0C3B2E]/10 bg-white/90 backdrop-blur-xl">
        <BrandLogo size="sm" href="/login" />
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Soft Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-gradient-to-tr from-[#0C3B2E]/15 via-emerald-600/10 to-[#0C3B2E]/15 dark:from-[#0C3B2E]/30 dark:via-emerald-950/40 dark:to-[#0C3B2E]/20 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-sans font-black tracking-tight text-[#0C3B2E] dark:text-white">Password Recovery</h1>
            <p className="text-xs text-stone-600 dark:text-emerald-100/70">
              Enter your email address to receive a secure reset link
            </p>
          </div>

          <div className="p-6 sm:p-7 rounded-3xl bg-white/95 dark:bg-[#09241B]/95 border border-[#0C3B2E]/15 dark:border-white/15 shadow-2xl space-y-5 backdrop-blur-xl">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
                {errorMessage}
              </div>
            )}

            {isSent ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="font-bold text-sm text-[#0C3B2E] dark:text-white">Check your email</h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  We have sent a secure reset link to <strong>{sentEmail || 'your email'}</strong>. You can click the link in your email, or enter the 6-digit code directly below.
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  <Link href={`/reset-password?email=${encodeURIComponent(sentEmail)}`}>
                    <Button size="sm" className="w-full rounded-xl font-bold bg-[#0C3B2E] hover:bg-[#155E49] text-white">
                      Enter Reset Code or Update Password
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="w-full rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 dark:text-stone-400">
                      Back to Sign In
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
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

                <Button
                  type="submit"
                  isLoading={isLoading}
                  className="w-full rounded-2xl font-bold shadow-md shadow-[#0C3B2E]/25 mt-2 bg-[#0C3B2E] text-white hover:bg-[#155E49] cursor-pointer"
                >
                  Send Reset Link
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
      </div>
    </div>
  );
}
