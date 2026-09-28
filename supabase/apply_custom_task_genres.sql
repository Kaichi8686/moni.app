-- Allow project-defined custom task genres (ids: custom_<slug>)
-- Built-ins remain: think / make / talk / spread / run
-- Safe to re-run: adds missing columns first, then relaxes the check constraint.

alter table public.project_issues
  add column if not exists genre text,
  add column if not exists workspace_text text,
  add column if not exists attachment_urls text[] not null default '{}',
  add column if not exists submitted_at timestamptz,
  add column if not exists begin_at timestamptz;

alter table public.project_issues drop constraint if exists project_issues_genre_check;
alter table public.project_issues
  add constraint project_issues_genre_check
  check (
    genre is null
    or genre in ('think', 'make', 'talk', 'spread', 'run')
    or genre ~ '^custom_[a-z0-9]{4,24}$'
  );

comment on column public.project_issues.genre is
  '課題ジャンル: think/make/talk/spread/run または custom_<id>（プロジェクトの customTaskGenres で定義）';
comment on column public.project_issues.workspace_text is '作業スペースの自由記述';
comment on column public.project_issues.attachment_urls is '写真フォルダからアップロードした画像URL';
comment on column public.project_issues.submitted_at is '提出日時。空なら未提出';
comment on column public.project_issues.begin_at is 'やり始めるタイミング';
