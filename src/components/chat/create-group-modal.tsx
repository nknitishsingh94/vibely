'use client';

import * as React from 'react';
import { Users, X, Check, Search, Loader2, Sparkles, UserPlus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useChat } from '@/context/chat-context';
import { toast } from '@/components/ui/toast';
import { Profile } from '@/types/database';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
  const { conversations, createGroup, isUserOnline } = useChat();

  const [groupName, setGroupName] = React.useState('');
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Extract connected friends from direct conversations
  const availableFriends = React.useMemo(() => {
    const friendMap = new Map<string, Profile>();
    for (const c of conversations) {
      if (c.type === 'direct' && c.otherUser && c.otherUser.id) {
        friendMap.set(c.otherUser.id, c.otherUser);
      }
    }
    return Array.from(friendMap.values());
  }, [conversations]);

  // Filter friends based on search
  const filteredFriends = React.useMemo(() => {
    if (!searchQuery.trim()) return availableFriends;
    const q = searchQuery.toLowerCase();
    return availableFriends.filter(
      f =>
        f.display_name?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q)
    );
  }, [availableFriends, searchQuery]);

  // Reset state on open/close
  React.useEffect(() => {
    if (isOpen) {
      setGroupName('');
      setSelectedUserIds([]);
      setSearchQuery('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const toggleSelect = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = groupName.trim();
    if (!trimmed) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least 1 member for the group');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createGroup(trimmed, selectedUserIds);
      if (res.success) {
        toast.success(`Group "${trimmed}" created! 🎉`);
        onClose();
      } else {
        toast.error(res.error || 'Failed to create group');
      }
    } catch {
      toast.error('Network error creating group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create Group Chat">
      <form onSubmit={handleCreate} className="space-y-4 select-none">
        {/* Header Icon & Intro */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>New Group Sanctuary</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </h3>
            <p className="text-xs text-muted-foreground">
              Connect multiple friends in one shared conversation
            </p>
          </div>
        </div>

        {/* Group Name Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <label htmlFor="group-name-input">Group Name</label>
            <span className="text-[11px] text-muted-foreground font-normal">
              {groupName.length}/60
            </span>
          </div>
          <input
            id="group-name-input"
            type="text"
            maxLength={60}
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="e.g. Dream Team, Family & Friends"
            required
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-muted/60 border border-border/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 placeholder:text-muted-foreground/70 transition-all shadow-xs"
          />
        </div>

        {/* Selected Members Chips */}
        {selectedUserIds.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Selected Members ({selectedUserIds.length})</span>
              <button
                type="button"
                onClick={() => setSelectedUserIds([])}
                className="text-rose-500 hover:underline text-[11px] cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 scrollbar-thin">
              {selectedUserIds.map(uid => {
                const friend = availableFriends.find(f => f.id === uid);
                if (!friend) return null;
                return (
                  <span
                    key={uid}
                    className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs animate-in zoom-in-95 duration-100"
                  >
                    <Avatar
                      src={friend.avatar_path || undefined}
                      name={friend.display_name}
                      size="sm"
                      className="w-4 h-4 text-[9px]"
                    />
                    <span className="max-w-[100px] truncate">{friend.display_name}</span>
                    <button
                      type="button"
                      onClick={() => toggleSelect(uid)}
                      className="w-3.5 h-3.5 rounded-full hover:bg-emerald-500/30 flex items-center justify-center cursor-pointer ml-0.5"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Search & Member Selection List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Add Members</span>
            <span className="text-[11px] text-muted-foreground font-normal">
              {availableFriends.length} friends available
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter friends by name or username..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-muted/50 border border-border/70 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-muted-foreground/60 transition-all"
            />
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-border/30 rounded-xl border border-border/60 bg-card/60 scrollbar-thin">
            {availableFriends.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground space-y-1">
                <p className="text-xs font-semibold text-foreground">No partners connected yet</p>
                <p className="text-[11px] text-muted-foreground">
                  Connect with friends first via "Connect" in the sidebar before adding them to a group.
                </p>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No friends match &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredFriends.map(friend => {
                const isSelected = selectedUserIds.includes(friend.id);
                const online = isUserOnline(friend.id);
                return (
                  <div
                    key={friend.id}
                    onClick={() => toggleSelect(friend.id)}
                    className="flex items-center justify-between p-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        src={friend.avatar_path || undefined}
                        name={friend.display_name}
                        size="sm"
                        isOnline={online}
                        className="w-9 h-9 text-xs shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-foreground truncate">
                          {friend.display_name}
                        </h4>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {friend.username ? `@${friend.username}` : (online ? 'Online' : 'Offline')}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'border-muted-foreground/40 bg-card hover:border-emerald-500'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !groupName.trim() || selectedUserIds.length === 0}
            className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Group</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
