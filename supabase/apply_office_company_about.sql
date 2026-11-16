-- オフィス：会社の説明（自由記述）カラム
-- 冪等

alter table public.office_companies
  add column if not exists about text;

alter table public.office_companies
  drop constraint if exists office_companies_about_check;

alter table public.office_companies
  add constraint office_companies_about_check
  check (
    about is null
    or char_length(btrim(about)) between 8 and 100
  );

-- 旧系統だけの会社は説明を空のままにし、アプリ側で補完 UI を出す
