create schema if not exists private;
create policy delivery_insert on public.delivery_events for insert to authenticated with check((select auth.uid())=recipient_user_id or exists(select 1 from public.messages m where m.id=message_id and m.sender_user_id=(select auth.uid())));
revoke all on function public.resolve_coldmail_recipients(text[]) from public;
drop function if exists public.resolve_coldmail_recipients(text[]);
create or replace function private.resolve_coldmail_recipients(p_addresses text[]) returns table(user_id uuid,address text) language sql security definer set search_path=public as $$
 select m.user_id,m.address from public.mail_addresses m where m.address=any(p_addresses);
$$;
revoke all on function private.resolve_coldmail_recipients(text[]) from public;
grant execute on function private.resolve_coldmail_recipients(text[]) to authenticated;
