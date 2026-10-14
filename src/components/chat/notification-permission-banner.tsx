'use client';

import * as React from 'react';
import { BellRing, Volume2, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  playMessageNotificationSound,
  registerPushSubscription,
} from '@/lib/device-notifications';
import { unlockAudioSession } from '@/lib/ringtone';
import { toast } from '@/components/ui/toast';

interface NotificationPermissionBannerProps {
  className?: string;
  compact?: boolean;
}

export function NotificationPermissionBanner({
  className = '',
  compact = false,
}: NotificationPermissionBannerProps) {
  const { profile } = useAuth();
  const [permission, setPermission] = React.useState<NotificationPermission>('granted');
  const [isDismissed, setIsDismissed] = React.useState(false);
  const [isRequesting, setIsRequesting] = React.useState(false);

  React.useEffect(() => {
    if (!isNotificationSupported()) {
      return;
    }
    const current = getNotificationPermission();
    setPermission(current);

    if (current === 'granted' && profile?.id) {
      registerPushSubscription(profile.id);
    }

    // If dismissed in this session, check sessionStorage
    try {
      const dismissed = sessionStorage.getItem('vibely_notif_banner_dismissed');
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    } catch {}
  }, [profile?.id]);

  if (permission === 'granted' || isDismissed) {
    return null;
  }

  const handleEnable = async () => {
    setIsRequesting(true);
    unlockAudioSession();

    try {
      const result = await requestNotificationPermission();
      setPermission(result);

      if (result === 'granted') {
        if (profile?.id) {
          registerPushSubscription(profile.id);
        }
        // Play gentle chime to confirm audio & notification readiness
        playMessageNotificationSound();
        toast.success('🔔 Real-time calling ringtone & notifications enabled!');
      } else if (result === 'denied') {
        toast.error('Notifications blocked in browser settings. Please allow in site permissions to hear ringing calls.');
      }
    } catch {
      toast.error('Could not request notification permissions.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('vibely_notif_banner_dismissed', 'true');
    } catch {}
  };

  if (compact) {
    return (
      <div
        className={`mx-3 my-2 p-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-teal-500/15 border border-emerald-500/30 shadow-xs flex items-center justify-between gap-2.5 animate-in fade-in select-none ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <BellRing className="w-4 h-4 animate-bounce" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">
              Enable Calling Ringtone
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              Get loud ringtones & call alerts on your phone
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={isRequesting}
            onClick={handleEnable}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer transition-all active:scale-95 shadow-xs disabled:opacity-50"
          >
            {isRequesting ? 'Enabling...' : 'Turn On'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative mx-3.5 my-2.5 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-600/15 via-emerald-500/10 to-teal-600/10 border border-emerald-500/30 shadow-sm animate-in fade-in select-none ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20 mt-0.5">
            <BellRing className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-foreground">
                Turn On Real-Time Calling & Alerts
              </h4>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                Recommended
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Allow notifications so your phone rings out loud for incoming calls and vibrates when you get new messages.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer shrink-0"
          title="Dismiss for now"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-emerald-500/15">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Real-time Web Audio + Vibration</span>
        </div>

        <button
          type="button"
          disabled={isRequesting}
          onClick={handleEnable}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm shadow-emerald-600/30 flex items-center gap-1.5 disabled:opacity-50"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>{isRequesting ? 'Enabling...' : 'Allow Calling Alerts'}</span>
        </button>
      </div>
    </div>
  );
}
