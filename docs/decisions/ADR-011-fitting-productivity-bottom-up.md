# ADR-011: Năng suất mix phụ kiện (avgProductivityKgPerMachineHour) — chuyển từ số nhập tay sang tính bottom-up từ bảng khuôn

Ngày: 2026-07-07 | Trạng thái: CHẤP NHẬN | Nguồn: `BlazeMaster_Model_v3_7.xlsx` (upload 2026-07-07)

## Bối cảnh

Đối chiếu Excel v3.7 với kiến trúc hiện tại (v3.4, `docs/BUSINESS_MODEL.md` §3.3):
Assumptions, Ống, Plan_SX, PriceList giống hệt v3.4 — cùng công thức, cùng số.
Chỉ 1 thay đổi thật ở sheet Phụ kiện: ô `B48` "Năng suất mix SỬ DỤNG" trước đây
= 1 số nhập tay cố định (`avgProductivityKgPerMachineHour = 44,6 kg/giờ máy`,
đúng giá trị đang có trong `tests/fixtures/fitting.json`/schema hiện tại). Ở
v3.7, ô này đổi công thức:

```
B47 "Năng suất mix TÍNH TỪ KHUÔN" = SUMPRODUCT(kg/giờ-máy theo 8 size DN, %mix)/Σ%mix
                                   // %mix hiện hardcode ĐỀU 12,5%/size (1/8) —
                                   // không lấy từ kế hoạch bán thực, nên
                                   // SUMPRODUCT/Σ ở đây = trung bình KHÔNG
                                   // trọng số qua 8 nhóm size
B48 "Năng suất mix SỬ DỤNG"        = IF(GHI_ĐÈ > 0, GHI_ĐÈ, B47)
```
trong đó `kg/giờ-máy theo size` = `unitsPerHour(size) × unitWeightKg bình quân
của mọi SKU thuộc size đó` — dữ liệu này (`moldSizeDN`, `cycleTimeSec`,
`cavity`, `unitWeightKg` mỗi SKU) đã có sẵn 100% trong `FittingProduct`
schema hiện tại, không cần trường mới. Ô GHI ĐÈ (`B19`) mặc định = 0 (dùng số
tính); ghi chú trong Excel: "Nhập 44,6 để tái tạo v3.5" — xác nhận 44,6 từng
là GHI ĐÈ chủ động ở bản trước, nay đổi mặc định sang tự tính.

Tính lại: năng suất mix = **22,83 kg/giờ máy** (giảm ~49% so với 44,6). Vì
`estimatedProductionKgYear = normalMachineHoursUtilized × năng suất mix` và số
này nuôi `sharedCostAllocationRatio` (tỷ lệ phân bổ chi phí chung theo kg,
tham chiếu chéo Ống ↔ Phụ kiện — BUSINESS_MODEL.md §2.2/§3.3), thay đổi này
kéo theo:
- MHR: 1.344.176 → **1.308.218 đ/giờ máy** (−2,7%)
- Giá thành đầy đủ phụ kiện (quy kg): 153.435 → **180.604 đ/kg** (+17,7% —　phần
  lớn do định phí xưởng ép nay chia cho ít kg hơn, không phải do MHR)
- Giá thành đầy đủ ỐNG: 106.204,73 → **106.318,88 đ/kg** (+0,11% — vì tỷ lệ
  phân bổ chi phí chung dịch từ 87,6%/12,4% sang 93,2%/6,8%, Ống gánh thêm)
- Toàn bộ 91 giá SKU phụ kiện + 8 giá ống (một số mốc ROUNDUP(-2) đổi bậc trăm)
  và mọi số phái sinh trong `dashboard.json`/`price-lock-scenarios.json`.

Đây KHÔNG phải lỗi engine — đối chiếu từng ô Assumptions/Ống xác nhận công thức
các sheet khác giữ nguyên 100%; chỉ 1 giả định đầu vào của riêng Phụ kiện đổi
phương pháp (từ ước lượng thủ công sang tính từ dữ liệu khuôn/SKU đã có).

## Quyết định

1. Áp dụng phương pháp v3.7: `avgProductivityKgPerMachineHour` mặc định
   **tính bottom-up** từ danh sách `FittingProduct` (nhóm theo `moldSizeDN`,
   mỗi nhóm = `unitsPerHour × unitWeightKg bình quân nhóm`, rồi lấy **trung
   bình KHÔNG trọng số** qua các nhóm — đúng giả định %mix đều 1/8 hiện có
   trong Excel; CHƯA có dữ liệu mix theo sản lượng thực nên không tự chế thêm
   trọng số). Giữ khả năng GHI ĐÈ thủ công (đổi chính sách công suất phải có
   ADR mới, cùng nguyên tắc ADR-001/ADR-007).
2. Schema (`MachineHourResourceSchema.avgProductivityKgPerMachineHour`,
   `src/schemas/resource.ts`): đổi từ `z.number().positive()` (bắt buộc) sang
   `z.number().positive().optional()` — `undefined` = tự tính bottom-up (mặc
   định mới); có giá trị = ghi đè thủ công (tương đương ô `B19` Excel).
3. Engine (`src/engine/fitting.ts`): thêm hàm pure
   `computeMixAvgProductivityKgPerMachineHour(products: FittingProduct[])`;
   `calculateFittingCapacity()` nhận thêm tham số `fittingProducts` để giải
   quyết override-hay-tính. `scenario.ts` truyền `products` đã lọc `kind ===
   'fitting'` vào.
4. Cập nhật TOÀN BỘ fixture vàng bị ảnh hưởng theo đúng quy trình skill
   `excel-parity-testing` (trích từ Excel v3.7 bằng script, không gõ tay):
   `pipe.json`, `fitting.json`, `dashboard.json`, `price-list.json`,
   `price-lock-scenarios.json`. Số liệu cũ (v3.4, override 44,6) không còn là
   "số vàng" — chỉ còn ý nghĩa lịch sử, ghi lại ở ADR này.
5. `docs/BUSINESS_MODEL.md` §3.2/§3.3 cập nhật công thức + số liệu theo v3.7.

## Hệ quả

- Đổi số vàng ở diện rộng (MHR, giá thành 2 dòng, 99 giá niêm yết, mọi bậc
  thang giá, CVP, đầu tư/hoàn vốn) — KHÔNG đổi ý nghĩa/công thức của
  ADR-001..010 nào khác, chỉ đổi 1 input duy nhất của phụ kiện.
- Nếu sau này có dữ liệu mix sản lượng thực (từ Plan_SX hoặc lịch sử bán), có
  thể thay "trung bình không trọng số qua 8 nhóm size" bằng trọng số thực —
  đó là quyết định nghiệp vụ MỚI, cần ADR riêng (không tự suy diễn).
- `tests/fixtures/mold-assets.json`, `tests/fixtures/metal-insert.json`,
  `tests/fixtures/assumptions.json` KHÔNG đổi (không phụ thuộc năng suất mix).
