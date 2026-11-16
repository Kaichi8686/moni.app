-- オフィス業種を「〇〇系」に変更
-- 冪等。旧 cafe/apparel/... は新IDへマップ

-- 旧値の移行
update public.office_companies set industry = 'food' where industry in ('cafe', 'baito');
update public.office_companies set industry = 'fashion' where industry = 'apparel';
update public.office_companies set industry = 'tech' where industry = 'game';
update public.office_companies set industry = 'event' where industry = 'festival';
update public.office_companies set industry = 'media' where industry = 'sns';

-- チェック制約を差し替え
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
