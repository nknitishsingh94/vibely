'use client';

import * as React from 'react';
import { useChat } from '@/context/chat-context';

/**
 * Snapchat-Style Universal Screenshot Detector
 * Intercepts desktop shortcuts (PrtScn, Win+Shift+S, Mac Cmd+Shift+3/4/5),
 * browser print commands, and mobile OS hardware screenshot focus shifts.
 */
export function ScreenshotDetector() {
  const { activeConversationId, notifySecurityEvent } = useChat();

  React.useEffect(() => {
    if (!activeConversationId || typeof window === 'undefined') return;

    let metaOrShiftPressed = false;
    let lastKeyTime = 0;

    // 1. Keydown event listener
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      lastKeyTime = now;

      if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Shift') {
        metaOrShiftPressed = true;
      }

      // Windows PrintScreen (some platforms fire on keydown)
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

    // 2. Keyup event listener (Windows PrtScn keyup is the standard in Chromium browsers)
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44 || e.code === 'PrintScreen') {
        notifySecurityEvent('screenshot');
        return;
      }
      if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Shift') {
        setTimeout(() => {
          metaOrShiftPressed = false;
        }, 800);
      }
    };

    // 3. Window blur detection (Windows Snipping Tool causes immediate window blur after Win+Shift+S or PrtScn)
    const handleBlur = () => {
      const timeSinceLastKey = Date.now() - lastKeyTime;
      if (metaOrShiftPressed && timeSinceLastKey < 450) {
        notifySecurityEvent('screenshot');
      }
    };

    // 4. Print dialog interceptor
    const handleBeforePrint = () => {
      notifySecurityEvent('screenshot');
    };

    // 5. Mobile focus/blur detection:
    // When a user takes a hardware screenshot on Android or iOS (Power + Volume Down),
    // the mobile browser experiences a temporary visibility pause of ~200-1100ms.
    let blurTime = 0;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        blurTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - blurTime;
        if (blurTime > 0 && elapsed > 180 && elapsed < 1200) {
          notifySecurityEvent('screenshot');
        }
        blurTime = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeprint', handleBeforePrint);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeprint', handleBeforePrint);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeConversationId, notifySecurityEvent]);

  return null;
}
