-- ====================================================================
-- FIX INFINITE RECURSION IN CONVERSATION_MEMBERS RLS POLICY
-- ====================================================================

-- 1. Helper function with PLPGSQL and SECURITY DEFINER so PostgreSQL never inlines it
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id UUID, usr_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id AND user_id = usr_id
  );
END;
$$;

-- 2. Policy for conversation_members
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid())
  );

-- 3. Policy for conversations
DROP POLICY IF EXISTS "Users can view conversations they belong to" ON public.conversations;
CREATE POLICY "Users can view conversations they belong to"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(id, auth.uid())
  );

-- 4. Policies for messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Authorized members can send messages" ON public.messages;
CREATE POLICY "Authorized members can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid())
  );

