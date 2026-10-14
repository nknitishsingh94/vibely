'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isConfigured: boolean;
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
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfile: async () => ({ error: 'Not implemented' }),
  uploadAvatar: async () => ({ success: false, error: 'Not implemented' }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    if (!isConfigured) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    // Initial session fetch
    supabase.auth.getSession().then(async ({ data }: { data: { session: any } }) => {
      const session = data?.session;
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured, loadProfile]);

  const signOut = async () => {
    if (isConfigured) {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
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
        signOut,
        refreshProfile,
        updateProfile,
        uploadAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
