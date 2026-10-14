'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Check, Heart, Sun, Moon, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRomanticFeatures } from '@/lib/romantic-features';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();
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
    toast.success('Relationship date saved!');
  };

  const themeOptions = [
    {
      id: 'system',
      name: 'System Default',
      desc: 'Matches your phone / computer setting',
      icon: Smartphone,
      preview: 'from-[#0C3B2E] to-[#051812]',
    },
    {
      id: 'light',
      name: 'Light Mode',
      desc: 'Crisp Pure White & Deep Emerald',
      icon: Sun,
      preview: 'from-[#FFFFFF] to-[#E6F4EA]',
    },
    {
      id: 'dark',
      name: 'Dark Mode',
      desc: 'Midnight Forest & Pure White',
      icon: Moon,
      preview: 'from-[#051812] to-[#09241B]',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif font-bold tracking-tight text-foreground">
          Appearance & Theme
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 font-sans">
          Customize dark mode and romantic touches of your private sanctuary
        </p>
      </div>

      <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-6">
        {/* Theme Selector Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Theme & Dark Mode</h3>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 capitalize">
              Active: {theme || 'system'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTheme(opt.id);
                    toast.success(`Switched to ${opt.name}`);
                  }}
                  className={cn(
                    'p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer relative',
                    isSelected
                      ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-border/80 hover:border-border hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-foreground">{opt.name}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Our Special Day Milestone Section */}
        <div className="pt-6 border-t border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-600/20" />
                <span>Our Day Counter</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set the date you two started your story to display an anniversary day counter.
              </p>
            </div>
            {daysTogether !== null && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/20 font-serif">
                Day {daysTogether} Together 💕
              </span>
            )}
          </div>

          <form onSubmit={handleSaveDate} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-md pt-1">
            <input
              type="date"
              value={dateInput}
              onChange={e => setDateInput(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl text-xs bg-background border border-input focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <Button type="submit" size="sm" className="rounded-2xl text-xs font-semibold bg-[#005C4B] hover:bg-[#004D3F] text-white shadow-sm px-4">
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
                  toast.info('Relationship date cleared');
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
            Live preview of incoming message, Little Note, and outgoing message in current theme
          </p>

          <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3 max-w-md">
            <div className="flex items-start">
              <div className="p-2.5 sm:p-3 rounded-2xl rounded-bl-xs bg-white dark:bg-[#202C33] border border-border/70 text-xs text-foreground shadow-2xs">
                Good morning my favorite person! ☕✨
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="p-3 rounded-2xl little-note-card shadow-xs text-xs space-y-1">
                <span className="text-[10px] font-serif italic text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <span>💌</span> Little Note
                </span>
                <p className="font-serif italic text-xs">
                  &quot;Every little moment with you is worth remembering.&quot;
                </p>
              </div>
            </div>

            <div className="flex items-end justify-end">
              <div className="p-2.5 sm:p-3 rounded-2xl rounded-br-xs bg-[#005C4B] text-white text-xs shadow-sm">
                Can&apos;t wait to see you tonight! ❤️
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
