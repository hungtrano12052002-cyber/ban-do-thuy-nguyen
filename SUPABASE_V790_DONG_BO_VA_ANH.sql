-- V7.9.0. Run in the SAME Supabase project as config.js.
-- Existing places, resident records and existing facility images are preserved.
-- Prerequisite for a new project only: run supabase_setup.sql first.
begin;
alter table public.profiles add column if not exists tdp_access text[] not null default '{}';
alter table public.profiles add column if not exists can_edit boolean not null default false;
alter table public.places add column if not exists revision bigint not null default 1;
create or replace function public.can_access_place(place_data jsonb, need_edit boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and
 (lower(p.role)='admin' or ((not need_edit or p.can_edit) and
 lower(trim(coalesce(place_data->>'wardBlock','')))=any(select lower(trim(x)) from unnest(p.tdp_access) x))));
$$;
revoke all on function public.can_access_place(jsonb,boolean) from public;
grant execute on function public.can_access_place(jsonb,boolean) to authenticated;
create or replace function public.get_my_access()
returns table(role text,tdp_access text[],can_edit boolean)
language sql stable security definer set search_path=public as $$
 select lower(p.role),case when lower(p.role)='admin' then array['*']::text[] else p.tdp_access end,
 (lower(p.role)='admin' or p.can_edit) from public.profiles p where p.id=auth.uid();
$$;
revoke all on function public.get_my_access() from public;
grant execute on function public.get_my_access() to authenticated;
alter table public.profiles enable row level security;
drop policy if exists v790_own_profile on public.profiles;
create policy v790_own_profile on public.profiles for select to authenticated using(id=auth.uid());
alter table public.places enable row level security;
-- Restrictive gates also constrain permissive policies left by earlier versions.
drop policy if exists v790_select_gate on public.places;
drop policy if exists v790_update_gate on public.places;
drop policy if exists v790_insert_gate on public.places;
drop policy if exists v790_delete_gate on public.places;
create policy v790_select_gate on public.places as restrictive for select to authenticated using(public.can_access_place(data,false));
create policy v790_update_gate on public.places as restrictive for update to authenticated using(public.can_access_place(data,true)) with check(public.can_access_place(data,true));
create policy v790_insert_gate on public.places as restrictive for insert to authenticated with check(exists(select 1 from public.profiles where id=auth.uid() and lower(role)='admin'));
create policy v790_delete_gate on public.places as restrictive for delete to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and lower(role)='admin'));
drop policy if exists v790_select on public.places;
drop policy if exists v790_update on public.places;
drop policy if exists v790_insert on public.places;
drop policy if exists v790_delete on public.places;
create policy v790_select on public.places for select to authenticated using(public.can_access_place(data,false));
create policy v790_update on public.places for update to authenticated using(public.can_access_place(data,true)) with check(public.can_access_place(data,true));
create policy v790_insert on public.places for insert to authenticated with check(exists(select 1 from public.profiles where id=auth.uid() and lower(role)='admin'));
create policy v790_delete on public.places for delete to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and lower(role)='admin'));
-- Revision changes on ALL updates, including writes from older app versions.
create or replace function public.tn_revision_trigger() returns trigger
language plpgsql set search_path=public as $$ begin
 if TG_OP='INSERT' then new.revision:=1; else new.revision:=old.revision+1; end if;
 new.updated_at:=clock_timestamp(); new.updated_by:=auth.uid(); return new;
