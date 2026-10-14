'use client';

import * as React from 'react';
import { Search, Send, Check, Loader2, Users, ArrowRight } from 'lucide-react';
import { useChat } from '@/context/chat-context';
import { Dialog } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageIds: string[];
  onSuccess?: () => void;
}

export function ForwardModal({
  isOpen,
  onClose,
  messageIds,
  onSuccess,
}: ForwardModalProps) {
  const { conversations, isUserOnline, forwardMessages, activeConversationId } = useChat();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedConvIds, setSelectedConvIds] = React.useState<string[]>([]);
  const [isForwarding, setIsForwarding] = React.useState(false);

  // Reset selected recipients when opened
  React.useEffect(() => {
    if (isOpen) {
      setSelectedConvIds([]);
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredConversations = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return conversations.filter(c => {
      const partner = c.otherUser;
      if (!partner) return false;
      if (!term) return true;
      return (
        partner.display_name.toLowerCase().includes(term) ||
        (partner.username && partner.username.toLowerCase().includes(term))
      );
    });
  }, [conversations, searchTerm]);

  const toggleSelectConversation = (convId: string) => {
    setSelectedConvIds(prev =>
      prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId]
    );
  };

  const handleForward = async () => {
    if (selectedConvIds.length === 0 || messageIds.length === 0) return;
    setIsForwarding(true);

    try {
      let successCount = 0;
      for (const convId of selectedConvIds) {
        const res = await forwardMessages(convId, messageIds);
        if (res.success) {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(
          `Message forwarded to ${successCount} ${successCount === 1 ? 'chat' : 'chats'}!`
        );
        onSuccess?.();
        onClose();
      } else {
        toast.error('Failed to forward message');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to forward message');
    } finally {
      setIsForwarding(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => !isForwarding && onClose()}
      title={`Forward ${messageIds.length > 1 ? `${messageIds.length} messages` : 'message'} to...`}
      size="sm"
    >
      <div className="space-y-3 pt-1 select-none">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search friends or chats..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-muted/60 border border-border/70 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-muted-foreground"
          />
        </div>

        {/* Contacts List */}
        <div className="max-h-64 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
          {filteredConversations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground space-y-1">
              <Users className="w-8 h-8 mx-auto opacity-40 mb-1" />
              <p className="text-xs font-medium">No chats found</p>
              <p className="text-[11px] opacity-75">Connect with friends to forward messages</p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const partner = conv.otherUser;
              if (!partner) return null;
              const isSelected = selectedConvIds.includes(conv.id);
              const isOnline = isUserOnline(partner.id);

              return (
                <div
                  key={conv.id}
                  onClick={() => toggleSelectConversation(conv.id)}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer',
                    isSelected
                      ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30'
                      : 'hover:bg-muted/70 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={partner.avatar_path}
                      name={partner.display_name}
                      size="sm"
                      isOnline={isOnline}
                    />
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {partner.display_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {partner.username ? `@${partner.username}` : isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>

                  {/* Checkbox circle */}
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-muted-foreground/40 bg-card'
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground font-medium">
            {selectedConvIds.length > 0
              ? `${selectedConvIds.length} ${selectedConvIds.length === 1 ? 'chat' : 'chats'} selected`
              : 'Select at least 1 chat'}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isForwarding}
              onClick={onClose}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedConvIds.length === 0 || isForwarding}
              onClick={handleForward}
              className="text-xs rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs font-medium"
            >
              {isForwarding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 ml-0.5" />
              )}
              <span>Forward</span>
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
