create or replace function private.user_can_access_message(p_message_id text,p_user_id uuid)
returns boolean
language sql
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.messages m
    where m.id=p_message_id
      and (
        m.sender_user_id=p_user_id
        or exists(
          select 1 from public.message_recipients r
          where r.message_id=m.id and r.recipient_user_id=p_user_id
        )
      )
  );
$$;

create or replace function private.user_is_message_recipient(p_message_id text,p_user_id uuid)
returns boolean
language sql
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.message_recipients r
    where r.message_id=p_message_id
      and r.recipient_user_id=p_user_id
  );
$$;

revoke all on function private.user_can_access_message(text,uuid) from public;
revoke all on function private.user_is_message_recipient(text,uuid) from public;
grant execute on function private.user_can_access_message(text,uuid) to authenticated;
grant execute on function private.user_is_message_recipient(text,uuid) to authenticated;

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
for select to authenticated
using (
  (select auth.uid())=sender_user_id
  or private.user_is_message_recipient(id,(select auth.uid()))
);

drop policy if exists recipients_read on public.message_recipients;
create policy recipients_read on public.message_recipients
for select to authenticated
using (
  (select auth.uid())=recipient_user_id
  or private.user_can_access_message(message_id,(select auth.uid()))
);

drop policy if exists recipients_insert on public.message_recipients;
create policy recipients_insert on public.message_recipients
for insert to authenticated
with check (
  private.user_can_access_message(message_id,(select auth.uid()))
);
