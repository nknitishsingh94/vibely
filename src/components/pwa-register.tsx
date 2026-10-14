'use client';

import * as React from 'react';

// Custom event to share install prompt state across components
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let globalInstallPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function usePwaInstall() {
  const [canInstall, setCanInstall] = React.useState<boolean>(() => !!globalInstallPrompt);
  const [isStandalone, setIsStandalone] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneMode);

    const update = () => {
      setCanInstall(!!globalInstallPrompt);
    };

    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const triggerInstall = async () => {
    if (!globalInstallPrompt) {
      return false;
    }
    try {
      await globalInstallPrompt.prompt();
      const choiceResult = await globalInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        globalInstallPrompt = null;
        listeners.forEach((l) => l());
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Install prompt error:', err);
      return false;
    }
  };

  return { canInstall, isStandalone, triggerInstall };
}

export function PwaRegister() {
  React.useEffect(() => {
    // Register Service Worker
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[Vibely PWA] Service Worker registered:', registration.scope);
          })
          .catch((error) => {
            console.warn('[Vibely PWA] Service Worker registration failed:', error);
          });
      });
    }

    // Capture Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalInstallPrompt = e as BeforeInstallPromptEvent;
      listeners.forEach((l) => l());
    };

    const handleAppInstalled = () => {
      globalInstallPrompt = null;
      listeners.forEach((l) => l());
      console.log('[Vibely PWA] App was successfully installed!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return null;
}
