'use client';

import * as React from 'react';

interface FloatingHeartItem {
  id: number;
  x: number;
  y: number;
  size: number;
  symbol: string;
}

export function FloatingHeartsOverlay() {
  const [hearts, setHearts] = React.useState<FloatingHeartItem[]>([]);

  React.useEffect(() => {
    const handleHeartEvent = (e: CustomEvent<{ x?: number; y?: number; count?: number }>) => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      const detail = e.detail || {};
      const count = detail.count || 5;
      const originX = detail.x ?? window.innerWidth / 2;
      const originY = detail.y ?? window.innerHeight / 2;

      const symbols = ['❤️', '💖', '✨', '💕', '🌹'];
      const newHearts: FloatingHeartItem[] = [];

      for (let i = 0; i < count; i++) {
        newHearts.push({
          id: Date.now() + Math.random(),
          x: originX + (Math.random() - 0.5) * 60,
          y: originY + (Math.random() - 0.5) * 40,
          size: 14 + Math.random() * 12,
          symbol: symbols[Math.floor(Math.random() * symbols.length)],
        });
      }

      setHearts(prev => [...prev, ...newHearts]);

      setTimeout(() => {
        setHearts(prev => prev.filter(h => !newHearts.some(nh => nh.id === h.id)));
      }, 1600);
    };

    window.addEventListener('spawn-floating-heart' as any, handleHeartEvent as any);
    return () => window.removeEventListener('spawn-floating-heart' as any, handleHeartEvent as any);
  }, []);

  if (hearts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {hearts.map(h => (
        <span
          key={h.id}
          className="absolute animate-floating-heart select-none"
          style={{
            left: `${h.x}px`,
            top: `${h.y}px`,
            fontSize: `${h.size}px`,
          }}
        >
          {h.symbol}
        </span>
      ))}
    </div>
  );
}

export function spawnFloatingHearts(x?: number, y?: number, count: number = 6) {
  if (typeof window === 'undefined') return;
  const evt = new CustomEvent('spawn-floating-heart', {
    detail: { x, y, count },
  });
  window.dispatchEvent(evt);
}
