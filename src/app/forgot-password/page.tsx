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
import { ThemeToggle } from '@/components/theme-toggle';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

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
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Password reset request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="p-4 flex items-center justify-between border-b border-border/40">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <MessageSquare className="w-4 h-4 fill-current" />
          </div>
          <span className="font-bold text-base">DuoChat</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Password Recovery</h1>
            <p className="text-xs text-muted-foreground">
              Enter your email address to receive a secure reset link
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xl space-y-5">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20">
                {errorMessage}
              </div>
            )}

            {isSent ? (
              <div className="p-6 rounded-2xl bg-primary/10 border border-primary/20 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
                <h3 className="font-bold text-sm">Check your email</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We have sent instructions to reset your password. Please check your inbox and spam folder.
                </p>
                <Link href="/login">
                  <Button size="sm" className="mt-2 rounded-xl">
                    Back to Sign In
                  </Button>
                </Link>
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
                    leftIcon={<Mail className="w-4 h-4" />}
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>

                <Button
                  type="submit"
                  isLoading={isLoading}
                  className="w-full rounded-xl font-medium shadow-sm mt-2"
                >
                  Send Reset Link
                </Button>
              </form>
            )}

            <div className="text-center pt-2 border-t border-border/50 text-xs text-muted-foreground">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 font-medium hover:text-foreground transition-colors"
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
