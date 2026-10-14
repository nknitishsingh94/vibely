'use client';

import * as React from 'react';
import { useChat } from '@/context/chat-context';

/**
 * Snapchat-Style Universal Screenshot Detector
 * - Desktop: PrtScn, Win+Shift+S, Mac Cmd+Shift+3/4/5/6, Ctrl+P, BeforePrint
 * - Mobile: Hardware buttons (Power + Volume Down/Up via AudioVolume keys),
 *   3-finger swipe down gesture, and rapid OS screenshot pause-refocus cycle.
 */
export function ScreenshotDetector() {
  const { activeConversationId, notifySecurityEvent } = useChat();

  React.useEffect(() => {
    if (!activeConversationId || typeof window === 'undefined') return;

    let metaOrShiftPressed = false;
    let lastKeyTime = 0;
    let lastVolumeKeyTime = 0;
    let lastMultiTouchTime = 0;
    let lastUserTouchTime = 0;
    let blurStartTime = 0;

    // Helper to check if user is currently typing in an input/textarea
    const isUserTyping = () => {
      const active = document.activeElement;
      if (!active) return false;
      const tag = active.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || (active as HTMLElement).isContentEditable;
    };

    // 1. Touch listeners: Track user touch activity and 3-finger screenshot gestures
    const handleTouchStart = (e: TouchEvent) => {
      lastUserTouchTime = Date.now();
      if (e.touches && e.touches.length >= 3) {
        lastMultiTouchTime = Date.now();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length >= 3) {
        lastMultiTouchTime = Date.now();
      }
    };

    const handleTouchEnd = () => {
      lastUserTouchTime = Date.now();
    };

    // 2. Keydown: Desktop shortcuts + Android Volume Down / Volume Up hardware keys
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      lastKeyTime = now;

      // Track Android Volume keys (Part of Power + Volume Down / Up screenshot combo)
      if (
        e.key === 'AudioVolumeDown' ||
        e.key === 'AudioVolumeUp' ||
        e.code === 'AudioVolumeDown' ||
        e.code === 'AudioVolumeUp' ||
        e.key === 'VolumeDown' ||
        e.key === 'VolumeUp' ||
        e.keyCode === 174 ||
        e.keyCode === 175
      ) {
        lastVolumeKeyTime = now;
      }

      if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Shift') {
        metaOrShiftPressed = true;
      }

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

    // 3. Keyup listener
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

    // 4. Blur handler: Record blur timestamp & check if triggered right after Volume or Multi-Touch
    const handleBlur = () => {
      const now = Date.now();
      blurStartTime = now;

      // Case A: Desktop blur immediately after Meta/Shift modifier
      if (metaOrShiftPressed && now - lastKeyTime < 450) {
        notifySecurityEvent('screenshot');
        return;
      }

      // Case B: Mobile Android Volume Key + Blur (Hardware Power + Volume screenshot)
      if (now - lastVolumeKeyTime < 1800) {
        notifySecurityEvent('screenshot');
        return;
      }

      // Case C: Mobile 3-Finger Gesture + Blur
      if (now - lastMultiTouchTime < 1800) {
        notifySecurityEvent('screenshot');
        return;
      }
    };

    // 5. Focus / Visibility return handler (Catches iOS & Android Hardware Screenshot pause-cycle)
    const handleFocus = () => {
      const now = Date.now();
      if (blurStartTime > 0) {
        const pauseDuration = now - blurStartTime;
        blurStartTime = 0;

        // An OS hardware screenshot pause typically lasts 150ms to 950ms on mobile.
        // If user was NOT typing in an input, and no button/link was tapped right before blur:
        const wasTyping = isUserTyping();
        const wasTouchingUi = now - lastUserTouchTime < 250;

        if (!wasTyping && !wasTouchingUi && pauseDuration >= 180 && pauseDuration <= 1000) {
          notifySecurityEvent('screenshot');
        }
      }
    };

    // 6. Visibility Change (syncs with focus/blur on mobile webview/browsers)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBlur();
      } else if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    // 7. Print dialog interceptor
    const handleBeforePrint = () => {
      notifySecurityEvent('screenshot');
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [activeConversationId, notifySecurityEvent]);

  return null;
}
