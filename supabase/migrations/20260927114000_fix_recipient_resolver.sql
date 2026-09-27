create or replace function public.resolve_coldmail_recipients(p_addresses text[])
returns table(user_id uuid,address text)
language sql
security definer
set search_path=public
as $$
  select m.user_id,m.address
  from public.mail_addresses m
  where (select auth.uid()) is not null
    and m.address=any(p_addresses);
$$;

revoke all on function public.resolve_coldmail_recipients(text[]) from public;
grant execute on function public.resolve_coldmail_recipients(text[]) to authenticated;