-- ビジネス向けロードマップ v3: フェーズゴール + フェーズ内タスク（課題タブの project_issues とは別）

alter table public.project_phases add column if not exists goal text default '';

alter table public.projects add column if not exists roadmap_business_type text default 'other'
  check (roadmap_business_type in ('food', 'retail', 'event', 'education', 'app', 'research', 'other'));

comment on column public.project_phases.goal is 'フェーズの一言ゴール（AI生成可）';
comment on column public.projects.roadmap_business_type is 'ロードマップテンプレート用の業種';

create table if not exists public.phase_tasks (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.project_phases (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  assignee_id uuid references auth.users (id) on delete set null,
  due_date timestamptz,
  priority text not null default 'medium'
    check (priority in ('urgent', 'high', 'medium', 'low')),
  is_today boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_phase_tasks_phase on public.phase_tasks (phase_id);
create index if not exists idx_phase_tasks_project on public.phase_tasks (project_id);
create index if not exists idx_phase_tasks_today on public.phase_tasks (project_id, is_today) where is_today = true;

alter table public.phase_tasks enable row level security;

drop policy if exists "phase tasks read members" on public.phase_tasks;
drop policy if exists "phase tasks write members" on public.phase_tasks;
create policy "phase tasks read members" on public.phase_tasks for select using (
  project_id in (select project_id from public.project_members where user_id = auth.uid())
);
create policy "phase tasks write members" on public.phase_tasks for all using (
  project_id in (select project_id from public.project_members where user_id = auth.uid())
) with check (
  project_id in (select project_id from public.project_members where user_id = auth.uid())
);

