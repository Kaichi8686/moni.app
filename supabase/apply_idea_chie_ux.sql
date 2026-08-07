-- 質問・相談 UX拡張（1回実行）
-- category / last_reply_at / nested replies / votes
-- 既存の best_answer_id はそのまま

-- ── questions ──────────────────────────────────────────────
alter table public.idea_questions
  add column if not exists category text not null default 'howto';

alter table public.idea_questions
  add column if not exists last_reply_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'idea_questions_category_check'
  ) then
    alter table public.idea_questions
      add constraint idea_questions_category_check
      check (category in ('howto', 'tech', 'idea', 'other'));
  end if;
exception
  when duplicate_object then null;
end $$;

create index if not exists idea_questions_category_idx on public.idea_questions (category);
create index if not exists idea_questions_last_reply_idx on public.idea_questions (last_reply_at desc nulls last);

-- ── answers ────────────────────────────────────────────────
alter table public.idea_answers
  add column if not exists parent_answer_id uuid references public.idea_answers (id) on delete cascade;

alter table public.idea_answers
  add column if not exists score integer not null default 0;

create index if not exists idea_answers_parent_idx on public.idea_answers (parent_answer_id);
create index if not exists idea_answers_score_idx on public.idea_answers (question_id, score desc);

-- ── votes ──────────────────────────────────────────────────
create table if not exists public.idea_answer_votes (
  answer_id uuid not null references public.idea_answers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);

create index if not exists idea_answer_votes_user_idx on public.idea_answer_votes (user_id);

alter table public.idea_answer_votes enable row level security;

drop policy if exists "read idea answer votes all" on public.idea_answer_votes;
drop policy if exists "insert own idea answer votes" on public.idea_answer_votes;
drop policy if exists "update own idea answer votes" on public.idea_answer_votes;
drop policy if exists "delete own idea answer votes" on public.idea_answer_votes;

create policy "read idea answer votes all" on public.idea_answer_votes for select using (true);
create policy "insert own idea answer votes" on public.idea_answer_votes for insert with check (
  auth.role() = 'authenticated' and auth.uid() = user_id
);
create policy "update own idea answer votes" on public.idea_answer_votes for update using (auth.uid() = user_id);
create policy "delete own idea answer votes" on public.idea_answer_votes for delete using (auth.uid() = user_id);

-- ── triggers: last_reply_at ────────────────────────────────
create or replace function public.touch_idea_question_last_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.idea_questions
      set last_reply_at = new.created_at
      where id = new.question_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.idea_questions
      set last_reply_at = (
        select max(a.created_at) from public.idea_answers a where a.question_id = old.question_id
      )
      where id = old.question_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists idea_answers_touch_last_reply on public.idea_answers;
create trigger idea_answers_touch_last_reply
  after insert or delete on public.idea_answers
  for each row execute function public.touch_idea_question_last_reply();

-- ── triggers: score ────────────────────────────────────────
create or replace function public.recompute_idea_answer_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid;
begin
  aid := coalesce(new.answer_id, old.answer_id);
  update public.idea_answers
    set score = (
      select coalesce(sum(v.value), 0)::integer
      from public.idea_answer_votes v
      where v.answer_id = aid
    )
    where id = aid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists idea_answer_votes_recompute_score on public.idea_answer_votes;
create trigger idea_answer_votes_recompute_score
  after insert or update or delete on public.idea_answer_votes
  for each row execute function public.recompute_idea_answer_score();

-- backfill last_reply_at
update public.idea_questions q
set last_reply_at = s.max_created
from (
  select question_id, max(created_at) as max_created
  from public.idea_answers
  group by question_id
) s
where q.id = s.question_id and q.last_reply_at is null;
