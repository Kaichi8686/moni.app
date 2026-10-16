-- 課題作業スペースのフリーキャンバス（用紙・写真・矢印）を JSON で保存

alter table public.project_issues
  add column if not exists workspace_board_json jsonb;

comment on column public.project_issues.workspace_board_json is
  '作業スペースのフリーキャンバス（sheets / images / arrows）。アプリが workspace_text にも本文要約を同期する';
