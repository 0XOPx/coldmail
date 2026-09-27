alter table public.profiles add column if not exists onboarding_complete boolean not null default false;
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
create table if not exists public.legal_acceptances(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 document text not null,
 version text not null,
 accepted_at timestamptz not null default now(),
 unique(user_id,document,version)
);
alter table public.legal_acceptances enable row level security;
create policy legal_acceptances_self on public.legal_acceptances for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create index if not exists legal_acceptances_user on public.legal_acceptances(user_id,accepted_at desc);

create or replace function public.create_coldmail_identity(p_user_id uuid,p_username text,p_display_name text) returns public.mail_addresses language plpgsql security definer set search_path=public as $$
declare r public.mail_addresses;
declare v_username text;
begin
 if auth.uid() is distinct from p_user_id then raise exception 'unauthorized'; end if;
 v_username:=lower(trim(p_username));
 if v_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then raise exception 'invalid_username'; end if;
 select * into r from public.mail_addresses where user_id=p_user_id and is_primary=true limit 1;
 if r.id is not null then
   if r.username=v_username then
     return r;
   end if;
   raise exception 'address_already_set';
 end if;
 if exists(select 1 from public.mail_addresses where username=v_username) then raise exception 'username_taken'; end if;
 insert into public.mail_addresses(user_id,address,username,is_primary) values(p_user_id,v_username||'@coldmail.com',v_username,true) returning * into r;
 update public.profiles set display_name=left(p_display_name,120),updated_at=now() where id=p_user_id;
 return r;
exception when unique_violation then
 raise exception 'username_taken';
end;
$$;
revoke all on function public.create_coldmail_identity(uuid,text,text) from anon;
grant execute on function public.create_coldmail_identity(uuid,text,text) to authenticated;

insert into public.profiles(id,display_name,onboarding_complete,onboarding_completed_at)
select p.id,p.display_name,true,coalesce(p.updated_at,now())
from public.profiles p
where exists(select 1 from public.mail_addresses a where a.user_id=p.id and a.is_primary=true)
on conflict(id) do update set onboarding_complete=excluded.onboarding_complete,onboarding_completed_at=excluded.onboarding_completed_at;
