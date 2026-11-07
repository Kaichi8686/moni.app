-- 募集ごとの応募者
create table if not exists public.project_recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  recruitment_id uuid not null references public.project_recruitments (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  applicant_id uuid not null references auth.users (id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  join_request_id uuid references public.project_join_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (recruitment_id, applicant_id)
);

create index if not exists project_recruitment_applications_recruitment_idx
  on public.project_recruitment_applications (recruitment_id, status, created_at desc);

create index if not exists project_recruitment_applications_project_idx
  on public.project_recruitment_applications (project_id, status, created_at desc);

alter table public.project_recruitment_applications enable row level security;

drop policy if exists "recruitment applications read member or own" on public.project_recruitment_applications;
create policy "recruitment applications read member or own" on public.project_recruitment_applications
  for select using (
    auth.uid() = applicant_id
    or exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid() or public.project_is_member(p.id, auth.uid()))
    )
  );

drop policy if exists "recruitment applications insert own" on public.project_recruitment_applications;
create policy "recruitment applications insert own" on public.project_recruitment_applications
  for insert with check (
    auth.uid() = applicant_id
    and not exists (
      select 1 from public.project_members m
      where m.project_id = project_recruitment_applications.project_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "recruitment applications update editor or own cancel" on public.project_recruitment_applications;
create policy "recruitment applications update editor or own cancel" on public.project_recruitment_applications
  for update using (
    (
      auth.uid() = applicant_id
      and status = 'pending'
    )
    or exists (
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
