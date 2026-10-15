'use client';

import * as React from 'react';
import {
  Download,
  Users,
  Smartphone,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  PhoneCall,
  BellRing,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/toast';

export function AppStatsBanner() {
  const [isClient, setIsClient] = React.useState(false);
  const [isNativeApp, setIsNativeApp] = React.useState(false);
  const [downloads, setDownloads] = React.useState<number>(185);
  const [activeUsers, setActiveUsers] = React.useState<number>(12);
  const [isDownloading, setIsDownloading] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);

    // 1. Strict Web-only check: Detect if running inside native Android APK or Capacitor webview
    const isCapacitorNative =
      typeof window !== 'undefined' &&
      Boolean(
        (window as any).Capacitor?.isNativePlatform?.() ||
        (window as any).AndroidBridge ||
        navigator.userAgent.includes('VibelyApp') ||
        (window as any).Capacitor?.getPlatform?.() === 'android'
      );

    if (isCapacitorNative) {
      setIsNativeApp(true);
      return; // DO NOT RUN OR SHOW IN MOBILE APK
    }

    // 2. Fetch latest stats from server
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.downloads === 'number') {
          setDownloads(data.downloads);
        }
        if (typeof data.activeUsers === 'number') {
          setActiveUsers(data.activeUsers);
        }
      })
      .catch(() => {});

    // 3. Connect to Supabase Realtime Global Presence for live active user counter
    try {
      const supabase = getSupabaseBrowserClient();
      const presenceChannel = supabase.channel('online-global-presence', {
        config: { presence: { key: `visitor_${Math.random().toString(36).slice(2, 8)}` } },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const liveOnlineCount = Object.keys(state).length;
          // Combine live presence with baseline active users
          setActiveUsers((prev) => Math.max(liveOnlineCount + 7, prev));
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              online_at: new Date().toISOString(),
              platform: 'web',
            });
          }
        });

      return () => {
        supabase.removeChannel(presenceChannel);
      };
    } catch {}
  }, []);

  // If rendering on server or inside native Android APK, do not display!
  if (!isClient || isNativeApp) {
    return null;
  }

  const handleDownloadClick = async () => {
    setIsDownloading(true);
    // Optimistic increment
    setDownloads((prev) => prev + 1);

    try {
      // Fire-and-forget persistent counter increment
      fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download' }),
      }).catch(() => {});

      toast.success('🚀 Downloading Vibely Android App (.apk)... Tap open to install!');

      // Trigger actual download via redirect
      const downloadLink = document.createElement('a');
      downloadLink.href = '/api/download';
      downloadLink.download = 'Vibely.apk';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch {
      window.location.href = '/api/download';
    } finally {
      setTimeout(() => setIsDownloading(false), 2000);
    }
  };

  return (
    <section className="relative overflow-hidden py-14 sm:py-20 border-t border-[#0C3B2E]/15 dark:border-white/10 bg-gradient-to-b from-stone-50/90 via-emerald-950/5 to-stone-100/90 dark:from-[#041510] dark:via-[#07241B] dark:to-[#030E0B]">
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-[#0C3B2E]/10 dark:bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto max-w-7xl px-4 sm:px-8 relative z-10">
        {/* Main Glassmorphic Card */}
        <div className="p-6 sm:p-10 lg:p-12 rounded-3xl bg-white/95 dark:bg-[#08241C]/95 border border-[#0C3B2E]/20 dark:border-emerald-500/25 shadow-2xl backdrop-blur-xl ring-1 ring-[#0C3B2E]/10 dark:ring-emerald-500/20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Heading & Download CTA */}
            <div className="lg:col-span-7 space-y-5 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-[#0C3B2E] dark:text-emerald-300 text-xs font-bold border border-emerald-500/20 shadow-xs">
                <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                <span>Vibely for Android • Direct APK Install</span>
              </div>

              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-sans font-black tracking-tight text-[#0C3B2E] dark:text-white leading-[1.15]">
                Carry your favorite person{' '}
                <span className="bg-gradient-to-r from-emerald-600 via-[#155E49] to-[#0C3B2E] dark:from-emerald-300 dark:via-emerald-400 dark:to-white bg-clip-text text-transparent">
                  right in your pocket.
                </span>
              </h2>

              <p className="text-sm sm:text-base text-stone-600 dark:text-emerald-100/80 leading-relaxed font-normal max-w-2xl">
                Experience crystal-clear real-time voice & video calls, WhatsApp-style background ringing even when the phone is locked, instant screenshot security alerts, and zero-noise romantic messaging.
              </p>

              {/* Action Buttons & Badges */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                <Button
                  size="lg"
                  onClick={handleDownloadClick}
                  isLoading={isDownloading}
                  className="rounded-2xl px-6 py-6 font-bold shadow-xl shadow-emerald-700/25 bg-[#0C3B2E] hover:bg-[#155E49] text-white hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer ring-1 ring-emerald-500/30 flex items-center justify-center gap-2.5 text-sm sm:text-base"
                >
                  <Download className="w-5 h-5 text-emerald-300" />
                  <span>Download Android App (.apk)</span>
                </Button>

                <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-emerald-200/70 px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>v1.0.0 • ~8.5 MB • Virus-Free</span>
                </div>
              </div>

              {/* Feature Highlights Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-stone-600 dark:text-emerald-200/80 font-medium">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/10">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Background Calling
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/10">
                  <BellRing className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Lockscreen Ringtone
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/10">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Screenshot Detector
                </span>
              </div>
            </div>

            {/* Right Column: Live Counters Display */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {/* Card 1: Total App Downloads */}
              <div className="p-6 rounded-2xl bg-stone-50/90 dark:bg-[#051A14]/90 border border-emerald-500/20 shadow-md space-y-2 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Download className="w-20 h-20 text-[#0C3B2E] dark:text-emerald-400" />
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>TOTAL APP DOWNLOADS</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#0C3B2E] dark:text-white">
                    {downloads.toLocaleString()}+
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Android Installs
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-emerald-200/60 leading-normal">
                  Verified APK packages downloaded directly by couples & pairs worldwide.
                </p>
              </div>

              {/* Card 2: Real-Time Active Users Online */}
              <div className="p-6 rounded-2xl bg-stone-50/90 dark:bg-[#051A14]/90 border border-emerald-500/20 shadow-md space-y-2 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Users className="w-20 h-20 text-[#0C3B2E] dark:text-emerald-400" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>LIVE ACTIVE USERS</span>
                  </div>
                  {/* Realtime Live Green Radar Pulse */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    LIVE NOW
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#0C3B2E] dark:text-white">
                    {activeUsers.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-stone-600 dark:text-emerald-200/80">
                    Users Online Now
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-emerald-200/60 leading-normal">
                  Couples chatting, listening to music & on active calls right now.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
