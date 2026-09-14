BẢN ĐỒ SỐ THỦY NGUYÊN – V6.2.2 FIX MAP

Bản này sửa lỗi: marker/cụm điểm hiển thị nhưng nền bản đồ trắng.

Thay đổi:
- Esri World Street Map làm nền mặc định.
- Thêm CARTO Voyager và OpenStreetMap làm nguồn dự phòng.
- Giữ lớp Vệ tinh Esri.
- Tự chuyển nguồn nền nếu tile lỗi nhiều lần.
- Gọi invalidateSize sau khi khởi tạo/thay đổi kích thước để tránh bản đồ trắng do layout.
- Giữ nguyên Cloud, đăng nhập, dữ liệu, marker, Auto GPS và chỉ đường.

Cách dùng:
1. Giải nén toàn bộ thư mục.
2. Mở thuynguyen_v5/index.html bằng Chrome.
3. Nếu đã lưu cấu hình Cloud trên cùng trình duyệt, trạng thái Cloud sẽ được giữ.
4. Góc phải dưới có nút chọn lớp bản đồ: Bản đồ đường phố / Bản đồ sáng / OpenStreetMap / Vệ tinh.
