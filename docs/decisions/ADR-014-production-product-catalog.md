# ADR-014: Doc `outputs/productCatalog` — danh mục SP + tham số vận hành cho vai `production` (M12.7)

Ngày: 2026-07-08 | Trạng thái: CHẤP NHẬN (user chốt "phương án a" 2026-07-08)

## Bối cảnh
Màn Kế Hoạch SX (M12.7, vai `production`) cần danh mục sản phẩm để dựng form
nhập kế hoạch (DN nào, loại phụ kiện × size nào), và prototype đóng băng còn
hiển thị cột kỹ thuật (kg/m, kg/cái, cycle, cavity) + cột dẫn xuất sống (kg
TP, giờ máy, ngày SX) khi đang gõ. Nhưng theo bảng phân quyền đóng băng
(`scenario.md` §6), `production` KHÔNG đọc được `scenarios/{id}` (chứa giá
vốn/tồn kho/cấu hình) — không có doc nào nó đọc được chứa danh mục.

2 phương án đã trình user (session log 2026-07-08):
- (a) thêm doc danh mục tối thiểu do Cloud Function ghi, `production` được đọc;
- (b) nới quyền `production` đọc `outputs/priceList` (có sẵn productKey nhưng
  CÓ GIÁ BÁN — đổi chính sách thông tin giá sang khối sản xuất).

**User chọn (a).**

## Quyết định
1. **Doc mới `scenarios/{id}/outputs/productCatalog`** (schema
   `ProductCatalogDocSchema`, `src/schemas/scenario.ts`), do `onScenarioWrite`
   ghi cùng lúc với `outputs/internal`/`outputs/priceList` (cùng nguồn
   `ScenarioInput`, cùng vòng đời — xóa scenario thì dọn cùng). Nội dung:
   - `pipes[]`: `{dn, unitWeightKgPerM, materialId, materialName}`
   - `fittings[]`: `{productName, sizeLabel, unit, unitWeightKg, cycleTimeSec,
     cavity, managementStatus, materialId, materialName}` — `managementStatus`
     để form ẩn SKU chưa có khuôn (ADR-007, giống Bảng Giá M12.6)
   - `params`: tham số VẬN HÀNH tối thiểu cho cột dẫn xuất sống đúng prototype:
     `pipe: {yieldRate, actualCapacityKgPerHour, hoursPerShift,
     hoursAvailablePerShiftYear, peoplePerShift}`,
     `fitting: {yieldRate, normalMachineHoursUtilizedYear, peoplePerShift}`.
   - **TUYỆT ĐỐI KHÔNG field giá** (giá bán, giá vốn, markup, tồn kho, tỷ
     giá): đơn trọng/chu kỳ/cavity/công suất là dữ liệu KỸ THUẬT tổ sản xuất
     vốn nắm hằng ngày, không thuộc ranh giới giá của ADR-006. (Lưu ý: khi
     trình phương án đã nói "không đơn trọng" — xem xét kỹ prototype thì cột
     kg/m / kg/cái / cycle / cavity là phần UI đóng băng và là dữ liệu kỹ
     thuật thuần, KHÔNG phải giá → đưa vào; ranh giới thật sự cần giữ là GIÁ.)
2. **Phân quyền** (`firestore.rules` + bảng `scenario.md` §5-§6):
   `outputs/productCatalog` — Đọc: `admin`, `pricing`, `production`; `sales`
   ✗ (không có màn nào cần); Ghi client: ✗ (Cloud Function only, như mọi
   `outputs/*`).
3. Giá trị BẰNG TIỀN của kế hoạch (NVL cần mua VNĐ/USD, chi phí CSNR...)
   `production` chỉ thấy qua `outputs/plan` — vốn đã được bảng §5 cho phép
   Đọc từ Pha 2, KHÔNG đổi gì thêm.

## Hệ quả
- `functions/src/index.ts`: `onScenarioWrite` ghi thêm doc thứ 3 + dọn khi
  xóa scenario; test tích hợp thêm assertion.
- `firestore.rules`: thêm match `outputs/productCatalog`; `tests/rules/` thêm
  case (production đọc được; sales bị chặn; client không ghi được).
- `docs/contracts/scenario.md` §5 thêm dòng doc, §6 thêm dòng vùng dữ liệu.
- Màn Kế Hoạch SX (M12.7) đọc catalog này + `outputs/plan`, ghi
  `planInputs/{period}` — không chạm doc nào khác.
- Khi thêm nguyên liệu mới (ADR-012), catalog tự có entry theo materialId —
  form kế hoạch phân biệt được SKU trùng tên/size khác compound.
