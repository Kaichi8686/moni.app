-- 承認者（following_id）がクライアントから follows を INSERT するための RLS。
-- 従来は follower_id = auth.uid() のみ許可されており、承認時の INSERT が常に拒否されていた。

drop policy if exists "insert follows when approving follow request" on public.follows;

create policy "insert follows when approving follow request" on public.follows
for insert
with check (
  auth.uid() = following_id
  and exists (
    select 1
    from public.follow_requests fr
    where fr.follower_id = follower_id
      and fr.following_id = following_id
      and fr.status = 'pending'
  )
);
