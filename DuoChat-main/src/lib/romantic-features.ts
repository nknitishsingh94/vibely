'use client';

import * as React from 'react';

const ANNIVERSARY_KEY = 'duochat_anniversary_date';
const FAVORITES_KEY = 'duochat_favorite_messages';

export function getAnniversaryDate(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ANNIVERSARY_KEY);
}

export function setAnniversaryDate(dateString: string | null): void {
  if (typeof window === 'undefined') return;
  if (!dateString) {
    localStorage.removeItem(ANNIVERSARY_KEY);
  } else {
    localStorage.setItem(ANNIVERSARY_KEY, dateString);
  }
}

export function calculateDaysTogether(dateString: string | null): number | null {
  if (!dateString) return null;
  const start = new Date(dateString);
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  const diffTime = Math.max(0, now.getTime() - start.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // 1-indexed days
}

export function getFavoriteMessageIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteMessage(messageId: string): boolean {
  if (typeof window === 'undefined') return false;
  const current = getFavoriteMessageIds();
  const isFav = current.includes(messageId);
  const updated = isFav ? current.filter(id => id !== messageId) : [...current, messageId];
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  } catch {}
  return !isFav;
}

// Hook for reacting to anniversary changes
export function useRomanticFeatures() {
  const [anniversary, setAnniversaryState] = React.useState<string | null>(null);
  const [favorites, setFavorites] = React.useState<string[]>([]);

  React.useEffect(() => {
    setAnniversaryState(getAnniversaryDate());
    setFavorites(getFavoriteMessageIds());

    const handleStorage = () => {
      setAnniversaryState(getAnniversaryDate());
      setFavorites(getFavoriteMessageIds());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateAnniversary = (date: string | null) => {
    setAnniversaryDate(date);
    setAnniversaryState(date);
  };

  const toggleFav = (id: string) => {
    const res = toggleFavoriteMessage(id);
    setFavorites(getFavoriteMessageIds());
    return res;
  };

  const daysTogether = calculateDaysTogether(anniversary);

  return {
    anniversary,
    daysTogether,
    updateAnniversary,
    favorites,
    toggleFav,
    isFavorite: (id: string) => favorites.includes(id),
  };
}
