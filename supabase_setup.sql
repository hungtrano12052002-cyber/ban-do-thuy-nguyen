-- BẢN ĐỒ SỐ THỦY NGUYÊN V5 — SUPABASE SETUP
-- Chạy toàn bộ file này trong Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin','user')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.profiles enable row level security;
alter table public.places enable row level security;

-- Người dùng đã đăng nhập có thể đọc hồ sơ của chính mình.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
for select to authenticated using (id = auth.uid());

-- Mọi tài khoản đã đăng nhập có thể đọc dữ liệu bản đồ.
drop policy if exists "authenticated read places" on public.places;
create policy "authenticated read places" on public.places
for select to authenticated using (true);

-- Chỉ admin mới được thêm/sửa/xóa.
drop policy if exists "admins insert places" on public.places;
create policy "admins insert places" on public.places
for insert to authenticated with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "admins update places" on public.places;
create policy "admins update places" on public.places
for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "admins delete places" on public.places;
create policy "admins delete places" on public.places
for delete to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Tự tạo profile role=user khi có tài khoản mới.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'user', coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.handle_new_user();

-- Bucket ảnh công khai: ảnh cơ sở được hiển thị trực tiếp trong app.
insert into storage.buckets (id, name, public)
values ('place-images', 'place-images', true)
on conflict (id) do update set public = true;

-- Ai cũng đọc được ảnh công khai; chỉ admin đăng nhập mới thêm/sửa/xóa.
drop policy if exists "public read place images" on storage.objects;
create policy "public read place images" on storage.objects
for select using (bucket_id = 'place-images');

drop policy if exists "admins upload place images" on storage.objects;
create policy "admins upload place images" on storage.objects
for insert to authenticated with check (
  bucket_id = 'place-images' and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "admins update place images" on storage.objects;
create policy "admins update place images" on storage.objects
for update to authenticated using (
  bucket_id = 'place-images' and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "admins delete place images" on storage.objects;
create policy "admins delete place images" on storage.objects
for delete to authenticated using (
  bucket_id = 'place-images' and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Realtime cho bảng places.
do $$ begin
  alter publication supabase_realtime add table public.places;
exception when duplicate_object then null;
end $$;

-- Sau khi tạo tài khoản admin trong Authentication > Users, chạy lệnh dưới đây
-- (thay email thật của admin):
-- update public.profiles set role='admin'
-- where id=(select id from auth.users where email='admin@example.com');
