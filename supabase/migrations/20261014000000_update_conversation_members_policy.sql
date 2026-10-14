-- Allow authenticated users to update their own conversation_members row (for last_read_at)
DROP POLICY IF EXISTS "Users can update their own membership row" ON public.conversation_members;
CREATE POLICY "Users can update their own membership row"
  ON public.conversation_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
