-- 興味のある分野（最大3つ・任意）
-- 形式: jsonb 文字列配列 例 ["AI・機械学習","音楽"]

alter table public.profiles
  add column if not exists interest_fields jsonb not null default '[]'::jsonb;

comment on column public.profiles.interest_fields is '興味のある分野タグ (string[], 最大3・任意)';
