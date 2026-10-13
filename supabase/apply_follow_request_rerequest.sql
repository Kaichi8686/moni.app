-- Allow a follower to reopen their own accepted/rejected follow_request as pending.
-- Without this, unique(follower_id, following_id) makes re-follow appear to do nothing.
drop policy if exists "reopen own follow requests" on public.follow_requests;
create policy "reopen own follow requests" on public.follow_requests
for update
using (auth.uid() = follower_id)
with check (auth.uid() = follower_id and status = 'pending');

-- Approver can delete the request row when resolving (optional cleanup path).
drop policy if exists "delete incoming follow requests" on public.follow_requests;
create policy "delete incoming follow requests" on public.follow_requests
for delete
using (auth.uid() = following_id);
