-- Optional profile photo URL for matching / discovery lists (public read via existing profiles policy)
alter table public.profiles add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is 'Optional HTTPS URL for avatar image; shown in discovery/matching when set.';
