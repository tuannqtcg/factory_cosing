# ADR-057 — Xoá hẳn 8 màn UI mồ côi (đã gỡ khỏi nav từ ADR-026/049/050 + PR #23/#24)

- **Ngày**: 2026-07-24
- **Trạng thái**: Chấp nhận (user chốt "xoá hẳn file" — nghiệm thu lõi, chuyển pha hoàn thiện UX)
- **Kế thừa**: ADR-026 (một view CEO), ADR-049 (Data Setup thay Tham Số/Cấu Hình), ADR-050 (tornado gộp vào So Sánh KB), PR #23/#24 (gỡ Nhận Đơn + Product-mix khỏi menu)

## Bối cảnh
Sau chuỗi thu hẹp về "một view CEO", 8 thư mục UI không còn được AppShell hay
bất kỳ màn sống nào import (`referenced_by = 0`, xác nhận bằng grep đồ thị
import 2026-07-24): `order-acceptance`, `product-mix`, `plan`,
`production-report`, `assumptions`, `config` (riêng `MoldAssetModal.tsx` GIỮ —
màn sống Data Setup import), `pricing-analytics`, `target-costing`.
~2.700 dòng UI đông lạnh gây nhiễu khi roll-out design system (ADR-033):
không rõ màn nào cần di trú, dễ sửa nhầm màn chết.

## Quyết định
Xoá hẳn 8 thư mục (trừ `config/MoldAssetModal.tsx`). KHÔNG đụng:
- `src/engine/*` — order-acceptance/product-mix/target-costing/plan engine giữ
  nguyên, vẫn có unit + parity test (nghiệp vụ không mất, chỉ mất lối vào UI).
- `src/schemas/*`, `functions/`, `firestore.rules`, `tests/` — callable
  `computeTargetCosting` và test emulator giữ nguyên.

Muốn bật lại màn nào: `git log --diff-filter=D` tìm commit xoá → checkout lại
file, nối vào AppShell, di trú lên design system (ADR-033) trong cùng PR.

## Kiểm chứng
`npm test` 393/393 xanh · `tsc --noEmit` sạch · `vite build` thành công sau xoá.

## Hệ quả
- Phạm vi roll-out design system (ADR-033) còn ~9 màn sống, không còn mơ hồ.
- Nếu sau này cần màn vận hành (Plan/Nhận Đơn...) → khôi phục từ git là
  quyết định sản phẩm mới, viết ADR mới, không phải "bật lại cho có".
