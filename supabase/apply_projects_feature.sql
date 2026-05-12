-- Project feature MVP schema for dream-spark-pro

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  description text not null default '',
  category text not null default 'general',
  tags text[] not null default '{}',
  thumbnail_url text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  recruitment_target text not null default '',
  recruitment_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_join_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, requester_id, status) deferrable initially immediate
);

create table if not exists public.project_chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  attachment_url text,
  reply_to_id uuid references public.project_chat_messages (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_call_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  started_by uuid not null references auth.users (id) on delete cascade,
  room_url text not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.project_call_participants (
  call_session_id uuid not null references public.project_call_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (call_session_id, user_id)
);

create table if not exists public.project_boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null default 'Main Board',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, title)
);

create table if not exists public.project_board_elements (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.project_boards (id) on delete cascade,
  element_type text not null check (element_type in ('note', 'text', 'shape', 'pen')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete cascade,
  updated_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assignee_id uuid references auth.users (id) on delete set null,
  due_date date,
  created_by uuid not null references auth.users (id) on delete cascade,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_task_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source text not null default 'ai' check (source in ('ai', 'manual')),
  payload jsonb not null,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
  created_by uuid not null references auth.users (id) on delete cascade,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.project_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  type text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_visibility_updated on public.projects (visibility, updated_at desc);
create index if not exists idx_project_members_user on public.project_members (user_id, joined_at desc);
create index if not exists idx_join_requests_project_status on public.project_join_requests (project_id, status, created_at desc);
create index if not exists idx_project_chat_project_created on public.project_chat_messages (project_id, created_at desc);
create index if not exists idx_project_tasks_project_status on public.project_tasks (project_id, status, priority);

create or replace function public.project_is_member(p_project_id uuid, p_uid uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = p_uid
  );
$$;

create or replace function public.project_has_role(p_project_id uuid, p_uid uuid, p_roles text[])
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id
      and m.user_id = p_uid
      and m.role = any (p_roles)
  );
$$;

create or replace function public.project_on_insert_add_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists trg_project_insert_add_owner on public.projects;
create trigger trg_project_insert_add_owner
after insert on public.projects
for each row execute function public.project_on_insert_add_owner();

create or replace function public.project_review_join_request(p_request_id uuid, p_action text)
returns public.project_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.project_join_requests;
begin
  select * into req from public.project_join_requests r where r.id = p_request_id for update;
  if req.id is null then
    raise exception 'request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'request already reviewed';
  end if;
  if not public.project_has_role(req.project_id, auth.uid(), array['owner','admin']) then
    raise exception 'forbidden';
  end if;

  if p_action = 'accept' then
    insert into public.project_members (project_id, user_id, role)
    values (req.project_id, req.requester_id, 'member')
    on conflict (project_id, user_id) do nothing;

    update public.project_join_requests
      set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now()
      where id = req.id
      returning * into req;
  elsif p_action = 'reject' then
    update public.project_join_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
      where id = req.id
      returning * into req;
  else
    raise exception 'invalid action';
  end if;

  insert into public.project_notifications (user_id, project_id, type, body)
  values (
    req.requester_id,
    req.project_id,
    case when p_action = 'accept' then 'join_request_accepted' else 'join_request_rejected' end,
    case when p_action = 'accept' then '参加申請が承認されました。' else '参加申請が却下されました。' end
  );

  return req;
end;
$$;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_join_requests enable row level security;
alter table public.project_chat_messages enable row level security;
alter table public.project_call_sessions enable row level security;
alter table public.project_call_participants enable row level security;
alter table public.project_boards enable row level security;
alter table public.project_board_elements enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_task_suggestions enable row level security;
alter table public.project_notifications enable row level security;

create policy "projects read public or member" on public.projects for select using (
  visibility = 'public' or public.project_is_member(id, auth.uid()) or owner_id = auth.uid()
);
create policy "projects insert own owner" on public.projects for insert with check (auth.uid() = owner_id);
create policy "projects update owner admin" on public.projects for update using (
  public.project_has_role(id, auth.uid(), array['owner','admin']) or owner_id = auth.uid()
);
create policy "projects delete owner only" on public.projects for delete using (
  public.project_has_role(id, auth.uid(), array['owner']) or owner_id = auth.uid()
);

create policy "members read project members only" on public.project_members for select using (
  public.project_is_member(project_id, auth.uid()) or
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
);
create policy "members insert owner admin" on public.project_members for insert with check (
  public.project_has_role(project_id, auth.uid(), array['owner','admin'])
);
create policy "members insert self as project owner" on public.project_members for insert with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
);
create policy "members update owner only" on public.project_members for update using (
  public.project_has_role(project_id, auth.uid(), array['owner'])
);
create policy "members delete owner admin or self" on public.project_members for delete using (
  public.project_has_role(project_id, auth.uid(), array['owner','admin']) or user_id = auth.uid()
);

