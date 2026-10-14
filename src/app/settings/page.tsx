'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Shield,
  Palette,
  Bell,
  Lock,
  Key,
  HelpCircle,
  LogOut,
  ChevronRight,
  Copy,
  Check,
  Camera,
  Heart,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useRomanticFeatures } from '@/lib/romantic-features';
import { AvatarPickerModal } from '@/components/chat/avatar-picker-modal';

export default function SettingsHubPage() {
  const { user, profile, signOut } = useAuth();
  const { daysTogether } = useRomanticFeatures();
  const router = useRouter();

  const [copied, setCopied] = React.useState(false);
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = React.useState(false);

  const myUsername = profile?.username ? `@${profile.username}` : '';

  const handleCopyUsername = () => {
    if (!myUsername) return;
    navigator.clipboard.writeText(myUsername);
    setCopied(true);
    toast.success('Username copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push('/login');
    } catch {
      toast.error('Failed to log out');
      setIsLoggingOut(false);
    }
  };

  const settingsMenu = [
    {
      title: 'Account',
      subtitle: 'Profile name, handle, bio, and credentials',
      href: '/settings/profile',
      icon: Key,
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Privacy',
      subtitle: 'Last seen, online status, read receipts (blue ticks)',
      href: '/settings/privacy',
      icon: Lock,
      iconBg: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
    },
    {
      title: 'Chats & Appearance',
      subtitle: 'Deep Emerald theme, wallpaper, relationship date counter',
      href: '/settings/appearance',
      icon: Palette,
      iconBg: 'bg-green-600/15 text-green-700 dark:text-green-400',
    },
    {
      title: 'Notifications & Sounds',
      subtitle: 'Message tones, real-time typing indicators, chimes',
      href: '/settings/privacy',
      icon: Bell,
      iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* WhatsApp Profile Card Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border/80 shadow-xs space-y-4">
        <div className="flex items-center gap-4">
          <div
            onClick={() => setIsAvatarPickerOpen(true)}
            className="relative group shrink-0 cursor-pointer"
          >
            <Avatar
              src={profile?.avatar_path}
              name={profile?.display_name || 'User'}
              size="xl"
              className="ring-2 ring-emerald-500/30 group-hover:ring-emerald-500/60 transition-all"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAvatarPickerOpen(true);
              }}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition-colors cursor-pointer"
              title="Change photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground truncate">
                {profile?.display_name || 'My Profile'}
              </h2>
              {daysTogether !== null && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                  <Heart className="w-2.5 h-2.5 fill-current" />
                  Day {daysTogether}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {profile?.bio || 'Hey there! I am using Vibely.'}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                {myUsername || '@user'}
              </span>

              <button
                type="button"
                onClick={handleCopyUsername}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Copy username"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <Link
            href="/settings/profile"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 hidden sm:block"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* WhatsApp Settings Options List */}
      <div className="rounded-3xl bg-card border border-border/80 shadow-xs divide-y divide-border/40 overflow-hidden">
        {settingsMenu.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              className="flex items-center gap-3.5 p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${item.iconBg}`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {item.subtitle}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* Security & Encryption Information Card */}
      <div className="p-4 rounded-3xl bg-emerald-500/5 dark:bg-[#182229] border border-emerald-500/20 flex items-start gap-3 shadow-2xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-foreground">
            End-to-End Encrypted Sanctuary
          </p>
          <p className="text-muted-foreground leading-relaxed text-[11px]">
            Your personal messages, voice notes, and media never leave your device unencrypted. No third parties, not even Vibely, can intercept them.
          </p>
        </div>
      </div>

      {/* Log Out Option (Inside Settings with confirmation) */}
      <div className="rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          className="w-full flex items-center gap-3.5 p-4 text-left hover:bg-rose-500/10 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-rose-600">
              Log Out
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              Securely sign out of this device
            </p>
          </div>

          <ChevronRight className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      <Dialog
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        size="sm"
        title="Log out of Vibely?"
        description="Are you sure you want to log out? You will need to sign in again to access your private chats."
      >
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLogoutModal(false)}
            disabled={isLoggingOut}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleSignOut}
            isLoading={isLoggingOut}
            className="rounded-xl font-semibold bg-rose-600 hover:bg-rose-700"
          >
            Log Out
          </Button>
        </div>
      </Dialog>

      <AvatarPickerModal
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
      />
    </div>
  );
}
