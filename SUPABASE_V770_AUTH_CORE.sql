-- V7.7.0: canonical authenticated access resolver.
-- Run once in Supabase SQL Editor.
create or replace function public.get_my_access()
returns table(role text, tdp_access text[], can_edit boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    case when lower(coalesce(p.role,'user'))='admin' then 'admin' else 'user' end::text,
    case when lower(coalesce(p.role,'user'))='admin' then array['*']::text[] else coalesce(p.tdp_access, array[]::text[]) end,
    case when lower(coalesce(p.role,'user'))='admin' then true else coalesce(p.can_edit,false) end
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;
revoke all on function public.get_my_access() from public;
grant execute on function public.get_my_access() to authenticated;

-- Diagnostic: this must return the UUID/profile that belongs to the signed-in account when called by the app.
-- IMPORTANT: set the owner's profile role to admin in Table Editor if it is not already admin.
