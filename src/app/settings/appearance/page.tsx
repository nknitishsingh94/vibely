'use client';

import * as React from 'react';
import { Check, Heart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRomanticFeatures } from '@/lib/romantic-features';
import { Button } from '@/components/ui/button';

export default function AppearanceSettingsPage() {
  const { anniversary, daysTogether, updateAnniversary } = useRomanticFeatures();
  const [mounted, setMounted] = React.useState(false);
  const [dateInput, setDateInput] = React.useState(anniversary || '');

  React.useEffect(() => {
    setMounted(true);
    setDateInput(anniversary || '');
  }, [anniversary]);

  if (!mounted) return null;

  const handleSaveDate = (e: React.FormEvent) => {
    e.preventDefault();
    updateAnniversary(dateInput || null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif font-bold tracking-tight text-foreground">
          Appearance & Our Moments
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 font-sans">
          Customize the aesthetic and romantic touches of your private sanctuary
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Color Palette</h3>
            <span className="text-[11px] font-semibold text-[#0C3B2E] bg-[#0C3B2E]/10 px-2.5 py-0.5 rounded-full border border-[#0C3B2E]/20">
              Permanent Signature Theme
            </span>
          </div>

          <div className="p-4 rounded-2xl border-2 border-primary bg-primary/5 shadow-xs space-y-2 select-none max-w-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#0C3B2E] inline-block ring-2 ring-white shadow-xs" />
                <span className="w-3.5 h-3.5 rounded-full bg-white inline-block ring-2 ring-[#0C3B2E]/30 shadow-xs" />
              </div>
              <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Check className="w-3 h-3" />
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Deep Emerald & Pure White (#0C3B2E)</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Vibely is exclusively styled in luxury Deep Emerald Green (#0C3B2E) and crisp Pure White.
              </p>
            </div>
          </div>
        </div>

        {/* Our Special Day Milestone Section */}
        <div className="pt-6 border-t border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-primary fill-primary/20" />
                <span>Our Day Counter</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set the date you two started your story to display an anniversary day counter.
              </p>
            </div>
            {daysTogether !== null && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#0C3B2E]/10 text-[#0C3B2E] dark:bg-white/10 dark:text-emerald-200 border border-[#0C3B2E]/20 dark:border-white/20 font-serif">
                Day {daysTogether} Together 💕
              </span>
            )}
          </div>

          <form onSubmit={handleSaveDate} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-md pt-1">
            <input
              type="date"
              value={dateInput}
              onChange={e => setDateInput(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl text-xs bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Button type="submit" size="sm" className="rounded-xl text-xs font-medium bg-primary text-primary-foreground">
              Save Date
            </Button>
            {anniversary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  updateAnniversary(null);
                  setDateInput('');
                }}
                className="rounded-xl text-xs text-destructive hover:bg-destructive/10"
              >
                Clear
              </Button>
            )}
          </form>
        </div>

        {/* Live Chat Bubble Preview */}
        <div className="pt-6 border-t border-border/60 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Message Bubble Aesthetic</h3>
          <p className="text-xs text-muted-foreground">
            Preview of incoming message, Little Note, and outgoing romantic gradient
          </p>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-3 max-w-md">
            <div className="flex items-start">
              <div className="p-3 rounded-2xl rounded-bl-xs bg-card border border-border text-xs text-card-foreground shadow-xs">
                Good morning my favorite person! ☕✨
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="p-3.5 rounded-2xl little-note-card shadow-xs text-xs space-y-1">
                <span className="text-[10px] font-serif italic text-primary font-bold flex items-center gap-1">
                  <span>💌</span> Little Note
                </span>
                <p className="font-serif italic text-xs">
                  &quot;Every little moment with you is worth remembering.&quot;
                </p>
              </div>
            </div>

            <div className="flex items-end justify-end">
              <div className="p-3 rounded-2xl rounded-br-xs bg-[#0C3B2E] text-white text-xs shadow-sm">
                Can&apos;t wait to see you tonight! ❤️
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
