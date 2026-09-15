BẢN ĐỒ SỐ THỦY NGUYÊN V6.1 — MAP FIX

Nâng cấp:
- 3 lớp bản đồ: Đường phố, Sáng rõ, Vệ tinh.
- Tự chuyển nguồn dự phòng nếu tile bản đồ lỗi nhiều.
- Sửa cache Service Worker để bản mới trên GitHub Pages được tải ưu tiên.
- Tự đọc tọa độ từ URL Google Maps dạng đầy đủ nếu URL có @lat,lng hoặc query=lat,lng.
- Giữ nguyên dữ liệu, đăng nhập, cloud, ảnh và chức năng V6.

LƯU Ý QUAN TRỌNG:
Dữ liệu gốc có phần lớn link maps.app.goo.gl rút gọn, không chứa lat/lng trực tiếp. Trình duyệt không thể đáng tin cậy tự giải các link rút gọn do giới hạn CORS. Vì vậy muốn hiện đủ marker cần bổ sung lat/lng cho từng cơ sở hoặc đổi sang URL Google Maps đầy đủ có tọa độ.

CÀI LÊN GITHUB:
Upload/replace index.html, app.js, style.css, sw.js (và giữ các file dữ liệu/config hiện có). Chờ GitHub Pages dấu xanh, sau đó Ctrl+F5. Trên iPhone đóng app PWA rồi mở lại; nếu vẫn cũ, xóa website data/cache của site và mở lại.
