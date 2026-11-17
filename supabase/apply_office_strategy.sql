-- オフィス：作戦カード・ターゲット・結果ストーリー
-- 冪等

alter table public.office_incidents
  add column if not exists strategies jsonb not null default '[]'::jsonb;

alter table public.office_incidents
  add column if not exists targets jsonb not null default '[]'::jsonb;

alter table public.office_incidents
  add column if not exists strategy_rerolls int not null default 0;

alter table public.office_incidents
  drop constraint if exists office_incidents_strategy_rerolls_check;

alter table public.office_incidents
  add constraint office_incidents_strategy_rerolls_check
  check (strategy_rerolls >= 0 and strategy_rerolls <= 1);

alter table public.office_submissions
  add column if not exists strategy_id text;

alter table public.office_submissions
  add column if not exists strategy_kind text;

alter table public.office_submissions
  add column if not exists target_ids jsonb not null default '[]'::jsonb;

alter table public.office_submissions
  add column if not exists target_other_text text;

alter table public.office_submissions
  add column if not exists score_fit int;

alter table public.office_submissions
  add column if not exists story text;

alter table public.office_submissions
  add column if not exists story_tone text;

alter table public.office_submissions
  add column if not exists next_hint text;

alter table public.office_submissions
  add column if not exists multiplier numeric;

alter table public.office_submissions
  add column if not exists is_original boolean not null default false;

alter table public.office_submissions
  drop constraint if exists office_submissions_strategy_kind_check;

alter table public.office_submissions
  add constraint office_submissions_strategy_kind_check
  check (
    strategy_kind is null
    or strategy_kind in ('safe', 'standard', 'bold', 'custom')
  );

alter table public.office_submissions
  drop constraint if exists office_submissions_story_tone_check;

alter table public.office_submissions
  add constraint office_submissions_story_tone_check
  check (
    story_tone is null
    or story_tone in ('great', 'ok', 'bitter')
  );

alter table public.office_submissions
  drop constraint if exists office_submissions_score_fit_check;

alter table public.office_submissions
  add constraint office_submissions_score_fit_check
  check (score_fit is null or (score_fit >= 0 and score_fit <= 100));

alter table public.office_submissions
  drop constraint if exists office_submissions_target_other_text_check;

alter table public.office_submissions
  add constraint office_submissions_target_other_text_check
  check (
    target_other_text is null
    or char_length(btrim(target_other_text)) between 1 and 20
  );
