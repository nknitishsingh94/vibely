-- Add group chat fields to conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS avatar_path TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Ensure conversation_members policies allow adding members and leaving groups
DROP POLICY IF EXISTS "Users can insert members for their conversations" ON public.conversation_members;
CREATE POLICY "Users can insert members for their conversations"
  ON public.conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR 
    public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their membership to leave group" ON public.conversation_members;
CREATE POLICY "Users can delete their membership to leave group"
  ON public.conversation_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update conversations they belong to" ON public.conversations;
CREATE POLICY "Users can update conversations they belong to"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (public.is_conversation_member(id, auth.uid()))
  WITH CHECK (public.is_conversation_member(id, auth.uid()));
