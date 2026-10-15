'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Check, Copy, User, AtSign, Sparkles, Hash } from 'lucide-react';
import { profileUpdateSchema, ProfileUpdateFormData } from '@/lib/validations/auth';
import { useAuth } from '@/context/auth-context';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { AvatarPickerModal } from '@/components/chat/avatar-picker-modal';

export default function ProfileSettingsPage() {
  const { profile, updateProfile, isConfigured } = useAuth();
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [copiedDuoId, setCopiedDuoId] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(false);

  const username = profile?.username ? `@${profile.username}` : '';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileUpdateFormData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      displayName: profile?.display_name || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
    },
  });

  React.useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.display_name,
        username: profile.username || '',
        bio: profile.bio || '',
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: ProfileUpdateFormData) => {
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const res = await updateProfile({
      displayName: data.displayName,
      username: data.username,
      bio: data.bio,
    });

    setIsSaving(false);
    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSuccessMessage('Profile changes saved successfully');
      toast.success('Profile updated');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const copyUsername = () => {
    if (!username) return;
    navigator.clipboard.writeText(username);
    setCopiedDuoId(true);
    toast.success('Username copied to clipboard');
    setTimeout(() => setCopiedDuoId(false), 2000);
  };

  const copyUserId = () => {
    if (profile?.id) {
      navigator.clipboard.writeText(profile.id);
      setCopiedId(true);
      toast.success('UUID copied to clipboard');
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Profile Information</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage how your partner sees you in Vibely
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-6">
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs border border-emerald-500/20 font-medium">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium">
            {errorMessage}
          </div>
        )}

        {/* Avatar Section */}
        <div className="flex items-center gap-4 pb-6 border-b border-border/60">
          <div
            onClick={() => setIsAvatarPickerOpen(true)}
            className="relative group cursor-pointer"
          >
            <Avatar
              src={profile?.avatar_path}
              name={profile?.display_name || 'User'}
              size="xl"
              className="w-20 h-20 text-2xl ring-2 ring-emerald-500/30 group-hover:ring-emerald-500/60 transition-all"
            />
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
              <Camera className="w-6 h-6" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-600 text-white shadow-md border-2 border-background">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground">Profile Picture</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select an image from gallery or take a live photo
            </p>
            <button
              type="button"
              onClick={() => setIsAvatarPickerOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Change Photo</span>
            </button>
          </div>
        </div>

        <AvatarPickerModal
          isOpen={isAvatarPickerOpen}
          onClose={() => setIsAvatarPickerOpen(false)}
        />

        {/* Profile Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Display Name
            </label>
            <Input
              placeholder="Enter your display name"
              leftIcon={<User className="w-4 h-4" />}
              error={errors.displayName?.message}
              {...register('displayName')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Username
            </label>
            <Input
              placeholder="Enter your username"
              leftIcon={<AtSign className="w-4 h-4" />}
              error={errors.username?.message}
              {...register('username')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Bio
            </label>
            <Textarea
              placeholder="A short note or favorite quote..."
              rows={3}
              error={errors.bio?.message}
              {...register('bio')}
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              isLoading={isSaving}
              className="rounded-2xl font-semibold bg-[#005C4B] hover:bg-[#004D3F] text-white shadow-sm px-6 h-10"
            >
              Save Changes
            </Button>
          </div>
        </form>

        {/* Account Details & Vibe Connection ID */}
        <div className="pt-6 border-t border-border/60 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Account Identification</h4>
              <p className="text-[11px] text-muted-foreground">
                Your credentials and unique address for connecting with partners.
              </p>
            </div>
            <Sparkles className="w-4 h-4 text-primary" />
          </div>

          {/* Unique Username Badge */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Your Username
              </span>
              <button
                onClick={copyUsername}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedDuoId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDuoId ? 'Copied!' : 'Copy Username'}</span>
              </button>
            </div>
            <div className="font-mono text-base font-bold text-foreground tracking-wide">
              {username || 'No username set'}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Share your @username with your partner. They can enter it to find and connect with you directly on Vibely.
            </p>
          </div>

          {/* Database UUID */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60 text-xs">
            <div className="min-w-0">
              <span className="text-[11px] text-muted-foreground block">System UUID</span>
              <span className="font-mono text-xs text-foreground truncate block">
                {profile?.id || '—'}
              </span>
            </div>
            <button
              onClick={copyUserId}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Copy UUID"
            >
              {copiedId ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Account created on{' '}
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : 'Recently'}
          </p>
        </div>
      </div>
    </div>
  );
}
