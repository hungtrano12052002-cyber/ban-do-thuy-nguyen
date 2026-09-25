-- V7.7.2: add an editable display name for the authenticated ADMIN profile.
alter table public.profiles add column if not exists display_name text;

-- The app reads the signed-in email from Supabase Auth (auth.getUser), not from a hard-coded value.
-- Password changes use Supabase Auth updateUser(), so passwords are never stored in public.profiles.

-- Allow each authenticated user to update only their own profile row.
drop policy if exists "profiles_update_own_v772" on public.profiles;
create policy "profiles_update_own_v772"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
