-- ロードマップテンプレートギャラリー（apply_linear_workspace.sql / apply_roadmap_phase_tasks.sql の後）

create table if not exists public.roadmap_templates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete cascade not null,
  title text not null,
  description text,
  category text not null default 'other'
    check (category in ('app', 'hardware', 'service', 'food', 'event', 'retail', 'research', 'other')),
  business_type text,
  is_public boolean default false,
  use_count integer default 0,
  like_count integer default 0,
  phases_json jsonb not null,
  tags text[] default '{}',
  thumbnail_emoji text default '📋',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_roadmap_templates_public on public.roadmap_templates (is_public, use_count desc);
create index if not exists idx_roadmap_templates_author on public.roadmap_templates (author_id);

create table if not exists public.template_uses (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.roadmap_templates (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  used_at timestamptz default now(),
  unique (template_id, project_id)
);

create table if not exists public.template_likes (
  template_id uuid references public.roadmap_templates (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  primary key (template_id, user_id)
);

alter table public.roadmap_templates enable row level security;
alter table public.template_uses enable row level security;
alter table public.template_likes enable row level security;

drop policy if exists "public templates are readable by all" on public.roadmap_templates;
create policy "public templates are readable by all"
  on public.roadmap_templates for select
  using (is_public = true or author_id = auth.uid());

drop policy if exists "own templates write" on public.roadmap_templates;
create policy "own templates write"
  on public.roadmap_templates for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "template uses read own" on public.template_uses;
create policy "template uses read own"
  on public.template_uses for select
  using (user_id = auth.uid());

drop policy if exists "template uses insert own" on public.template_uses;
create policy "template uses insert own"
  on public.template_uses for insert
  with check (user_id = auth.uid());

drop policy if exists "template likes read all" on public.template_likes;
create policy "template likes read all"
  on public.template_likes for select
  using (true);

drop policy if exists "template likes write own" on public.template_likes;
create policy "template likes write own"
  on public.template_likes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.increment_template_use(tid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.roadmap_templates
  set use_count = use_count + 1, updated_at = now()
  where id = tid;
$$;

grant execute on function public.increment_template_use(uuid) to authenticated;
