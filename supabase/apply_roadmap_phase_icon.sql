-- ロードマップ各ステップのマス内アイコン
alter table public.project_phases
  add column if not exists icon text default 'star';

comment on column public.project_phases.icon is 'ロードマップマスのアイコンキー（star / book / flag など）';
