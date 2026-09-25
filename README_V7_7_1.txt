V7.7.1 GPS TRANSPORT FIX
- Giữ nguyên Auth Core V7.7.0.
- GPS không còn phụ thuộc trạng thái LOCAL/CLOUD của giao diện.
- Nếu Supabase SDK không gọi được Function, tự fallback sang HTTPS Edge Function bằng cấu hình publishable hiện có trong config.js.
- Quản lý GPS có nút Kiểm tra kết nối và hiển thị lỗi thật.
- Kèm source supabase/functions/resolve-map-link/index.ts để deploy lại nếu Function bị thiếu.
- Không chứa config.js: giữ nguyên config.js đang hoạt động trên GitHub.
