-- メッセージをリアルタイム配信する
-- Supabase SQL Editor で全部実行してください。

do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null; when undefined_table then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null; when undefined_table then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversation_members;
  exception when duplicate_object then null; when undefined_table then null;
  end;
  begin
    alter publication supabase_realtime add table public.message_reactions;
  exception when duplicate_object then null; when undefined_table then null;
  end;
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null; when undefined_table then null;
  end;
  begin
    alter publication supabase_realtime add table public.project_chat_messages;
  exception when duplicate_object then null; when undefined_table then null;
  end;
  begin
    alter publication supabase_realtime add table public.project_direct_messages;
  exception when duplicate_object then null; when undefined_table then null;
  end;
  begin
    alter publication supabase_realtime add table public.chat_dm_rooms;
  exception when duplicate_object then null; when undefined_table then null;
  end;
end $$;

do $$
begin
  if to_regclass('public.messages') is not null then
    execute 'alter table public.messages replica identity full';
  end if;
  if to_regclass('public.conversations') is not null then
    execute 'alter table public.conversations replica identity full';
  end if;
  if to_regclass('public.conversation_members') is not null then
    execute 'alter table public.conversation_members replica identity full';
  end if;
  if to_regclass('public.message_reactions') is not null then
    execute 'alter table public.message_reactions replica identity full';
  end if;
  if to_regclass('public.chat_messages') is not null then
    execute 'alter table public.chat_messages replica identity full';
  end if;
  if to_regclass('public.project_chat_messages') is not null then
    execute 'alter table public.project_chat_messages replica identity full';
  end if;
  if to_regclass('public.project_direct_messages') is not null then
    execute 'alter table public.project_direct_messages replica identity full';
  end if;
  if to_regclass('public.chat_dm_rooms') is not null then
    execute 'alter table public.chat_dm_rooms replica identity full';
  end if;
end $$;
