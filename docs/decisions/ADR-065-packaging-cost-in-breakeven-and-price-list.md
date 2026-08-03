# ADR-065 — Chi phí bao bì bóc tách trên Bảng Giá + phản ánh đúng vào CVP/hoà vốn

- **Ngày**: 2026-08-02
- **Trạng thái**: Chấp nhận (user phiên 2026-08-02, chọn làm cả 2: hiển thị + sửa công thức)
- **Kế thừa**: ADR-060 (bao bì Phụ kiện theo thùng carton, `fittingPackagingMethod`), ADR-062 (tách hoà vốn theo dòng + tóm tắt bao bì trên Dashboard), ADR-011 (bình quân không trọng số khi chưa có dữ liệu mix thật — `computeMixAvgProductivityKgPerMachineHour`)

## Bối cảnh

User: *"việc chạy chi phí bao bì túi ni lông và thùng carton chưa bóc tách hiển thị trên bảng giá, cũng chưa có phần cấu hình bao bì để xác định đúng điểm hòa vốn theo cách này, cách cũ đang để phẳng"*.

Kiểm tra lại phát hiện ĐÚNG như vậy — 2 lỗ hổng riêng biệt kể từ ADR-060:

1. **`cvp.ts`** (`calculatePipeCvp`/`calculateFittingCvp`, nguồn của `variableCostPerKg`/`fixedCostPerYear`/`breakEvenKgYear` — dùng CHO CẢ thang giá 5 bậc VÀ 2 thẻ "Điểm hoà vốn — Ống/Phụ kiện" ở Dashboard, ADR-062) **LUÔN đọc `resource.packagingCostPerKg` (phẳng)**, bất kể `fittingPackagingMethod` đã bật `'per_box'` hay chưa. Chỉ giá BÁN từng SKU (`skuPriceChains`, qua `packagingCostPerUnitOverride`) đổi theo thùng carton — hoà vốn/thang giá thì KHÔNG, tạo lệch số giữa "giá bán 1 SKU" và "điểm hoà vốn của cả dòng".
2. **`PriceList.tsx`** (khối "Giá này từ đâu ra?") gộp bao bì CHUNG vào "① Chi phí biến đổi" (Ống) / "① Tiền nguyên liệu" (Phụ kiện) — không có dòng riêng cho bao bì, dù ghi chú có nhắc tới ("...điện, nước, bao bì") thì cũng không ra được CON SỐ cụ thể.

## Quyết định

### 1. CVP/hoà vốn Phụ kiện đọc đúng bao bì đang cấu hình

- `fitting.ts` thêm `averageFittingPackagingCostPerKg(products, resource, method)`: nếu `method !== 'per_box'` hoặc thiếu `packagingBoxCostVnd` hoặc không có SKU nào ⇒ trả nguyên `resource.packagingCostPerKg` (parity tuyệt đối). Ngược lại: mỗi SKU tính đ/kg = `(packagingBoxCostVnd ÷ piecesPerBox) ÷ unitWeightKg` (SKU thiếu `piecesPerBox` fallback phẳng cho riêng SKU đó — đúng cơ chế ADR-060), rồi lấy **TRUNG BÌNH KHÔNG TRỌNG SỐ** qua mọi SKU — chưa có dữ liệu SẢN LƯỢNG từng SKU để tính bình quân gia quyền thật (capacity model tính GỘP theo giờ máy), nên tái dùng ĐÚNG giả định "chưa có mix thật ⇒ bình quân đơn giản" đã có sẵn ở `computeMixAvgProductivityKgPerMachineHour` (ADR-011) — không phát minh công thức trọng số mới.
- `cvp.ts`: `calculateFittingCvp()` thêm tham số optional `packagingCostPerKgOverride` (cuối danh sách, parity-safe — không truyền = hành vi cũ y hệt); cả `PipeCvp`/`FittingCvp` thêm field `packagingCostPerKg` (giá trị THẬT SỰ dùng trong `variableCostPerKg`) để tầng hiển thị đọc lại, không tính trùng.
- `scenario.ts`: gọi `averageFittingPackagingCostPerKg(fittingProducts, fittingResource, fittingPackagingMethod)` 1 lần, truyền vào `calculateFittingCvp`. `ScenarioOutput.cvp.byLineMaterial` (cả pipe/fitting) thêm field `packagingCostPerKg`.
- Hệ quả: Dashboard "Điểm hoà vốn — Phụ kiện" (ADR-062, đọc `fittingCvp.fixedCostPerYear`/`breakEvenKgYear` qua `calculateScenario()`) và thang giá 5 bậc Phụ kiện (`variableCostFloor` = `cvp.variableCostPerKg`) **tự động** phản ánh đúng khi bật `'per_box'` — không cần sửa gì thêm ở dashboard-support.ts.
- Ống KHÔNG đổi — luôn phẳng theo kg (đúng như ADR-062 đã xác nhận, ống chưa có cơ chế "theo mét túi" như phụ kiện có "theo thùng").

