'use client';

import * as React from 'react';
import {
  ShieldCheck,
  Eye,
  Keyboard,
  BellRing,
  Trash2,
  Laptop,
  Smartphone,
  AlertTriangle,
  Zap,
  Bell,
  PhoneCall,
  MessageSquareCheck,
  Check,
  Play,
  Square,
  Volume2,
  VolumeX,
  Save,
  LogOut,
  Lock,
  Unlock,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { useChatLock } from '@/context/chat-lock-context';
import { useRouter } from 'next/navigation';
import {
  getNotificationPermission,
  requestNotificationPermission,
} from '@/lib/device-notifications';
import {
  AVAILABLE_RINGTONES,
  AVAILABLE_NOTIFICATION_SOUNDS,
  getSelectedRingtone,
  setSelectedRingtone,
  getSelectedNotificationSound,
  setSelectedNotificationSound,
  previewRingtone,
  stopRingtonePreview,
  previewNotificationSound,
} from '@/lib/ringtone';
import {
  fetchRegisteredDevices,
  disconnectRemoteDevice,
  purgeAccountPermanently,
  getDeviceId,
  RegisteredDevices,
} from '@/lib/device-session';

export default function PrivacySettingsPage() {
  const { user, signOut } = useAuth();
  const { conversations } = useChat();
  const {
    hasPasscode,
    lockedConversationIds,
    openUnlockModal,
    lockSession,
    isUnlocked,
    unlockChatPermanently,
  } = useChatLock();
  const router = useRouter();

  const [notifPermission, setNotifPermission] = React.useState<NotificationPermission>('default');
  const [readReceipts, setReadReceipts] = React.useState(true);
  const [typingIndicators, setTypingIndicators] = React.useState(true);
  const [antiBusyMode, setAntiBusyMode] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vibely_anti_busy_mode') === 'true';
    }
    return false;
  });

  // Sound Preferences State
  const [selectedRingtone, setSelectedRingtoneState] = React.useState<string>('romantic');
  const [selectedNotifSound, setSelectedNotifSoundState] = React.useState<string>('pop');
  const [activePreviewRingtone, setActivePreviewRingtone] = React.useState<string | null>(null);
  const [activePreviewNotif, setActivePreviewNotif] = React.useState<string | null>(null);
  const [isSavingSounds, setIsSavingSounds] = React.useState(false);

  // Device Management State
  const [registeredDevices, setRegisteredDevices] = React.useState<RegisteredDevices>({});
  const [isLoadingDevices, setIsLoadingDevices] = React.useState(true);
  const [disconnectingType, setDisconnectingType] = React.useState<'desktop' | 'mobile' | null>(null);
  const currentDeviceId = React.useMemo(() => getDeviceId(), []);

  // Account Deletion State
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    setNotifPermission(getNotificationPermission());
    setSelectedRingtoneState(getSelectedRingtone());
    setSelectedNotifSoundState(getSelectedNotificationSound());

    if (user?.id) {
      loadRegisteredDevices(user.id);
    }
  }, [user?.id]);

  const loadRegisteredDevices = async (userId: string) => {
    setIsLoadingDevices(true);
    try {
      const devices = await fetchRegisteredDevices(userId);
      setRegisteredDevices(devices);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      toast.success('Call & Message notifications enabled!');
    } else if (perm === 'denied') {
      toast.error('Notification permission was blocked in browser settings.');
    }
  };

  // Ringtone Preview
  const handlePlayRingtonePreview = (id: string) => {
    if (activePreviewRingtone === id) {
      stopRingtonePreview();
      setActivePreviewRingtone(null);
      return;
    }
    setActivePreviewRingtone(id);
    previewRingtone(id);
    setTimeout(() => {
      setActivePreviewRingtone(prev => (prev === id ? null : prev));
    }, 2300);
  };

  // Notification Sound Preview
  const handlePlayNotifPreview = (id: string) => {
    setActivePreviewNotif(id);
    previewNotificationSound(id);
    setTimeout(() => {
      setActivePreviewNotif(prev => (prev === id ? null : prev));
    }, 600);
  };

  // Save Sound Preferences
  const handleSaveSoundPreferences = () => {
    setIsSavingSounds(true);
    try {
      setSelectedRingtone(selectedRingtone);
      setSelectedNotificationSound(selectedNotifSound);
      stopRingtonePreview();
      setActivePreviewRingtone(null);
      toast.success('Sound preferences saved successfully!');
    } catch {
      toast.error('Failed to save sound preferences');
    } finally {
      setTimeout(() => setIsSavingSounds(false), 300);
    }
  };

  // Disconnect Registered Device
  const handleDisconnectDevice = async (type: 'desktop' | 'mobile') => {
    if (!user?.id) return;
    setDisconnectingType(type);
    try {
      const success = await disconnectRemoteDevice(user.id, type);
      if (success) {
        toast.success(`${type === 'desktop' ? 'Desktop' : 'Mobile'} device disconnected. Slot is now free.`);
        await loadRegisteredDevices(user.id);
        // If current device was disconnected, sign out
        const existing = registeredDevices[type];
        if (existing?.deviceId === currentDeviceId) {
          await signOut();
          router.push('/login');
        }
      } else {
        toast.error('Failed to disconnect device slot');
      }
    } catch {
      toast.error('Failed to disconnect device slot');
    } finally {
      setDisconnectingType(null);
    }
  };

  // Permanent Account Deletion
  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setIsDeleting(true);
    try {
      await purgeAccountPermanently(user.id);
      toast.success('Account and all associated data permanently deleted.');
      await signOut();
      router.push('/');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Privacy & Security</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your real-time presence, device limits, ringtones, and notification sounds
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-8">
        {/* SECTION 1: STRICT DEVICE LIMITS (1 DESKTOP + 1 MOBILE ONLY) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Registered Devices (Strict 1 Desktop + 1 Mobile)</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only 1 Desktop and 1 Mobile allowed simultaneously per account. Third devices are blocked.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong>Security Rule:</strong> Once 1 Desktop and 1 Mobile are linked, no other device can log in until an active device is logged out or disconnected below, or this account is permanently deleted.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Desktop Slot */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Desktop Slot</h4>
                    <p className="text-[11px] text-muted-foreground">Max 1 Active PC / Mac</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    registeredDevices.desktop
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {registeredDevices.desktop ? 'Slot Occupied' : 'Slot Available'}
                </span>
              </div>

              {registeredDevices.desktop ? (
                <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium flex items-center gap-1.5">
                      {registeredDevices.desktop.name}
                      {registeredDevices.desktop.deviceId === currentDeviceId && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-primary/10 text-primary font-bold">
                          THIS DEVICE
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Active since: {new Date(registeredDevices.desktop.registeredAt).toLocaleDateString()}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={disconnectingType === 'desktop'}
                    onClick={() => handleDisconnectDevice('desktop')}
                    className="w-full text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30 rounded-xl"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1.5" />
                    Disconnect Desktop Slot
                  </Button>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic pt-2 border-t border-border/40">
                  No desktop currently logged in. You can log in from 1 Desktop PC.
                </p>
              )}
            </div>

            {/* Mobile Slot */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Mobile Slot</h4>
                    <p className="text-[11px] text-muted-foreground">Max 1 Active Phone</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    registeredDevices.mobile
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {registeredDevices.mobile ? 'Slot Occupied' : 'Slot Available'}
                </span>
              </div>

              {registeredDevices.mobile ? (
                <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-medium flex items-center gap-1.5">
                      {registeredDevices.mobile.name}
                      {registeredDevices.mobile.deviceId === currentDeviceId && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 font-bold">
                          THIS DEVICE
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Active since: {new Date(registeredDevices.mobile.registeredAt).toLocaleDateString()}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={disconnectingType === 'mobile'}
                    onClick={() => handleDisconnectDevice('mobile')}
                    className="w-full text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30 rounded-xl"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1.5" />
                    Disconnect Mobile Slot
                  </Button>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic pt-2 border-t border-border/40">
                  No mobile phone currently logged in. You can log in from 1 Mobile.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: CUSTOM RINGTONES & NOTIFICATION SOUNDS (WITH ACTIVE SAVE BUTTON & SILENT MODE) */}
        <div className="pt-6 border-t border-border/60 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Ringtones & Notification Sounds</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customize your incoming call melody and message chimes, or set to Silent
              </p>
            </div>

            {/* ACTIVE SAVE BUTTON */}
            <Button
              size="sm"
              isLoading={isSavingSounds}
              onClick={handleSaveSoundPreferences}
              className="rounded-xl px-4 text-xs font-semibold bg-[#005C4B] hover:bg-[#004D3F] text-white shadow-sm shrink-0 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Sound Preferences
            </Button>
          </div>

          {/* Incoming Call Ringtone Selection */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <PhoneCall className="w-3.5 h-3.5 text-primary" />
              <span>Incoming Call Ringtone</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AVAILABLE_RINGTONES.map(tone => {
                const isSelected = selectedRingtone === tone.id;
                const isPlaying = activePreviewRingtone === tone.id;

                return (
                  <div
                    key={tone.id}
                    onClick={() => setSelectedRingtoneState(tone.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-foreground ring-1 ring-emerald-500/30'
                        : 'bg-muted/30 border-border/50 hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-emerald-600 bg-[#005C4B] text-white'
                            : 'border-muted-foreground/40 bg-background'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-foreground font-semibold' : ''}`}>
                          {tone.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{tone.description}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handlePlayRingtonePreview(tone.id);
                      }}
                      className="p-1.5 rounded-xl hover:bg-background/80 text-foreground/80 hover:text-foreground transition-colors shrink-0"
                      title={isPlaying ? 'Stop Preview' : 'Preview Ringtone'}
                    >
                      {tone.isSilent ? (
                        <VolumeX className="w-4 h-4 text-muted-foreground" />
                      ) : isPlaying ? (
                        <Square className="w-4 h-4 text-rose-500 fill-rose-500" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Message Notification Sound Selection */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <MessageSquareCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Chat Message Chime</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AVAILABLE_NOTIFICATION_SOUNDS.map(sound => {
                const isSelected = selectedNotifSound === sound.id;
                const isPlaying = activePreviewNotif === sound.id;

                return (
                  <div
                    key={sound.id}
                    onClick={() => setSelectedNotifSoundState(sound.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-foreground ring-1 ring-emerald-500/30'
                        : 'bg-muted/30 border-border/50 hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-emerald-600 bg-[#005C4B] text-white'
                            : 'border-muted-foreground/40 bg-background'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-foreground font-semibold' : ''}`}>
                          {sound.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{sound.description}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handlePlayNotifPreview(sound.id);
                      }}
                      className="p-1.5 rounded-xl hover:bg-background/80 text-foreground/80 hover:text-foreground transition-colors shrink-0"
                      title="Preview Chime"
                    >
                      {sound.isSilent ? (
                        <VolumeX className="w-4 h-4 text-muted-foreground" />
                      ) : isPlaying ? (
                        <Square className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 3: DEVICE & PUSH NOTIFICATIONS FOR CALLS & MESSAGES */}
        <div className="pt-6 border-t border-border/60 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Device Calling & Message Alerts</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rings and vibrates phone in background when calls or messages arrive
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
              When enabled, incoming voice and video calls will trigger full phone vibration and status alerts even when you are outside the app, and new messages pop up with single chimes without echoing.
            </p>

            <div className="pt-1">
              {notifPermission !== 'granted' ? (
                <Button
                  size="sm"
                  onClick={handleRequestPermission}
                  className="rounded-xl text-xs font-semibold bg-[#005C4B] hover:bg-[#004D3F] text-white shadow-xs cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 mr-1.5" />
                  Enable Call & Message Notifications
                </Button>
              ) : (
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3.5 py-2 rounded-xl border border-emerald-500/20">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Call notifications and background ringing are fully active on this device.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 4: REAL-TIME PRIVACY PREFERENCES */}
        <div className="pt-6 border-t border-border/60 space-y-4">
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
                    Broadcast subtle typing status when writing a message
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

            {/* Anti-Busy Stealth Mode */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40">
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Anti-Busy Mode (Call Privacy Bypass)</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Prevents external callers from seeing you as busy during Vibely calls
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

        {/* SECTION 5: CHAT LOCK & PRIVACY PASSCODE */}
        <div className="pt-6 border-t border-border/60 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Chat Lock & Privacy Passcode</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lock personal conversations behind a 4-digit PIN. Locked chats are hidden from the chat list.
              </p>
            </div>
            <span
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                hasPasscode
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {hasPasscode ? 'Passcode Active' : 'Not Set'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-foreground">
                  {lockedConversationIds.length === 0
                    ? 'No chats currently locked'
                    : `${lockedConversationIds.length} ${
                        lockedConversationIds.length === 1 ? 'chat' : 'chats'
                      } locked and hidden`}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  You can lock any single conversation directly using the lock icon in the chat header or the sidebar.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => openUnlockModal()}
                  className="rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-xs"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                  {hasPasscode ? 'Change Passcode' : 'Set 4-Digit Passcode'}
                </Button>

                {isUnlocked && lockedConversationIds.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={lockSession}
                    className="rounded-xl text-xs font-semibold border-border cursor-pointer active:scale-95"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1.5" />
                    Lock Now
                  </Button>
                )}
              </div>
            </div>

            {/* Individual Locked Chats List */}
            {lockedConversationIds.length > 0 && (
              <div className="pt-3 border-t border-border/40 space-y-2">
                <h5 className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  Individually Protected Chats ({lockedConversationIds.length})
                </h5>

                <div className="space-y-2">
                  {conversations
                    .filter(c => lockedConversationIds.includes(c.id))
                    .map(conv => {
                      const other = conv.otherUser;
                      return (
                        <div
                          key={conv.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/60"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <Avatar
                              src={other?.avatar_path}
                              name={other?.display_name || 'Partner'}
                              size="sm"
                              className="w-8 h-8 text-xs shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                                <span>{other?.display_name || 'Partner'}</span>
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                  Locked
                                </span>
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate">
                                {other?.username ? `@${other.username}` : ''}
                              </p>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unlockChatPermanently(conv.id, other?.display_name)}
                            className="h-7 px-2.5 rounded-lg text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30 gap-1 shrink-0 cursor-pointer active:scale-95"
                          >
                            <Unlock className="w-3 h-3" />
                            <span>Unlock</span>
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 6: DANGER ZONE - PERMANENT ACCOUNT DELETION */}
        <div className="pt-6 border-t border-border/60 space-y-3">
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Permanent Account Deletion
          </h3>
          <p className="text-xs text-muted-foreground">
            Permanently erase all messages, attachments, profile info, and release all registered devices.
          </p>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-xl gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account Permanently
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        size="md"
        title="Permanently Delete Account?"
        description="This action cannot be undone. All messages, media, friendships, and device registrations will be permanently purged from Vibely servers."
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
