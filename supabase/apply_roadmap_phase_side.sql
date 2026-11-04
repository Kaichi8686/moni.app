-- ロードマップ：本線の横に置くマス（side_of = 親マス、lane = 左右）
alter table public.project_phases
  add column if not exists side_of uuid references public.project_phases(id) on delete cascade;

alter table public.project_phases
  add column if not exists lane smallint not null default 0;

comment on column public.project_phases.side_of is '横置きの親マス（null = 本線）';
comment on column public.project_phases.lane is '本線からの左右: -1 左 / 0 本線 / 1 右';
