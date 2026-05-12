-- Project space upgrade: DM / docs / roadmap / schedule

create table if not exists public.project_direct_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists idx_project_direct_messages_project_created on public.project_direct_messages (project_id, created_at desc);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null default '新しいドキュメント',
  content text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_documents_project_updated on public.project_documents (project_id, updated_at desc);

create table if not exists public.project_roadmap_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  position integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_roadmap_steps_project_position on public.project_roadmap_steps (project_id, position);

create table if not exists public.project_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  attendees text[] not null default '{}',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_schedules_project_starts_at on public.project_schedules (project_id, starts_at);

alter table public.projects add column if not exists business_type text check (business_type in ('maker', 'software', 'social'));

alter table public.project_direct_messages enable row level security;
alter table public.project_documents enable row level security;
alter table public.project_roadmap_steps enable row level security;
alter table public.project_schedules enable row level security;

drop policy if exists "project dm read members" on public.project_direct_messages;
drop policy if exists "project dm insert members" on public.project_direct_messages;
create policy "project dm read members" on public.project_direct_messages for select using (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
);
create policy "project dm insert members" on public.project_direct_messages for insert with check (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
  and sender_id = auth.uid()
);

drop policy if exists "project docs read members" on public.project_documents;
drop policy if exists "project docs write members" on public.project_documents;
create policy "project docs read members" on public.project_documents for select using (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
);
create policy "project docs write members" on public.project_documents for all using (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
) with check (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
);

drop policy if exists "project roadmap read members" on public.project_roadmap_steps;
drop policy if exists "project roadmap write members" on public.project_roadmap_steps;
create policy "project roadmap read members" on public.project_roadmap_steps for select using (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
);
create policy "project roadmap write members" on public.project_roadmap_steps for all using (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
) with check (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
);

drop policy if exists "project schedule read members" on public.project_schedules;
drop policy if exists "project schedule write members" on public.project_schedules;
create policy "project schedule read members" on public.project_schedules for select using (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
);
create policy "project schedule write members" on public.project_schedules for all using (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
) with check (
  exists (select 1 from public.project_members m where m.project_id = project_id and m.user_id = auth.uid())
);
