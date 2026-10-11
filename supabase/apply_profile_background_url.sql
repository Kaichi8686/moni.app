-- プロフィール背景（カバー）画像
alter table public.profiles add column if not exists background_url text;

comment on column public.profiles.background_url is 'プロフィール画面の背景（カバー）画像 URL';
