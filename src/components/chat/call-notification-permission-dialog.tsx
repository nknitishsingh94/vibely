'use client';

import * as React from 'react';
import { BellRing, PhoneCall, Volume2, X } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerPushSubscription,
  playMessageNotificationSound,
} from '@/lib/device-notifications';
import { unlockAudioSession } from '@/lib/ringtone';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

export function CallNotificationPermissionDialog() {
  const { user } = useAuth();
  const [permission, setPermission] = React.useState<NotificationPermission>('granted');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isEnabling, setIsEnabling] = React.useState(false);

  React.useEffect(() => {
    if (!user?.id || !isNotificationSupported()) return;

    const currentPerm = getNotificationPermission();
    setPermission(currentPerm);

    // If already granted, immediately register & verify push subscription on Supabase
    if (currentPerm === 'granted') {
      registerPushSubscription(user.id);
      return;
    }

    // If permission is default (never asked), check if user dismissed it in this session
    if (currentPerm === 'default') {
      const dismissed = sessionStorage.getItem('vibely_call_perm_dismissed');
      if (dismissed !== 'true') {
        // Small delay so page renders first
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [user?.id]);

  if (!user || permission === 'granted' || !isOpen) {
    return null;
  }

  const handleEnable = async () => {
    setIsEnabling(true);
    unlockAudioSession();

    try {
      const res = await requestNotificationPermission();
      setPermission(res);

      if (res === 'granted') {
        if (user?.id) {
          await registerPushSubscription(user.id);
        }
        playMessageNotificationSound(true);
        toast.success('🔔 Incoming call ringing is now enabled!');
        setIsOpen(false);
      } else if (res === 'denied') {
        toast.error('Notifications blocked in browser settings. Please allow notifications in site permissions.');
        setIsOpen(false);
      }
    } catch {
      toast.error('Could not request notification permission.');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    try {
      sessionStorage.setItem('vibely_call_perm_dismissed', 'true');
    } catch {}
  };

  return (
    <div className="fixed inset-x-0 bottom-0 sm:bottom-6 sm:right-6 sm:left-auto z-50 p-4 sm:p-0 max-w-md w-full animate-in slide-in-from-bottom duration-300">
      <div className="p-5 rounded-3xl bg-card border border-emerald-500/40 shadow-2xl space-y-3.5 backdrop-blur-xl bg-white/95 dark:bg-[#082219]/95 ring-1 ring-emerald-500/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Ring Phone on Incoming Calls
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Rings and vibrates when app is closed or phone is locked
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Allow notifications so your phone rings out loud when your partner calls you, even if you are outside the app.
        </p>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="rounded-xl text-xs text-muted-foreground"
          >
            Later
          </Button>

          <Button
            size="sm"
            isLoading={isEnabling}
            onClick={handleEnable}
            className="rounded-xl text-xs font-bold bg-[#005C4B] hover:bg-[#004D3F] text-white shadow-sm px-4 cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5 mr-1.5" />
            Allow Call Ringing
          </Button>
        </div>
      </div>
    </div>
  );
}
