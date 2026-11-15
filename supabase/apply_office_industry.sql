-- オフィス：業種（〇〇系）カラム追加
-- 冪等

alter table public.office_companies
  add column if not exists industry text;

-- 旧具体業種が残っていれば系へマップ（カラム追加直後は空でも可）
update public.office_companies set industry = 'food' where industry in ('cafe', 'baito');
update public.office_companies set industry = 'fashion' where industry = 'apparel';
update public.office_companies set industry = 'tech' where industry = 'game';
update public.office_companies set industry = 'event' where industry = 'festival';
update public.office_companies set industry = 'media' where industry = 'sns';

alter table public.office_companies
  drop constraint if exists office_companies_industry_check;

alter table public.office_companies
  add constraint office_companies_industry_check
  check (
    industry is null
    or industry in (
      'food', 'fashion', 'tech', 'event', 'shop',
      'media', 'learn', 'health', 'community'
    )
  );

-- 会社名を 1〜12 文字に合わせる（超過分は切り詰め）
update public.office_companies
set name = left(name, 12)
where char_length(name) > 12;

alter table public.office_companies
  drop constraint if exists office_companies_name_check;

alter table public.office_companies
  add constraint office_companies_name_check
  check (char_length(name) between 1 and 12);
