'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Laptop } from 'lucide-react';
import { Button } from './ui/button';

import { cn } from '@/lib/utils';

export function ThemeToggle({ showLabel = false, className }: { showLabel?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size={showLabel ? 'sm' : 'icon'} className={cn("w-8 h-8 opacity-50", className)}>
        <Sun className="w-4 h-4" />
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const getIcon = () => {
    if (theme === 'dark') return <Moon className="w-4 h-4 text-emerald-300" />;
    if (theme === 'light') return <Sun className="w-4 h-4 text-[#0C3B2E]" />;
    return <Laptop className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <Button
      variant="ghost"
      size={showLabel ? 'sm' : 'icon'}
      onClick={cycleTheme}
      className={cn("w-8 h-8 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all", className)}
      title={`Current: ${theme} (click to cycle)`}
      aria-label="Toggle theme"
    >
      {getIcon()}
      {showLabel && <span className="ml-2 capitalize text-xs">{theme || 'System'}</span>}
    </Button>
  );
}
