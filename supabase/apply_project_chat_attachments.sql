-- プロジェクトチャット: 画像のみ送信・DM添付を許可

alter table public.project_chat_messages
  drop constraint if exists project_chat_messages_body_check;

alter table public.project_chat_messages
  add constraint project_chat_messages_body_check check (
    length(btrim(body)) > 0
    or attachment_url is not null
  );

alter table public.project_direct_messages
  add column if not exists attachment_url text;

alter table public.project_direct_messages
  drop constraint if exists project_direct_messages_body_check;

alter table public.project_direct_messages
  add constraint project_direct_messages_body_check check (
    char_length(body) between 1 and 4000
    or attachment_url is not null
  );
