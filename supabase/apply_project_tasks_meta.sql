-- タスク画面の「選択肢」「自由記述」「回答の保存」用メタデータ

alter table public.project_tasks
  add column if not exists meta jsonb not null default '{}'::jsonb;

comment on column public.project_tasks.meta is 'UI用: inputKind, choiceOptions, placeholder, answer など';

-- 例（選択式タスク）:
-- update public.project_tasks set
--   description = 'このお菓子は誰向けに作りますか？',
--   meta = jsonb_build_object(
--     'inputKind', 'choice',
--     'choiceOptions', jsonb_build_array('小学生', '中学生', '大人', '全員')
--   ),
--   due_date = (current_date),
--   priority = 'high'
-- where id = '…';
