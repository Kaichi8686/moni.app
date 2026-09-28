-- サインアップ後オンボーディング用プロフィール項目
-- age: 年齢（整数） / country: ISO 3166-1 alpha-2 / onboarding_completed_at: 完了日時

alter table public.profiles
  add column if not exists age integer;

alter table public.profiles
  add column if not exists country text;

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.age is '年齢（オンボーディング・プロフィール）';
comment on column public.profiles.country is '国コード ISO 3166-1 alpha-2（例: JP）';
comment on column public.profiles.onboarding_completed_at is '初回オンボーディング完了日時';

-- 妥当な年齢のみ許可（NULL 可）
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_age_range'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_age_range
      check (age is null or (age >= 5 and age <= 120));
  end if;
end $$;
