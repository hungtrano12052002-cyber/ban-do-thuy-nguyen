BẢN ĐỒ SỐ THỦY NGUYÊN — V6 MAP UPGRADE

Nâng cấp:
- Marker nhà trọ lớn, dễ nhìn; hiện tên cơ sở khi zoom >= 15.
- Bản đồ đường phố + ảnh vệ tinh, đổi nhanh bằng nút lớp bản đồ.
- Thanh thông báo số điểm có/chưa có tọa độ.
- Popup/tooltip rõ hơn, tối ưu mobile.
- Cache PWA đổi sang V6 để tránh trình duyệt giữ app.js/style.css cũ.
- Giữ nguyên Cloud/Supabase, đăng nhập, thêm/sửa/xóa, ảnh, chỉ đường.

QUAN TRỌNG: dữ liệu gốc hiện có 187 link Google Maps dạng maps.app.goo.gl nhưng KHÔNG có lat/lng. Vì vậy app không thể đặt marker chính xác cho các điểm đó chỉ từ dữ liệu offline. Admin cần bổ sung tọa độ cho từng điểm (hoặc nhập bộ dữ liệu có lat/lng). Sau khi có tọa độ, marker sẽ xuất hiện ngay.

Cập nhật GitHub Pages: upload toàn bộ nội dung thư mục này đè lên repo, chờ Pages deploy, sau đó Ctrl+F5. Nếu đã cài PWA trên điện thoại, đóng/mở lại app sau khi deploy.