create policy "join request read owner admin or requester" on public.project_join_requests for select using (
  requester_id = auth.uid() or public.project_has_role(project_id, auth.uid(), array['owner','admin'])
);
create policy "join request create own" on public.project_join_requests for insert with check (
  requester_id = auth.uid()
  and exists (
    select 1 from public.projects p where p.id = project_id and p.visibility = 'public'
  )
);
create policy "join request cancel own pending" on public.project_join_requests for update using (
  requester_id = auth.uid() and status = 'pending'
);

create policy "project chat read members" on public.project_chat_messages for select using (
  public.project_is_member(project_id, auth.uid())
);
create policy "project chat insert members" on public.project_chat_messages for insert with check (
  sender_id = auth.uid() and public.project_is_member(project_id, auth.uid())
);

create policy "call sessions read members" on public.project_call_sessions for select using (
  public.project_is_member(project_id, auth.uid())
);
create policy "call sessions insert members" on public.project_call_sessions for insert with check (
  started_by = auth.uid() and public.project_is_member(project_id, auth.uid())
);
create policy "call sessions update starter admin owner" on public.project_call_sessions for update using (
  started_by = auth.uid() or public.project_has_role(project_id, auth.uid(), array['owner','admin'])
);

create policy "call participants read members" on public.project_call_participants for select using (
  exists (
    select 1 from public.project_call_sessions s
    where s.id = call_session_id and public.project_is_member(s.project_id, auth.uid())
  )
);
create policy "call participants upsert own membership" on public.project_call_participants for insert with check (
  user_id = auth.uid()
);
create policy "call participants update self" on public.project_call_participants for update using (user_id = auth.uid());

create policy "boards read members" on public.project_boards for select using (
  public.project_is_member(project_id, auth.uid())
);
create policy "boards insert members" on public.project_boards for insert with check (
  created_by = auth.uid() and public.project_is_member(project_id, auth.uid())
);
create policy "boards update members" on public.project_boards for update using (
  public.project_is_member(project_id, auth.uid())
);

create policy "board elements read members" on public.project_board_elements for select using (
  exists (
    select 1 from public.project_boards b
    where b.id = board_id and public.project_is_member(b.project_id, auth.uid())
  )
);
create policy "board elements write members" on public.project_board_elements for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.project_boards b
    where b.id = board_id and public.project_is_member(b.project_id, auth.uid())
  )
);
create policy "board elements update members" on public.project_board_elements for update using (
  exists (
    select 1 from public.project_boards b
    where b.id = board_id and public.project_is_member(b.project_id, auth.uid())
  )
);

create policy "tasks read members" on public.project_tasks for select using (
  public.project_is_member(project_id, auth.uid())
);
create policy "tasks write members" on public.project_tasks for insert with check (
  created_by = auth.uid() and public.project_is_member(project_id, auth.uid())
);
create policy "tasks update members" on public.project_tasks for update using (
  public.project_is_member(project_id, auth.uid())
);

create policy "task suggestions read members" on public.project_task_suggestions for select using (
  public.project_is_member(project_id, auth.uid())
);
create policy "task suggestions write members" on public.project_task_suggestions for insert with check (
  created_by = auth.uid() and public.project_is_member(project_id, auth.uid())
);
create policy "task suggestions update members" on public.project_task_suggestions for update using (
  public.project_is_member(project_id, auth.uid())
);

create policy "notifications read own" on public.project_notifications for select using (user_id = auth.uid());
create policy "notifications update own" on public.project_notifications for update using (user_id = auth.uid());
