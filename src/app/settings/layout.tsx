'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, User, Palette, Shield, LogOut, Key, Lock, Bell } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { BrandLogo } from '@/components/ui/brand-logo';
import { cn } from '@/lib/utils';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.push(`/login?redirectTo=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, user, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground text-xs font-medium">
        Loading settings...
      </div>
    );
  }

  if (!user) return null;

  const isHub = pathname === '/settings';

  const navItems = [
    { href: '/settings/profile', label: 'Account & Profile', icon: Key },
    { href: '/settings/privacy', label: 'Privacy & Security', icon: Lock },
    { href: '/settings/appearance', label: 'Chats & Appearance', icon: Palette },
  ];

  const getPageTitle = () => {
    if (pathname.includes('/profile')) return 'Profile';
    if (pathname.includes('/privacy')) return 'Privacy';
    if (pathname.includes('/appearance')) return 'Chats & Appearance';
    return 'Settings';
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* WhatsApp Settings Top Header */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 backdrop-blur-md pt-[max(env(safe-area-inset-top),0rem)]">
        <div className="container mx-auto max-w-4xl flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link
              href={isHub ? '/chat' : '/settings'}
              className="p-2 -ml-2 rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label={isHub ? 'Back to chat' : 'Back to settings'}
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Link>

            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-foreground">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BrandLogo size="sm" href="/chat" />
          </div>
        </div>
      </header>

      {/* Main Settings Container */}
      <div className="container mx-auto max-w-4xl flex-1 px-3 sm:px-6 py-4 sm:py-6">
        {isHub ? (
          /* Hub screen: Full WhatsApp Settings dashboard */
          <main className="w-full">{children}</main>
        ) : (
          /* Sub-page screen: Sidebar navigation on desktop + Content */
          <div className="flex flex-col md:flex-row gap-6">
            <aside className="w-full md:w-60 shrink-0 hidden md:block">
              <div className="rounded-3xl bg-card border border-border/80 p-2 shadow-xs space-y-1">
                <Link
                  href="/settings"
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>All Settings</span>
                </Link>

                <div className="my-1 border-t border-border/50" />

                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all',
                        isActive
                          ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/25'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      )}
                    >
                      <Icon className={cn('w-4 h-4', isActive ? 'text-emerald-600 dark:text-emerald-400' : '')} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </aside>

            <main className="flex-1 min-w-0">{children}</main>
          </div>
        )}
      </div>
    </div>
  );
}
