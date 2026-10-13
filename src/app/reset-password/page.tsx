'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageSquare, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { resetPasswordSchema, ResetPasswordFormData } from '@/lib/validations/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandLogo } from '@/components/ui/brand-logo';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    setErrorMessage(null);


    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        setErrorMessage(error.message);
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
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-[#0C3B2E]/15">
      {/* Sleek Top Bar */}
      <header className="px-4 sm:px-6 h-12 flex items-center justify-between border-b border-[#0C3B2E]/10 bg-white/90 backdrop-blur-xl">
        <BrandLogo size="sm" href="/" />
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Soft Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-gradient-to-tr from-[#0C3B2E]/15 via-emerald-600/10 to-[#0C3B2E]/15 dark:from-[#0C3B2E]/30 dark:via-emerald-950/40 dark:to-[#0C3B2E]/20 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-sans font-black tracking-tight text-[#0C3B2E] dark:text-white">Set New Password</h1>
            <p className="text-xs text-stone-600 dark:text-emerald-100/70">
              Choose a strong new password for your account
            </p>
          </div>

          <div className="p-6 sm:p-7 rounded-3xl bg-white/95 dark:bg-[#09241B]/95 border border-[#0C3B2E]/15 dark:border-white/15 shadow-2xl space-y-5 backdrop-blur-xl">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
                {errorMessage}
              </div>
            )}

            {isSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="font-bold text-sm text-[#0C3B2E] dark:text-white">Password updated!</h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  Your password has been changed successfully. You can now sign in with your new credentials.
                </p>
                <Link href="/login">
                  <Button size="sm" className="mt-2 rounded-xl font-bold bg-[#0C3B2E] hover:bg-[#155E49] text-white">
                    Go to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    Confirm Password
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
          </div>
        </div>
      </div>
    </div>
  );
}
