-- ユーザー定義のプロジェクト型（ロードマップ構造のスナップショット）
-- apply_linear_workspace.sql と apply_roadmap_phase_tasks.sql の後に実行

create table if not exists public.project_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  source_project_id uuid references public.projects (id) on delete set null,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  kind text not null default 'phases'
    check (kind in ('phases', 'milestones', 'both')),
  definition jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_templates_owner on public.project_templates (owner_id, updated_at desc);
create index if not exists idx_project_templates_public on public.project_templates (is_public, updated_at desc)
  where is_public = true;

comment on table public.project_templates is 'プロジェクトのロードマップ構造テンプレート（Notion のデータベース複製に近い）';
comment on column public.project_templates.definition is 'JSON: { version, phases: [{ title, goal, durationDays, color, tasks? }] }';

alter table public.projects add column if not exists last_template_id uuid references public.project_templates (id) on delete set null;

alter table public.project_templates enable row level security;

drop policy if exists "templates read own or public" on public.project_templates;
create policy "templates read own or public" on public.project_templates for select using (
  owner_id = auth.uid() or is_public = true
);

drop policy if exists "templates insert own" on public.project_templates;
create policy "templates insert own" on public.project_templates for insert with check (
  owner_id = auth.uid()
);

drop policy if exists "templates update own" on public.project_templates;
create policy "templates update own" on public.project_templates for update using (
  owner_id = auth.uid()
) with check (
  owner_id = auth.uid()
);

drop policy if exists "templates delete own" on public.project_templates;
create policy "templates delete own" on public.project_templates for delete using (
  owner_id = auth.uid()
);
