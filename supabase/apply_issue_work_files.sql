-- 課題に紐づく作業ファイル一覧（ドキュメント / ホワイトボード / 作業スペース）
alter table public.project_issues
  add column if not exists work_files_json jsonb;

comment on column public.project_issues.work_files_json is
  '課題の作業ファイル一覧 JSON。kind=doc|board|canvas。canvas は board オブジェクトを内包可。';
