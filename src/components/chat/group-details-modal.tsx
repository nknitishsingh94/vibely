'use client';

import * as React from 'react';
import {
  Users,
  UserPlus,
  LogOut,
  Crown,
  Shield,
  Loader2,
  Check,
  Search,
  X,
  Edit2,
  Calendar,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { toast } from '@/components/ui/toast';
import { ConversationWithDetails, Profile } from '@/types/database';

interface GroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: ConversationWithDetails;
}

export function GroupDetailsModal({ isOpen, onClose, conversation }: GroupDetailsModalProps) {
  const { profile } = useAuth();
  const { conversations, isUserOnline, updateGroup, addGroupMembers, leaveGroup } = useChat();

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [editedName, setEditedName] = React.useState(conversation.name || '');
  const [isUpdatingName, setIsUpdatingName] = React.useState(false);

  const [isAddMembersOpen, setIsAddMembersOpen] = React.useState(false);
  const [selectedNewUserIds, setSelectedNewUserIds] = React.useState<string[]>([]);
  const [friendSearch, setFriendSearch] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);

  const [isLeaving, setIsLeaving] = React.useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = React.useState(false);

  const groupTitle =
    conversation.name ||
    conversation.members.map(m => m.profile?.display_name).filter(Boolean).join(', ') ||
    'Group Chat';

  const currentMemberRow = conversation.members.find(m => m.user_id === profile?.id);
  const isAdmin = currentMemberRow?.role === 'admin' || conversation.created_by === profile?.id;

  // Existing member IDs in group
  const existingMemberIds = React.useMemo(() => {
    return new Set(conversation.members.map(m => m.user_id));
  }, [conversation.members]);

  // Candidates to add (friends not currently in this group)
  const availableFriendsToAdd = React.useMemo(() => {
    const friendMap = new Map<string, Profile>();
    for (const c of conversations) {
      if (c.type === 'direct' && c.otherUser && c.otherUser.id && !existingMemberIds.has(c.otherUser.id)) {
        friendMap.set(c.otherUser.id, c.otherUser);
      }
    }
    return Array.from(friendMap.values());
  }, [conversations, existingMemberIds]);

  const filteredCandidates = React.useMemo(() => {
    if (!friendSearch.trim()) return availableFriendsToAdd;
    const q = friendSearch.toLowerCase();
    return availableFriendsToAdd.filter(
      f =>
        f.display_name?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q)
    );
  }, [availableFriendsToAdd, friendSearch]);

  React.useEffect(() => {
    if (isOpen) {
      setEditedName(conversation.name || '');
      setIsEditingName(false);
      setIsAddMembersOpen(false);
      setSelectedNewUserIds([]);
      setFriendSearch('');
      setShowConfirmLeave(false);
    }
  }, [isOpen, conversation.name]);

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    if (!trimmed) {
      toast.error('Group name cannot be empty');
      return;
    }
    setIsUpdatingName(true);
    try {
      const res = await updateGroup(conversation.id, { name: trimmed });
      if (res.success) {
        toast.success('Group name updated!');
        setIsEditingName(false);
      } else {
        toast.error(res.error || 'Failed to update name');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedNewUserIds.length === 0) return;
    setIsAdding(true);
    try {
      const res = await addGroupMembers(conversation.id, selectedNewUserIds);
      if (res.success) {
        toast.success('Members added successfully!');
        setSelectedNewUserIds([]);
        setIsAddMembersOpen(false);
      } else {
        toast.error(res.error || 'Failed to add members');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleLeaveGroup = async () => {
    setIsLeaving(true);
    try {
      const res = await leaveGroup(conversation.id);
      if (res.success) {
        toast.success('You have left the group');
        onClose();
      } else {
        toast.error(res.error || 'Failed to leave group');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsLeaving(false);
    }
  };

  const toggleSelectCandidate = (uid: string) => {
    setSelectedNewUserIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Group Details">
      <div className="space-y-4 select-none">
        {/* Group Banner / Avatar */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-emerald-500/15 to-transparent border border-emerald-500/20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md mb-2.5">
            <Users className="w-8 h-8" />
          </div>

          {/* Group Title / Rename */}
          {isEditingName ? (
            <div className="flex items-center gap-2 mt-1 w-full max-w-xs">
              <input
                type="text"
                value={editedName}
                onChange={e => setEditedName(e.target.value)}
                maxLength={60}
                autoFocus
                className="w-full px-3 py-1.5 rounded-xl text-sm font-bold bg-muted border border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center"
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={isUpdatingName}
                className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shrink-0"
              >
                {isUpdatingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5">
              <h3 className="text-base font-extrabold text-foreground">{groupTitle}</h3>
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer"
                title="Rename group"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-0.5">
            {conversation.members.length} members
          </p>
        </div>

        {/* Member Action Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Members ({conversation.members.length})</span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsAddMembersOpen(prev => !prev)}
            className="h-7 text-xs rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </Button>
        </div>

        {/* Add Members Drawer / Expandable List */}
        {isAddMembersOpen && (
          <div className="p-3 rounded-xl bg-muted/40 border border-emerald-500/20 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span>Select Friends to Add</span>
              <button
                type="button"
                onClick={() => setIsAddMembersOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={friendSearch}
                onChange={e => setFriendSearch(e.target.value)}
                placeholder="Search connected partners..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-card border border-border/70 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="max-h-36 overflow-y-auto divide-y divide-border/20 rounded-lg border border-border/50 bg-card/80 scrollbar-thin">
              {availableFriendsToAdd.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  All your connected partners are already in this group.
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No partners found matching search.
                </div>
              ) : (
                filteredCandidates.map(candidate => {
                  const isSelected = selectedNewUserIds.includes(candidate.id);
                  return (
                    <div
                      key={candidate.id}
                      onClick={() => toggleSelectCandidate(candidate.id)}
                      className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          src={candidate.avatar_path || undefined}
                          name={candidate.display_name}
                          size="sm"
                          className="w-7 h-7 text-[10px]"
                        />
                        <span className="text-xs font-semibold truncate text-foreground">
                          {candidate.display_name}
                        </span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-muted-foreground/40'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedNewUserIds.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={handleAddMembers}
                disabled={isAdding}
                className="w-full text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 cursor-pointer shadow-xs"
              >
                {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                <span>Add Selected ({selectedNewUserIds.length})</span>
              </Button>
            )}
          </div>
        )}

        {/* Existing Members List */}
        <div className="max-h-56 overflow-y-auto divide-y divide-border/30 rounded-xl border border-border/60 bg-card/60 scrollbar-thin">
          {conversation.members.map(member => {
            const isMe = member.user_id === profile?.id;
            const online = isUserOnline(member.user_id);
            const isUserAdmin = member.role === 'admin' || conversation.created_by === member.user_id;

            return (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-2.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    src={member.profile?.avatar_path || undefined}
                    name={member.profile?.display_name || 'Member'}
                    size="sm"
                    isOnline={online}
                    className="w-9 h-9 text-xs shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-foreground truncate">
                        {member.profile?.display_name || 'User'}
                      </h4>
                      {isMe && (
                        <span className="text-[10px] font-semibold text-muted-foreground px-1 py-0.2 rounded-md bg-muted">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {member.profile?.username ? `@${member.profile.username}` : (online ? 'Online' : 'Offline')}
                    </p>
                  </div>
                </div>

                {/* Role Badge */}
                <div>
                  {isUserAdmin ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span>Admin</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      <span>Member</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Leave Group Section */}
        <div className="pt-2 border-t border-border/60">
          {showConfirmLeave ? (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-2 animate-in fade-in duration-100">
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Are you sure you want to leave this group?
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirmLeave(false)}
                  disabled={isLeaving}
                  className="rounded-lg text-xs cursor-pointer h-7"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleLeaveGroup}
                  disabled={isLeaving}
                  className="rounded-lg text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1 cursor-pointer h-7"
                >
                  {isLeaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                  <span>Yes, Leave</span>
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmLeave(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave Group</span>
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
