'use client';

import * as React from 'react';
import { ShieldCheck, Eye, Keyboard, BellRing, Trash2, Laptop, AlertTriangle, Zap, Bell, PhoneCall, MessageSquareCheck, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import {
  getNotificationPermission,
  requestNotificationPermission,
  showIncomingCallNotification,
  showChatMessageNotification,
  dismissCallNotification,
} from '@/lib/device-notifications';

export default function PrivacySettingsPage() {
  const { signOut } = useAuth();
  const router = useRouter();

  const [notifPermission, setNotifPermission] = React.useState<NotificationPermission>('default');
  const [readReceipts, setReadReceipts] = React.useState(true);
  const [typingIndicators, setTypingIndicators] = React.useState(true);
  const [soundEffects, setSoundEffects] = React.useState(true);
  const [antiBusyMode, setAntiBusyMode] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vibely_anti_busy_mode') === 'true';
    }
    return false;
  });
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      toast.success('Call & Message notifications enabled!');
      // Show confirmation test notification
      showChatMessageNotification({
        senderName: 'Vibely Sanctuary',
        messageText: '🎉 Call & Message notifications are active!',
        conversationId: 'system_test',
      });
    } else if (perm === 'denied') {
      toast.error('Notification permission was blocked in browser settings.');
    }
  };

  const handleTestCallNotification = async () => {
    if (notifPermission !== 'granted') {
      await handleRequestPermission();
      return;
    }
    toast.info('Simulating incoming call notification (5 seconds)...');
    showIncomingCallNotification({
      callerName: 'Alex (Test Call)',
      callType: 'voice',
      callId: 'test_call_' + Date.now(),
    });
    setTimeout(() => {
      dismissCallNotification();
    }, 5000);
  };

  const handleTestMessageNotification = async () => {
    if (notifPermission !== 'granted') {
      await handleRequestPermission();
      return;
    }
    toast.success('Sending test message notification...');
    showChatMessageNotification({
      senderName: 'Alex',
      messageText: 'Hey there! How is your day going? 💕',
      conversationId: 'test_conv',
    });
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setTimeout(async () => {
      await signOut();
      router.push('/');
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Privacy & Security</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your real-time presence, read receipts, and session security
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-6">
        {/* Device & Push Notifications for Calls & Messages */}
        <div className="space-y-3 pb-6 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Call & Message Notifications</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rings and vibrates your phone when a call or message arrives
              </p>
            </div>
            <span
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border capitalize ${
                notifPermission === 'granted'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : notifPermission === 'denied'
                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
              }`}
            >
              {notifPermission === 'granted' ? 'Active' : notifPermission === 'denied' ? 'Blocked' : 'Not Allowed'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/40 space-y-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              When enabled, incoming voice and video calls will trigger notifications and phone vibration just like an actual call, and new messages will pop up with audio chimes.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {notifPermission !== 'granted' ? (
                <Button
                  size="sm"
                  onClick={handleRequestPermission}
                  className="rounded-xl text-xs font-semibold bg-[#005C4B] hover:bg-[#004D3F] text-white shadow-xs"
                >
                  <Bell className="w-3.5 h-3.5 mr-1.5" />
                  Enable Call & Message Notifications
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestCallNotification}
                    className="rounded-xl text-xs font-medium border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
                    Test Call Ring & Vibrate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestMessageNotification}
                    className="rounded-xl text-xs font-medium border-border hover:bg-muted cursor-pointer"
                  >
                    <MessageSquareCheck className="w-3.5 h-3.5 mr-1.5" />
                    Test Message Chime
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Real-Time Communication Preferences */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Real-Time Privacy</h3>

          <div className="space-y-3">
            {/* Read Receipts */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40">
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Read Receipts</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Let your friend see when you have read their messages (blue double checkmarks)
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={readReceipts}
                onChange={e => setReadReceipts(e.target.checked)}
                className="w-5 h-5 rounded-md text-emerald-600 accent-[#005C4B] cursor-pointer"
              />
            </div>

            {/* Typing Indicators */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40">
              <div className="flex items-start gap-3">
                <Keyboard className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Typing Indicators</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Broadcast a subtle typing indicator when composing a message
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={typingIndicators}
                onChange={e => setTypingIndicators(e.target.checked)}
                className="w-5 h-5 rounded-md text-emerald-600 accent-[#005C4B] cursor-pointer"
              />
            </div>

            {/* In-App Sounds */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40">
              <div className="flex items-start gap-3">
                <BellRing className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Notification Chimes</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Play audio feedback when new messages or media arrive
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundEffects}
                onChange={e => setSoundEffects(e.target.checked)}
                className="w-5 h-5 rounded-md text-emerald-600 accent-[#005C4B] cursor-pointer"
              />
            </div>

            {/* Anti-Busy Stealth Mode */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40">
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Anti-Busy Mode (WhatsApp Busy Bypass)</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Bypasses Android in-call telecom lock during Vibely calls so WhatsApp callers won't see you as busy or on another call (recommended with earphones)
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={antiBusyMode}
                onChange={e => {
                  setAntiBusyMode(e.target.checked);
                  localStorage.setItem('vibely_anti_busy_mode', String(e.target.checked));
                }}
                className="w-5 h-5 rounded-md text-emerald-600 accent-[#005C4B] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Active Session Info */}
        <div className="pt-6 border-t border-border/60 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Active Session</h3>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Current Web Browser</p>
                <p className="text-[11px] text-muted-foreground">Authenticated via Supabase SSR</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Active Now
            </span>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-6 border-t border-border/60 space-y-3">
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </h3>
          <p className="text-xs text-muted-foreground">
            Permanent account and personal data deletion
          </p>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-xl gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account & Conversations
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        size="md"
        title="Delete Account?"
        description="This action will permanently delete your account, messages, reactions, and uploaded attachments. This cannot be undone."
      >
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            isLoading={isDeleting}
            onClick={handleDeleteAccount}
          >
            Permanently Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
