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
import { UserPlus, Sparkles, Copy, Check, ArrowRight, ArrowLeft, Loader2, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InviteModal } from '@/components/chat/invite-modal';
import { TopNotificationBar } from '@/components/chat/notification-bar';
import { ScreenshotDetector } from '@/components/chat/screenshot-detector';
import { SecurityAlertBanner } from '@/components/chat/security-alert-banner';
import { BrandLogo, VibelyEmblem } from '@/components/ui/brand-logo';
import { toast } from '@/components/ui/toast';
import { useChatLock } from '@/context/chat-lock-context';

export default function ChatPage() {
  const router = useRouter();
  const { activeConversationId, setActiveConversationId, connectWithPartner } = useChat();
  const { isChatLocked, isUnlocked, openUnlockModal } = useChatLock();
  const { user, profile, isLoading } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [partnerInput, setPartnerInput] = React.useState('');
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [viewportHeight, setViewportHeight] = React.useState<number | null>(null);

  // Dynamic visualViewport tracking so mobile keyboard shrinks container without covering composer
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Handle mobile hardware back button / swipe-back gesture so user returns to user list instead of exiting the webapp
  React.useEffect(() => {
    if (!activeConversationId) {
      if (typeof window !== 'undefined' && window.location.hash === '#chat') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      return;
    }

    // Push hash to history stack so mobile swipe back or Android hardware back pops the hash instead of leaving /chat
    if (typeof window !== 'undefined' && window.location.hash !== '#chat') {
      window.history.pushState({ chatOpen: true }, '', '#chat');
    }

    const handlePopState = () => {
      // Hardware back or browser back was triggered: close conversation and reveal user list
      setActiveConversationId(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeConversationId, setActiveConversationId]);

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

  const myUsername = profile?.username ? `@${profile.username}` : '';

  const handleCopyUsername = async () => {
    try {
      if (!myUsername) return;
      await navigator.clipboard.writeText(myUsername);
      setCopied(true);
      toast.success('Username copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy username');
    }
  };

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = partnerInput.trim().replace(/^@/, '');
    if (!cleanUsername) return;

    setIsConnecting(true);
    try {
      const res = await connectWithPartner(cleanUsername);
      if (res.success) {
        if (res.isRequestSent) {
          toast.success(res.message || 'Connection request sent! They will appear in your friend list once they accept.');
          setPartnerInput('');
        } else {
          toast.success(res.message || 'Connected successfully! Starting your conversation.');
          setPartnerInput('');
        }
      } else {
        toast.error(res.error || `Could not find any user with username @${cleanUsername}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      style={viewportHeight ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` } : undefined}
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-background flex select-none"
    >
      {/* Left Sidebar: on mobile takes full screen 100dvh, hidden if conversation open */}
      <div
        className={`h-full max-h-[100dvh] overflow-hidden ${
          activeConversationId ? 'hidden md:flex' : 'flex w-full md:w-80 lg:w-88'
        }`}
      >
        <Sidebar />
      </div>

      {/* Main Conversation Area: full screen on mobile when conversation selected */}
      <div
        className={`relative flex-1 flex flex-col h-full max-h-[100dvh] overflow-hidden bg-background ${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ScreenshotDetector />
        <SecurityAlertBanner />
        <TopNotificationBar />
        {activeConversationId ? (
          isChatLocked(activeConversationId) && !isUnlocked ? (
            <div className="flex-1 flex flex-col h-full bg-background select-none">
              {/* Minimal top bar with back button */}
              <div className="p-3 border-b border-border/60 flex items-center gap-3 bg-card/60">
                <button
                  type="button"
                  onClick={() => setActiveConversationId(null)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
                  aria-label="Back to chats"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <VibelyEmblem size="xs" />
                  <span className="font-bold text-sm text-foreground">Private Space</span>
                </div>
              </div>

              {/* Locked Screen Center Box */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none romantic-wallpaper">
                <div className="max-w-xs w-full space-y-4 p-8 rounded-3xl bg-card/90 border border-border/80 shadow-2xl backdrop-blur-xl">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs">
                    <VibelyEmblem size="sm" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground">Private Space</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Enter your 4-digit PIN to access this space.
                    </p>
                  </div>
                  <Button
                    onClick={() => openUnlockModal(activeConversationId)}
                    className="w-full h-11 rounded-2xl font-bold bg-[#0C3B2E] hover:bg-[#155E49] text-white shadow-md active:scale-95 cursor-pointer"
                  >
                    Enter PIN
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <ConversationHeader />
              <MessageList />
              <MessageComposer />
            </>
          )
        ) : (
          /* Empty state on desktop when no conversation is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground select-none romantic-wallpaper">
            <div className="max-w-md w-full space-y-5 animate-in fade-in duration-300">
              <BrandLogo size="lg" className="justify-center mb-2" href="/chat" />

              <div className="space-y-2">
                <h3 className="text-2xl font-sans font-bold text-foreground">
                  Where two souls sync.
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Connect 1-on-1 with your partner using their username to start chatting.
                </p>
              </div>

              {/* Your Username Card */}
              <div className="bg-card/85 backdrop-blur-md border border-[#0C3B2E]/20 dark:border-white/15 rounded-2xl p-4 shadow-sm text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#0C3B2E] dark:text-emerald-400" />
                    Your Username
                  </span>
                  <button
                    onClick={handleCopyUsername}
                    className="text-[11px] text-[#0C3B2E] dark:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy Username'}
                  </button>
                </div>
                <div
                  onClick={handleCopyUsername}
                  className="bg-background/80 hover:bg-background border border-border/60 hover:border-[#0C3B2E]/40 rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <span className="text-sm font-bold font-mono text-[#0C3B2E] dark:text-emerald-300 tracking-wide">
                    {myUsername || '@user'}
                  </span>
                  <span className="text-[11px] text-muted-foreground group-hover:text-foreground">
                    Click to copy
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Give your @username to your partner so they can connect with you directly on Vibely.
                </p>
              </div>

              {/* Quick Connect Input */}
              <form onSubmit={handleQuickConnect} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter partner's username"
                    value={partnerInput}
                    onChange={(e) => setPartnerInput(e.target.value)}
                    className="rounded-xl bg-card/60 backdrop-blur border-border text-xs h-10 placeholder:font-sans"
                    disabled={isConnecting}
                  />
                  <Button
                    type="submit"
                    disabled={isConnecting || !partnerInput.trim()}
                    className="h-10 px-4 rounded-xl gap-1.5 bg-[#0C3B2E] hover:bg-[#155E49] text-white shadow-sm text-xs font-semibold cursor-pointer shrink-0"
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
