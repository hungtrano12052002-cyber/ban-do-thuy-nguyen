BẢN ĐỒ SỐ THỦY NGUYÊN — MOBILE V6.1

Nâng cấp trực tiếp từ V5 Cloud của người dùng.

MỚI TRONG V6.1
- Giao diện bản đồ tối ưu cho điện thoại, phong cách gần Google Maps.
- Marker dạng ghim đỏ, gom cụm marker khi nhiều vị trí gần nhau.
- Chuyển Bản đồ / Vệ tinh.
- Bấm marker để mở đầy đủ thông tin cơ sở.
- Nút Chỉ đường dùng Google Maps Directions, ưu tiên lat/lng chính xác.
- Vẫn giữ Supabase Cloud, đăng nhập, ảnh, CRUD, PWA và dữ liệu V5.

LƯU Ý VỀ 187 CƠ SỞ
Dữ liệu gốc hiện có 187 link maps.app.goo.gl nhưng không chứa lat/lng trong file. Link rút gọn không thể được trình duyệt tách tọa độ một cách đáng tin cậy do giới hạn chuyển hướng/CORS. Vì vậy marker chỉ xuất hiện cho cơ sở đã có lat/lng.

CÁCH ĐỂ HIỆN ĐỦ MARKER
1) ADMIN mở cơ sở > Sửa.
2) Nếu có URL Google Maps đầy đủ chứa tọa độ, bấm “Tách tọa độ từ link”.
3) Hoặc di chuyển tâm bản đồ tới đúng vị trí và bấm “Lấy tâm bản đồ hiện tại”.
4) Lưu. Nếu đang dùng Supabase Cloud, tọa độ được đồng bộ qua trường data như V5.

Tài khoản demo: admin/admin123 hoặc user/user123.
