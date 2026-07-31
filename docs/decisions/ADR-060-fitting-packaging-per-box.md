# ADR-060 — Chi phí bao bì phụ kiện tính theo CÁI (packagingCostPerUnit = boxCost ÷ piecesPerBox), không quy đổi qua kg

- **Ngày**: 2026-07-31
- **Trạng thái**: Chấp nhận (user phiên 2026-07-31 — "ADR cho phụ kiện làm trước", ống treo lại)
- **Kế thừa**: ADR-047 (mẫu công tắc 2 logic song song, parity-safe theo default)

## Bối cảnh

`packagingCostPerKg` hiện là 1 số flat cấp Resource (`MachineHourResourceSchema`), áp cho MỌI
SKU phụ kiện qua `calculateFittingMaterialCostPerUnit()` (`src/engine/metal-insert.ts:34`, đổi tên
2026-07-31 — tên cũ `materialCostPerUnitWithInsert` gây hiểu lầm là chỉ dùng cho SKU họ ren,
thực tế dùng cho cả 91 SKU):
`unitWeightKg × (compoundLandedPerKg/yieldRate + packagingCostPerKg)`. Tức chi phí bao bì được
quy theo TRỌNG LƯỢNG từng cái.

Thực tế bao bì phụ kiện là **thùng carton giá cố định/thùng** (12.000đ/thùng, chưa VAT — user
xác nhận), số cái/thùng lấy trực tiếp từ catalog đóng gói (Paratech BlazeMaster CPVC, DN khớp
đúng dữ liệu đang dùng trong `tests/fixtures/fitting.json`).

Đối chiếu số liệu catalog (`Wt.(g/cái)` × `Packing(cái/thùng)`, quy ngược ra đ/kg để so sánh) với
flat rate hiện dùng (2.000đ/kg, `tests/fixtures/fitting.json`):

- Đa số nhóm (Tê, Cút, Chếch, Măng sông, Côn thu, Nối ren, Nắp bịt...) quy đổi ra
  **667–1.500đ/kg — thấp hơn** flat rate.
- 2 outlier quy đổi **cao hơn** flat rate nhiều lần: **Gioăng EPDM** (12.000–17.143đ/kg, gấp
  6–8.5×) và **Thập DN20** (~2.308đ/kg) — vật nhẹ/xốp, rất ít cái/thùng (10–80 cái/thùng), quy
  qua kg bị méo nặng vì bao bì không tỷ lệ thuận với trọng lượng cho nhóm này.

→ Quy theo kg sai bản chất cho phụ kiện (khác ống — ống đúng là nên theo kg, chỉ cần đúng
kg/bó thay vì 1 số flat, xem mục "Còn treo"). Đúng bản chất: chi phí bao bì phụ kiện gắn với
THÙNG (giá cố định/thùng), phân bổ theo SỐ CÁI/thùng — không liên quan trọng lượng.

