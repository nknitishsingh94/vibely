'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, User, Palette, Shield, LogOut } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

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

  const navItems = [
    { href: '/settings/profile', label: 'Profile', icon: User },
    { href: '/settings/appearance', label: 'Appearance', icon: Palette },
    { href: '/settings/privacy', label: 'Privacy & Security', icon: Shield },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/70 backdrop-blur-md">
        <div className="container mx-auto max-w-4xl flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <BrandLogo size="sm" href="/chat" />
            <span className="text-xs text-muted-foreground/80 font-serif italic border-l border-border/60 pl-2 ml-1 hidden sm:inline">
              Settings & Preferences
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="rounded-xl text-xs font-semibold gap-1.5 text-stone-600 hover:text-rose-600 hover:bg-rose-500/10 border-border/80 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>Log Out</span>
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <div className="container mx-auto max-w-4xl flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Settings Sub-Navigation */}
          <aside className="w-full md:w-56 shrink-0">
            <nav className="flex md:flex-col gap-1.5 p-1 rounded-2xl bg-muted/40 border border-border/50">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all',
                      isActive
                        ? 'bg-card text-foreground shadow-xs font-semibold border border-primary/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : '')} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="pt-2 mt-1 border-t border-border/50">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-all cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Log Out</span>
                </button>
              </div>
            </nav>
          </aside>

          {/* Sub-Page Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
