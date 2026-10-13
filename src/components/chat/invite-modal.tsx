'use client';

import * as React from 'react';
import {
  Copy,
  Check,
  Link as LinkIcon,
  Clock,
  Trash2,
  Heart,
  Sparkles,
  UserCheck,
  Search,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { generateSecureToken, hashToken } from '@/lib/utils';
import { formatDuoId } from '@/lib/duo-id';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Invitation } from '@/types/database';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'duoid' | 'link';
}

export function InviteModal({ isOpen, onClose, defaultTab = 'duoid' }: InviteModalProps) {
  const { profile, isConfigured } = useAuth();
  const { connectWithPartner } = useChat();

  const [activeTab, setActiveTab] = React.useState<'duoid' | 'link'>(defaultTab);

  // Duo ID connect state
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

  const myDuoId = formatDuoId(profile);

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

  const copyMyDuoId = () => {
    navigator.clipboard.writeText(myDuoId);
    setCopiedMyId(true);
    setTimeout(() => setCopiedMyId(false), 2500);
  };

  const handleConnectByDuoId = async (e: React.FormEvent) => {
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

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const inviteUrl = `${baseUrl}/invite/${rawToken}`;
      setGeneratedUrl(inviteUrl);
    } catch (err) {
      console.warn('Error creating invitation:', err);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyInviteLink = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleRevoke = async (id: string) => {
    if (isConfigured) {
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from('invitations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      await loadInvites();
    } else {
      setMyInvites(prev => prev.filter(i => i.id !== id));
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Connect with Your Partner"
      description="Connect directly with your favorite person using their unique Vibe ID or a private invite link."
    >
      <div className="space-y-4 pt-1">
        {/* Navigation Tabs */}
        <div className="flex rounded-2xl bg-muted/80 p-1 border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab('duoid')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'duoid'
                ? 'bg-card text-foreground shadow-xs border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-primary" />
            <span>Connect with Vibe ID</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'link'
                ? 'bg-card text-foreground shadow-xs border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 text-primary" />
            <span>Private Invite Link</span>
          </button>
        </div>

        {/* TAB 1: CONNECT VIA DUO ID */}
        {activeTab === 'duoid' && (
          <div className="space-y-4">
            {/* My Unique Duo ID Card */}
            <div className="p-3.5 rounded-2xl bg-[#0C3B2E]/5 dark:bg-white/5 border border-[#0C3B2E]/15 dark:border-white/15 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Your Unique Vibe ID
                </span>
                <span className="text-[10px] text-muted-foreground">Share this with your partner</span>
              </div>

              <div className="flex items-center justify-between bg-card/80 backdrop-blur-xs p-2 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold tracking-wider text-foreground px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    {myDuoId}
                  </span>
                  {profile?.username && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      @{profile.username}
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyMyDuoId}
                  className="h-7 text-xs gap-1 rounded-lg hover:bg-muted"
                >
                  {copiedMyId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy ID</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Form to enter partner's ID */}
            <form onSubmit={handleConnectByDuoId} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-primary" />
                  <span>Partner&apos;s Vibe ID or Username</span>
                </label>
                <input
                  type="text"
                  value={targetIdentifier}
                  onChange={e => setTargetIdentifier(e.target.value)}
                  placeholder="e.g. #VIBE-8A3F1C2B or @username"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono placeholder:font-sans placeholder:text-muted-foreground transition-all"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Ask your partner for their unique Vibe ID shown on their profile.
                </p>
              </div>

              {connectError && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{connectError}</span>
                </div>
              )}

              {connectSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs border border-emerald-500/20 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{connectSuccess}</span>
                </div>
              )}

              <Button
                type="submit"
                isLoading={isConnecting}
                disabled={!targetIdentifier.trim() || isConnecting}
                className="w-full rounded-2xl gap-2 font-medium bg-gradient-to-tr from-[#702C45] to-[#C96B83] text-white shadow-md hover:opacity-95 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                Send Connection Request
              </Button>
            </form>
          </div>
        )}

        {/* TAB 2: CONNECT VIA INVITE LINK */}
        {activeTab === 'link' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs">
              <Heart className="w-4 h-4 text-primary shrink-0 mt-0.5 fill-primary/30" />
              <p className="text-muted-foreground leading-relaxed">
                Generate a single-use private link to send via SMS or WhatsApp. Once accepted, your private space opens automatically.
              </p>
            </div>

            {!generatedUrl && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  Link Expiration
                </label>
                <select
                  value={expiryHours}
                  onChange={e => setExpiryHours(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="24">24 Hours</option>
                  <option value="168">7 Days (Recommended)</option>
                  <option value="720">30 Days</option>
                </select>
              </div>
            )}

            {generatedUrl ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>Your Private Invitation Link</span>
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </label>
                <div className="flex items-center gap-2 p-2 rounded-2xl bg-muted/80 border border-border">
                  <input
                    type="text"
                    readOnly
                    value={generatedUrl}
                    className="w-full bg-transparent text-xs font-mono focus:outline-none truncate select-all px-2"
                  />
                  <Button
                    size="sm"
                    onClick={copyInviteLink}
                    className="shrink-0 gap-1 rounded-xl text-xs font-medium bg-primary text-primary-foreground"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Send this link to your partner via SMS, WhatsApp, or email.
                </p>
              </div>
            ) : (
              <Button
                onClick={handleGenerateLink}
                isLoading={isGeneratingLink}
                className="w-full rounded-2xl gap-2 font-medium bg-gradient-to-tr from-[#702C45] to-[#C96B83] text-white shadow-md hover:opacity-95"
              >
                <Heart className="w-4 h-4 fill-current" />
                Generate Private Link
              </Button>
            )}

            {/* Active Invites List */}
            {myInvites.length > 0 && (
              <div className="pt-3 border-t border-border/50">
                <h5 className="text-xs font-semibold text-foreground mb-2">
                  Pending Invitations ({myInvites.length})
                </h5>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {myInvites.map(inv => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/40 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-[11px] truncate">
                          Expires {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
