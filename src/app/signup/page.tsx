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
  ShieldCheck,
  KeyRound,
  RotateCw,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { signupSchema, SignupFormData } from '@/lib/validations/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
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

  // Step state: 'form' -> 'otp'
  const [step, setStep] = React.useState<'form' | 'otp'>('form');
  const [submittedData, setSubmittedData] = React.useState<SignupFormData | null>(null);

  // OTP state
  const [otpCode, setOtpCode] = React.useState('');
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = React.useState(false);
  const [isResendingOtp, setIsResendingOtp] = React.useState(false);
  const [otpSentMessage, setOtpSentMessage] = React.useState<string | null>(null);

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

  // Resend OTP countdown timer
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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

  // Step 1: Submit Form -> Validate uniqueness & Send OTP to real email
  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setAuthError(null);
    setIsAlreadyRegistered(false);

    try {
      const cleanEmail = data.email.trim().toLowerCase();
      const cleanUsername = data.username.trim().toLowerCase();
      const cleanDisplayName = data.displayName.trim();

      const res = await fetch('/api/auth/send-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          username: cleanUsername,
          displayName: cleanDisplayName,
        }),
      });

      const resData = await res.json().catch(() => null);

      if (res.ok && resData?.success) {
        setSubmittedData(data);
        setStep('otp');
        setOtpCode('');
        setResendCooldown(60);
        setOtpSentMessage(`We sent a 6-digit verification code to ${cleanEmail}`);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        const errorType = resData?.error;
        const msg = resData?.message || resData?.error;

        if (errorType === 'both_exist' || errorType === 'email_exists') {
          setIsAlreadyRegistered(true);
          setAuthError(msg || 'An account with this email already exists. Please sign in instead.');
        } else if (errorType === 'username_exists') {
          setIsAlreadyRegistered(false);
          setAuthError(msg || 'This username is already taken. Please choose another username.');
        } else if (errorType === 'rate_limited') {
          setAuthError(msg || 'Too many attempts. Please wait a moment and try again.');
        } else {
          setAuthError(msg || 'Failed to send verification code. Please check your email.');
        }
      }
    } catch (err: unknown) {
      setAuthError((err as Error)?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP -> Activate Account & Set Password
  const onVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!submittedData) return;

    const trimmedOtp = otpCode.trim();
    if (trimmedOtp.length !== 6 || !/^\d{6}$/.test(trimmedOtp)) {
      setAuthError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setAuthError(null);

    try {
      const cleanEmail = submittedData.email.trim().toLowerCase();
      const res = await fetch('/api/auth/verify-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: trimmedOtp,
          password: submittedData.password,
          displayName: submittedData.displayName.trim(),
          username: submittedData.username.trim().toLowerCase(),
        }),
      });

      const resData = await res.json().catch(() => null);

      if (res.ok && resData?.success) {
        setSignupSuccess(true);
        const supabase = getSupabaseBrowserClient();

        // 1. If session was returned, set it directly
        if (resData.session?.access_token && resData.session?.refresh_token) {
          try {
            await supabase.auth.setSession({
              access_token: resData.session.access_token,
              refresh_token: resData.session.refresh_token,
            });
          } catch {}
        } else {
          // 2. Otherwise sign in with verified password
          try {
            await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: submittedData.password,
            });
          } catch {}
        }

        setTimeout(() => {
          router.replace('/chat');
          if (typeof window !== 'undefined') {
            window.location.href = '/chat';
          }
        }, 1200);
      } else {
        setAuthError(resData?.message || 'Invalid or expired verification code. Please try again.');
      }
    } catch (err: unknown) {
      setAuthError((err as Error)?.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Resend OTP code
  const onResendOtp = async () => {
    if (resendCooldown > 0 || !submittedData || isResendingOtp) return;
    setIsResendingOtp(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/auth/send-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: submittedData.email.trim().toLowerCase(),
          username: submittedData.username.trim().toLowerCase(),
          displayName: submittedData.displayName.trim(),
        }),
      });

      const resData = await res.json().catch(() => null);
      if (res.ok && resData?.success) {
        setResendCooldown(60);
        setOtpSentMessage(`New 6-digit code sent to ${submittedData.email}`);
      } else {
        setAuthError(resData?.message || 'Failed to resend verification code. Please try again.');
      }
    } catch (err: unknown) {
      setAuthError((err as Error)?.message || 'Failed to resend code.');
    } finally {
      setIsResendingOtp(false);
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
              {step === 'otp' ? 'Verify Your Email' : 'Sync your world on Vibely.'}
            </h1>
            <p className="text-xs text-stone-600 dark:text-emerald-100/70 font-sans">
              {step === 'otp'
                ? 'Enter the 6-digit code sent to your real email to activate your account.'
                : 'A private space for the notes, memories, and moments you share.'}
            </p>
          </div>

          <div className="p-6 sm:p-7 rounded-3xl bg-white/95 dark:bg-[#09241B]/95 border border-[#0C3B2E]/15 dark:border-white/15 shadow-2xl space-y-5 backdrop-blur-xl">
            {signupSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3 animate-in fade-in zoom-in-95 duration-300">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Email Verified Successfully!
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  Your account is activated and secure. Signing you in to Vibely...
                </p>
                <div className="flex items-center justify-center gap-2 pt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Launching your space...</span>
                </div>
              </div>
            ) : step === 'otp' ? (
              /* ================= STEP 2: OTP VERIFICATION ================= */
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Email Banner */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Real Email Verification</span>
                  </div>
                  <p className="text-xs text-stone-700 dark:text-stone-300 font-medium">
                    We sent a 6-digit OTP to:
                  </p>
                  <p className="text-sm font-bold text-foreground font-mono break-all">
                    {submittedData?.email}
                  </p>
                </div>

                {otpSentMessage && !authError && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold text-center border border-emerald-500/20">
                    {otpSentMessage}
                  </div>
                )}

                {authError && (
                  <div className="p-3.5 rounded-2xl bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{authError}</p>
                  </div>
                )}

                <form onSubmit={onVerifyOtp} className="space-y-4">
                  <div className="space-y-2 text-center">
                    <label className="text-xs font-bold text-foreground block">
                      Enter 6-Digit OTP Code
                    </label>

                    <div className="relative max-w-[260px] mx-auto">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoFocus
                        autoComplete="one-time-code"
                        placeholder="••••••"
                        value={otpCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setOtpCode(val);
                          setAuthError(null);
                          // Auto submit when 6 digits are typed
                          if (val.length === 6 && submittedData) {
                            setTimeout(() => {
                              const verifyBtn = document.getElementById('verify-otp-btn');
                              if (verifyBtn) verifyBtn.click();
                            }, 50);
                          }
                        }}
                        className="h-14 text-center font-mono text-2xl font-black tracking-[0.45em] rounded-2xl border-2 border-emerald-500/40 focus:border-emerald-500 bg-background shadow-inner"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Check your inbox or spam folder for the email from Vibely.
                    </p>
                  </div>

                  <Button
                    id="verify-otp-btn"
                    type="submit"
                    isLoading={isVerifyingOtp}
                    disabled={otpCode.length !== 6 || isVerifyingOtp}
                    className="w-full rounded-2xl font-bold shadow-md shadow-[#0C3B2E]/25 bg-[#0C3B2E] text-white hover:bg-[#155E49] cursor-pointer h-11"
                  >
                    <span>Verify Code & Activate Account</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </form>

                {/* Resend and Edit details footer */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form');
                      setAuthError(null);
                    }}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change details</span>
                  </button>

                  <button
                    type="button"
                    onClick={onResendOtp}
                    disabled={resendCooldown > 0 || isResendingOtp}
                    className={`font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      resendCooldown > 0
                        ? 'text-muted-foreground cursor-not-allowed'
                        : 'text-emerald-600 dark:text-emerald-400 hover:underline'
                    }`}
                  >
                    {isResendingOtp ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : resendCooldown > 0 ? (
                      <span>Resend code in {resendCooldown}s</span>
                    ) : (
                      <span>Resend OTP code</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* ================= STEP 1: REGISTRATION FORM ================= */
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

                {/* Anti-Fake Email Shield Highlight */}
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold leading-tight">
                    Email verification via OTP is required to prevent fake accounts.
                  </span>
                </div>

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
                      Email Address (Real email for OTP)
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
                    className="w-full rounded-2xl font-bold shadow-md shadow-[#0C3B2E]/25 mt-4 bg-[#0C3B2E] text-white hover:bg-[#155E49] cursor-pointer h-11"
                  >
                    <span>Verify Email & Continue</span>
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
