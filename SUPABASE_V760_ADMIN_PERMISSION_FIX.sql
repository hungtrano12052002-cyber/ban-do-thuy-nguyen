-- V7.6.0 - sửa xác minh ADMIN + phân quyền TDP an toàn.
-- Chạy toàn bộ file này trong Supabase SQL Editor bằng tài khoản chủ dự án.

alter table public.profiles add column if not exists tdp_access text[] not null default '{}';
alter table public.profiles add column if not exists can_edit boolean not null default false;

-- Cho chính người đăng nhập đọc quyền của mình. ADMIN có thể đọc profiles để quản trị.
alter table public.profiles enable row level security;
drop policy if exists "v760_read_own_profile" on public.profiles;
create policy "v760_read_own_profile" on public.profiles for select to authenticated
using (id = auth.uid());

-- RPC chỉ trả quyền của CHÍNH auth.uid(), tránh lỗi profiles RLS làm ADMIN bị nhận thành USER.
create or replace function public.current_access_profile()
returns table(role text, tdp_access text[], can_edit boolean)
language sql security definer set search_path=public
as $$
  select lower(coalesce(p.role,'user'))::text,
         coalesce(p.tdp_access,'{}'::text[]),
         case when lower(coalesce(p.role,'user'))='admin' then true else coalesce(p.can_edit,false) end
  from public.profiles p where p.id=auth.uid() limit 1;
$$;
revoke all on function public.current_access_profile() from public;
grant execute on function public.current_access_profile() to authenticated;

-- Helper SECURITY DEFINER dùng cho places RLS, tránh policy tự truy vấn profiles dưới RLS.
create or replace function public.can_access_place(place_data jsonb, need_edit boolean default false)
returns boolean language sql stable security definer set search_path=public
as $$
 select exists(
   select 1 from public.profiles p
   where p.id=auth.uid() and (
     lower(coalesce(p.role,'user'))='admin'
     or (
       (not need_edit or coalesce(p.can_edit,false))
       and lower(trim(coalesce(place_data->>'wardBlock',''))) = any(
         select lower(trim(x)) from unnest(coalesce(p.tdp_access,'{}'::text[])) x
       )
     )
   )
 );
$$;
revoke all on function public.can_access_place(jsonb,boolean) from public;
grant execute on function public.can_access_place(jsonb,boolean) to authenticated;

alter table public.places enable row level security;
drop policy if exists "v755_select_places_by_tdp" on public.places;
drop policy if exists "v755_update_places_by_tdp" on public.places;
drop policy if exists "v760_select_places" on public.places;
drop policy if exists "v760_update_places" on public.places;
create policy "v760_select_places" on public.places for select to authenticated
using (public.can_access_place(data,false));
create policy "v760_update_places" on public.places for update to authenticated
using (public.can_access_place(data,true)) with check (public.can_access_place(data,true));

-- QUAN TRỌNG: tài khoản chủ phải có đúng UUID auth.users.id và role='admin'.
-- Kiểm tra sau khi chạy:
-- select id, role, tdp_access, can_edit from public.profiles;
