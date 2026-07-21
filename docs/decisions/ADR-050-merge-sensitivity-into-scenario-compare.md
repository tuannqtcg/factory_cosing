# ADR-050 — Gộp "Độ Nhạy" (tornado) thành tab trong "So Sánh Kịch Bản"

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user chọn phương án 1)
- **Kế thừa**: ADR-027 (Độ Nhạy), ADR-028 (So Sánh Kịch Bản)

## Bối cảnh
Rà nhóm menu "Thử & Hoạch định" (6 công cụ) tìm trùng lặp. Độ Nhạy và So Sánh Kịch Bản
**trùng nền mạnh nhất**: cùng import `engine/scenario-drivers.ts` (`makeFixedPriceModel` +
`applyDriverMultipliers`), cùng mô hình EBIT "giá-bán-cố-định", cùng 6 driver. Độ Nhạy chỉ
là **trường hợp đặc biệt single-driver** của So Sánh (tornado = tự sinh 6 kịch bản mỗi cái
lệch 1 driver ±δ); lại tự gắn nhãn "bản xem thử". 5 màn còn lại trả lời câu hỏi khác nhau → giữ.

## Quyết định
Gộp Độ Nhạy thành **1 tab "Độ Nhạy (Tornado)"** bên trong `ScenarioCompareScreen` (2 tab:
So Sánh Kịch Bản · Độ Nhạy). Bỏ mục "Độ Nhạy" khỏi menu.
- `ScenarioCompareScreen` nhận thêm `initialTab?: 'compare' | 'tornado'` + `onNavigate`.
- Nhúng `SensitivityScreen` nguyên vẹn ở tab tornado (KHÔNG đổi engine/logic).
- **Giữ deep-link**: `tabId === 'sensitivity'` vẫn render → mở thẳng tab tornado (các link
  Explain "Độ Nhạy — …" còn sống). Chỉ gỡ khỏi NAV_GROUPS + gỡ import SensitivityScreen ở AppShell.
- Nút "→ Dựng kịch bản xấu/tốt" trong Độ Nhạy → chuyển sang tab So Sánh (thay vì điều hướng).

## Hệ quả
- Menu "Thử & Hoạch định" còn 5 mục; không mất tính năng (tornado vẫn còn).
- `SensitivityScreen.tsx` giữ nguyên (chỉ đổi nơi gọi). typecheck + 380 test + build xanh.
- `ROLE_BY_TAB['sensitivity']` mất → fallback 'view' cho deep-link (cosmetic, chấp nhận).

## Còn treo (đề xuất từ rà soát, CHƯA làm)
- Trích component dùng chung cho "thang giá 5 bậc/sàn" (Trợ Lý CEO, Nhận Đơn vẽ lại riêng) và
  khối "khóa giá/chốt lại" (rải 4 màn). Là refactor trình bày, không gỡ màn.
