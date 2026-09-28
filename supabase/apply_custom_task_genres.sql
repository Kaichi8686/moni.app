-- Allow project-defined custom task genres (ids: custom_<slug>)
-- Built-ins remain: think / make / talk / spread / run

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
