'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { Profile } from '@/types/database';
import { registerDeviceSession, releaseDeviceSession } from '@/lib/device-session';
import { registerPushSubscription } from '@/lib/device-notifications';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Laptop, Smartphone } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isConfigured: boolean;
  deviceLimitError: string | null;
  clearDeviceLimitError: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: { displayName: string; username: string; bio?: string | null; avatarPath?: string | null }) => Promise<{ error?: string }>;
  uploadAvatar: (avatarData: string | null) => Promise<{ success: boolean; avatarUrl?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isConfigured: false,
  deviceLimitError: null,
  clearDeviceLimitError: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfile: async () => ({ error: 'Not implemented' }),
  uploadAvatar: async () => ({ success: false, error: 'Not implemented' }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceLimitError, setDeviceLimitError] = useState<string | null>(null);
  const isConfigured = isSupabaseConfigured();

  const loadProfile = useCallback(async (userId: string) => {
    if (!isConfigured) {
      setProfile(null);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setProfile(data as Profile);
      } else {
        // Auto-sync profile and cross-device account merges
        const res = await fetch('/api/auth/sync-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const resData = await res.json();
        if (resData.profile) {
          setProfile(resData.profile);
        }
      }
    } catch (err) {
      console.warn('Failed to load profile:', err);
    }
  }, [isConfigured]);

  const verifyAndRegisterDevice = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const result = await registerDeviceSession(userId);
      if (!result.allowed) {
        const errorMsg =
          result.message ||
          'Device Limit Reached: A single Vibely account can only be active on 1 Desktop and 1 Mobile simultaneously. Please logout from your other device to sign in here.';
        setDeviceLimitError(errorMsg);
        const supabase = getSupabaseBrowserClient();
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        return false;
      }
      setDeviceLimitError(null);
      // Auto-register device push subscription for real-time background calling
      registerPushSubscription(userId);
      return true;
    } catch (e) {
      console.warn('Device verification error:', e);
      return true;
    }
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    // Check for deep-link tokens in URL hash (from mobile OAuth redirect)
    const initSession = async () => {
      try {
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
      } catch (hashErr) {
        console.warn('Deep link hash token error:', hashErr);
      }

      // Initial session fetch
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (session?.user) {
        const isAllowed = await verifyAndRegisterDevice(session.user.id);
        if (isAllowed) {
          setUser(session.user);
          await loadProfile(session.user.id);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    };

    initSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (session?.user) {
        // On sign in or token refresh, enforce device check
        if (event === 'SIGNED_IN') {
          const isAllowed = await verifyAndRegisterDevice(session.user.id);
          if (!isAllowed) {
            setIsLoading(false);
            return;
          }
        }
        setUser(session.user);
        await loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured, loadProfile, verifyAndRegisterDevice]);

  const signOut = async () => {
    if (user) {
      await releaseDeviceSession(user.id);
    }
    if (isConfigured) {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
  };

  const clearDeviceLimitError = () => {
    setDeviceLimitError(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  const updateProfile = async (data: {
    displayName: string;
    username: string;
    bio?: string | null;
    avatarPath?: string | null;
  }) => {
    if (!profile) return { error: 'No profile found' };

    if (!isConfigured) {
      setProfile(prev => prev ? {
        ...prev,
        display_name: data.displayName,
        username: data.username,
        bio: data.bio ?? null,
        avatar_path: data.avatarPath !== undefined ? data.avatarPath : prev.avatar_path,
      } : null);
      return {};
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const updates: any = {
        display_name: data.displayName,
        username: data.username,
        bio: data.bio ?? null,
        updated_at: new Date().toISOString(),
      };
      if (data.avatarPath !== undefined) {
        updates.avatar_path = data.avatarPath;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        return { error: error.message };
      }

      await refreshProfile();
      return {};
    } catch (err: unknown) {
      return { error: (err as Error)?.message || 'Failed to update profile' };
    }
  };

  const uploadAvatar = async (
    avatarData: string | null
  ): Promise<{ success: boolean; avatarUrl?: string; error?: string }> => {
    if (!profile) return { success: false, error: 'No profile found' };

    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          avatarData,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to update avatar' };
      }

      if (data.profile) {
        setProfile(data.profile);
      } else {
        setProfile(prev => (prev ? { ...prev, avatar_path: data.avatarUrl ?? null } : null));
      }

      await refreshProfile();
      return { success: true, avatarUrl: data.avatarUrl };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error updating avatar' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isConfigured,
        deviceLimitError,
        clearDeviceLimitError,
        signOut,
        refreshProfile,
        updateProfile,
        uploadAvatar,
      }}
    >
      {children}

      {/* Strict Device Limit Reached Modal (1 Desktop + 1 Mobile Maximum) */}
      <Dialog
        isOpen={Boolean(deviceLimitError)}
        onClose={clearDeviceLimitError}
        size="md"
        title="⚠️ Device Limit Exceeded"
        description="Vibely security policy allows each account to be active on only 1 Desktop and 1 Mobile phone simultaneously."
      >
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            {deviceLimitError}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-muted/60 border border-border/50 text-center space-y-1">
              <Laptop className="w-5 h-5 mx-auto text-primary" />
              <p className="font-semibold text-foreground">Desktop Slot</p>
              <p className="text-[10px] text-muted-foreground">Max 1 Active PC / Mac</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/60 border border-border/50 text-center space-y-1">
              <Smartphone className="w-5 h-5 mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="font-semibold text-foreground">Mobile Slot</p>
              <p className="text-[10px] text-muted-foreground">Max 1 Active Phone</p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            To switch devices, logout from your active device or delete your account in Settings.
          </p>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={clearDeviceLimitError}
              className="rounded-xl px-5 bg-[#005C4B] hover:bg-[#004D3F] text-white"
            >
              Understood
            </Button>
          </div>
        </div>
      </Dialog>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
