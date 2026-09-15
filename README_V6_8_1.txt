BẢN V6.8.1 - FIX NÚT + THÊM CƠ SỞ

Sửa lỗi nút + Thêm không mở biểu mẫu trên một số trình duyệt (Cốc Cốc/Chromium cũ):
- bỏ phụ thuộc structuredClone, dùng bản sao JSON tương thích rộng hơn
- kiểm tra phiên đăng nhập ADMIN an toàn hơn
- tăng phiên bản tài nguyên để tránh cache PWA/GitHub Pages

CẬP NHẬT GITHUB:
1. Giữ config.js hiện đang chứa cấu hình Supabase của bạn.
2. Thay index.html, app.js, style.css, sw.js, manifest.json và các file còn lại bằng bản này.
3. Commit changes, chờ Pages deploy xanh.
4. Mở lại trang và Ctrl+F5. Trên iPhone nếu vẫn cũ, mở Safari tải lại trước rồi mở PWA.
