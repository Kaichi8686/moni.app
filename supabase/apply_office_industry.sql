-- オフィス：業種カラム追加
-- 冪等

alter table public.office_companies
  add column if not exists industry text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'office_companies_industry_check'
  ) then
    alter table public.office_companies
      add constraint office_companies_industry_check
      check (
        industry is null
        or industry in ('cafe', 'apparel', 'game', 'festival', 'baito', 'sns')
      );
  end if;
end $$;

-- 会社名を 1〜12 文字に合わせる（超過分は切り詰め）
update public.office_companies
set name = left(name, 12)
where char_length(name) > 12;

alter table public.office_companies
  drop constraint if exists office_companies_name_check;

alter table public.office_companies
  add constraint office_companies_name_check
  check (char_length(name) between 1 and 12);
