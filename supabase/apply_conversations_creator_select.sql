-- Allow conversation creators to SELECT their new row before membership exists.
-- Needed for client insert+returning; also safe for creator-owned drafts.

drop policy if exists "conversations: members select" on public.conversations;
create policy "conversations: members select" on public.conversations
  for select using (
    public.is_conversation_member(id)
    or created_by = auth.uid()
  );
