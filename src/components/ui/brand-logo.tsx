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
    sm: 'w-7 h-7 rounded-xl',
    md: 'w-9 h-9 rounded-2xl',
    lg: 'w-12 h-12 rounded-[18px]',
  };

  const svgSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  };

  const titleSizes = {
    sm: 'text-[15px]',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const content = (
    <div className={cn('flex items-center gap-2.5 select-none group', className)}>
      {/* Radiant Vibely Emblem */}
      <div
        className={cn(
          'relative bg-[#0C3B2E] text-white flex items-center justify-center shadow-md shadow-[#0C3B2E]/25 transition-all duration-300 group-hover:scale-105 group-hover:bg-[#155E49] group-hover:shadow-lg group-hover:shadow-[#0C3B2E]/35 shrink-0 ring-1 ring-white/20',
          iconSizes[size]
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('text-white drop-shadow-sm', svgSizes[size])}
        >
          {/* Modern Geometric 'V' with integrated Heartbeat / Wave Resonance */}
          <path
            d="M4.5 4.5L12 18.5L19.5 4.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner heartbeat pulse wave inside the V */}
          <path
            d="M8.5 9.5L10.5 13L12 10.5L13.5 13L15.5 9.5"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Soft central love aura dot */}
          <circle cx="12" cy="7" r="1.5" fill="white" />
        </svg>

        {/* Dynamic pulse indicator */}
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
      </div>

      <div className="flex flex-col text-left">
        <span
          className={cn(
            'font-sans font-extrabold tracking-tight text-[#0C3B2E] dark:text-white leading-none flex items-center gap-1.5 transition-colors',
            titleSizes[size]
          )}
        >
          <span className="group-hover:text-[#155E49] dark:group-hover:text-emerald-300 transition-colors duration-200">
            Vibely
          </span>
          <span className="text-[10px] font-sans font-semibold tracking-normal px-1.5 py-0.5 rounded-full bg-[#0C3B2E]/10 dark:bg-white/10 text-[#0C3B2E] dark:text-emerald-200 border border-[#0C3B2E]/20 dark:border-white/20">
            for two
          </span>
        </span>
        {showTagline && (
          <span className="text-[11px] text-stone-500 dark:text-emerald-100/70 font-sans font-medium tracking-tight mt-0.5">
            Where two souls sync.
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

