import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
  href?: string;
}

export function BrandLogo({
  size = 'md',
  showTagline = false,
  className,
  href = '/',
}: BrandLogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const titleSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl',
  };

  const content = (
    <div className={cn('flex items-center gap-2.5 select-none group', className)}>
      {/* Intertwined Connected Hearts / Double-Orbit Emblem */}
      <div
        className={cn(
          'relative rounded-2xl bg-gradient-to-tr from-[#702C45] via-[#A84B69] to-[#C96B83] text-white flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105 shrink-0',
          iconSizes[size]
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-rose-100"
        >
          {/* Intersecting dual hearts motif */}
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="currentColor"
            fillOpacity="0.88"
          />
          <path
            d="M12 7c-1-1.3-2.5-2-4.2-2C5 5 3 7 3 9.8c0 3 2.8 5.6 7 9.5l2 1.8 2-1.8c4.2-3.9 7-6.5 7-9.5 0-2.8-2-4.8-4.8-4.8-1.7 0-3.2.7-4.2 2z"
            stroke="white"
            strokeWidth="0.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Small sparkling glow dot */}
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-300 ring-2 ring-background animate-pulse" />
      </div>

      <div className="flex flex-col text-left">
        <span
          className={cn(
            'font-serif font-bold tracking-tight text-foreground leading-tight group-hover:text-primary transition-colors flex items-center gap-1',
            titleSizes[size]
          )}
        >
          DuoChat
          <span className="text-primary text-[10px] font-sans font-normal opacity-80 italic">
            for two
          </span>
        </span>
        {showTagline && (
          <span className="text-[11px] text-muted-foreground font-sans font-medium tracking-tight">
            Just us, in our own little world.
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
