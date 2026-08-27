-- Web Push 購読（PWA通知）
-- VAPID 生成: npx web-push generate-vapid-keys
-- Vercel env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET, RESEND_API_KEY, RESEND_FROM
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions read own" on public.push_subscriptions;
create policy "push_subscriptions read own"
  on public.push_subscriptions for select using (auth.uid() = user_id);

drop policy if exists "push_subscriptions insert own" on public.push_subscriptions;
create policy "push_subscriptions insert own"
  on public.push_subscriptions for insert with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions delete own" on public.push_subscriptions;
create policy "push_subscriptions delete own"
  on public.push_subscriptions for delete using (auth.uid() = user_id);

alter table public.profiles add column if not exists notify_push boolean not null default true;
alter table public.profiles add column if not exists notify_email_weekly boolean not null default false;
