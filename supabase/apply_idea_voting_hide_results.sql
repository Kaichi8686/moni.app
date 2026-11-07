-- 投票結果を締切まで非公開にできるフラグ
-- Supabase SQL Editor で実行してください。

alter table public.project_idea_events
  add column if not exists hide_results_until_close boolean not null default false;

comment on column public.project_idea_events.hide_results_until_close is
  'true のとき、締切まで票数・結果を誰にも見せない';
