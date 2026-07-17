# ADR-019: Bộ tham số Ống v3.7 (3 máy đùn) + tách khấu hao khuôn kéo/cắt — tái lập số vàng

## Ngữ cảnh
Commit `7d134f7` ("big update", 2026-07-13) cập nhật tham số đầu tư dòng Ống theo
thực tế nhà máy (user nhập trực tiếp), đồng thời sửa công thức khấu hao trong
`src/engine/pipe.ts`, nhưng CHƯA cập nhật số vàng dẫn xuất trong
`tests/fixtures/` và expectation inline → 47 assertion parity đỏ (vi phạm luật
"npm test phải xanh trước mọi commit").

Thay đổi tham số (đã nằm trong `tests/fixtures/pipe.json.params`, được giữ nguyên):
- `extruderCount`: 1 → **3**
- `depreciationYears` (máy đùn): 5 → **10**
- `moldPullerCutterCost`: 200.000.000 → **3.726.500.000** đ
- `moldDepreciationYears` (MỚI, schema default 3): khuôn kéo/cắt khấu hao **3 năm riêng**
- `annualMaintenance`: 200.000.000 → **120.000.000** đ

Thay đổi công thức (`calculatePipeCostAtNormalCapacity`):
- Cũ: `(extruderPriceEach × extruderCount + moldPullerCutterCost) / depreciationYears`
- Mới: `(extruderPriceEach × extruderCount) / depreciationYears + moldPullerCutterCost / moldDepreciationYears`
  (khuôn kéo/cắt là công cụ mòn nhanh, đời sống kinh tế khác máy đùn).

## Quyết định
1. **Giữ nguyên** tham số + công thức v3.7 của user (nguồn chân lý nghiệp vụ mới).
2. **Tái lập số vàng dẫn xuất** cho toàn chuỗi phụ thuộc, vì Excel v3.4 không còn
   phản ánh bộ tham số này và không có workbook mới trong repo:
   - Số vàng mới được sinh từ engine forward (script 1 lần, xoá sau khi chạy) **sau khi
     hand-verify độc lập** chuỗi chi phí: khấu hao mới = 3×3.612.904.000/10 +
     3.726.500.000/3 = 2.326.037.866,67 đ/năm → định phí Ống 4.989.390.480,69 đ/năm
     (+42,31%) → fullCost 108.711,86 đ/kg, VF 135.889,83 đ/kg, hòa vốn 141.637,79 kg
     (=108.761,09 × 1,42312, đúng tỉ lệ định phí) — khớp engine tới từng đồng.
   - File cập nhật: `pipe.json` (costAtNormalCapacity, priceLadderByDN, capacityTiers,
     cvp), `dashboard.json` (thang 5 bậc cả 2 dòng — bậc 4 Phụ kiện đổi theo vì hòa vốn
     toàn DN tham chiếu chéo định phí 2 dòng; capacityLevels; cvpAndCapacity; investment;
     dualCostingInventory), `price-list.json` (8 dòng Ống), `price-lock-scenarios.json`
     (BE 5 kịch bản ADR-004), expectation inline trong `pipe/corzan/plan` tests +
     `plan-support` test.
3. Khi có Excel bản mới phản ánh v3.7, lặp lại quy trình trích cached-value
   (README fixtures) để thay thế số vàng engine-derived này bằng số trích độc lập.

## Hệ quả
- `npm test` xanh lại 328/328; parity giữa engine ↔ fixture được khôi phục làm
  hàng rào hồi quy (regression guard) cho v3.7.
- KPI đầu tư thực tế hơn: tổng vốn cố định 15,97 → 26,72 tỷ; thu hồi vốn 0,82 → 1,24 năm
  (cùng hướng với mục tiêu ADR-018 sửa payback "không tưởng").
- Lưu ý: cho tới khi có Excel v3.7 chính thức, các field kể trên là
  **engine-derived** (được hand-verify chuỗi chính) chứ không phải cell-extract.
