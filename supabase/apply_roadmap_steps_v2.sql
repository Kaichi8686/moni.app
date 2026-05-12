-- ロードマップ拡張: 説明・期限・担当・メモ + 具体タスクとの紐付け

alter table public.project_roadmap_steps
  add column if not exists description text not null default '';

alter table public.project_roadmap_steps
  add column if not exists due_date date;

alter table public.project_roadmap_steps
  add column if not exists owner_id uuid references auth.users (id) on delete set null;

alter table public.project_roadmap_steps
  add column if not exists notes text not null default '';

alter table public.project_tasks
  add column if not exists roadmap_step_id uuid references public.project_roadmap_steps (id) on delete set null;

create index if not exists idx_project_tasks_roadmap_step on public.project_tasks (roadmap_step_id)
  where roadmap_step_id is not null;
