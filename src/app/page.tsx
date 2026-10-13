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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { BrandLogo } from '@/components/ui/brand-logo';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-rose-500/20">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4 sm:px-6">
          <BrandLogo size="md" href="/" />

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm" className="rounded-xl text-xs">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="rounded-xl text-xs font-medium shadow-xs bg-gradient-to-tr from-[#702C45] to-[#C96B83] text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
          {/* Subtle Ambient Background Gradient Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-rose-500/10 dark:bg-rose-950/20 blur-[130px] rounded-full pointer-events-none -z-10" />

          <div className="container mx-auto max-w-5xl px-4 sm:px-6 text-center">
            {/* Romantic Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-600 dark:text-rose-300 mb-6 animate-in fade-in duration-300">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="font-serif italic">Made for the moments between us</span>
            </div>

            {/* Main Editorial Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif font-bold tracking-tight max-w-3xl mx-auto leading-[1.12] text-foreground">
              Just us, in our{' '}
              <span className="bg-gradient-to-r from-[#702C45] via-[#A84B69] to-[#C96B83] bg-clip-text text-transparent italic font-normal">
                own little world.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed font-sans">
              A private messaging sanctuary designed exclusively for couples and soulmates. Share daily thoughts, romantic Little Notes, favorite songs, voice recordings, and treasured memories without the noise of social media.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto rounded-2xl gap-2 font-semibold shadow-md bg-gradient-to-tr from-[#702C45] to-[#C96B83] text-white hover:opacity-95 cursor-pointer">
                  Create Our Space
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-2xl cursor-pointer">
                  Sign In
                </Button>
              </Link>
              <Link href="/chat" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto rounded-2xl gap-1.5 cursor-pointer">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Live Preview
                </Button>
              </Link>
            </div>

            {/* Interactive Preview Mockup */}
            <div className="mt-14 max-w-3xl mx-auto rounded-3xl border border-border/80 bg-card/80 backdrop-blur-xl p-4 sm:p-6 shadow-2xl text-left relative overflow-hidden">
              {/* Preview Window Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#702C45] to-[#C96B83] flex items-center justify-center font-bold text-white text-sm shadow-xs">
                    EM
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      Emily
                      <span className="text-[11px] font-normal text-rose-500 bg-rose-500/10 px-2 py-0.2 rounded-full border border-rose-500/20 font-sans">
                        Day 284 together 💕
                      </span>
                    </h3>
                    <p className="text-[11px] text-emerald-500 font-medium">Online now</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-serif italic">
                  <Lock className="w-3.5 h-3.5 text-primary" />
                  <span>Private Sanctuary</span>
                </div>
              </div>

              {/* Chat Messages Preview */}
              <div className="py-6 space-y-4 font-sans text-xs">
                {/* Incoming Message */}
                <div className="flex justify-start">
                  <div className="max-w-md rounded-2xl rounded-bl-xs p-3.5 bg-muted/70 text-card-foreground border border-border/60 space-y-1">
                    <p className="leading-relaxed">
                      Thinking about our weekend walk in the park. Can&apos;t wait to see you tonight! ☕✨
                    </p>
                    <span className="text-[10px] text-muted-foreground block text-right font-mono">10:42 AM</span>
                  </div>
                </div>

                {/* Outgoing "Little Note" Message */}
                <div className="flex justify-end">
                  <div className="max-w-md rounded-2xl p-4 little-note-card shadow-sm space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-rose-900/15 dark:border-rose-300/15">
                      <span className="text-[11px] font-serif italic font-bold text-primary flex items-center gap-1">
                        <span>💌</span> Little Note
                      </span>
                      <Sparkles className="w-3 h-3 text-primary" />
                    </div>
                    <p className="font-serif italic text-sm leading-relaxed text-foreground">
                      &quot;Every little moment with you is my favorite part of the day. Counting down the minutes until dinner.&quot;
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1 text-amber-500 font-medium font-sans">
                        <Bookmark className="w-2.5 h-2.5 fill-current" /> Saved with love
                      </span>
                      <span className="font-mono">10:45 AM • Read</span>
                    </div>
                  </div>
                </div>

                {/* Shared Music Track Preview */}
                <div className="flex justify-start">
                  <div className="max-w-xs rounded-2xl rounded-bl-xs p-3 bg-muted/70 border border-border/60 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-500 flex items-center justify-center shrink-0">
                      <Music className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">Our Song — Acoustic.mp3</p>
                      <p className="text-[10px] text-muted-foreground">3:42 • High Fidelity Audio</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Composer Preview Bar */}
              <div className="pt-3 border-t border-border/60 flex items-center gap-2">
                <div className="flex-1 px-3.5 py-2 rounded-xl bg-background border border-input text-xs text-muted-foreground italic font-serif">
                  Write your heartfelt note or message...
                </div>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#702C45] to-[#C96B83] text-white flex items-center justify-center shadow-xs">
                  <Heart className="w-4 h-4 fill-current" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-16 sm:py-24 border-t border-border/60 bg-muted/20">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-foreground">
                Crafted for two hearts
              </h2>
              <p className="text-sm text-muted-foreground">
                Everything you need to stay intimately connected, no matter the distance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {/* Feature 1 */}
              <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3 hover:border-primary/40 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-primary flex items-center justify-center">
                  <Heart className="w-6 h-6 fill-primary/20 stroke-primary" />
                </div>
                <h3 className="font-serif font-bold text-lg text-foreground">Intimate 1-on-1 Space</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No public feeds, algorithmic suggestions, or group chat clutter. A quiet, private sanctuary dedicated strictly to the two of you.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3 hover:border-primary/40 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <span className="text-xl">💌</span>
                </div>
                <h3 className="font-serif font-bold text-lg text-foreground">Little Notes</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Compose heartfelt messages with an elegant parchment presentation and editorial typography for special moments that deserve extra care.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3 hover:border-primary/40 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Music className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-foreground">Songs & Voice Notes</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Share musical tracks, favorite songs, or spontaneous voice recordings with crystal-clear playback and progress seeking.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3 hover:border-primary/40 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-foreground">Our Moments Gallery</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A dedicated vault organizing your shared photos, videos, songs, and bookmarked favorite messages in one shared album.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3 hover:border-primary/40 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-primary flex items-center justify-center">
                  <CalendarHeart className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-foreground">Our Day Counter</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Honor your relationship anniversary or special milestone with a private, gentle day counter keeping track of your journey.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-3 hover:border-primary/40 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-foreground">Private & Protected</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cryptographic single-use invitations, signed media URLs with token expiry, and private Supabase storage keep your memories safe.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8 bg-card/40">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <BrandLogo size="sm" href="/" />
          <p className="font-serif italic">
            &quot;A little closer, even when we&apos;re apart.&quot;
          </p>
          <p className="text-[11px] font-sans">
            © {new Date().getFullYear()} DuoChat. Made with love for couples.
          </p>
        </div>
      </footer>
    </div>
  );
}
