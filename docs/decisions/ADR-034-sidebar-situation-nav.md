# ADR-034 — Sidebar theo tình huống CEO + gộp hub Bảng Giá + link chéo theo mạch làm việc

- **Ngày**: 2026-07-18
- **Trạng thái**: Chấp nhận (user duyệt phương án trong phiên 2026-07-18)
- **Kế thừa**: ADR-020 (một view CEO), ADR-026 (bỏ tab vận hành vai khác)

## Bối cảnh

Sau ADR-026, nav còn 12 mục chia 2 nhóm ("Phân Tích & Quyết Định" 10 mục phẳng +
"Điều Chỉnh Tham Số" 2 mục). User (CEO) phản hồi: menu rối, phải nhớ tên màn,
không biết màn nào làm trước, màn nào liên quan màn nào.

Phân tích lại theo câu hỏi "*khi nào CEO thực sự mở màn này?*" cho thấy 12 màn
được kích hoạt bởi đúng 4 tình huống: nhìn hằng ngày / sự kiện đến (đơn hàng,
lô NVL, gửi bảng giá) / ngồi hoạch định what-if / chỉnh số nền (hiếm).

## Quyết định

1. **Nav nhóm theo TÌNH HUỐNG, không theo loại công cụ** — 4 nhóm:
   Hằng Ngày (Tổng Quan) · Khi Có Việc (Nhận Đơn, Giá Vốn Theo Lô, Bảng Giá) ·
   Hoạch Định (Trợ Lý CEO, Độ Nhạy, So Sánh Kịch Bản, Product-mix) ·
   Thiết Lập (Tham Số, Cấu Hình). Trong nhóm xếp theo tần suất dùng thật.
2. **Mỗi mục kèm chú thích 1 dòng** = câu hỏi màn đó trả lời ("đơn này nhận
   không?", "biến nào bào EBIT mạnh nhất?") — không bắt user nhớ tên màn.
3. **Gộp 3 tab giá thành 1 hub "Bảng Giá"** (`PricingHub.tsx`, sub-tab
   VF / NPP / Phân tích): 3 màn là 3 góc nhìn của cùng một bảng giá (VF gốc,
   NPP dẫn xuất đọc-only, Phân tích soi thang giá). 12 mục menu → 9 mục.
   Id tab dạng `pricing:vf` — 3 màn con GIỮ NGUYÊN, chỉ bọc điều hướng.
4. **Link chéo tại điểm chuyển mạch tự nhiên** (menu để định vị, nút chéo để
   dẫn theo mạch): Giá Vốn Theo Lô (banner "nên chốt lại") → Bảng Giá;
   Độ Nhạy → So Sánh Kịch Bản; Nhận Đơn → Giá Vốn Theo Lô.

## Phạm vi

Thuần trình bày: `AppShell.tsx` (nav + routing), `PricingHub.tsx` (mới),
prop `onNavigate?` optional cho 3 màn (LotCosting / Sensitivity /
OrderAcceptance). KHÔNG đụng engine, schema, rules, backend — suite parity
không đổi.

## Hệ quả

- CEO điều hướng theo tình huống thay vì tên màn; người mới đọc caption là hiểu.
- Bỏ khái niệm "Bảng Giá NPP là một màn riêng" — đúng bản chất dẫn xuất ADR-025.
- Màn nhận `onNavigate` optional → dùng độc lập (test/storybook) không cần shell.
