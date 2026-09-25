V7.6.0 - ADMIN AUTHORITY FIX
1. Giữ nguyên config.js đang hoạt động trên GitHub.
2. Upload/ghi đè các file V7.6.0.
3. Trong Supabase SQL Editor chạy SUPABASE_V760_ADMIN_PERMISSION_FIX.sql.
4. Trong public.profiles, UUID của tài khoản email chủ phải có role = admin.
5. Đăng xuất rồi đăng nhập lại. Header phải hiện: ADMIN · TOÀN PHƯỜNG.
ADMIN không bị lọc TDP; USER chỉ thấy TDP được cấp.
