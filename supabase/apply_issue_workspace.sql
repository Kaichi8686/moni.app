-- 課題を「ジャンル + 作業スペース + 写真 + 提出」に切り替える
-- 旧5ステップの本文移行はアプリ起動時に行い、移行後 workflow_json を空にする

alter table public.project_issues
  add column if not exists genre text,
  add column if not exists workspace_text text,
  add column if not exists attachment_urls text[] not null default '{}',
  add column if not exists submitted_at timestamptz;

alter table public.project_issues drop constraint if exists project_issues_genre_check;
alter table public.project_issues
  add constraint project_issues_genre_check
  check (genre is null or genre in ('think', 'make', 'talk', 'spread', 'run'));

comment on column public.project_issues.genre is '課題ジャンル: think/make/talk/spread/run';
comment on column public.project_issues.workspace_text is '作業スペースの自由記述';
comment on column public.project_issues.attachment_urls is '写真フォルダからアップロードした画像URL';
comment on column public.project_issues.submitted_at is '提出日時。空なら未提出';

alter table public.project_issues
  add column if not exists begin_at timestamptz;

comment on column public.project_issues.begin_at is 'やり始めるタイミング';
