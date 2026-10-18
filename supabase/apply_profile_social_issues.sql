-- 気になる社会問題（最大3つ・任意）
-- 形式: jsonb 文字列配列 例 ["環境・気候変動","教育格差"]

alter table public.profiles
  add column if not exists social_issues jsonb not null default '[]'::jsonb;

comment on column public.profiles.social_issues is '気になる社会問題タグ (string[], 最大3・任意)';
