'use client';

import * as React from 'react';
import {
  Bell,
  Check,
  X,
  UserCheck,
  UserX,
  Sparkles,
  Heart,
  Clock,
  Loader2,
  Users,
  MessageSquare,
  Copy,
  CheckCheck,
  UserPlus,
  CheckCircle2,
  Trash2,
  UserMinus,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types/database';

export interface NotificationBellProps {
  onOpenConnect?: () => void;
  className?: string;
}

export function NotificationBell({ onOpenConnect, className }: NotificationBellProps) {
  const { profile } = useAuth();
  const {
    conversations,
    incomingRequests,
    respondToRequest,
    setActiveConversationId,
    friendPresence,
    deleteFriend,
  } = useChat();

  const [isOpen, setIsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'friends' | 'requests'>('requests');
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<{ friend: Profile; conversationId: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [copiedMyId, setCopiedMyId] = React.useState(false);
  const [coords, setCoords] = React.useState<{ top: number; left: number; width: number } | null>(null);

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const requestCount = incomingRequests.length;

  // Extract confirmed friends from conversations list
  const friends = React.useMemo(() => {
    const list: Array<{
      conversationId: string;
      friend: Profile;
      lastMessageTime?: string;
    }> = [];
    const seen = new Set<string>();

    for (const conv of conversations) {
      if (conv.otherUser && !seen.has(conv.otherUser.id)) {
        seen.add(conv.otherUser.id);
        list.push({
          conversationId: conv.id,
          friend: conv.otherUser,
          lastMessageTime: conv.lastMessage?.created_at,
        });
      }
    }
    return list;
  }, [conversations]);

  // Set default tab when opening: if there are pending requests, show 'requests', else 'friends'
  React.useEffect(() => {
    if (isOpen) {
      if (requestCount > 0) {
        setActiveTab('requests');
      } else {
        setActiveTab('friends');
      }
    }
  }, [isOpen, requestCount]);

  // Calculate clamped viewport position so no part of the popover goes outside the display
  const calculatePosition = React.useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

    // Desired popover width: responsive width that fits mobile and desktop comfortably
    const width = Math.min(390, screenWidth - 24);

    // Calculate left position:
    // Try aligning to button's left edge, or right edge if close to right screen boundary
    let left = rect.left;
    if (left + width > screenWidth - 12) {
      left = screenWidth - 12 - width;
    }
    if (left < 12) {
      left = 12;
    }

    // Calculate top position:
    let top = rect.bottom + 8;
    // If overflowing screen bottom and room exists above, open upwards
    if (top + 380 > screenHeight && rect.top > 380) {
      top = Math.max(12, rect.top - 440);
    }

    setCoords({ top, left, width });
  }, []);

  // Window resize, scroll, and outside click listeners
  React.useEffect(() => {
    if (!isOpen) return;
    calculatePosition();

    function handleResizeOrScroll() {
      calculatePosition();
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, calculatePosition]);

  const handleAction = async (requestId: string, action: 'accept' | 'decline', senderName: string) => {
    setProcessingId(requestId);
    try {
      const res = await respondToRequest(requestId, action);
      if (res.success) {
        if (action === 'accept') {
          toast.success(`You are now connected with ${senderName}! Added to your friend list.`);
          setActiveTab('friends');
        } else {
          toast.info(`Request from ${senderName} declined.`);
        }
      } else {
        toast.error(res.error || `Failed to ${action} request`);
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenChat = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setIsOpen(false);
  };

  const handleDeleteFriendConfirmed = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteFriend(confirmDelete.friend.id, confirmDelete.conversationId);
      if (res.success) {
        // Intentionally NO success toast per user instruction
        setConfirmDelete(null);
      } else {
        toast.error(res.error || 'Failed to remove friend');
      }
    } catch {
      toast.error('Network error. Failed to remove friend.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyMyUsername = () => {
    if (!profile?.username) return;
    const text = `@${profile.username}`;
    navigator.clipboard.writeText(text);
    setCopiedMyId(true);
    toast.success('Username copied to clipboard!');
    setTimeout(() => setCopiedMyId(false), 2000);
  };

  return (
    <div className="relative inline-block">
      {/* Bell Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all cursor-pointer border border-transparent',
          isOpen && 'bg-muted/80 text-foreground border-border/50',
          requestCount > 0 && 'text-primary',
          className
        )}
        title={
          requestCount > 0
            ? `${requestCount} pending connection request${requestCount > 1 ? 's' : ''}`
            : 'Notifications & Friends'
        }
        aria-label="Open notifications"
      >
        <Bell className="w-4 h-4" />
        {requestCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-bounce">
            {requestCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Window with Clamped Boundary */}
      {isOpen && (
        <>
          {/* Backdrop on mobile for easy dismissal */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: coords ? `${coords.top}px` : '72px',
              left: coords ? `${coords.left}px` : '12px',
              width: coords ? `${coords.width}px` : 'calc(100vw - 24px)',
              maxHeight: coords ? `min(540px, calc(100vh - ${coords.top + 16}px))` : '500px',
            }}
            className="fixed z-50 rounded-2xl bg-card/95 border border-border/80 shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col animate-in fade-in-0 zoom-in-95 duration-150 select-none"
          >
            {/* Window Header */}
            <div className="p-3 border-b border-border/60 bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground leading-tight">Partner Hub</h3>
                  <p className="text-[10px] text-muted-foreground">Friends & Connection Requests</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg text-xs hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section Switcher Tabs: 1) Friends, 2) Requests */}
            <div className="p-2 border-b border-border/50 bg-muted/20">
              <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/60 text-xs font-medium gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('friends')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer',
                    activeTab === 'friends'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Friends</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                    {friends.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer',
                    activeTab === 'requests'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                  )}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Requests</span>
                  {requestCount > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                      {requestCount} new
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted text-muted-foreground">
                      0
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[180px]">
              {/* SECTION 1: FRIENDS */}
              {activeTab === 'friends' && (
                <>
                  {friends.length === 0 ? (
                    <div className="py-10 px-4 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                        <Users className="w-6 h-6 opacity-80" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">No confirmed friends yet</p>
                        <p className="text-[11px] text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                          When a partner accepts your connection request, they will appear here in your friends list.
                        </p>
                      </div>
                      {onOpenConnect && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setIsOpen(false);
                            onOpenConnect();
                          }}
                          className="rounded-xl text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Connect Partner</span>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground px-1">
                        <span>Connected Partners ({friends.length})</span>
                      </div>

                      {friends.map(({ conversationId, friend }) => {
                        const isFriendOnline =
                          friendPresence.userId === friend.id ? friendPresence.online : false;

                        return (
                          <div
                            key={friend.id}
                            className="p-2.5 rounded-xl bg-background/80 border border-border/60 hover:border-primary/40 transition-all flex items-center justify-between gap-3 shadow-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar
                                src={friend.avatar_path || undefined}
                                name={friend.display_name}
                                size="md"
                                isOnline={isFriendOnline}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">
                                  {friend.display_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono truncate">
                                  {friend.username ? `@${friend.username}` : ''}
                                </p>
                                <span className="inline-flex items-center gap-1 text-[10px] mt-0.5">
                                  <span
                                    className={cn(
                                      'w-1.5 h-1.5 rounded-full',
                                      isFriendOnline ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                                    )}
                                  />
                                  <span className="text-muted-foreground">
                                    {isFriendOnline ? 'Online now' : 'Offline'}
                                  </span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenChat(conversationId)}
                                className="h-7 px-2.5 rounded-lg text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary shrink-0 cursor-pointer"
                                title={`Chat with ${friend.display_name}`}
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Chat</span>
                              </Button>

                              <button
                                type="button"
                                onClick={() => setConfirmDelete({ friend, conversationId })}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                title={`Remove ${friend.display_name} from friends`}
                                aria-label={`Remove ${friend.display_name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* SECTION 2: REQUESTS */}
              {activeTab === 'requests' && (
                <>
                  {requestCount === 0 ? (
                    <div className="py-10 px-4 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 opacity-80" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">No pending requests</p>
                        <p className="text-[11px] text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                          When someone sends a connection request using your username, it will appear right here in real time.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-primary px-1">
                        <span>Incoming Partner Requests ({requestCount})</span>
                      </div>

                      {incomingRequests.map(req => {
                        const isBusy = processingId === req.id;
                        const usernameText = req.sender.username ? `@${req.sender.username}` : '';

                        return (
                          <div
                            key={req.id}
                            className="p-3 rounded-xl bg-[#0C3B2E]/5 dark:bg-white/5 border border-primary/25 space-y-2.5 shadow-xs transition-all hover:border-primary/40"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={req.sender.avatar_path || undefined}
                                name={req.sender.display_name}
                                size="md"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-foreground truncate">
                                    {req.sender.display_name}
                                  </p>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    Recent
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground font-mono truncate">
                                  {usernameText}
                                </p>
                                <p className="text-[11px] text-primary font-medium italic mt-0.5">
                                  wants to connect with you
                                </p>
                              </div>
                            </div>

                            {/* Accept / Decline Action Buttons */}
                            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                              <Button
                                size="sm"
                                disabled={isBusy}
                                onClick={() => handleAction(req.id, 'accept', req.sender.display_name)}
                                className="flex-1 h-8 rounded-xl text-xs gap-1.5 font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                              >
                                {isBusy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Accept</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => handleAction(req.id, 'decline', req.sender.display_name)}
                                className="flex-1 h-8 rounded-xl text-xs gap-1.5 border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Decline</span>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Window Footer: Quick Username Share Tool */}
            {profile && (
              <div className="p-2.5 bg-muted/40 border-t border-border/60 flex items-center justify-between gap-2 text-[11px]">
                <div className="truncate">
                  <span className="text-muted-foreground">Your Username: </span>
                  <span className="font-mono font-semibold text-primary">{profile.username ? `@${profile.username}` : ''}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyMyUsername}
                  className="px-2 py-1 rounded-lg bg-background hover:bg-primary/10 border border-border/60 text-muted-foreground hover:text-primary transition-all flex items-center gap-1 cursor-pointer shrink-0 font-medium"
                  title="Copy your username to share with friends"
                >
                  {copiedMyId ? (
                    <>
                      <CheckCheck className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500 text-[10px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span className="text-[10px]">Copy Username</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Remove Friend Confirmation Dialog */}
      <Dialog
        isOpen={!!confirmDelete}
        onClose={() => !isDeleting && setConfirmDelete(null)}
        title="Remove Friend"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="w-10 h-10 rounded-full bg-destructive/20 text-destructive flex items-center justify-center shrink-0">
              <UserMinus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {confirmDelete?.friend.display_name}
              </p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {confirmDelete?.friend?.username ? `@${confirmDelete.friend.username}` : ''}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to remove <strong className="text-foreground">{confirmDelete?.friend.display_name}</strong> from your friends? This will delete your conversation history and disconnect your partner.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setConfirmDelete(null)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteFriendConfirmed}
              className="text-xs rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Remove Friend</span>
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/**
 * Top Notification Bar (Shows when there are incoming requests directly at the top of the chat)
 */
export function TopNotificationBar() {
  const { incomingRequests, respondToRequest } = useChat();
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  if (incomingRequests.length === 0) return null;

  const current = incomingRequests[0];
  const isBusy = processingId === current.id;
  const usernameText = (current.sender as any)?.username ? `@${(current.sender as any).username}` : '';

  const handleAction = async (requestId: string, action: 'accept' | 'decline', senderName: string) => {
    setProcessingId(requestId);
    try {
      const res = await respondToRequest(requestId, action);
      if (res.success) {
        if (action === 'accept') {
          toast.success(`Connected with ${senderName}! Added to your friend list.`);
        } else {
          toast.info(`Request from ${senderName} declined.`);
        }
      } else {
        toast.error(res.error || `Failed to ${action} request`);
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="w-full bg-[#0C3B2E]/10 dark:bg-white/10 border-b border-primary/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs backdrop-blur-md animate-in slide-in-from-top duration-200 select-none">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex h-2 w-2 rounded-full bg-primary animate-ping shrink-0" />
        <Avatar
          src={current.sender.avatar_path || undefined}
          name={current.sender.display_name}
          size="sm"
        />
        <div className="truncate">
          <span className="font-semibold text-foreground">{current.sender.display_name}</span>
          <span className="text-muted-foreground ml-1.5 font-mono text-[11px]">
            ({usernameText})
          </span>
          <span className="text-muted-foreground ml-1 hidden sm:inline">
            sent you a partner connection request!
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          disabled={isBusy}
          onClick={() => handleAction(current.id, 'accept', current.sender.display_name)}
          className="h-7 px-3 rounded-lg text-xs gap-1 font-medium bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
        >
          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
          <span>Accept</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => handleAction(current.id, 'decline', current.sender.display_name)}
          className="h-7 px-3 rounded-lg text-xs gap-1 border-border/80 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <UserX className="w-3 h-3" />
          <span>Decline</span>
        </Button>
      </div>
    </div>
  );
}
