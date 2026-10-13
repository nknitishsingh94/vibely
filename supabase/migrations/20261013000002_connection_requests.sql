-- ====================================================================
-- CONNECTION REQUESTS & NOTIFICATION SUPPORT MIGRATION
-- Supports asynchronous 1-on-1 partner connection requests and acceptance
-- ====================================================================

-- 1. Index for fast lookup of incoming connection requests stored in invitations
CREATE INDEX IF NOT EXISTS idx_invitations_token_req
  ON public.invitations (token_hash)
  WHERE token_hash LIKE 'req:%';

-- 2. Dedicated connection_requests table (optional companion)
CREATE TABLE IF NOT EXISTS public.connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_connection_requests_receiver
  ON public.connection_requests (receiver_id, status);

CREATE INDEX IF NOT EXISTS idx_connection_requests_sender
  ON public.connection_requests (sender_id, status);

-- Enable RLS
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their connection requests" ON public.connection_requests;
CREATE POLICY "Users can view their connection requests"
  ON public.connection_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert connection requests" ON public.connection_requests;
CREATE POLICY "Users can insert connection requests"
  ON public.connection_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update their connection requests" ON public.connection_requests;
CREATE POLICY "Users can update their connection requests"
  ON public.connection_requests FOR UPDATE
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
