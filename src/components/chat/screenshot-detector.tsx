'use client';

import * as React from 'react';
import { useChat } from '@/context/chat-context';

/**
 * Deterministic Snapchat-Style Screenshot Detector
 * - Desktop: PrtScn key, Win+Shift+S (Snipping Tool), Mac Cmd+Shift+3/4/5/6, Ctrl+P, BeforePrint
 * - Android APK: Native ScreenCaptureCallback (Android 14+) & ContentObserver (Android 10-13)
 * 
 * Note: Avoid heuristic blur/focus/visibility guesses that cause false positive triggers.
 */
export function ScreenshotDetector() {
  const { activeConversationId, notifySecurityEvent } = useChat();

  React.useEffect(() => {
    if (!activeConversationId || typeof window === 'undefined') return;

    // 1. Keydown: Desktop shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Windows PrintScreen
      if (e.key === 'PrintScreen' || e.keyCode === 44 || e.code === 'PrintScreen') {
        notifySecurityEvent('screenshot');
        return;
      }

      // Windows Snipping Tool: Win + Shift + S
      if ((e.key === 's' || e.key === 'S') && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        notifySecurityEvent('screenshot');
        return;
      }

      // Mac screenshot commands: Cmd + Shift + 3, Cmd + Shift + 4, Cmd + Shift + 5, Cmd + Shift + 6
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        ['3', '4', '5', '6'].includes(e.key)
      ) {
        notifySecurityEvent('screenshot');
        return;
      }

      // Browser Print / Save as PDF: Ctrl+P / Cmd+P
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        notifySecurityEvent('screenshot');
        return;
      }
    };

    // 2. Keyup listener
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44 || e.code === 'PrintScreen') {
        notifySecurityEvent('screenshot');
        return;
      }
    };

    // 3. Print dialog interceptor
    const handleBeforePrint = () => {
      notifySecurityEvent('screenshot');
    };

    // 4. Native Android APK screenshot callback bridge
    const handleNativeScreenshot = () => {
      notifySecurityEvent('screenshot');
    };

    // Bind both CustomEvent and direct global function for Android native bridge
    (window as any).onVibelyScreenshotDetected = handleNativeScreenshot;
    window.addEventListener('vibely_screenshot_captured', handleNativeScreenshot);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      (window as any).onVibelyScreenshotDetected = null;
      window.removeEventListener('vibely_screenshot_captured', handleNativeScreenshot);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [activeConversationId, notifySecurityEvent]);

  return null;
}
