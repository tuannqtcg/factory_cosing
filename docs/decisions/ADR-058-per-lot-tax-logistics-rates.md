# ADR-058 — Thuế NK/phí logistics RIÊNG từng lô (landed cost bình quân gia quyền chính xác)

- **Ngày**: 2026-07-30 | **Trạng thái**: CHẤP NHẬN
- **Kế thừa**: ADR-002 (giá vốn kép), ADR-012 (landed cost theo material), ADR-057 (đổi tên + dual-cost view)

## Bối cảnh

User chỉ ra: mỗi LÔ nguyên liệu có thể có xuất xứ khác nhau (vd một phần lô có
C/O ưu đãi AIFTA 0%, phần khác chịu thuế MFN đầy đủ), nên thuế NK + phí
logistics KHÔNG thể dùng chung 1 mức cho cả nguyên liệu (như ADR-012 hiện tại)
khi tính **giá vốn bình quân gia quyền** — nếu không, bình quân gia quyền sẽ
**sai bản chất kế toán**: công thức cũ bình quân GIÁ MUA THÔ của các lô rồi mới
nhân 1 mức thuế/phí chung, thay vì tính landed cost (giá mua + thuế + phí)
TỪNG lô rồi mới bình quân theo tấn. Hai lô cùng giá mua nhưng khác thuế sẽ bị
tính landed cost giống hệt nhau trong công thức cũ — che mất khoản tiết kiệm
thuế thật của lô có C/O ưu đãi.

## Quyết định

1. **`InventoryLotSchema`** (`src/schemas/pricing-chain.ts`) thêm 2 field
   **optional**: `importTaxRate`, `customsLogisticsFeeRate` (0–1). Bỏ trống =
   kế thừa rate của material (hành vi y hệt trước ADR này — parity tuyệt đối
   với dữ liệu cũ, vì không lô nào có field này).
2. **`src/engine/dual-costing.ts`** — hàm mới `weightedAvgLandedCostPerKgVnd(lots, fallbackRates, usdVndRate)`:
   tính landed cost (đ/kg) TỪNG lô (rate riêng lô, thiếu thì lấy `fallbackRates`)
   rồi mới bình quân theo tấn — khác `landedCostPerKgVnd(weightedAvgUsdPerKg(lots), rate)`
   (bình quân giá thô rồi mới nhân 1 rate — chỉ đúng khi MỌI lô cùng rate).
   `holdingGainLossVnd` đổi input sang nhận thẳng 2 landed cost đã tính (mỗi vế
   đúng rate của nó) thay vì giá USD thô + 1 bộ rate dùng chung.
3. **`src/engine/cost-pool.ts`** — hàm mới `usdPerKgForLandedCostVnd` (nghịch
   đảo `landedCostPerKgVnd`) — dùng ở `price-cost-scenarios.ts` để quy đổi
   landed cost bình quân gia quyền (đã đúng theo từng lô) về "giá USD/kg tương
   đương" chảy qua pipeline tính giá hiện có (vốn chỉ nhận 1 rate/material,
   ADR-012) mà không cần sửa `calculateScenario`.
4. **`src/engine/scenario.ts`** (`pushDualCosting`) và **`price-cost-scenarios.ts`**
   (`scenarioWithCostBasis('weighted-avg', ...)`) đổi sang dùng
   `weightedAvgLandedCostPerKgVnd` — mọi nơi hiển thị "giá vốn bình quân gia
   quyền" (Giá Vốn Theo Lô, Bảng Giá, Tổng Quan — ADR-057) giờ phản ánh đúng
   thuế/phí từng lô.
5. **UI**: `InventoryScreen.tsx` (màn "Tồn Kho Compound", nơi chính thức sửa
   lô — vào từ Giá Vốn Theo Lô → "Cập nhật lô hàng") và `DataSetupScreen.tsx`
   mục ④ (bản nháp trước khi lưu) đều thêm 2 cột **"Thuế NK riêng"** / **"Phí
   HQ+logistics riêng"** mỗi lô — để trống = dùng theo nguyên liệu (placeholder
   hiện rate material). Landed cost hiển thị (đ/kg) tính qua
   `weightedAvgLandedCostPerKgVnd`.

## Hệ quả

- **Parity tuyệt đối với dữ liệu cũ**: khi không lô nào override (100% dữ liệu
  hiện có), `weightedAvgLandedCostPerKgVnd` === `landedCostPerKgVnd(weightedAvgUsdPerKg(...))`
  về mặt toán học (chứng minh bằng tính tuyến tính của phép nhân — có test
  `dual-costing.test.ts`/`price-cost-scenarios.test.ts` xác nhận) → mọi số
  vàng hiện có KHÔNG đổi.
- `holdingGainLossVnd` đổi signature (nhận 2 landed cost thay vì giá thô + 1
  rate) — chỉ 1 nơi gọi trong production code (`scenario.ts`), test cũ
  (`tests/unit/dual-costing.test.ts`) viết lại theo signature mới, GIỮ NGUYÊN
  số vàng 1.332.685.000đ.
- `metal-insert.ts` (ren kim loại, ADR-008) KHÔNG bị ảnh hưởng — dùng hàm riêng
  `metalInsertHoldingGainLossVnd` (ren mua VND trong nước, không có bước landed
  cost/thuế NK).
- Suite 404/404 (+8 test mới), typecheck + build xanh.
