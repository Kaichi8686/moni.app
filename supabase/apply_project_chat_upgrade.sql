-- プロジェクト内チャット統合（グループ全体 + メンバー個別DM）用アップグレード
-- ・project_direct_messages に画像添付列を追加
-- ・DM の閲覧を「送信者・受信者本人」に限定（同一プロジェクトのメンバー全員が見えてしまう問題を修正）

-- 個別DMテーブルが未作成の環境向けにフォールバックで作成
create table if not exists public.project_direct_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.project_direct_messages add column if not exists attachment_url text;

create index if not exists idx_project_direct_messages_project_created
  on public.project_direct_messages (project_id, created_at desc);
create index if not exists idx_project_direct_messages_pair
  on public.project_direct_messages (project_id, sender_id, receiver_id, created_at);

alter table public.project_direct_messages enable row level security;

-- 旧ポリシー（メンバー全員が閲覧可能）を置き換える
drop policy if exists "project dm read members" on public.project_direct_messages;
drop policy if exists "project dm insert members" on public.project_direct_messages;
drop policy if exists "project dm read participants" on public.project_direct_messages;
drop policy if exists "project dm insert participants" on public.project_direct_messages;

create policy "project dm read participants" on public.project_direct_messages for select using (
  (sender_id = auth.uid() or receiver_id = auth.uid())
  and exists (
    select 1 from public.project_members m
    where m.project_id = project_direct_messages.project_id and m.user_id = auth.uid()
  )
);

create policy "project dm insert participants" on public.project_direct_messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.project_members m
    where m.project_id = project_direct_messages.project_id and m.user_id = auth.uid()
  )
);
