-- V7.5.5: optional server-side TDP permission enforcement for Supabase.
-- Review/back up before running in SQL Editor.
alter table public.profiles add column if not exists tdp_access text[] not null default '{}';
alter table public.profiles add column if not exists can_edit boolean not null default false;
-- ADMIN should keep role='admin'. User profiles receive tdp_access such as ARRAY['TDP 1','TDP 2'].
-- NOTE: the current places schema stores facility fields inside jsonb column data.
alter table public.places enable row level security;
drop policy if exists "v755_select_places_by_tdp" on public.places;
create policy "v755_select_places_by_tdp" on public.places for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and (p.role='admin' or (data->>'wardBlock')=any(p.tdp_access)))
);
drop policy if exists "v755_update_places_by_tdp" on public.places;
create policy "v755_update_places_by_tdp" on public.places for update to authenticated using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and (p.role='admin' or (p.can_edit and (data->>'wardBlock')=any(p.tdp_access))))
) with check (
  exists (select 1 from public.profiles p where p.id=auth.uid() and (p.role='admin' or (p.can_edit and (data->>'wardBlock')=any(p.tdp_access))))
);
