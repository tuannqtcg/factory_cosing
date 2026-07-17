# ADR-028: Màn "So Sánh Kịch Bản" — if–then đa-biến cho CEO

Ngày: 2026-07-17 | Trạng thái: CHẤP NHẬN | Nối tiếp: ADR-027 (nền giá-bán-cố-định)

## Bối cảnh
Sau Độ Nhạy (một-biến-một-lần), bước if–then tiếp theo: gộp NHIỀU biến thành kịch
bản có tên ("Suy thoái: compound +15%, USD +10%, sản lượng −20%") và đặt cạnh Cơ sở
để CEO thấy *"nếu thế giới thành X thì tôi ở đâu"*.

## Quyết định
- **Tách nền dùng chung `src/engine/scenario-drivers.ts`**: `DriverMultipliers` (6
  driver dạng hệ số nhân), `applyDriverMultipliers`, `makeFixedPriceModel` (EBIT +
  doanh thu tại GIÁ BÁN cố định — base khớp KPI Dashboard). Refactor `sensitivity.ts`
  dùng lại nền này (7 test giữ xanh) → không lặp logic, đồng bộ ngữ nghĩa 2 màn.
- **Engine `scenario-compare.ts`** (`calculateScenarioCompare(baseline, scenarios[])`):
  mỗi kịch bản → EBIT/doanh thu/biên (giá cố định) + Δ vs cơ sở. Schema
  `scenario-compare.ts` đóng băng.
- **Màn `ScenarioCompareScreen`** (tab "So Sánh Kịch Bản"): 3 cột (Cơ sở + 2 kịch bản
  chỉnh %), preset (Suy thoái/Kỳ vọng/Sốc tỷ giá/Reset), tô đậm EBIT cao/thấp nhất.

## Hệ quả
- Thuần đọc engine đóng băng — parity 343 giữ nguyên; +6 test (base khớp KPI, suy
  thoái ⇒ EBIT↓, sản lượng↓ ⇒ doanh thu↓ tỉ lệ). Suite 356/356.
- Đồng bộ với Độ Nhạy (cùng EBIT giá-bán-cố-định) → 2 màn kể chung một câu chuyện rủi ro.
- Verify: suy thoái (compound +15/USD +10/sản lượng −20) lật EBIT 18,55 tỷ → −2,54 tỷ
  (LỖ, −114%); kỳ vọng +37%. Đúng "if–then" điều hành.
- Còn 2 công cụ if–then: Quyết định nhận đơn (biên đóng góp), Tối ưu product-mix.
