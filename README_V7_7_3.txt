BẢN ĐỒ SỐ THỦY NGUYÊN V7.7.3 - BOOT / CLOUD HOTFIX

- Sửa lỗi ReferenceError: restoreSession is not defined tại app.js.
- Cho phép toàn bộ app.js tải xong để Supabase Auth/Cloud/GPS được khởi tạo.
- Giữ nguyên Auth Core, quyền ADMIN/TDP và module GPS V7.7.1.
- Tăng cache Service Worker lên V7.7.3 để tránh trình duyệt giữ JS lỗi cũ.
- Gói có đầy đủ icon/login assets; config.js không được đóng gói để tránh ghi đè cấu hình đang dùng.

CẬP NHẬT:
1. Giữ nguyên config.js trên GitHub.
2. Upload/replace các file còn lại.
3. Ctrl+F5 hoặc xóa site data/service worker nếu vẫn thấy V7.7.2.
4. Đăng nhập bằng EMAIL Supabase ADMIN (không dùng admin/admin123) để trạng thái thành ONLINE.
