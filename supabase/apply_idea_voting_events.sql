-- 投票の土台（選択肢・票）と投票イベントをまとめて作成
-- Supabase SQL Editor でこのファイルを全部実行してください。
-- 依存: public.projects, public.project_is_member(), public.project_has_role()

-- 1) 選択肢
create table if not exists public.project_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);

-- 2) 票
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

-- 3) 旧・プロジェクト全体設定（互換用）
create table if not exists public.project_idea_settings (
  project_id uuid primary key references public.projects (id) on delete cascade,
  votes_per_person integer not null default 1 check (votes_per_person between 1 and 10),
  max_votes_per_idea integer not null default 1 check (max_votes_per_idea between 1 and 10),
  closed boolean not null default false,
  anonymous boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 4) 投票イベント
create table if not exists public.project_idea_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null,
  description text not null default '',
  closes_at timestamptz,
  closed boolean not null default false,
  anonymous boolean not null default true,
  votes_per_person integer not null default 1 check (votes_per_person between 1 and 10),
  max_votes_per_idea integer not null default 1 check (max_votes_per_idea between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_ideas
  add column if not exists event_id uuid references public.project_idea_events (id) on delete cascade;

create index if not exists idx_project_ideas_project on public.project_ideas (project_id, created_at desc);
create index if not exists idx_project_ideas_event on public.project_ideas (event_id, created_at desc);
create index if not exists idx_project_idea_votes_project on public.project_idea_votes (project_id);
create index if not exists idx_project_idea_votes_idea on public.project_idea_votes (idea_id);
create index if not exists idx_project_idea_events_project on public.project_idea_events (project_id, created_at desc);

alter table public.project_ideas enable row level security;
alter table public.project_idea_votes enable row level security;
alter table public.project_idea_settings enable row level security;
alter table public.project_idea_events enable row level security;

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

drop policy if exists "idea events read members" on public.project_idea_events;
create policy "idea events read members" on public.project_idea_events for select using (
  public.project_is_member(project_id, auth.uid())
);
drop policy if exists "idea events insert members" on public.project_idea_events;
create policy "idea events insert members" on public.project_idea_events for insert with check (
  created_by = auth.uid() and public.project_is_member(project_id, auth.uid())
);
drop policy if exists "idea events update author or owner" on public.project_idea_events;
create policy "idea events update author or owner" on public.project_idea_events for update using (
  created_by = auth.uid() or public.project_has_role(project_id, auth.uid(), array['owner', 'admin'])
);
drop policy if exists "idea events delete author or owner" on public.project_idea_events;
create policy "idea events delete author or owner" on public.project_idea_events for delete using (
  created_by = auth.uid() or public.project_has_role(project_id, auth.uid(), array['owner', 'admin'])
);

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
  begin
    alter publication supabase_realtime add table public.project_idea_events;
  exception when duplicate_object then null;
  end;
end $$;

comment on table public.project_idea_events is
  '投票イベント。選択肢は project_ideas.event_id で紐づく';
