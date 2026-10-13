'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/context/chat-context';
import { useAuth } from '@/context/auth-context';
import { Sidebar } from '@/components/chat/sidebar';
import { ConversationHeader } from '@/components/chat/conversation-header';
import { MessageList } from '@/components/chat/message-list';
import { MessageComposer } from '@/components/chat/message-composer';
import { MediaGalleryDrawer } from '@/components/chat/media-gallery-drawer';
import { UserPlus, Sparkles, Copy, Check, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InviteModal } from '@/components/chat/invite-modal';
import { TopNotificationBar } from '@/components/chat/notification-bar';
import { BrandLogo } from '@/components/ui/brand-logo';
import { formatDuoId } from '@/lib/duo-id';
import { toast } from '@/components/ui/toast';

export default function ChatPage() {
  const router = useRouter();
  const { activeConversationId, conversations, connectWithPartner } = useChat();
  const { user, profile, isLoading } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [partnerInput, setPartnerInput] = React.useState('');
  const [isConnecting, setIsConnecting] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login?redirectTo=/chat');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground text-xs font-medium">
        Loading our space...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const duoId = formatDuoId(profile || user?.id);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(duoId);
      setCopied(true);
      toast.success('Duo ID copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy ID');
    }
  };

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerInput.trim()) return;

    setIsConnecting(true);
    try {
      const res = await connectWithPartner(partnerInput.trim());
      if (res.success) {
        if (res.isRequestSent) {
          toast.success(res.message || 'Connection request sent! They will appear in your friend list once they accept.');
          setPartnerInput('');
        } else {
          toast.success(res.message || 'Connected successfully! Starting your conversation.');
          setPartnerInput('');
        }
      } else {
        toast.error(res.error || 'Could not find user with that Duo ID or username.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left Sidebar: hidden on mobile if an active conversation is open */}
      <div
        className={`h-full ${
          activeConversationId ? 'hidden md:flex' : 'flex w-full md:w-auto'
        }`}
      >
        <Sidebar />
      </div>

      {/* Main Conversation Area: full screen on mobile when conversation selected */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden bg-background ${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <TopNotificationBar />
        {activeConversationId ? (
          <>
            <ConversationHeader />
            <MessageList />
            <MessageComposer />
          </>
        ) : (
          /* Empty state on desktop when no conversation is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground select-none romantic-wallpaper">
            <div className="max-w-md w-full space-y-5 animate-in fade-in duration-300">
              <BrandLogo size="lg" className="justify-center mb-2" />

              <div className="space-y-2">
                <h3 className="text-2xl font-serif font-bold text-foreground">
                  Just us, in our own little world.
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Connect 1-on-1 with your partner using your unique Duo ID or enter theirs to start chatting.
                </p>
              </div>

              {/* Your Duo ID Card */}
              <div className="bg-card/70 backdrop-blur-md border border-primary/20 rounded-2xl p-4 shadow-sm text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    Your Unique Duo ID
                  </span>
                  <button
                    onClick={handleCopyId}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy ID'}
                  </button>
                </div>
                <div
                  onClick={handleCopyId}
                  className="bg-background/80 hover:bg-background border border-border/60 hover:border-primary/40 rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <code className="text-sm font-mono font-semibold text-primary tracking-wide">
                    {duoId}
                  </code>
                  <span className="text-[11px] text-muted-foreground group-hover:text-foreground">
                    Click to copy
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Give this ID to your partner so they can connect with you directly.
                </p>
              </div>

              {/* Quick Connect Input */}
              <form onSubmit={handleQuickConnect} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter partner's #DUO-ID or username"
                    value={partnerInput}
                    onChange={(e) => setPartnerInput(e.target.value)}
                    className="rounded-xl bg-card/60 backdrop-blur border-border text-xs h-10 font-mono placeholder:font-sans"
                    disabled={isConnecting}
                  />
                  <Button
                    type="submit"
                    disabled={isConnecting || !partnerInput.trim()}
                    className="h-10 px-4 rounded-xl gap-1.5 bg-gradient-to-tr from-[#702C45] to-[#C96B83] text-white hover:opacity-95 shadow-sm text-xs font-medium cursor-pointer shrink-0"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Connect</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </form>

              <div className="pt-2 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInviteOpen(true)}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  More Connection Options
                </Button>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/80">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>End-to-end private. Made for the moments between us.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Drawer: Shared Media & Info */}
      <MediaGalleryDrawer />

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />
    </div>
  );
}
