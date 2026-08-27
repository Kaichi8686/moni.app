-- 投稿削除は本人のみ（Supabase SQL Editor で1回実行）
alter table public.posts enable row level security;

drop policy if exists "delete own posts" on public.posts;
create policy "delete own posts"
  on public.posts
  for delete
  using (auth.uid() = author_id);
