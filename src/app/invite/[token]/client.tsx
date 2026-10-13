'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Heart,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import { hashToken } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/ui/brand-logo';

export default function InviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const { user, profile, isConfigured } = useAuth();
  const { refreshConversations } = useChat();

  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successConversationId, setSuccessConversationId] = React.useState<string | null>(null);

  const handleAcceptInvite = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMessage(null);

    if (!isConfigured) {
      setErrorMessage('Database connection is not configured.');
      setIsLoading(false);
      return;
    }

    try {
      const tokenHash = await hashToken(token);
      const supabase = getSupabaseBrowserClient();

      const { data: conversationId, error } = await supabase.rpc('accept_invitation', {
        p_token_hash: tokenHash,
      });

      if (error) {
        setErrorMessage(error.message);
      } else if (conversationId) {
        setSuccessConversationId(conversationId);
        await refreshConversations();
        router.push(`/chat/${conversationId}`);
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-[#0C3B2E]/15">
      <header className="p-4 flex items-center justify-between border-b border-[#0C3B2E]/10 bg-white/90 backdrop-blur-xl">
        <BrandLogo size="md" href="/" />
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Ambient Warm Gradient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-rose-500/10 dark:bg-rose-950/20 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            {/* Animated Connecting Double-Heart Motif */}
            <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-rose-500 text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-fuchsia-500/25 animate-pulse">
              <Heart className="w-8 h-8 fill-current text-white" />
              <Sparkles className="w-4 h-4 text-fuchsia-200 absolute -top-1 -right-1" />
            </div>

            <h1 className="text-3xl font-sans font-bold tracking-tight text-foreground">
              Someone saved a little space for you.
            </h1>
            <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto leading-relaxed">
              Your partner has invited you to connect privately on Vibely — where two souls sync, in your own little world.
            </p>
          </div>

          <div className="p-6 sm:p-7 rounded-3xl bg-card/90 border border-border/80 shadow-2xl space-y-5 backdrop-blur-md">
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Invitation unavailable</p>
                  <p className="text-[11px] leading-relaxed">
                    {errorMessage.includes('expired') || errorMessage.includes('invalid')
                      ? 'This link may have already been accepted or expired. Ask your partner for a new invitation.'
                      : errorMessage}
                  </p>
                </div>
              </div>
            )}

            {successConversationId ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="text-base font-semibold text-foreground">
                  Welcome to your private space!
                </h3>
                <p className="text-xs text-muted-foreground">
                  Connecting to your conversation...
                </p>
              </div>
            ) : user ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                    {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      Signed in as {profile?.display_name || user.email}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Ready to join your partner
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleAcceptInvite}
                  isLoading={isLoading}
                  className="w-full rounded-2xl font-semibold shadow-md bg-gradient-to-tr from-[#702C45] to-[#C96B83] text-white hover:opacity-95 cursor-pointer"
                >
                  Enter Our Space
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  To accept this invitation, sign in to your account or create one in seconds.
                </p>

                <div className="space-y-2.5">
                  <Link href={`/login?redirectTo=/invite/${token}`} className="block">
                    <Button className="w-full rounded-2xl font-semibold shadow-md bg-gradient-to-tr from-[#702C45] to-[#C96B83] text-white hover:opacity-95">
                      Sign In to Accept
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </Link>

                  <Link href={`/signup?redirectTo=/invite/${token}`} className="block">
                    <Button variant="outline" className="w-full rounded-2xl text-xs">
                      Create an Account
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            <div className="text-center pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Protected private connection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