end $$;
drop trigger if exists tn_revision on public.places;
create trigger tn_revision before insert or update on public.places for each row execute function public.tn_revision_trigger();
create or replace function public.tn_save_place(p_id text,p_data jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare previous public.places%rowtype; saved public.places%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_data->>'id' is distinct from p_id then raise exception 'INVALID_ID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id,790));
 select * into previous from public.places where id=p_id;
 if found then
  if not public.can_access_place(previous.data,true) then raise exception 'WRITE_DENIED'; end if;
  select * into previous from public.places where id=p_id for update;
  if not found then raise exception 'SYNC_CONFLICT'; end if;
  if previous.data=p_data then return to_jsonb(previous); end if;
  if previous.revision is distinct from p_expected_revision then raise exception 'SYNC_CONFLICT'; end if;
  update public.places set data=p_data where id=p_id returning * into saved;
  if not found then raise exception 'WRITE_DENIED'; end if;
 else
  if p_expected_revision is not null then raise exception 'SYNC_CONFLICT'; end if;
  insert into public.places(id,data) values(p_id,p_data) returning * into saved;
 end if;
 return to_jsonb(saved);
end $$;
revoke all on function public.tn_save_place(text,jsonb,bigint) from public;
grant execute on function public.tn_save_place(text,jsonb,bigint) to authenticated;
grant select,insert,update,delete on public.places to authenticated;
grant select on public.profiles to authenticated;
-- Portraits and legal papers never use the public facility-image bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tn-private-media','tn-private-media',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.tn_media_access(object_name text,need_edit boolean)
returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and lower(role)='admin')
 or exists(select 1 from public.places where id=split_part(object_name,'/',1) and public.can_access_place(data,need_edit));
$$;
revoke all on function public.tn_media_access(text,boolean) from public;
grant execute on function public.tn_media_access(text,boolean) to authenticated;
drop policy if exists tn_private_read on storage.objects;
drop policy if exists tn_private_insert on storage.objects;
drop policy if exists tn_private_delete on storage.objects;
create policy tn_private_read on storage.objects for select to authenticated using(bucket_id='tn-private-media' and public.tn_media_access(name,false));
create policy tn_private_insert on storage.objects for insert to authenticated with check(bucket_id='tn-private-media' and public.tn_media_access(name,true));
create policy tn_private_delete on storage.objects for delete to authenticated using(bucket_id='tn-private-media' and public.tn_media_access(name,true));
-- Constrain any old broad storage policy for the new bucket as well.
drop policy if exists tn_private_select_gate on storage.objects;
drop policy if exists tn_private_insert_gate on storage.objects;
drop policy if exists tn_private_update_gate on storage.objects;
drop policy if exists tn_private_delete_gate on storage.objects;
create policy tn_private_select_gate on storage.objects as restrictive for select to authenticated using(bucket_id<>'tn-private-media' or public.tn_media_access(name,false));
create policy tn_private_insert_gate on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'tn-private-media' or public.tn_media_access(name,true));
create policy tn_private_update_gate on storage.objects as restrictive for update to authenticated using(bucket_id<>'tn-private-media') with check(bucket_id<>'tn-private-media');
create policy tn_private_delete_gate on storage.objects as restrictive for delete to authenticated using(bucket_id<>'tn-private-media' or public.tn_media_access(name,true));
-- No anonymous access even if the project has broad legacy policies.
drop policy if exists tn_private_anon_gate on storage.objects;
create policy tn_private_anon_gate on storage.objects as restrictive for all to anon using(bucket_id<>'tn-private-media') with check(bucket_id<>'tn-private-media');
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='places') then
 alter publication supabase_realtime add table public.places;
 end if;
end $$;

-- Lock and merge only GPS fields so background geocoding preserves resident edits.
create or replace function public.tn_patch_gps(p_id text,p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare saved public.places%rowtype; clean jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 clean:=jsonb_build_object('lat',p_patch->'lat','lng',p_patch->'lng','coordinateSource',p_patch->'coordinateSource','coordinateUpdatedAt',p_patch->'coordinateUpdatedAt');
 if p_patch ? 'resolvedMapsUrl' then clean:=clean||jsonb_build_object('resolvedMapsUrl',p_patch->'resolvedMapsUrl'); end if;
 update public.places set data=data||clean where id=p_id returning * into saved;
 if not found then raise exception 'WRITE_DENIED'; end if;
 return to_jsonb(saved);
end $$;
revoke all on function public.tn_patch_gps(text,jsonb) from public;
grant execute on function public.tn_patch_gps(text,jsonb) to authenticated;

commit;
