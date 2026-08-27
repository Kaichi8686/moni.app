-- アイデア投票をサーバー共有化（メンバー間で正確に集計・1人1票をDBで担保）
-- 依存: public.projects, public.project_members, public.project_is_member(), public.project_has_role()

create table if not exists public.project_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_idea_votes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  idea_id uuid not null references public.project_ideas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  count integer not null default 1 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idea_id, user_id)
);

create table if not exists public.project_idea_settings (
  project_id uuid primary key references public.projects (id) on delete cascade,
  votes_per_person integer not null default 1 check (votes_per_person between 1 and 10),
  max_votes_per_idea integer not null default 1 check (max_votes_per_idea between 1 and 10),
  closed boolean not null default false,
  anonymous boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_ideas_project on public.project_ideas (project_id, created_at desc);
create index if not exists idx_project_idea_votes_project on public.project_idea_votes (project_id);
create index if not exists idx_project_idea_votes_idea on public.project_idea_votes (idea_id);

alter table public.project_ideas enable row level security;
alter table public.project_idea_votes enable row level security;
alter table public.project_idea_settings enable row level security;

-- ideas
drop policy if exists "ideas read members" on public.project_ideas;
create policy "ideas read members" on public.project_ideas for select using (
  public.project_is_member(project_id, auth.uid())
);
drop policy if exists "ideas insert members" on public.project_ideas;
create policy "ideas insert members" on public.project_ideas for insert with check (
  author_id = auth.uid() and public.project_is_member(project_id, auth.uid())
);
drop policy if exists "ideas update author or owner" on public.project_ideas;
create policy "ideas update author or owner" on public.project_ideas for update using (
  author_id = auth.uid() or public.project_has_role(project_id, auth.uid(), array['owner', 'admin'])
);
drop policy if exists "ideas delete author or owner" on public.project_ideas;
create policy "ideas delete author or owner" on public.project_ideas for delete using (
  author_id = auth.uid() or public.project_has_role(project_id, auth.uid(), array['owner', 'admin'])
);

-- votes（自分の票だけ操作可・集計は全員が閲覧可）
drop policy if exists "idea votes read members" on public.project_idea_votes;
create policy "idea votes read members" on public.project_idea_votes for select using (
  public.project_is_member(project_id, auth.uid())
);
drop policy if exists "idea votes insert own" on public.project_idea_votes;
create policy "idea votes insert own" on public.project_idea_votes for insert with check (
  user_id = auth.uid() and public.project_is_member(project_id, auth.uid())
);
drop policy if exists "idea votes update own" on public.project_idea_votes;
create policy "idea votes update own" on public.project_idea_votes for update using (
  user_id = auth.uid()
);
drop policy if exists "idea votes delete own" on public.project_idea_votes;
create policy "idea votes delete own" on public.project_idea_votes for delete using (
  user_id = auth.uid()
);

-- settings（閲覧は全員・変更はオーナー/管理者）
drop policy if exists "idea settings read members" on public.project_idea_settings;
create policy "idea settings read members" on public.project_idea_settings for select using (
  public.project_is_member(project_id, auth.uid())
);
drop policy if exists "idea settings insert owner" on public.project_idea_settings;
create policy "idea settings insert owner" on public.project_idea_settings for insert with check (
  public.project_has_role(project_id, auth.uid(), array['owner', 'admin'])
);
drop policy if exists "idea settings update owner" on public.project_idea_settings;
create policy "idea settings update owner" on public.project_idea_settings for update using (
  public.project_has_role(project_id, auth.uid(), array['owner', 'admin'])
);

-- リアルタイム配信（重複追加はスキップ）
do $$
begin
  begin
    alter publication supabase_realtime add table public.project_ideas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.project_idea_votes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.project_idea_settings;
  exception when duplicate_object then null;
  end;
end $$;
