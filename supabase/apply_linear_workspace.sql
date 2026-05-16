-- Linear-like workspace: project columns + phases + issues (run after apply_projects_feature.sql)

alter table public.projects add column if not exists icon text default '📁';
alter table public.projects add column if not exists start_date timestamptz;
alter table public.projects add column if not exists target_date timestamptz;
alter table public.projects add column if not exists linear_status text default 'planned'
  check (linear_status in ('backlog', 'planned', 'in_progress', 'paused', 'completed', 'cancelled'));
alter table public.projects add column if not exists lead_id uuid references auth.users (id) on delete set null;

comment on column public.projects.linear_status is 'Linear-style project lifecycle (separate from task workflow)';

create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text default '',
  status text not null default 'planned'
    check (status in ('backlog', 'planned', 'in_progress', 'paused', 'completed', 'cancelled')),
  start_date timestamptz not null,
  end_date timestamptz not null,
  color text not null default 'purple',
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_phases_project_order on public.project_phases (project_id, "order");

create table if not exists public.project_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_id uuid references public.project_phases (id) on delete set null,
  title text not null check (length(btrim(title)) > 0),
  description text default '',
  status text not null default 'backlog'
    check (status in ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled')),
  priority text not null default 'no_priority'
    check (priority in ('no_priority', 'urgent', 'high', 'medium', 'low')),
  assignee_id uuid references auth.users (id) on delete set null,
  due_date timestamptz,
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_issues_project_status on public.project_issues (project_id, status);
create index if not exists idx_project_issues_phase on public.project_issues (phase_id);

alter table public.project_phases enable row level security;
alter table public.project_issues enable row level security;

drop policy if exists "project phases read members" on public.project_phases;
drop policy if exists "project phases write members" on public.project_phases;
create policy "project phases read members" on public.project_phases for select using (
  project_id in (select project_id from public.project_members where user_id = auth.uid())
);
create policy "project phases write members" on public.project_phases for all using (
  project_id in (select project_id from public.project_members where user_id = auth.uid())
) with check (
  project_id in (select project_id from public.project_members where user_id = auth.uid())
);

drop policy if exists "project issues read members" on public.project_issues;
drop policy if exists "project issues write members" on public.project_issues;
create policy "project issues read members" on public.project_issues for select using (
  project_id in (select project_id from public.project_members where user_id = auth.uid())
);
create policy "project issues write members" on public.project_issues for all using (
  project_id in (select project_id from public.project_members where user_id = auth.uid())
) with check (
  project_id in (select project_id from public.project_members where user_id = auth.uid())
);

-- Public projects: allow read phases/issues for visibility check (optional discoverability)
drop policy if exists "project phases read public project" on public.project_phases;
create policy "project phases read public project" on public.project_phases for select using (
  exists (
    select 1 from public.projects p
    where p.id = project_phases.project_id and p.visibility = 'public'
  )
);

drop policy if exists "project issues read public project" on public.project_issues;
create policy "project issues read public project" on public.project_issues for select using (
  exists (
    select 1 from public.projects p
    where p.id = project_issues.project_id and p.visibility = 'public'
  )
);
