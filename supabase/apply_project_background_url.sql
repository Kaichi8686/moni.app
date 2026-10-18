-- プロジェクト概要の背景（カバー）画像。正方形の thumbnail_url とは別。
alter table public.projects add column if not exists background_url text;

comment on column public.projects.background_url is 'プロジェクト概要の背景（カバー）画像 URL。thumbnail_url（正方形写真）とは別';
