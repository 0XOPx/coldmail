create schema if not exists private;

create or replace function private.consume_signup_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.rate_limits;
begin
  insert into public.rate_limits(key) values(p_key) on conflict(key) do nothing;
  select * into r from public.rate_limits where key=p_key for update;
  if r.window_started_at + make_interval(secs=>p_window_seconds) <= now() then
    update public.rate_limits set window_started_at=now(),count=1 where key=p_key;
    return true;
  end if;
  if r.count >= p_limit then return false; end if;
  update public.rate_limits set count=count+1 where key=p_key;
  return true;
end;
$$;

revoke all on function private.consume_signup_rate_limit(text,integer,integer) from public;
grant execute on function private.consume_signup_rate_limit(text,integer,integer) to service_role;
