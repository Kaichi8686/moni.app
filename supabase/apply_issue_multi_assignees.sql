-- 課題の担当を複数人対応（assignee_ids）
-- 既存の assignee_id は第1担当として残し、互換のため同期する

alter table public.project_issues
  add column if not exists assignee_ids uuid[] not null default '{}';

comment on column public.project_issues.assignee_ids is '担当メンバー（複数可）。空なら未担当';
comment on column public.project_issues.assignee_id is '互換用の第1担当。assignee_ids[1] と揃える';

-- 既存の単一担当を配列へ移行
update public.project_issues
set assignee_ids = array[assignee_id]
where assignee_id is not null
  and (assignee_ids is null or cardinality(assignee_ids) = 0);

create index if not exists idx_project_issues_assignee_ids
  on public.project_issues using gin (assignee_ids);
