# ADR-033: Design system (tokens + primitives) — thoát "trông như AI làm"

Ngày: 2026-07-17 | Trạng thái: DEMO (chờ duyệt gu) | Nối tiếp: ADR-018/020 (progressive disclosure)

## Bối cảnh
User: các màn "trông như AI làm, cái nào cũng giống cái nào". Nguyên nhân KHÔNG do
bảng màu mà do CÁCH QUẢN LÝ DESIGN: inline style rải rác, hex/px gõ tay lặp lại, mỗi
màn tự dựng lại cùng khuôn → thiếu nhất quán. Cái user nhớ tới = Design System quản
lý bằng Design Tokens + component dùng chung (kiểu GitHub Primer). User chọn: dựng
tokens+primitives, demo 1 màn để duyệt "gu", + đổi sang PHONG CÁCH MỚI.

## Quyết định (bước demo)
- **`src/design/tokens.ts`** — nguồn chân lý: màu/chữ/spacing/bo góc/bóng. Phong cách
  mới: TỐI GIẢN ĐEN–TRẮNG (user chốt 2026-07-17). Đen/trắng/xám chủ đạo, accent
  tương tác = ĐEN (không màu); MÀU CHỈ dành cho BIỂU ĐỒ (tornado đỏ/xanh) và GHI CHÚ
  CẦN THIẾT (banner cảnh báo). Nền #f6f6f6, mực #0a0a0a, hairline, sidebar đen #0a0a0a.
- **`src/design/primitives.tsx`** — Screen, PageHeader, Card, Stat, Badge, Banner,
  Button, Segmented, NumberField, TableRow — dựng TỪ tokens.
- **Demo màn Độ Nhạy** rebuild hoàn toàn bằng primitives + tokens; retheme chrome
  AppShell (canvas/sidebar/nav accent) sang palette mới.

## Hệ quả
- KHÔNG đụng engine/logic/test — suite 370/370. Thuần trình bày.
- Các màn KHÁC còn dùng style cũ (burgundy nội dung) → giai đoạn demo sẽ trông chuyển
  tiếp; sẽ di trú dần sau khi user duyệt gu.
- Sau duyệt: nhân rộng primitives ra toàn bộ màn; cân nhắc nạp font Inter (hiện dùng
  Roboto hệ thống — vẫn sạch). CHỜ user duyệt phong cách trước khi roll-out.
