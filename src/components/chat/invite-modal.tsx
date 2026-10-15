'use client';

import * as React from 'react';
import {
  Copy,
  Check,
  Link as LinkIcon,
  Clock,
  Trash2,
  Sparkles,
  UserCheck,
  Search,
  AlertCircle,
  User,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toast';
import { generateSecureToken, hashToken } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Invitation } from '@/types/database';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'username' | 'link';
}

export function InviteModal({ isOpen, onClose, defaultTab = 'username' }: InviteModalProps) {
  const { profile, isConfigured } = useAuth();
  const { connectWithPartner } = useChat();

  const [activeTab, setActiveTab] = React.useState<'username' | 'link'>(defaultTab);

  // Username connect state
  const [targetIdentifier, setTargetIdentifier] = React.useState('');
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [connectError, setConnectError] = React.useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = React.useState<string | null>(null);
  const [copiedMyId, setCopiedMyId] = React.useState(false);

  // Invite link state
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [generatedUrl, setGeneratedUrl] = React.useState<string | null>(null);
  const [expiryHours, setExpiryHours] = React.useState('168'); // 7 days default
  const [isGeneratingLink, setIsGeneratingLink] = React.useState(false);
  const [myInvites, setMyInvites] = React.useState<Invitation[]>([]);

  const myUsername = profile?.username ? `@${profile.username}` : '';

  const loadInvites = React.useCallback(async () => {
    if (!isConfigured || !profile) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from('invitations')
        .select('*')
        .eq('created_by', profile.id)
        .is('used_at', null)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (data) setMyInvites(data);
    } catch (err) {
      console.warn('Failed to load invitations:', err);
    }
  }, [isConfigured, profile]);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setConnectError(null);
      setConnectSuccess(null);
      setTargetIdentifier('');
      loadInvites();
    } else {
      setGeneratedUrl(null);
      setCopiedLink(false);
      setCopiedMyId(false);
    }
  }, [isOpen, defaultTab, loadInvites]);

  const copyMyUsername = () => {
    if (!myUsername) return;
    navigator.clipboard.writeText(myUsername);
    setCopiedMyId(true);
    toast.success('Username copied to clipboard!');
    setTimeout(() => setCopiedMyId(false), 2500);
  };

  const handleConnectByUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetIdentifier.trim()) return;

    setIsConnecting(true);
    setConnectError(null);
    setConnectSuccess(null);

    const res = await connectWithPartner(targetIdentifier.trim());
    setIsConnecting(false);

    if (!res.success) {
      setConnectError(res.error || 'Could not connect with this user');
    } else if (res.isRequestSent) {
      setConnectSuccess(res.message || 'Connection request sent! Once they accept, they will appear in your friend list.');
      setTargetIdentifier('');
    } else {
      setConnectSuccess(res.message || 'Connected successfully! Opening conversation...');
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const handleGenerateLink = async () => {
    if (!profile) return;
    setIsGeneratingLink(true);

    try {
      const rawToken = generateSecureToken(32);
      const tokenHash = await hashToken(rawToken);
      const expiresAt = new Date(Date.now() + parseInt(expiryHours, 10) * 3600 * 1000).toISOString();

      if (isConfigured) {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.from('invitations').insert({
          created_by: profile.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
        });

        if (error) throw error;
        await loadInvites();
      }

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://vibely-sigma-roan.vercel.app';
      const inviteUrl = `${baseUrl}/invite/${rawToken}`;
      setGeneratedUrl(inviteUrl);
      toast.success('Private invitation link generated!');
    } catch (err) {
      console.warn('Error creating invitation:', err);
      toast.error('Failed to generate invite link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyInviteLink = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopiedLink(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const shareViaWhatsApp = () => {
    if (!generatedUrl) return;
    const shareText = encodeURIComponent(
      `Hey! Connect with me on Vibely, our private 1-on-1 space:\n${generatedUrl}`
    );
    window.open(`https://wa.me/?text=${shareText}`, '_blank');
  };

  const handleRevoke = async (id: string) => {
    if (isConfigured) {
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from('invitations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      await loadInvites();
      toast.info('Invitation revoked');
    } else {
      setMyInvites(prev => prev.filter(i => i.id !== id));
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Connect Partner"
      description="Pair 1-on-1 with your partner to start chatting in your private space."
    >
      <div className="space-y-4 pt-1">
        {/* Segmented Pill Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-muted/80 border border-border/60">
          <button
            type="button"
            onClick={() => {
              setActiveTab('username');
              setConnectError(null);
              setConnectSuccess(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'username'
                ? 'bg-white dark:bg-[#0E3528] text-foreground shadow-xs border border-border/40'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="w-3.5 h-3.5 text-primary" />
            <span>Search Username</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('link');
              setConnectError(null);
              setConnectSuccess(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'link'
                ? 'bg-white dark:bg-[#0E3528] text-foreground shadow-xs border border-border/40'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 text-primary" />
            <span>Private Invite Link</span>
          </button>
        </div>

        {/* TAB 1: CONNECT VIA USERNAME */}
        {activeTab === 'username' && (
          <div className="space-y-4">
            {/* My Identity Card */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0C3B2E]/5 dark:bg-white/5 border border-[#0C3B2E]/15 dark:border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  src={profile?.avatar_path}
                  name={profile?.display_name || 'You'}
                  size="md"
                />
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                      {profile?.display_name || 'My Profile'}
                    </p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                      You
                    </span>
                  </div>
                  <p className="text-xs font-mono font-semibold text-[#0C3B2E] dark:text-emerald-300 truncate">
                    {myUsername || 'No username set'}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyMyUsername}
                className="h-8 px-3 rounded-xl text-xs gap-1.5 shrink-0 border-border/80 font-medium hover:bg-muted cursor-pointer"
                title="Copy your username"
              >
                {copiedMyId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>

            {/* Form to enter partner's username */}
            <form onSubmit={handleConnectByUsername} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-primary" />
                  <span>Enter Partner&apos;s Username</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground font-mono text-sm font-semibold">
                    @
                  </div>
                  <input
                    type="text"
                    value={targetIdentifier}
                    onChange={e => {
                      setTargetIdentifier(e.target.value);
                      if (connectError) setConnectError(null);
                    }}
                    placeholder="Enter partner's username"
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-2xl text-xs bg-background border border-input focus:outline-none focus:ring-2 focus:ring-[#0C3B2E]/25 dark:focus:ring-emerald-400/25 font-sans placeholder:text-muted-foreground transition-all shadow-2xs"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Type your partner&apos;s @username. A real-time connection request will be sent to their Vibely inbox.
                </p>
              </div>

              {connectError && (
                <div className="p-3 rounded-2xl bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-start gap-2.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{connectError}</span>
                </div>
              )}

              {connectSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-500/25 flex items-start gap-2.5 animate-in fade-in duration-150">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span className="leading-relaxed font-medium">{connectSuccess}</span>
                </div>
              )}

              <Button
                type="submit"
                isLoading={isConnecting}
                disabled={!targetIdentifier.trim() || isConnecting}
                className="w-full h-11 rounded-2xl gap-2 font-semibold bg-[#0C3B2E] hover:bg-[#135744] dark:bg-white dark:hover:bg-white/90 dark:text-[#0C3B2E] text-white shadow-md hover:shadow-lg transition-all cursor-pointer text-xs"
              >
                <UserCheck className="w-4 h-4" />
                <span>Send Connection Request</span>
              </Button>
            </form>
          </div>
        )}

        {/* TAB 2: CONNECT VIA INVITE LINK */}
        {activeTab === 'link' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#0C3B2E]/5 dark:bg-white/5 border border-[#0C3B2E]/15 dark:border-white/10 text-xs">
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-muted-foreground leading-relaxed">
                Generate a private, encrypted single-use link. When your partner clicks it, your accounts pair instantly and your private chat opens.
              </p>
            </div>

            {!generatedUrl && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Link Expiration</span>
                </label>
                <select
                  value={expiryHours}
                  onChange={e => setExpiryHours(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl text-xs bg-background border border-input focus:outline-none focus:ring-2 focus:ring-[#0C3B2E]/25 transition-all"
                >
                  <option value="24">24 Hours (Fast & secure)</option>
                  <option value="168">7 Days (Standard recommended)</option>
                  <option value="720">30 Days (Extended)</option>
                </select>
              </div>
            )}

            {generatedUrl ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Your Private Invitation Link</span>
                </label>

                <div className="p-3 rounded-2xl bg-muted/80 border border-border space-y-2.5">
                  <input
                    type="text"
                    readOnly
                    value={generatedUrl}
                    className="w-full bg-transparent text-xs font-mono focus:outline-none truncate select-all px-1 text-foreground"
                  />

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={copyInviteLink}
                      className="flex-1 h-9 gap-1.5 rounded-xl text-xs font-semibold bg-[#0C3B2E] hover:bg-[#135744] text-white cursor-pointer"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={shareViaWhatsApp}
                      className="h-9 px-3 gap-1.5 rounded-xl text-xs font-medium border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </Button>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Send this 1-time private invite to your partner. It automatically expires once used.
                </p>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleGenerateLink}
                isLoading={isGeneratingLink}
                className="w-full h-11 rounded-2xl gap-2 font-semibold bg-[#0C3B2E] hover:bg-[#135744] dark:bg-white dark:hover:bg-white/90 dark:text-[#0C3B2E] text-white shadow-md hover:shadow-lg transition-all cursor-pointer text-xs"
              >
                <LinkIcon className="w-4 h-4" />
                <span>Generate Private Invite Link</span>
              </Button>
            )}

            {/* Active Invites List */}
            {myInvites.length > 0 && (
              <div className="pt-3 border-t border-border/50">
                <h5 className="text-xs font-bold text-foreground mb-2">
                  Active Invitations ({myInvites.length})
                </h5>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {myInvites.map(inv => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-muted/40 border border-border/60 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-[11px] text-muted-foreground truncate">
                          Expires {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevoke(inv.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Revoke link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
