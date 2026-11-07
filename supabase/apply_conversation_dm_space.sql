-- DM（direct conversation）専用の共有スペース
-- ドキュメント / ホワイトボード / 作業ファイル一覧（課題の work_files と同型）
-- 依存: conversations, conversation_members, is_conversation_member()

create table if not exists public.conversation_spaces (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  work_files_json jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.conversation_spaces is
  'DM などの会話に紐づく共有ファイル一覧。work_files_json は課題と同型 (doc|board|canvas|photo|link)。';

create table if not exists public.conversation_documents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  title text not null default '無題のドキュメント',
  content text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversation_documents_conv_updated
  on public.conversation_documents (conversation_id, updated_at desc);

create table if not exists public.conversation_boards (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  title text not null default '無題のボード',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversation_boards_conv_updated
  on public.conversation_boards (conversation_id, updated_at desc);

create table if not exists public.conversation_board_elements (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.conversation_boards (id) on delete cascade,
  element_type text not null check (element_type in ('note', 'text', 'shape', 'pen')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete cascade,
  updated_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversation_board_elements_board
  on public.conversation_board_elements (board_id, created_at);

alter table public.conversation_spaces enable row level security;
alter table public.conversation_documents enable row level security;
alter table public.conversation_boards enable row level security;
alter table public.conversation_board_elements enable row level security;

drop policy if exists "conversation spaces member all" on public.conversation_spaces;
create policy "conversation spaces member all" on public.conversation_spaces
  for all using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));

drop policy if exists "conversation docs member all" on public.conversation_documents;
create policy "conversation docs member all" on public.conversation_documents
  for all using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));

drop policy if exists "conversation boards member all" on public.conversation_boards;
create policy "conversation boards member all" on public.conversation_boards
  for all using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));

drop policy if exists "conversation board elements member all" on public.conversation_board_elements;
create policy "conversation board elements member all" on public.conversation_board_elements
  for all using (
    exists (
      select 1 from public.conversation_boards b
      where b.id = board_id and public.is_conversation_member(b.conversation_id)
    )
  )
  with check (
    exists (
      select 1 from public.conversation_boards b
      where b.id = board_id and public.is_conversation_member(b.conversation_id)
    )
  );
