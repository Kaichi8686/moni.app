-- Phase 1: タスクのステータス拡張（blocked / waiting）・オンボーディング用JSON・マイルストーン完了条件

-- 1) project_tasks.status を新チェックに（旧 todo/doing → マイグレーション後削除）
alter table public.project_tasks drop constraint if exists project_tasks_status_check;

update public.project_tasks set status = 'not_started' where status = 'todo';
update public.project_tasks set status = 'in_progress' where status = 'doing';

alter table public.project_tasks add constraint project_tasks_status_check
  check (status in ('not_started', 'in_progress', 'blocked', 'waiting', 'done'));

-- 2) オンボーディング用 JSON（プロジェクト単位）
alter table public.projects add column if not exists coaching_context jsonb not null default '{}'::jsonb;

comment on column public.projects.coaching_context is 'プロジェクトの追加コンテキスト: dreamStatement, stuckNow, roughDeadline, onboardingDoneAt など';

-- 3) マイルストーン（ロードマップステップ）の完了条件
alter table public.project_roadmap_steps add column if not exists completion_criteria text not null default '';
