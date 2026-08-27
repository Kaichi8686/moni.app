-- 課題ごとの「解決へ進む」ステップ（タブ）を JSON で保存
alter table public.project_issues
  add column if not exists workflow_json jsonb default null;

comment on column public.project_issues.workflow_json is '解決ステップ（タブ）の進捗・メモ';
