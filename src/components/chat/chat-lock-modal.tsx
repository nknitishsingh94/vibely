'use client';

import * as React from 'react';
import { Lock, ShieldCheck, X, Delete, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useChatLock } from '@/context/chat-lock-context';
import { useChat } from '@/context/chat-context';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

export function ChatLockModal() {
  const {
    showUnlockModal,
    closeUnlockModal,
    hasPasscode,
    unlockSession,
    createPasscode,
    targetConversationId,
    targetPartnerName,
    toggleLockChat,
  } = useChatLock();

  const { setActiveConversationId } = useChat();

  // Mode: 'unlock' or 'setup'
  const isSetupMode = !hasPasscode;
  const [setupStep, setSetupStep] = React.useState<1 | 2>(1); // 1 = enter, 2 = confirm
  const [firstPin, setFirstPin] = React.useState('');
  const [enteredPin, setEnteredPin] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isShaking, setIsShaking] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (showUnlockModal) {
      setEnteredPin('');
      setFirstPin('');
      setSetupStep(1);
      setErrorMsg(null);
      setIsShaking(false);
    }
  }, [showUnlockModal]);

  const triggerShake = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setEnteredPin('');
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleDigit = React.useCallback(
    (digit: string) => {
      if (enteredPin.length >= 4) return;
      const nextPin = enteredPin + digit;
      setEnteredPin(nextPin);
      setErrorMsg(null);

      // When 4 digits reached, process automatically
      if (nextPin.length === 4) {
        if (isSetupMode) {
          if (setupStep === 1) {
            setFirstPin(nextPin);
            setSetupStep(2);
            setEnteredPin('');
          } else {
            // Step 2 confirm
            if (nextPin === firstPin) {
              setIsSubmitting(true);
              createPasscode(nextPin).then(success => {
                setIsSubmitting(false);
                if (success) {
                  if (targetConversationId) {
                    toggleLockChat(targetConversationId, targetPartnerName || undefined);
                    setActiveConversationId(targetConversationId);
                  }
                  closeUnlockModal();
                }
              });
            } else {
              triggerShake('Passcodes did not match. Please start over.');
              setSetupStep(1);
              setFirstPin('');
            }
          }
        } else {
          // Unlock mode
          setIsSubmitting(true);
          unlockSession(nextPin).then(res => {
            setIsSubmitting(false);
            if (res.success) {
              toast.success(
                targetPartnerName
                  ? `Chat with ${targetPartnerName} unlocked!`
                  : 'Chats unlocked!'
              );
              if (targetConversationId) {
                setActiveConversationId(targetConversationId);
              }
            } else {
              triggerShake(res.error || 'Incorrect passcode');
            }
          });
        }
      }
    },
    [
      enteredPin,
      isSetupMode,
      setupStep,
      firstPin,
      createPasscode,
      targetConversationId,
      targetPartnerName,
      toggleLockChat,
      setActiveConversationId,
      closeUnlockModal,
      unlockSession,
    ]
  );

  const handleDelete = () => {
    setEnteredPin(prev => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setEnteredPin('');
    setErrorMsg(null);
  };

  // Physical keyboard support
  React.useEffect(() => {
    if (!showUnlockModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        closeUnlockModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUnlockModal, handleDigit, closeUnlockModal]);

  return (
    <Dialog isOpen={showUnlockModal} onClose={closeUnlockModal}>
      <div className="relative p-6 sm:p-7 max-w-sm w-full mx-auto bg-card/95 border border-border/80 rounded-3xl shadow-2xl backdrop-blur-2xl text-center select-none">
        {/* Close Button */}
        <button
          onClick={closeUnlockModal}
          className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Lock Icon Emblem */}
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-4 shadow-xs">
          <Lock className="w-7 h-7" />
        </div>

        {/* Title & Instructions */}
        <h3 className="text-lg font-bold text-foreground">
          {isSetupMode
            ? setupStep === 1
              ? targetPartnerName
                ? `Lock Chat with ${targetPartnerName}`
                : 'Set 4-Digit Passcode'
              : 'Confirm Your Passcode'
            : targetPartnerName
            ? `Unlock Chat with ${targetPartnerName}`
            : 'Enter Passcode'}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 mb-6">
          {isSetupMode
            ? setupStep === 1
              ? targetPartnerName
                ? `Create a 4-digit PIN to lock and protect your chat with ${targetPartnerName}`
                : 'Create a 4-digit PIN to secure your private chats'
              : 'Re-enter your 4-digit PIN to confirm'
            : targetPartnerName
            ? `Enter your 4-digit PIN to open chat with ${targetPartnerName}`
            : 'Enter your 4-digit PIN to access locked chats'}
        </p>

        {/* 4 Dot Indicators */}
        <div
          className={cn(
            'flex items-center justify-center gap-4 mb-6 transition-transform',
            isShaking && 'animate-[wiggle_0.2s_ease-in-out_infinite]'
          )}
        >
          {[0, 1, 2, 3].map(index => {
            const isFilled = enteredPin.length > index;
            return (
              <div
                key={index}
                className={cn(
                  'w-4 h-4 rounded-full border-2 transition-all duration-200',
                  isFilled
                    ? 'bg-emerald-600 border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500 scale-110 shadow-xs'
                    : 'border-muted-foreground/30 bg-muted/40'
                )}
              />
            );
          })}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="text-xs font-semibold text-rose-500 mb-4 flex items-center justify-center gap-1.5 animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Number Keypad (3x4 Grid) */}
        <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto mb-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-muted/50 hover:bg-muted text-xl font-bold text-foreground transition-all active:scale-95 shadow-2xs hover:shadow-xs flex items-center justify-center cursor-pointer border border-border/40"
            >
              {digit}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            disabled={isSubmitting || enteredPin.length === 0}
            onClick={handleClear}
            className="h-14 rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            Clear
          </button>

          {/* 0 Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-muted/50 hover:bg-muted text-xl font-bold text-foreground transition-all active:scale-95 shadow-2xs hover:shadow-xs flex items-center justify-center cursor-pointer border border-border/40"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            disabled={isSubmitting || enteredPin.length === 0}
            onClick={handleDelete}
            className="h-14 rounded-2xl text-muted-foreground hover:text-rose-500 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            aria-label="Delete last digit"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground/70 mt-4">
          Locked chats are encrypted and never shown without your passcode.
        </p>
      </div>
    </Dialog>
  );
}
