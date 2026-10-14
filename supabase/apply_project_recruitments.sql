-- プロジェクトごとの複数募集（公開中 / 締切）
create table if not exists public.project_recruitments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null,
  message text not null default '',
  skill_name text not null default '',
  duration text not null default '1週間',
  compensation text not null default 'なし（経験・実績として）',
  skill_request_id uuid,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists project_recruitments_project_status_idx
  on public.project_recruitments (project_id, status, created_at desc);

create index if not exists project_recruitments_open_created_idx
  on public.project_recruitments (created_at desc)
  where status = 'open';

alter table public.project_recruitments enable row level security;

drop policy if exists "project_recruitments read open or member" on public.project_recruitments;
create policy "project_recruitments read open or member" on public.project_recruitments
  for select using (
    status = 'open'
    or exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid() or public.project_is_member(p.id, auth.uid()))
    )
  );

drop policy if exists "project_recruitments insert editor" on public.project_recruitments;
create policy "project_recruitments insert editor" on public.project_recruitments
  for insert with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          p.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members m
            where m.project_id = p.id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'admin')
          )
        )
    )
  );

drop policy if exists "project_recruitments update editor" on public.project_recruitments;
create policy "project_recruitments update editor" on public.project_recruitments
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          p.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members m
            where m.project_id = p.id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'admin')
          )
        )
    )
  );

-- 既存の単一募集フィールドを初期データとして取り込む
insert into public.project_recruitments (project_id, created_by, title, message, status)
select
  p.id,
  p.owner_id,
  nullif(trim(p.recruitment_target), ''),
  coalesce(p.recruitment_message, ''),
  'open'
from public.projects p
where (nullif(trim(p.recruitment_target), '') is not null or nullif(trim(p.recruitment_message), '') is not null)
  and not exists (
    select 1 from public.project_recruitments r where r.project_id = p.id
  )
  and nullif(trim(p.recruitment_target), '') is not null;