**Lưu ý phạm vi (user xác nhận phiên 2026-07-31)**: 2 outlier nêu trên (Gioăng EPDM, Thập)
CHƯA có trong SKU đang sản xuất thực tế — Thập chưa làm sản phẩm, Gioăng chưa sản xuất. Với
đúng tập SKU đang chạy hiện nay, độ lệch quan sát được đồng nhất một chiều: **667–1.500đ/kg,
thấp hơn** flat rate 2.000đ/kg ở mọi nhóm đã đối chiếu — tức chuyển sang `'per_box'` nhìn
chung sẽ HẠ chi phí bao bì phân bổ cho phụ kiện đang bán, không phải đẩy lên. 2 outlier vẫn
giữ trong ADR làm căn cứ cho fallback parity-safe (mục Quyết định #5) — khi nào thêm SKU
Thập/Gioăng vào sản xuất, cơ chế per-SKU đã sẵn sàng xử lý đúng mà không cần sửa lại thiết kế.

`packagingCostPerKg` flat đang là 1 phần của `fullCostPerKgRef`/`materialCostPerUnit` đã khóa
parity Excel v3.4 (404/404 test, luật bất biến #1 AGENTS.md). Không đổi công thức mặc định —
theo đúng mẫu ADR-047, dùng công tắc song song.

## Quyết định

1. `ScenarioInput.fittingPackagingMethod` = `'flat_per_kg'` (default) | `'per_box'`. Doc cũ
   không có field → parse thành `'flat_per_kg'` → parity giữ nguyên tuyệt đối.
2. **`'flat_per_kg'`**: giữ nguyên công thức cũ (`unitWeightKg × packagingCostPerKg`) — khớp
   Excel v3.4, không đổi 1 số nào trong fixture hiện có.
3. **`'per_box'`**: `packagingCostPerUnit(SKU) = resource.packagingBoxCostVnd ÷ product.piecesPerBox`,
   cộng thẳng vào `materialCostPerUnit` thay cho số hạng `unitWeightKg × packagingCostPerKg` cũ.
4. Schema mới — cả 2 field đều **optional**, không phá parity khi thiếu:
   - `MachineHourResourceSchema.packagingBoxCostVnd?: number` — giá 1 thùng carton, chưa VAT
     (input cấp resource, dùng chung mọi SKU phụ kiện; catalog hiện chỉ cho 1 mức giá, chưa rõ
     có phân theo cỡ thùng hay không — xem "Còn treo").
   - `FittingProductSchema.piecesPerBox?: number` — số cái/thùng theo catalog đóng gói, nhập
     riêng từng SKU.
5. **Fallback parity-safe** (giống ADR-047 mục 3): SKU nào thiếu `piecesPerBox`, hoặc resource
   thiếu `packagingBoxCostVnd` → SKU đó tự động dùng lại công thức `'flat_per_kg'` dù scenario
   đang ở method `'per_box'` — không NaN, không chặn tính toán, chuyển dần từng SKU một khi có
   dữ liệu thật.
6. Công tắc đặt cùng nhóm với `pipeCostMethod` (ADR-047) ở sidebar, admin đổi → lưu cố định vào
   scenario, mọi màn tính lại theo ADR-045.

## Parity-safe (test mới `fitting-packaging-method`)

- Mặc định `'flat_per_kg'` → mọi output giống hệt hiện tại, suite 404/404 không đổi.
- `'per_box'` khi SKU/resource thiếu dữ liệu mới → rơi về `'flat_per_kg'` TUYỆT ĐỐI cho đúng
  SKU đó (không lan sang SKU khác đã có đủ dữ liệu).
- `'per_box'` có đủ dữ liệu (`piecesPerBox` + `packagingBoxCostVnd`) → đổi phân bổ đúng theo
  từng SKU, khớp bảng tính tay từ catalog.

## Triển khai (2026-07-31, cùng phiên)

- Schema + engine: `ScenarioInputSchema.fittingPackagingMethod`, `MachineHourResourceSchema.packagingBoxCostVnd`,
  `FittingProductSchema.piecesPerBox`, nhánh override trong `calculateFittingMaterialCostPerUnit()`
  (`src/engine/metal-insert.ts`) + wiring ở `src/engine/scenario.ts`. Test mới
  `tests/parity/fitting-packaging-method.test.ts` (4 case: default, 2 kiểu fallback thiếu dữ
  liệu, công thức per-box đúng). Suite 408/408 xanh (404 cũ + 4 mới).
- UI: `ProductsScreen.tsx` — cột "Cái/thùng" sửa/xóa trực tiếp trên bảng Phụ Kiện (ô trống =
  fallback flat, giống pattern `capacityMetersPerHour` ADR-046) + nút **"📦 Nạp bao bì carton
  (Paratech)"** (idempotent, giống pattern `standardizeCorzan`): điền `piecesPerBox` cho
  **63/91 SKU** khớp TUYỆT ĐỐI theo trọng lượng với catalog Paratech (`PARATECH_FITTING_PACKING`
  trong file), đặt `packagingBoxCostVnd = 12.000` nếu resource chưa có. **28/91 SKU cố ý để
  trống** — 4 nhóm ren kim loại (Nối ren trong/ngoài, Cút/Tê ren trong — 18 SKU, trọng lượng
  catalog LỆCH ~2–2.5× so với `unitWeightKg` fixture vì catalog cân cả cụm đã lắp ren, không
  tách riêng nhựa) + mọi SKU DN100 (10 SKU, catalog Paratech dừng ở DN80) — cần nhập tay qua
  cột "Cái/thùng" nếu có số liệu riêng, engine tự fallback flat_per_kg cho tới lúc đó.
  `DataSetupScreen.tsx` — GridCell "Giá 1 thùng carton" (mục ② Chi phí chế biến, dòng Phụ kiện).
  `AppShell.tsx` — công tắc sidebar "Bao bì Phụ kiện" (Theo kg / Theo thùng), cùng cơ chế
  `pipeCostMethod`, chỉ Toàn Quyền đổi được.
- `npm run typecheck` + `npm run build` sạch.

## Còn treo

- **Ống**: chưa làm ADR tương tự — thiếu số liệu thật "1kg túi nilon dài bao nhiêu mét / định
  lượng màng (g/m²)" để tính `packagingCostPerBundle` chính xác theo `cây/bó` từng DN. Khi có
  số → ADR riêng cùng mẫu này (`pipePackagingMethod`, song song `pipeCostMethod` ADR-047).
- 28/91 SKU phụ kiện (ren kim loại + DN100) chưa có `piecesPerBox` tin cậy — cần số liệu thật
  (cân/đếm thực tế hoặc catalog khác) trước khi coi `'per_box'` là đầy đủ cho toàn bộ danh mục.
- Chưa xác nhận `packagingBoxCostVnd` = 12.000đ áp dụng cho MỌI cỡ thùng hay chỉ 1 loại thùng
  chuẩn — catalog không phân biệt cỡ thùng theo SKU/nhóm, cần hỏi lại nếu có nhiều cỡ thùng giá
  khác nhau (vd thùng phụ kiện lớn như Mặt bích/Gioăng có thể khác thùng đóng Tê/Cút nhỏ).
