-- 文化祭シフト合わせ（スタンドアロン・ログイン不要）
-- API は service role 経由で読み書きする想定

create table if not exists public.festival_shift_boards (
  id text primary key,
  code text not null unique,
  admin_key text not null,
  title text not null default '',
  note text not null default '',
  days jsonb not null default '[]'::jsonb,
  slots jsonb not null default '[]'::jsonb,
  roles jsonb not null default '[]'::jsonb,
  assignments jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.festival_shift_responses (
  id text primary key,
  board_id text not null references public.festival_shift_boards (id) on delete cascade,
  name text not null,
  prefs jsonb not null default '{}'::jsonb,
  preferred_role_ids jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_festival_shift_boards_code
  on public.festival_shift_boards (code);
create index if not exists idx_festival_shift_responses_board
  on public.festival_shift_responses (board_id, created_at);

alter table public.festival_shift_boards enable row level security;
alter table public.festival_shift_responses enable row level security;

-- 公開RLSは付けない（anon 直アクセス不可）。サーバー API のみ。
