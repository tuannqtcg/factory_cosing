# ADR-069 — Bao bì Ống theo túi ni lông (per_bag), đối xứng ADR-060/065 Phụ kiện

- **Ngày**: 2026-08-03
- **Trạng thái**: Chấp nhận (user phiên 2026-08-03)
- **Kế thừa**: ADR-060 (bao bì Phụ kiện theo thùng carton), ADR-065 (CVP/hoà vốn đọc đúng cách cấu hình), ADR-066 (thác chi phí tách tầng bao bì)

## Bối cảnh

User cung cấp dữ liệu cuộn túi ni lông bọc Ống: giá vật liệu 74.000đ/kg, 1 cuộn nặng 35kg dài 630m, mỗi túi dài 4,2m (= 1 cây ống). Số cây ống mỗi túi **khác nhau theo từng DN** (DN nhỏ nhét được nhiều cây/túi hơn DN lớn) và cần nhập tay per-DN — trước ADR này, Ống chỉ có 1 số `packagingCostPerKg` phẳng duy nhất (không có cơ chế "theo túi" như Phụ kiện đã có).

## Quyết định

Thêm cơ chế `pipePackagingMethod` (`'flat_per_kg' | 'per_bag'`, mặc định `'flat_per_kg'`) **đối xứng hoàn toàn** với `fittingPackagingMethod` (ADR-060):

- **Resource** (`resources.pipe`, 4 field optional): `packagingBagMaterialPricePerKgVnd`, `packagingRollWeightKg`, `packagingRollLengthM`, `packagingBagLengthM`. Giá 1 túi = `(giá/kg × kg/cuộn ÷ m/cuộn) × m/túi` (`pipePackagingBagCostVnd`, pipe.ts).
- **Product** (`PipeProductSchema`): thêm `piecesPerBag` optional (số cây ống/túi, theo từng DN).
- **Per-DN** (skuPriceChains, scenario.ts): đ/kg = `(giá 1 túi ÷ piecesPerBag) ÷ (đơn trọng × chiều dài túi)`, DN thiếu `piecesPerBag` fallback `packagingCostPerKg` phẳng.
- **Line-level** (CVP/hoà vốn/thác chi phí): `averagePipePackagingCostPerKg` — trung bình KHÔNG trọng số qua mọi DN (chưa có sản lượng riêng từng DN, cùng giả định `averageFittingPackagingCostPerKg`), truyền CÙNG 1 giá trị vào `calculatePipeCostAtNormalCapacity` (fullCostPerKg) VÀ `calculatePipeCvp` (variableCostPerKg) để 2 bậc thang giá cộng khớp (đúng bất biến ADR-066).
- Thiếu bất kỳ field nào trong 4 field resource, hoặc DN thiếu `piecesPerBag` ⇒ tự fallback `flat_per_kg` cho đúng phần đó — parity tuyệt đối với trước ADR-069 khi chưa nhập dữ liệu.

UI: Thiết Lập (4 ô cuộn ở khối Ống), Sản phẩm (cột "Cây/túi" cho từng DN), sidebar toggle "Bao bì Ống" (Theo kg | Theo túi, chỉ Toàn Quyền đổi), Dashboard KPI card + Bảng Giá ("Giá này từ đâu ra?" — dòng bao bì) đọc đúng giá trị đang cấu hình.

## Verify

`tests/parity/pipe-packaging-method.test.ts` (9 test, đối xứng `fitting-packaging-method.test.ts`): mặc định parity, fallback khi thiếu dữ liệu, đổi đúng công thức khi đủ dữ liệu, CVP/fullCostPerKg cộng khớp, không ảnh hưởng dòng Phụ kiện. Typecheck + build xanh, suite 447/447 (438 cũ + 9 mới).
