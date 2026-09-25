V7.6.3 - GPS SYNC INDEPENDENT OF LOGIN MODE
- ADMIN ở chế độ LOCAL vẫn có thể gọi resolve-map-link nếu config.js/Supabase đã kết nối.
- Không còn buộc currentUser.cloud mới được giải link Google Maps rút gọn.
- Tọa độ thành công được lưu local ngay để marker xuất hiện tức thì.
- Khi có Cloud session, GPS đồng thời được lưu lên Supabase.
- Có tiến độ, danh sách lỗi và định vị thủ công.
- Giữ nguyên config.js hiện tại khi cập nhật.
