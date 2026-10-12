-- Project social: likes, favorites (bookmarks), and per-user "working on" focus
-- Re-runnable. Depends on: apply_projects_feature.sql (projects, project_members, project_is_member)

-- ---------------------------------------------------------------------------
-- Likes (軽いいいね。お気に入りとは独立)
-- ---------------------------------------------------------------------------
create table if not exists public.project_likes (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_project_likes_user on public.project_likes (user_id, created_at desc);
create index if not exists idx_project_likes_project on public.project_likes (project_id);

alter table public.projects
  add column if not exists like_count integer not null default 0;

create or replace function public.project_like_count_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.projects
      set like_count = coalesce(like_count, 0) + 1
    where id = new.project_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.projects
      set like_count = greatest(0, coalesce(like_count, 0) - 1)
    where id = old.project_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_project_likes_count on public.project_likes;
create trigger trg_project_likes_count
after insert or delete on public.project_likes
for each row execute function public.project_like_count_sync();

-- Backfill counts (safe if already correct)
update public.projects p
set like_count = coalesce(c.cnt, 0)
from (
  select project_id, count(*)::integer as cnt
  from public.project_likes
  group by project_id
) c
where p.id = c.project_id;

alter table public.project_likes enable row level security;

drop policy if exists "project likes read all" on public.project_likes;
create policy "project likes read all"
  on public.project_likes for select
  using (true);

drop policy if exists "project likes insert own" on public.project_likes;
create policy "project likes insert own"
  on public.project_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          p.visibility = 'public'
          or p.owner_id = auth.uid()
          or public.project_is_member(p.id, auth.uid())
        )
    )
  );

drop policy if exists "project likes delete own" on public.project_likes;
create policy "project likes delete own"
  on public.project_likes for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Favorites / bookmarks (保存。いいねとは独立)
-- ---------------------------------------------------------------------------
create table if not exists public.project_favorites (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_project_favorites_user on public.project_favorites (user_id, created_at desc);

alter table public.project_favorites enable row level security;

drop policy if exists "project favorites read own" on public.project_favorites;
create policy "project favorites read own"
  on public.project_favorites for select
  using (auth.uid() = user_id);

drop policy if exists "project favorites insert own" on public.project_favorites;
create policy "project favorites insert own"
  on public.project_favorites for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          p.visibility = 'public'
          or p.owner_id = auth.uid()
          or public.project_is_member(p.id, auth.uid())
        )
    )
  );

drop policy if exists "project favorites delete own" on public.project_favorites;
create policy "project favorites delete own"
  on public.project_favorites for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Working-on focus: one project per user (must be a member)
-- ---------------------------------------------------------------------------
create table if not exists public.user_project_focus (
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

create index if not exists idx_user_project_focus_project on public.user_project_focus (project_id);

alter table public.user_project_focus enable row level security;

drop policy if exists "user project focus read own" on public.user_project_focus;
create policy "user project focus read own"
  on public.user_project_focus for select
  using (auth.uid() = user_id);

drop policy if exists "user project focus upsert own" on public.user_project_focus;
create policy "user project focus upsert own"
  on public.user_project_focus for insert
  with check (
    auth.uid() = user_id
    and public.project_is_member(project_id, auth.uid())
  );

drop policy if exists "user project focus update own" on public.user_project_focus;
create policy "user project focus update own"
  on public.user_project_focus for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.project_is_member(project_id, auth.uid())
  );

drop policy if exists "user project focus delete own" on public.user_project_focus;
create policy "user project focus delete own"
  on public.user_project_focus for delete
  using (auth.uid() = user_id);

create or replace function public.user_project_focus_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_project_focus_touch on public.user_project_focus;
create trigger trg_user_project_focus_touch
before insert or update on public.user_project_focus
for each row execute function public.user_project_focus_touch();

-- Clear focus when membership is removed (keep owner row intact until project delete cascades)
create or replace function public.clear_focus_on_member_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_project_focus
  where user_id = old.user_id
    and project_id = old.project_id;
  return old;
end;
$$;

drop trigger if exists trg_clear_focus_on_member_leave on public.project_members;
create trigger trg_clear_focus_on_member_leave
after delete on public.project_members
for each row execute function public.clear_focus_on_member_leave();
