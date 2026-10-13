'use client';

import * as React from 'react';
import { ShieldCheck, Eye, Keyboard, BellRing, Trash2, Laptop, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export default function PrivacySettingsPage() {
  const { signOut } = useAuth();
  const router = useRouter();

  const [readReceipts, setReadReceipts] = React.useState(true);
  const [typingIndicators, setTypingIndicators] = React.useState(true);
  const [soundEffects, setSoundEffects] = React.useState(true);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setTimeout(async () => {
      await signOut();
      router.push('/');
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Privacy & Security</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your real-time presence, read receipts, and session security
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-6">
        {/* Real-Time Communication Preferences */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Real-Time Privacy</h3>

          <div className="space-y-3">
            {/* Read Receipts */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40">
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Read Receipts</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Let your friend see when you have read their messages (blue double checkmarks)
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={readReceipts}
                onChange={e => setReadReceipts(e.target.checked)}
                className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
              />
            </div>

            {/* Typing Indicators */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40">
              <div className="flex items-start gap-3">
                <Keyboard className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Typing Indicators</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Broadcast a subtle typing indicator when composing a message
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={typingIndicators}
                onChange={e => setTypingIndicators(e.target.checked)}
                className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
              />
            </div>

            {/* In-App Sounds */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40">
              <div className="flex items-start gap-3">
                <BellRing className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Notification Chimes</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Play audio feedback when new messages or media arrive
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundEffects}
                onChange={e => setSoundEffects(e.target.checked)}
                className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Active Session Info */}
        <div className="pt-6 border-t border-border/60 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Active Session</h3>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Current Web Browser</p>
                <p className="text-[11px] text-muted-foreground">Authenticated via Supabase SSR</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Active Now
            </span>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-6 border-t border-border/60 space-y-3">
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </h3>
          <p className="text-xs text-muted-foreground">
            Permanent account and personal data deletion
          </p>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-xl gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account & Conversations
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        size="md"
        title="Delete Account?"
        description="This action will permanently delete your account, messages, reactions, and uploaded attachments. This cannot be undone."
      >
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            isLoading={isDeleting}
            onClick={handleDeleteAccount}
          >
            Permanently Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