### 2. Bóc tách bao bì trên Bảng Giá

`PriceList.tsx` (khối "Giá này từ đâu ra?", cả 2 nhánh Ống/Phụ kiện) thêm dòng con thụt lề *"— trong đó bao bì (…)"* ngay dưới ①. Tính **client-side, KHÔNG thêm field mới vào `SkuPriceChainSchema`** (tránh phình schema đã persist) — tái dùng lại chính công thức engine đang dùng, đọc từ `scenario`/`internal` sẵn có (đều chỉ non-null cho vai admin/pricing — giữ đúng ranh giới "sales-safe" đã có):
- Ống: `pipeResource.packagingCostPerKg × product.unitWeightKgPerM` (đúng công thức phẳng, luôn áp dụng).
- Phụ kiện: **ĐÚNG công thức per-SKU** ở `calculateFittingMaterialCostPerUnit`/`packagingCostPerUnitOverride` (scenario.ts) — không phải số bình quân CVP (số đó là bình quân CẢ DÒNG, hiển thị theo SKU sẽ sai) — `per_box` VÀ SKU có `piecesPerBox` ⇒ `packagingBoxCostVnd ÷ piecesPerBox`; ngược lại `unitWeightKg × packagingCostPerKg`.

## Verify

- `tests/parity/fitting-packaging-method.test.ts` — thêm describe `ADR-065` (4 test): `'flat_per_kg'` ⇒ `packagingCostPerKg` khớp đúng resource (parity); `'per_box'` thiếu dữ liệu ⇒ fallback đúng, hoà vốn KHÔNG đổi; `'per_box'` đủ dữ liệu ⇒ `packagingCostPerKg` VÀ `breakEvenKgYear` đổi; đổi bao bì Phụ kiện KHÔNG đụng CVP dòng Ống.
- Suite 437/437 (433 cũ + 4 mới), typecheck + build xanh — **parity tuyệt đối** ở `fittingPackagingMethod: 'flat_per_kg'` (mặc định, mọi scenario cũ) vì `packagingCostPerKgOverride` chỉ khác `resource.packagingCostPerKg` khi bật `'per_box'` VÀ có đủ `packagingBoxCostVnd`.

## Còn treo

- Bình quân bao bì Phụ kiện cho CVP là KHÔNG TRỌNG SỐ (giả định tạm, giống ADR-011) — nếu sau này có dữ liệu SẢN LƯỢNG thật từng SKU (không chỉ tổng giờ máy), nên đổi sang bình quân GIA QUYỀN theo sản lượng để hoà vốn sát thực tế hơn.
- Ống vẫn chưa có cơ chế "bao bì theo mét túi ni lông" (đã treo từ trước ADR-060, chờ user cung cấp "1kg túi bao nhiêu mét") — khi có, cần làm tương tự ADR-065 (thêm nhánh method cho Ống, hiện tại Ống chỉ có 1 phương thức duy nhất: phẳng theo kg).
