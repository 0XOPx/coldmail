create extension if not exists pg_trgm;

create type public.message_recipient_kind as enum ('to','cc','bcc');
create type public.delivery_status as enum ('Accepted','Queued','Delivered','Rejected','Invalid','Unauthorized','RecipientNotFound','RateLimited','Failed');

create table public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 bio text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.mail_addresses(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 address text not null unique,
 username text not null unique,
 is_primary boolean not null default true,
 created_at timestamptz not null default now(),
 constraint address_format check(address=lower(address) and address like '%@coldmail.com')
);

create table public.threads(
 id text primary key,
 owner_user_id uuid not null references public.profiles(id) on delete cascade,
 subject text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.messages(
 id text primary key,
 sender_user_id uuid not null references public.profiles(id) on delete cascade,
 thread_id text not null references public.threads(id) on delete cascade,
 subject text not null default '',
 body text not null default '',
 impf_raw text not null,
 message_id text not null unique,
 in_reply_to text,
 content_type text not null default 'text/impf',
 sent_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);

create table public.message_recipients(
 id uuid primary key default gen_random_uuid(),
 message_id text not null references public.messages(id) on delete cascade,
 recipient_user_id uuid not null references public.profiles(id) on delete cascade,
 address text not null,
 kind public.message_recipient_kind not null,
 folder text not null default 'inbox',
 is_read boolean not null default false,
 is_starred boolean not null default false,
 created_at timestamptz not null default now(),
 unique(message_id,recipient_user_id,kind)
);

create table public.attachments(
 id uuid primary key default gen_random_uuid(),
 message_id text not null references public.messages(id) on delete cascade,
 owner_user_id uuid not null references public.profiles(id) on delete cascade,
 storage_path text not null unique,
 filename text not null,
 mime_type text not null,
 size_bytes bigint not null check(size_bytes>=0),
 created_at timestamptz not null default now()
);

create table public.folders(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,name text not null,slug text not null,unique(user_id,slug));
create table public.labels(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,name text not null,color text,unique(user_id,name));
create table public.message_labels(message_id text references public.messages(id) on delete cascade,label_id uuid references public.labels(id) on delete cascade,primary key(message_id,label_id));
create table public.drafts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,to_addresses text[] not null default '{}',cc_addresses text[] not null default '{}',bcc_addresses text[] not null default '{}',subject text not null default '',body text not null default '',thread_id text references public.threads(id) on delete set null,updated_at timestamptz not null default now(),created_at timestamptz not null default now());
create table public.delivery_events(id uuid primary key default gen_random_uuid(),message_id text references public.messages(id) on delete cascade,recipient_user_id uuid references public.profiles(id) on delete cascade,event_type text not null,status public.delivery_status not null,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table public.spam_reports(id uuid primary key default gen_random_uuid(),message_id text references public.messages(id) on delete cascade,reporter_user_id uuid not null references public.profiles(id) on delete cascade,reason text not null,created_at timestamptz not null default now(),unique(message_id,reporter_user_id));
create table public.user_preferences(user_id uuid primary key references public.profiles(id) on delete cascade,theme text not null default 'system',signature text not null default '',notify_new_mail boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.sessions_devices(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,device_name text not null,created_at timestamptz not null default now(),last_seen_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete set null,action text not null,target_type text,target_id text,metadata jsonb not null default '{}',created_at timestamptz not null default now());

create index recipients_mailbox on public.message_recipients(recipient_user_id,folder,created_at desc);
create index recipients_unread on public.message_recipients(recipient_user_id,is_read,created_at desc);
create index messages_thread on public.messages(thread_id,sent_at desc);
create index messages_subject_trgm on public.messages using gin(subject gin_trgm_ops);
create index messages_body_trgm on public.messages using gin(body gin_trgm_ops);
create index messages_sender on public.messages(sender_user_id,sent_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'username',''));
 insert into public.user_preferences(user_id) values(new.id);
 return new;
end;
$$;
revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.create_coldmail_identity(p_user_id uuid,p_username text,p_display_name text) returns public.mail_addresses language plpgsql security definer set search_path=public as $$
declare r public.mail_addresses;
begin
 if auth.uid() is distinct from p_user_id then raise exception 'unauthorized'; end if;
 insert into public.mail_addresses(user_id,address,username) values(p_user_id,lower(p_username)||'@coldmail.com',lower(p_username)) returning * into r;
 update public.profiles set display_name=left(p_display_name,120),updated_at=now() where id=p_user_id;
 return r;
end;
$$;
revoke all on function public.create_coldmail_identity(uuid,text,text) from public;
grant execute on function public.create_coldmail_identity(uuid,text,text) to authenticated;

create or replace function public.resolve_coldmail_recipients(p_addresses text[]) returns table(user_id uuid,address text) language sql security definer set search_path=public as $$
 select m.user_id,m.address from public.mail_addresses m where m.address=any(p_addresses);
$$;
revoke all on function public.resolve_coldmail_recipients(text[]) from public;
grant execute on function public.resolve_coldmail_recipients(text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.mail_addresses enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;
alter table public.attachments enable row level security;
alter table public.folders enable row level security;
alter table public.labels enable row level security;
alter table public.message_labels enable row level security;
alter table public.drafts enable row level security;
alter table public.delivery_events enable row level security;
alter table public.spam_reports enable row level security;
alter table public.user_preferences enable row level security;
alter table public.sessions_devices enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self on public.profiles for all to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy addresses_self on public.mail_addresses for select to authenticated using((select auth.uid())=user_id);
create policy addresses_insert on public.mail_addresses for insert to authenticated with check((select auth.uid())=user_id);
create policy threads_self on public.threads for all to authenticated using((select auth.uid())=owner_user_id) with check((select auth.uid())=owner_user_id);
create policy messages_read on public.messages for select to authenticated using((select auth.uid())=sender_user_id or exists(select 1 from public.message_recipients r where r.message_id=id and r.recipient_user_id=(select auth.uid())));
create policy messages_insert on public.messages for insert to authenticated with check((select auth.uid())=sender_user_id);
create policy recipients_read on public.message_recipients for select to authenticated using((select auth.uid())=recipient_user_id or exists(select 1 from public.messages m where m.id=message_id and m.sender_user_id=(select auth.uid())));
create policy recipients_insert on public.message_recipients for insert to authenticated with check(exists(select 1 from public.messages m where m.id=message_id and m.sender_user_id=(select auth.uid())));
create policy recipients_update on public.message_recipients for update to authenticated using((select auth.uid())=recipient_user_id) with check((select auth.uid())=recipient_user_id);
create policy attachments_self on public.attachments for all to authenticated using((select auth.uid())=owner_user_id) with check((select auth.uid())=owner_user_id);
create policy folders_self on public.folders for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy labels_self on public.labels for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy message_labels_self on public.message_labels for all to authenticated using(exists(select 1 from public.labels l where l.id=label_id and l.user_id=(select auth.uid()))) with check(exists(select 1 from public.labels l where l.id=label_id and l.user_id=(select auth.uid())));
create policy drafts_self on public.drafts for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy delivery_read on public.delivery_events for select to authenticated using((select auth.uid())=recipient_user_id or exists(select 1 from public.messages m where m.id=message_id and m.sender_user_id=(select auth.uid())));
create policy spam_self on public.spam_reports for all to authenticated using((select auth.uid())=reporter_user_id) with check((select auth.uid())=reporter_user_id);
create policy preferences_self on public.user_preferences for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy sessions_self on public.sessions_devices for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy audit_self on public.audit_logs for select to authenticated using((select auth.uid())=user_id);

insert into storage.buckets(id,name,public) values('attachments','attachments',false) on conflict(id) do nothing;
create policy attachment_read on storage.objects for select to authenticated using(bucket_id='attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy attachment_write on storage.objects for insert to authenticated with check(bucket_id='attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
