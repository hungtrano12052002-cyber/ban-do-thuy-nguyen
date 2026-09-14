BẢN ĐỒ SỐ THỦY NGUYÊN — V6.2 AUTO GPS
======================================

V6.2 bổ sung:
- Tự giải mã link Google Maps rút gọn maps.app.goo.gl ở phía máy chủ Supabase.
- ADMIN Cloud có nút: Dữ liệu & đồng bộ > Tự lấy tọa độ từ Google Maps.
- Chạy song song 3 link/lần, hiện tiến độ thành công/lỗi.
- Tọa độ được lưu trở lại trường data.lat / data.lng của bảng places.
- Sau khi có lat/lng, marker xuất hiện tự động trên bản đồ và được gom cụm.
- Bấm marker mở toàn bộ thông tin; nút Chỉ đường dùng tọa độ chính xác.
- Có thể xử lý từng cơ sở bằng nút “Tự lấy tọa độ” trong bảng chi tiết.

QUAN TRỌNG — TRIỂN KHAI EDGE FUNCTION
-------------------------------------
App web không thể tự mở hàng loạt link rút gọn Google Maps do giới hạn CORS của trình duyệt.
Vì vậy V6.2 đi kèm Edge Function:
  supabase/functions/resolve-map-link/index.ts

Cách A — Supabase Dashboard (nếu tài khoản của bạn có trình quản lý Edge Functions):
1. Mở project Supabase đang dùng cho V5/V6.1.
2. Edge Functions > tạo function tên: resolve-map-link
3. Dán nội dung file supabase/functions/resolve-map-link/index.ts
4. Deploy.

Cách B — Supabase CLI:
1. Cài Supabase CLI và đăng nhập.
2. Trong thư mục dự án chạy:
   supabase link --project-ref PROJECT_REF
   supabase functions deploy resolve-map-link

Sau đó:
1. Mở ứng dụng V6.2 và đăng nhập tài khoản ADMIN bằng email Supabase.
2. Mở nút ⇅ Dữ liệu & đồng bộ.
3. Bấm “Tự lấy tọa độ từ Google Maps”.
4. Giữ trang mở cho đến khi báo hoàn tất.
5. Bấm “Xem toàn bộ marker”.

LƯU Ý
-----
- Chỉ những cơ sở có link Google Maps mới có thể tự lấy tọa độ theo cách này.
- Cơ sở chưa có link Google Maps vẫn cần gắn pin thủ công hoặc bổ sung link.
- Nếu một link Google Maps cũ/hỏng không trả về tọa độ, V6.2 sẽ đưa vào danh sách lỗi và tiếp tục các cơ sở còn lại.
- Không đưa service_role key vào config.js. Chỉ dùng URL + anon/publishable key như V5.
