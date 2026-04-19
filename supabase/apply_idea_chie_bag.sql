-- アイデア知恵袋（1回実行）— Supabase SQL Editor

create table if not exists public.idea_questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  author_display_name text not null,
  title text not null check (length(btrim(title)) > 0),
  body text not null default '',
  best_answer_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.idea_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.idea_questions (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_display_name text not null,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'idea_questions_best_answer_fkey') then
    alter table public.idea_questions
      add constraint idea_questions_best_answer_fkey
      foreign key (best_answer_id) references public.idea_answers (id) on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

alter table public.idea_questions enable row level security;
alter table public.idea_answers enable row level security;

drop policy if exists "read idea questions all" on public.idea_questions;
drop policy if exists "insert own idea questions" on public.idea_questions;
drop policy if exists "update own idea questions" on public.idea_questions;

create policy "read idea questions all" on public.idea_questions for select using (true);
create policy "insert own idea questions" on public.idea_questions for insert with check (
  auth.role() = 'authenticated' and auth.uid() = author_id
);
create policy "update own idea questions" on public.idea_questions for update using (auth.uid() = author_id);

drop policy if exists "read idea answers all" on public.idea_answers;
drop policy if exists "insert own idea answers" on public.idea_answers;
drop policy if exists "delete own idea answers" on public.idea_answers;

create policy "read idea answers all" on public.idea_answers for select using (true);
create policy "insert own idea answers" on public.idea_answers for insert with check (
  auth.role() = 'authenticated' and auth.uid() = author_id
);
create policy "delete own idea answers" on public.idea_answers for delete using (auth.uid() = author_id);
