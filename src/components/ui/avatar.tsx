'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

export function Avatar({
  src,
  name,
  size = 'md',
  isOnline,
  className,
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  // Clean and validate source string
  const validSrc = React.useMemo(() => {
    if (!src) return null;
    if (typeof src !== 'string') return null;
    const trimmed = src.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed;
  }, [src]);

  // Reset error state whenever src changes so newly selected/uploaded images render immediately
  React.useEffect(() => {
    setImageError(false);
  }, [validSrc]);

  const initials = name
    ? name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
  };

  const badgeSizeClasses = {
    xs: 'w-2 h-2 ring-1',
    sm: 'w-2.5 h-2.5 ring-1.5',
    md: 'w-3 h-3 ring-2',
    lg: 'w-3.5 h-3.5 ring-2',
    xl: 'w-4 h-4 ring-3',
  };

  // Generate consistent background color based on name string
  const hash = name ? name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const hue = (hash * 137.5) % 360;

  return (
    <div className={cn('relative inline-flex shrink-0 select-none', className)}>
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full overflow-hidden font-semibold border border-border/40 shadow-xs transition-transform',
          sizeClasses[size]
        )}
        style={{
          backgroundColor: validSrc && !imageError ? undefined : `hsl(${hue} 65% 45%)`,
          color: validSrc && !imageError ? undefined : '#ffffff',
        }}
      >
        {validSrc && !imageError ? (
          // Using standard img for external blob/signed storage urls or base64 data URLs
          <img
            src={validSrc}
            alt={name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {isOnline !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-background transition-colors',
            badgeSizeClasses[size],
            isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          )}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
