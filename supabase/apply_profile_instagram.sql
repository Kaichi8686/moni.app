-- プロフィール拡張（インスタ風プロフィール画面用）
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists is_private boolean not null default false;

-- 既存 goal を bio にコピー（bio が空のとき）
update public.profiles
set bio = goal
where (bio is null or btrim(bio) = '')
  and goal is not null
  and btrim(goal) <> '';

-- Storage: Dashboard → Storage → New bucket
-- 名前: avatars / Public / image/jpeg,image/png,image/webp / 5MB
