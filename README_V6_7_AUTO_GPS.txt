BẢN ĐỒ SỐ THỦY NGUYÊN V6.7 — AUTO GPS

Mới:
- Nút 📌 Auto GPS cho Admin.
- Tự xử lý các cơ sở chưa có lat/lng nhưng có link Google Maps.
- Hiển thị tiến độ, số thành công/thất bại.
- Lưu tọa độ trực tiếp vào bảng places trên Supabase.
- Trong biểu mẫu từng cơ sở có nút “Tự lấy từ link rút gọn”.
- Giữ Định vị thủ công/GPS của V6.5-V6.6 làm phương án dự phòng.

CÀI EDGE FUNCTION:
1. Supabase Dashboard > Edge Functions > Create/Deploy function tên: resolve-map-link.
2. Dán nội dung file supabase/functions/resolve-map-link/index.ts và Deploy.
3. Điền SUPABASE_URL + SUPABASE_ANON_KEY trong config.js. Chỉ dùng anon/publishable key, KHÔNG dùng service_role.
4. Đưa toàn bộ app lên GitHub Pages/HTTPS.
5. Đăng nhập Cloud Admin > 📌 Auto GPS > Lấy tọa độ.

LƯU Ý:
- Google Maps có thể thay đổi cách redirect; một số link có thể không tự giải được. Dùng 🧭 Định vị cho các điểm còn lại.
- Không nên chạy chức năng Cloud bằng file:// trên ổ C; dùng GitHub Pages HTTPS.
