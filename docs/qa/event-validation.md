# Event Validation Guide

This guide verifies that key activation/retention events are written to `app_events`.

## Required Event Set

- `signup_completed`
- `onboarding_started`
- `onboarding_completed`
- `first_post_started`
- `first_post_completed`
- `first_question_started`
- `first_question_completed`
- `first_ai_consult_started`
- `first_ai_consult_completed`
- `search_started`
- `dm_started`
- `pitch_created`
- `article_created`
- `return_visit_7d`

## Quick SQL Checks

Use Supabase SQL editor.

```sql
-- 1) Last 200 events
select created_at, user_id, page, event_name
from app_events
order by created_at desc
limit 200;
```

```sql
-- 2) Required events summary (last 7 days)
select event_name, count(*) as cnt
from app_events
where created_at >= now() - interval '7 day'
  and event_name in (
    'signup_completed',
    'onboarding_started',
    'onboarding_completed',
    'first_post_started',
    'first_post_completed',
    'first_question_started',
    'first_question_completed',
    'first_ai_consult_started',
    'first_ai_consult_completed',
    'search_started',
    'dm_started',
    'pitch_created',
    'article_created',
    'return_visit_7d'
  )
group by event_name
order by event_name;
```

```sql
-- 3) Funnel-style count for latest day
select event_name, count(*) as cnt
from app_events
where created_at >= now() - interval '1 day'
  and event_name in (
    'signup_completed',
    'onboarding_started',
    'onboarding_completed',
    'first_ai_consult_started',
    'first_ai_consult_completed',
    'first_post_started',
    'first_post_completed',
    'first_question_started',
    'first_question_completed',
    'search_started',
    'dm_started'
  )
group by event_name
order by min(created_at);
```

## Pass Criteria

- All required events appear at least once in staging/prod validation run.
- Each "started" event has corresponding "completed" events with expected ratio.
- No obvious spikes in error-related events during UX flow test.

