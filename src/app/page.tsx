'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Heart,
  Music,
  Image as ImageIcon,
  Film,
  FileText,
  Lock,
  ArrowRight,
  Sparkles,
  CalendarHeart,
  ShieldCheck,
  Bookmark,
  Radio,
  Flame,
  Volume2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo, VibelyEmblem } from '@/components/ui/brand-logo';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { AppStatsBanner } from '@/components/landing/app-stats-banner';

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [activeReaction, setActiveReaction] = React.useState<string | null>('💜');
  const [isNativeApp, setIsNativeApp] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return Boolean(
      (window as any).Capacitor?.isNativePlatform?.() ||
      (window as any).AndroidBridge ||
      ua.includes('VibelyApp') ||
      (window as any).Capacitor?.getPlatform?.() === 'android'
    );
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent || '';
    const native = Boolean(
      (window as any).Capacitor?.isNativePlatform?.() ||
      (window as any).AndroidBridge ||
      ua.includes('VibelyApp') ||
      (window as any).Capacitor?.getPlatform?.() === 'android'
    );
    if (native !== isNativeApp) {
      setIsNativeApp(native);
    }

    // If OAuth code landed on the landing page, forward immediately to /auth/callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      window.location.href = `/auth/callback?${params.toString()}`;
      return;
    }

    if (!isLoading) {
      if (user) {
        // Authenticated user: immediately enter the Vibely chat application
        router.replace('/chat');
      } else if (native) {
        // Native mobile app: open the login screen directly so user can sign in immediately
        router.replace('/login');
      }
    }
  }, [user, isLoading, isNativeApp, router]);

  // Inside the mobile app or when user is authenticated, NEVER render marketing landing page
  if (isNativeApp || user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground select-none">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <VibelyEmblem size="lg" />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{user ? 'Entering your space...' : 'Opening Vibely...'}</span>
          </div>
        </div>
      </div>
    );
  }

  const reactions = ['💜', '✨', '💖', '🔥', '🎵', '💌'];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-[#0C3B2E]/15 overflow-x-hidden">
      {/* Sleek Fixed Floating Box Navbar */}
      <div className="fixed top-3 sm:top-4 left-0 right-0 z-50 flex justify-center px-3 sm:px-4 pointer-events-none">
        <header className="pointer-events-auto flex items-center justify-between gap-3 sm:gap-6 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-2xl bg-white/95 dark:bg-[#071F18]/95 border border-[#0C3B2E]/15 dark:border-white/15 shadow-md shadow-[#0C3B2E]/10 backdrop-blur-xl transition-all w-full max-w-lg sm:max-w-2xl">
          <BrandLogo size="sm" href={user ? '/chat' : '/'} />

          <nav className="hidden sm:flex items-center gap-5 text-xs font-semibold text-stone-600 dark:text-emerald-100/80">
            <a href="#features" className="hover:text-[#0C3B2E] dark:hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#0C3B2E] dark:hover:text-white transition-colors">
              How It Works
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {user ? (
              <Link href="/chat">
                <Button
                  size="sm"
                  className="h-8 px-3 sm:px-3.5 rounded-xl text-xs font-bold shadow-xs bg-[#0C3B2E] hover:bg-[#155E49] text-white transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Open Chat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 sm:px-3 rounded-xl text-xs font-semibold text-[#0C3B2E] hover:bg-[#0C3B2E]/5 cursor-pointer"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button
                    size="sm"
                    className="h-8 px-3 sm:px-3.5 rounded-xl text-xs font-bold shadow-xs bg-[#0C3B2E] hover:bg-[#155E49] text-white transition-all cursor-pointer"
                  >
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="flex-1 pt-16 sm:pt-20">
        <section className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-28">
          {/* Ambient Radiant Glow Orbs */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-gradient-to-tr from-[#0C3B2E]/15 via-emerald-600/10 to-[#0C3B2E]/15 dark:from-[#0C3B2E]/30 dark:via-emerald-950/40 dark:to-[#0C3B2E]/20 blur-[140px] rounded-full pointer-events-none -z-10" />

          <div className="container mx-auto max-w-7xl px-4 sm:px-8 text-center">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0C3B2E]/5 dark:bg-white/10 border border-[#0C3B2E]/20 dark:border-white/20 text-xs font-semibold text-[#0C3B2E] dark:text-emerald-200 mb-6 animate-in fade-in duration-300 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#0C3B2E] dark:text-emerald-400 animate-pulse" />
              <span>Next-Gen Private Space for You & Your Favorite Person</span>
            </div>

            {/* Main Punchy Headline with #0C3B2E & Crisp White Harmony */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-sans font-black tracking-tight max-w-4xl mx-auto leading-[1.08] text-[#0C3B2E] dark:text-white">
              Sync your vibe.{' '}
              <span className="bg-gradient-to-r from-[#0C3B2E] via-[#155E49] to-[#059669] dark:from-white dark:via-emerald-200 dark:to-emerald-400 bg-clip-text text-transparent">
                Just the two of you.
              </span>
            </h1>

            {/* Subtitle with Clear Contrast */}
            <p className="mt-6 text-base sm:text-lg text-stone-600 dark:text-emerald-100/80 max-w-3xl mx-auto leading-relaxed font-sans font-medium">
              Vibely is the aesthetic, zero-noise sanctuary built exclusively for two souls. Share unfiltered thoughts, romantic Little Notes, midnight soundtracks, audio snaps, and treasured memories — free from algorithms, feeds, and prying eyes.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              {user ? (
                <>
                  <Link href="/chat" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto rounded-2xl gap-2 font-bold shadow-lg shadow-[#0C3B2E]/25 bg-[#0C3B2E] text-white hover:bg-[#155E49] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer ring-1 ring-[#0C3B2E]/30"
                    >
                      <span>Continue to Your Space</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href="/settings" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto rounded-2xl border-[#0C3B2E]/30 dark:border-white/30 text-[#0C3B2E] dark:text-white hover:bg-[#0C3B2E]/5 dark:hover:bg-white/10 font-semibold cursor-pointer"
                    >
                      Settings
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/signup" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto rounded-2xl gap-2 font-bold shadow-lg shadow-[#0C3B2E]/25 bg-[#0C3B2E] text-white hover:bg-[#155E49] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer ring-1 ring-[#0C3B2E]/30"
                    >
                      Start Vibing Free
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto rounded-2xl border-[#0C3B2E]/30 dark:border-white/30 text-[#0C3B2E] dark:text-white hover:bg-[#0C3B2E]/5 dark:hover:bg-white/10 font-semibold cursor-pointer"
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/chat" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      variant="secondary"
                      className="w-full sm:w-auto rounded-2xl gap-1.5 font-semibold bg-[#0C3B2E]/5 dark:bg-white/10 text-[#0C3B2E] dark:text-white hover:bg-[#0C3B2E]/10 dark:hover:bg-white/15 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[#0C3B2E] dark:text-emerald-400" />
                      Live Preview
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Interactive Preview Mockup - Expansive Full Width */}
            <div className="mt-14 max-w-6xl mx-auto rounded-3xl border border-[#0C3B2E]/15 dark:border-white/15 bg-white/95 dark:bg-[#09241B]/95 backdrop-blur-2xl p-4 sm:p-8 shadow-2xl text-left relative overflow-hidden ring-1 ring-stone-900/5 dark:ring-white/10 w-full">
              {/* Preview Window Header */}
              <div className="flex items-center justify-between pb-4 border-b border-stone-200/90 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-2xl bg-[#0C3B2E] flex items-center justify-center font-bold text-white text-sm shadow-md shadow-[#0C3B2E]/25">
                      AR
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#09241B]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#0C3B2E] dark:text-white flex items-center gap-2">
                      Aria
                      <span className="text-[11px] font-semibold text-[#0C3B2E] dark:text-emerald-200 bg-[#0C3B2E]/10 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-[#0C3B2E]/20 dark:border-white/20">
                        Vibing together • Day 312 💕
                      </span>
                    </h3>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Listening to your shared playlist
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#0C3B2E] dark:text-white font-medium px-3 py-1 rounded-full bg-[#0C3B2E]/5 dark:bg-white/10 border border-[#0C3B2E]/15 dark:border-white/15">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">100% Encrypted & Private</span>
                  <span className="sm:hidden">Private</span>
                </div>
              </div>

              {/* Chat Messages Preview */}
              <div className="py-6 space-y-4 font-sans text-xs">
                {/* Incoming Message */}
                <div className="flex justify-start">
                  <div className="max-w-md rounded-2xl rounded-bl-xs p-3.5 bg-stone-50 dark:bg-[#0C3B2E]/30 text-stone-900 dark:text-stone-100 border border-[#0C3B2E]/10 dark:border-white/10 space-y-1 shadow-xs">
                    <p className="leading-relaxed font-normal">
                      Just listened to that track you sent earlier... it&apos;s officially our song now 🎧✨ Can&apos;t wait to see you tonight!
                    </p>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 block text-right font-mono font-medium">10:42 AM</span>
                  </div>
                </div>

                {/* Outgoing "Little Note" Message */}
                <div className="flex justify-end">
                  <div className="max-w-md rounded-2xl p-4 little-note-card shadow-md space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#0C3B2E]/15 dark:border-white/15">
                      <span className="text-[11px] font-bold text-[#0C3B2E] dark:text-emerald-200 flex items-center gap-1.5">
                        <span>💌</span> Little Note • Sunset Vibe
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-[#0C3B2E] dark:text-emerald-400" />
                    </div>
                    <p className="font-serif italic text-sm sm:text-base leading-relaxed text-stone-950 dark:text-stone-50">
                      &quot;Every little moment with you is my favorite part of the day. Counting down the minutes until we meet.&quot;
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-stone-600 dark:text-stone-300 pt-1">
                      <span className="flex items-center gap-1 text-[#0C3B2E] dark:text-emerald-300 font-semibold font-sans">
                        <Bookmark className="w-3 h-3 fill-current" /> Saved in Moments Vault
                      </span>
                      <span className="font-mono text-stone-500 dark:text-stone-400">10:45 AM • Read</span>
                    </div>
                  </div>
                </div>

                {/* Shared Music Track Preview */}
                <div className="flex justify-start">
                  <div className="max-w-sm rounded-2xl rounded-bl-xs p-3.5 bg-stone-50 dark:bg-[#0C3B2E]/30 border border-[#0C3B2E]/10 dark:border-white/10 flex items-center gap-3.5 shadow-xs">
                    <div className="w-10 h-10 rounded-xl bg-[#0C3B2E] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Music className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-stone-900 dark:text-stone-100 text-xs truncate">Golden Hour (Acoustic Chill).mp3</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-end gap-0.5 h-3">
                          <span className="w-0.5 bg-[#0C3B2E] dark:bg-emerald-400 rounded-full h-2 wave-bar" />
                          <span className="w-0.5 bg-[#0C3B2E] dark:bg-emerald-400 rounded-full h-3 wave-bar" style={{ animationDelay: '0.2s' }} />
                          <span className="w-0.5 bg-[#0C3B2E] dark:bg-emerald-400 rounded-full h-1.5 wave-bar" style={{ animationDelay: '0.4s' }} />
                          <span className="w-0.5 bg-[#0C3B2E] dark:bg-emerald-400 rounded-full h-2.5 wave-bar" style={{ animationDelay: '0.1s' }} />
                        </div>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">3:24 • Hi-Fi Audio</span>
                      </div>
                    </div>
                    <Volume2 className="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Reaction Bar */}
              <div className="py-2.5 flex items-center justify-between border-t border-stone-200/90 dark:border-white/10 text-[11px] text-stone-600 dark:text-stone-300">
                <span className="font-semibold text-[#0C3B2E] dark:text-white">Quick Vibe Reactions:</span>
                <div className="flex items-center gap-1.5">
                  {reactions.map((r) => (
                    <button
                      key={r}
                      onClick={() => setActiveReaction(r)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-transform cursor-pointer ${
                        activeReaction === r
                          ? 'bg-[#0C3B2E]/15 scale-125 ring-1 ring-[#0C3B2E]/40 dark:bg-white/20 dark:ring-white/40'
                          : 'hover:scale-110 hover:bg-stone-100 dark:hover:bg-white/10'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Composer Preview Bar */}
              <div className="pt-3 border-t border-stone-200/90 dark:border-white/10 flex items-center gap-2">
                <div className="flex-1 px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-[#051812]/80 border border-[#0C3B2E]/10 dark:border-white/10 text-xs text-stone-500 dark:text-stone-400 font-sans flex items-center justify-between">
                  <span>Write a note, drop a song, or send a vibe...</span>
                  <span className="text-base cursor-pointer">💌</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#0C3B2E] text-white flex items-center justify-center shadow-md shadow-[#0C3B2E]/25 hover:bg-[#155E49] cursor-pointer transition-colors">
                  <Heart className="w-4 h-4 fill-current" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-16 sm:py-28 border-t border-[#0C3B2E]/10 dark:border-white/10 bg-stone-50/70 dark:bg-[#03100C]/70 relative scroll-mt-14">
          <div className="container mx-auto max-w-7xl px-4 sm:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20 space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#0C3B2E]/10 dark:bg-white/10 text-[#0C3B2E] dark:text-emerald-200 text-xs font-semibold border border-[#0C3B2E]/20 dark:border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-[#0C3B2E] dark:text-emerald-400" />
                <span>The Vibely Experience</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-sans font-extrabold tracking-tight text-[#0C3B2E] dark:text-white">
                Crafted for genuine connection
              </h2>
              <p className="text-sm sm:text-base text-stone-600 dark:text-emerald-100/70 leading-relaxed font-medium">
                Everything you and your favorite person need to stay effortlessly close, no matter where life takes you.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {/* Feature 1 */}
              <div className="p-7 rounded-3xl bg-white dark:bg-[#09241B] border border-[#0C3B2E]/15 dark:border-white/10 shadow-sm space-y-3 hover:border-[#0C3B2E]/50 dark:hover:border-emerald-400/50 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-[#0C3B2E]/10 dark:bg-white/10 text-[#0C3B2E] dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Heart className="w-6 h-6 fill-[#0C3B2E]/20 stroke-[#0C3B2E] dark:fill-white/20 dark:stroke-emerald-300" />
                </div>
                <h3 className="font-bold text-lg text-[#0C3B2E] dark:text-white">Pure 1-on-1 Sanctuary</h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-emerald-100/70 leading-relaxed font-normal">
                  No public feeds, algorithmic distractions, or chaotic group chats. A quiet, beautifully styled space dedicated strictly to the two of you.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-7 rounded-3xl bg-white dark:bg-[#09241B] border border-[#0C3B2E]/15 dark:border-white/10 shadow-sm space-y-3 hover:border-[#0C3B2E]/50 dark:hover:border-emerald-400/50 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-[#0C3B2E]/10 dark:bg-white/10 text-[#0C3B2E] dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-2xl">💌</span>
                </div>
                <h3 className="font-bold text-lg text-[#0C3B2E] dark:text-white">Aesthetic Little Notes</h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-emerald-100/70 leading-relaxed font-normal">
                  Compose editorial love notes with subtle parchment textures, poetic formatting, and bookmarks for special memories that deserve forever.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-7 rounded-3xl bg-white dark:bg-[#09241B] border border-[#0C3B2E]/15 dark:border-white/10 shadow-sm space-y-3 hover:border-[#0C3B2E]/50 dark:hover:border-emerald-400/50 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-[#0C3B2E]/10 dark:bg-white/10 text-[#0C3B2E] dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Music className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-[#0C3B2E] dark:text-white">Tracks & Audio Snaps</h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-emerald-100/70 leading-relaxed font-normal">
                  Share audio tracks, favorite song snippets, and spontaneous voice recordings with live waveform visualizers and progress seeking.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-7 rounded-3xl bg-white dark:bg-[#09241B] border border-[#0C3B2E]/15 dark:border-white/10 shadow-sm space-y-3 hover:border-[#0C3B2E]/50 dark:hover:border-emerald-400/50 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-[#0C3B2E]/10 dark:bg-white/10 text-[#0C3B2E] dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-[#0C3B2E] dark:text-white">Moments & Memory Vault</h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-emerald-100/70 leading-relaxed font-normal">
                  An automatic shared vault organizing all your photos, videos, audio tracks, and pinned messages in one seamless digital album.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-7 rounded-3xl bg-white dark:bg-[#09241B] border border-[#0C3B2E]/15 dark:border-white/10 shadow-sm space-y-3 hover:border-[#0C3B2E]/50 dark:hover:border-emerald-400/50 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-[#0C3B2E]/10 dark:bg-white/10 text-[#0C3B2E] dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CalendarHeart className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-[#0C3B2E] dark:text-white">Our Vibe Counter</h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-emerald-100/70 leading-relaxed font-normal">
                  Track days together, upcoming anniversaries, and relationship milestones with gentle private badges and sweet counters.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-7 rounded-3xl bg-white dark:bg-[#09241B] border border-[#0C3B2E]/15 dark:border-white/10 shadow-sm space-y-3 hover:border-[#0C3B2E]/50 dark:hover:border-emerald-400/50 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-[#0C3B2E]/10 dark:bg-white/10 text-[#0C3B2E] dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-[#0C3B2E] dark:text-white">Unique Username & Zero-Trust Privacy</h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-emerald-100/70 leading-relaxed font-normal">
                  Connect effortlessly with your personal <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#0C3B2E]/10 text-[#0C3B2E] dark:bg-white/10 dark:text-emerald-200 font-bold">@username</code>, single-use invite tokens, and secure tokenized media storage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 sm:py-24 border-t border-[#0C3B2E]/10 dark:border-white/10 scroll-mt-14">
          <div className="container mx-auto max-w-7xl px-4 sm:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
              <h2 className="text-2xl sm:text-4xl font-sans font-extrabold text-[#0C3B2E] dark:text-white">
                Get started in 30 seconds
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-emerald-100/70 font-medium">
                Connecting with your partner has never been simpler.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-center">
              <div className="p-6 rounded-3xl bg-white dark:bg-[#09241B] border border-[#0C3B2E]/15 dark:border-white/10 shadow-sm space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-[#0C3B2E] text-white font-bold text-sm mx-auto flex items-center justify-center shadow-md shadow-[#0C3B2E]/25">
                  1
                </div>
                <h3 className="font-bold text-base text-[#0C3B2E] dark:text-white">Create Your Account</h3>
                <p className="text-xs text-stone-600 dark:text-emerald-100/70 leading-relaxed font-normal">
                  Sign up with email or 1-click Google sign in to set your personal @username.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-white dark:bg-[#09241B] border border-[#0C3B2E]/15 dark:border-white/10 shadow-sm space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-[#0C3B2E] text-white font-bold text-sm mx-auto flex items-center justify-center shadow-md shadow-[#0C3B2E]/25">
                  2
                </div>
                <h3 className="font-bold text-base text-[#0C3B2E] dark:text-white">Connect with Username</h3>
                <p className="text-xs text-stone-600 dark:text-emerald-100/70 leading-relaxed font-normal">
                  Share your @username or generate an encrypted 1-time invite link for your partner.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-white dark:bg-[#09241B] border border-[#0C3B2E]/15 dark:border-white/10 shadow-sm space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-[#0C3B2E] text-white font-bold text-sm mx-auto flex items-center justify-center shadow-md shadow-[#0C3B2E]/25">
                  3
                </div>
                <h3 className="font-bold text-base text-[#0C3B2E] dark:text-white">Sync & Enjoy</h3>
                <p className="text-xs text-stone-600 dark:text-emerald-100/70 leading-relaxed font-normal">
                  Step into your private sanctuary and start sharing notes, voice clips, and songs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Live Downloads & Real-Time Active Users Banner (Web Only) */}
        <AppStatsBanner />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#0C3B2E]/15 dark:border-white/10 py-10 bg-stone-50/80 dark:bg-[#03100C]/80">
        <div className="container mx-auto max-w-7xl px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-600 dark:text-emerald-100/70">
          <BrandLogo size="sm" href="/" showTagline={false} />
          <p className="font-serif italic text-[#0C3B2E] dark:text-emerald-200">
            &quot;When two souls vibe, distance ceases to exist.&quot;
          </p>
          <p className="text-[11px] font-sans font-medium text-stone-500 dark:text-stone-400">
            © {new Date().getFullYear()} Vibely. Made with love for two souls.
          </p>
        </div>
      </footer>
    </div>
  );
}

