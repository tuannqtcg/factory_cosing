# ADR-054 — Gom công suất Ống theo phương pháp phân bổ vào 1 helper dùng chung

- **Ngày**: 2026-07-22
- **Trạng thái**: Chấp nhận (user — "làm cả 2")
- **Kế thừa**: ADR-047 (pipeCostMethod kg/meters), ADR-048 (meters nghẽn tổng công suất)

## Bối cảnh
ADR-048 đưa chế độ `meters`: tổng công suất DÒNG Ống suy từ tốc độ per-size
(m/giờ × đơn trọng) → override `effectiveFinishedKgPerHour` khi tính
`normalCapacityKgYear`. **Nhưng override chỉ được áp ở ĐÚNG 1 chỗ**
(`scenario.ts` → `calculateScenario`). Rà soát cho thấy 4 nơi khác gọi
`calculatePipeCapacity()` TRẦN (không override):

| Nơi gọi | Dùng field nào | Ảnh hưởng chế độ meters |
|---|---|---|
| `dashboard-support.ts` (:87, :130) | `normalCapacityKgYear` (giá vốn, phân bổ chung, 3 mức ca) | ❌ **lệch số** |
| `plan-support.ts` (:94) | `normalCapacityKgYear` (cost + CVP Plan) | ❌ **lệch số** |
| `ceo-planner.ts` (:91) | chỉ `normalOperatingHours` | ✅ vô hại (field độc lập override) |
| `product-mix.ts` (:43) | chỉ `normalOperatingHours` | ✅ vô hại |

⇒ Bật `meters`, Tổng Quan (Dashboard) và Plan vẫn tính công suất kiểu `kg` →
số lệch giữa các màn. Nguyên nhân: mỗi nơi phải **tự nhớ** dựng lại logic
override — dễ sót.

## Quyết định
Gom logic vào 2 hàm pure trong `src/engine/pipe.ts`:
- `effectivePipeFinishedKgPerHour(resource, pipeProducts, method)` — trả tốc độ
  thành phẩm kg/giờ hiệu dụng (`undefined` ⇒ dùng danh nghĩa). `kg` ⇒ `undefined`;
  `meters` ⇒ trung bình (m/giờ × đơn trọng) các size đã nhập; KHÔNG size nào nhập
  ⇒ `undefined`.
- `effectivePipeCapacity(resource, pipeProducts, method)` — bọc
  `calculatePipeCapacity` + override → **mọi tầng gọi hàm này** thay vì bản trần.

Thay 5 callsite (scenario/dashboard×2/plan/ceo/product-mix) sang helper. `functions/
index.ts` (catalog doc) chỉ đọc `normalOperatingHours` (độc lập override) → giữ
`calculatePipeCapacity` trần, không đổi.

## Kiểm chứng
- `method='kg'` ⇒ helper trả `undefined` ⇒ trùng khít `calculatePipeCapacity` cũ ⇒
  **parity Excel tuyệt đối** (382 test vàng xanh không đổi).
- typecheck + build xanh. Chế độ `meters` nay áp ĐỒNG NHẤT ở Dashboard/CEO/Plan/UI.

## Còn treo
- `calculatePipeCapacity` vẫn export (test parity + functions dùng) — không gỡ.
