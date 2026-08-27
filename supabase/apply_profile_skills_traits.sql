-- プロフィール: 特技・性格（chip 複数選択）
-- skills は apply_grand_vision.sql で既存。traits のみ追加。
-- 形式: jsonb 文字列配列 例 ["プログラミング","デザイン"]

alter table public.profiles
  add column if not exists traits jsonb not null default '[]'::jsonb;

comment on column public.profiles.skills is '特技タグ (string[])';
comment on column public.profiles.traits is '性格タグ (string[])';
