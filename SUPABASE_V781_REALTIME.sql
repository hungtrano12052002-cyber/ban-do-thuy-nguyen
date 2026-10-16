-- Chỉ bật thông báo thay đổi; không thay chính sách quyền hiện có.
do $$ begin
 alter publication supabase_realtime add table public.places;
exception when duplicate_object then null;
end $$;
