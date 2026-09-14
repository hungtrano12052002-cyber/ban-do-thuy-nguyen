BẢN ĐỒ SỐ THỦY NGUYÊN — MOBILE V5 CLOUD
========================================

V5 bổ sung:
- Đồng bộ dữ liệu nhiều điện thoại/máy tính bằng Supabase PostgreSQL.
- Đăng nhập Supabase Auth, phân quyền ADMIN / USER bằng Row Level Security.
- Ảnh cơ sở lưu trên Supabase Storage.
- Realtime: thay đổi từ máy khác tự cập nhật trong app.
- Chỉ đường Google Maps, Google Images, Street View, định vị hiện tại.
- PWA cài lên màn hình chính iPhone/Android.
- Chế độ LOCAL demo vẫn dùng được khi chưa cấu hình cloud.

CÀI CLOUD — 6 BƯỚC
1. Tạo project tại https://supabase.com
2. Mở SQL Editor và chạy toàn bộ file supabase_setup.sql.
3. Authentication > Users: tạo tài khoản bằng email + mật khẩu cho quản trị viên/người dùng.
4. Đổi tài khoản quản trị viên thành admin bằng lệnh mẫu cuối file supabase_setup.sql.
5. Project Settings > API: lấy Project URL và anon/publishable key; điền vào config.js.
6. Đưa toàn bộ thư mục này lên hosting HTTPS (Netlify, Vercel, Cloudflare Pages, GitHub Pages...).

LẦN ĐẦU ĐỒNG BỘ DỮ LIỆU
- Đăng nhập bằng email admin.
- Mở nút ⇅ > “Đưa dữ liệu gốc lên cloud”.
- Sau đó mọi máy đăng nhập sẽ thấy cùng dữ liệu.

CÀI TRÊN IPHONE
Safari > mở URL HTTPS > Chia sẻ > Thêm vào Màn hình chính.

BẢO MẬT
- config.js chỉ được chứa anon/publishable key. KHÔNG BAO GIỜ đặt service_role/secret key trong mã phía trình duyệt.
- Quyền ghi dữ liệu được khóa bằng RLS; chỉ profile role=admin mới được sửa/xóa/thêm.
- Nên đổi mật khẩu demo nếu bạn tiếp tục cho phép chế độ LOCAL trong bản phát hành nội bộ.
