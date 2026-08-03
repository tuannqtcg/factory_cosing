# ADR-066 — Tách tầng bao bì riêng trong Thác Chi Phí + sửa fullCostPerKgRef theo per_box

- **Ngày**: 2026-08-02
- **Trạng thái**: Chấp nhận (user phiên 2026-08-02, chọn "tách riêng thành 1 tầng trong Thác Chi Phí")
- **Kế thừa**: ADR-065 (CVP/hoà vốn Phụ kiện đọc đúng bao bì theo `fittingPackagingMethod`), M12.5 "Thác chi phí đ/kg" gốc (`cost-breakdown.ts`)

## Bối cảnh

Sau ADR-065, user hỏi tiếp: *"vậy tóm lại chi phí bao bì xem ở đâu? khi toàn bị gộp vào thế này."* — rà lại 3 chỗ hiển thị bao bì trong app:

1. Dashboard "Bao bì — Ống/Phụ kiện" (ADR-062): chỉ hiện MỨC GIÁ đang cấu hình, không phải chi phí đã phân bổ.
2. Bảng Giá "Giá này từ đâu ra?" (ADR-065): có nhưng phải bấm MỞ TỪNG SKU.
3. **Thác Chi Phí / KG ("Tiền đi đâu?")**: bao bì bị GỘP vào tầng "Gia công tiền mặt trực tiếp" cùng nhân công/điện/nước/bảo trì — đúng như user mô tả "gộp vào thế này". User chọn tách bao bì thành 1 TẦNG RIÊNG ở đây (recommended, vì đây là chỗ xem tổng quan nhanh nhất, không cần bấm từng SKU).

Trong lúc sửa, phát hiện thêm 1 lỗ hổng KHÁC chưa lộ ra ở ADR-065: `fitting.ts` → `calculateFittingCostAtNormalCapacity()` → `fullCostPerKgRef` **VẪN LUÔN dùng `resource.packagingCostPerKg` phẳng**, kể cả sau ADR-065 (ADR-065 chỉ sửa `cvp.ts`). Vì bậc 1 thang giá (`variableCostFloor` = `cvp.variableCostPerKg`) và bậc 2 (`breakEvenFullCost` = `cost.fullCostPerKgRef`) được THIẾT KẾ để cộng khớp nhau (`breakEvenFullCost = variableCostPerKg + fixedCostPerYear/kg`, cùng 1 giá trị bao bì cắm vào cả 2 công thức), sau ADR-065 (chỉ sửa CVP) 2 bậc này sẽ LỆCH NHAU khi bật `per_box` — một sự KHÔNG NHẤT QUÁN mới, đúng loại vấn đề user đang lo ngại.

## Quyết định

### 1. `fitting.ts` — `fullCostPerKgRef` cũng đọc đúng bao bì đang cấu hình

- `FittingCostAtNormalCapacityInputs` thêm `packagingCostPerKgOverride?: number` (optional, cuối input — parity-safe, đối xứng tham số cùng tên ở `calculateFittingCvp`).
- `FittingCostAtNormalCapacity` thêm field `packagingCostPerKg` (giá trị THẬT SỰ đã dùng) để tầng gọi đọc lại, không tính trùng.
- `scenario.ts`/`dashboard-support.ts`: tính `averageFittingPackagingCostPerKg(...)` **1 LẦN**, dùng CHUNG cho cả `calculateFittingCostAtNormalCapacity` VÀ `calculateFittingCvp` — đảm bảo 2 công thức luôn cộng khớp bất kể `fittingPackagingMethod`.

### 2. `cost-breakdown.ts` — 5 tầng thay vì 4

- `CostLayersPerKg` thêm field `packaging`; `cashDirect` bớt bao bì ra (chỉ còn nhân công/điện/nước/bảo trì).
- `pipeCostLayersPerKg()`/`fittingCostLayersPerKg()` đổi tham số thứ 2 từ `Pick<Resource, 'packagingCostPerKg'>` sang **nhận thẳng số `packagingCostPerKg`** — caller PHẢI truyền đúng giá trị đã dùng để tính `cost.fullCostPerKg(Ref)` (với Phụ kiện là `cost.packagingCostPerKg` mới thêm ở trên), nếu không tổng 5 tầng sẽ không khớp `total`.
- Tổng 5 tầng vẫn = `fullCostPerKg`/`fullCostPerKgRef` (bất biến giữ nguyên từ M12.5, chỉ đổi CÁCH CHIA, không đổi TỔNG).

### 3. UI — `CostWaterfall.tsx`

- Thêm tầng "Bao bì" (5 tầng: Gia công trực tiếp → **Bao bì** → Chi phí chung → Khấu hao → Nguyên liệu).
- Màu: `color.inkMuted` (xám trung tính) — KHÔNG dùng success/warning/danger vì 3 hue đó đang mang nghĩa tín hiệu (tốt/cảnh báo) ở chỗ khác trong app; bao bì không phải tín hiệu cảnh báo.
- Ghi chú tầng "Bao bì" nêu rõ: Ống luôn theo kg (túi ni lông); Phụ kiện theo cấu hình (carton/thùng hoặc phẳng theo kg).

## Verify

- **Bất biến cộng khớp** (test mới quan trọng nhất, phát hiện đúng lỗ hổng vừa nêu): `tests/parity/fitting-packaging-method.test.ts` describe `ADR-066` — `breakEvenFullCost` (bậc 2 thang giá) = `variableCostPerKg + fixedCostPerYear/kg` (bậc 1 + định phí/kg từ CVP) **đúng cả khi bật `per_box`**. Test này sẽ FAIL nếu chỉ sửa 1 trong 2 nơi (đã tự kiểm chứng bằng cách chạy trước khi sửa `fitting.ts` — fail đúng như dự đoán, rồi pass sau khi thêm override).
- `tests/unit/cost-breakdown.test.ts` — cập nhật cho 5 tầng: tổng 5 tầng = `fullCostPerKg(Ref)`; `cashDirect` mới = `cashDirect` cũ trừ đúng `packagingCostPerKg` (số vàng Excel v3.4 vẫn giữ nguyên, chỉ đổi CÁCH CHIA).
- Suite 438/438 (437 cũ + 1 mới), typecheck + build xanh — parity tuyệt đối ở `flat_per_kg` (mặc định).

## Còn treo

- Giống ADR-065: bình quân bao bì Phụ kiện cho `per_box` vẫn KHÔNG TRỌNG SỐ (chưa có dữ liệu sản lượng thật từng SKU).
