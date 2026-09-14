BẢN ĐỒ SỐ THỦY NGUYÊN — V6.2.1 FIX CLOUD

1. Mở index.html.
2. Nếu góc phải hiện LOCAL, bấm nút “☁ Cloud”.
3. Nhập Project URL và Publishable key/anon key của Supabase. KHÔNG dùng service_role/secret key.
4. Bấm “Lưu & khởi động lại”.
5. Đăng nhập bằng EMAIL Supabase của tài khoản Admin. Không dùng tài khoản demo “admin”, vì tài khoản demo chỉ là ADMIN LOCAL.
6. Khi góc phải hiện “☁ CLOUD”, mở Dữ liệu & đồng bộ và bấm “📌 Tự lấy tọa độ từ Google Maps”.
7. Edge Function resolve-map-link phải đã được deploy (bạn đã làm bước này).

Lưu ý: cấu hình Cloud được lưu cục bộ trong trình duyệt bằng localStorage.
