# ADR-021: Màn "Trợ Lý CEO" (CEO Planner) — schema request/result, tái dùng engine, thuê mặt bằng nhập-được

Ngày: 2026-07-16 | Trạng thái: CHẤP NHẬN (đóng băng schema Pha 2)

## Bối cảnh
Prototype Pha 1 `prototype/ceo-planner.html` (brief `docs/briefs/BRIEF-2026-07-15-ceo-planner.md`,
qua 7 vòng duyệt) đã được **duyệt cổng Pha 1** (user 2026-07-16). Màn trả lời 3
câu CEO cần trước bàn đàm phán: giá compound X + margin mong muốn → giá bán tối
thiểu; giá đó nằm đâu trên thang giá 5 bậc; chạy hết công suất thì hiệu quả cả
năm ra sao. Nó hội tụ với ADR-020 (một view CEO) — là màn trung tâm của view đó.
Cần đóng băng hợp đồng dữ liệu (Pha 2) trước khi code thật (Pha 3).

## Quyết định

### 1. Schema `src/schemas/ceo-planner.ts` (đóng băng)
- `CeoPlannerRequestSchema`: `scenarioId`, `marginMode` (markup_on_cost |
  margin_on_price), `fxRateUsdVnd`, `annualPremiseLeaseVnd`, `pipe`
  (`CeoPipeInputSchema`), `fitting` (`CeoFittingInputSchema` — thêm
  `machineHourUtilization`). Mỗi line input: `materialId` (ADR-012, KHÔNG enum
  thương hiệu), `compoundPriceUsdPerKg`, `desiredMargin` (<0,95), `normalShifts`
  (1–3).
- `CeoPlannerResultSchema`: `pipe`/`fitting` (`CeoLineResultSchema` — giá bán VF,
  giá thành, thang giá 5 bậc `CeoLadderSchema`, sản lượng/giờ máy/hòa vốn/lãi gộp
  năm), `summary` (`CeoFactorySummarySchema` — doanh thu, lãi gộp, LN trước/sau
  thuế, thu hồi vốn), `pipeDnPrices[]`, `fittingSkuPrices[]`. Echo `request`
  (đối xứng `outputs/targetCosting` ADR-013).
- `paybackYears: z.number().nullable()` — null khi dòng tiền ≤0 (KHÔNG Infinity,
  không tuần tự hóa JSON được).

### 2. "Chọn dòng nguyên liệu 1 nơi cho cả 2 line" (brief mục 7) là ràng buộc UI, KHÔNG phải schema
Request vẫn ghi rõ `pipe.materialId` và `fitting.materialId` riêng (trung thực với
`ScenarioInput.materials[]`, ADR-012). UI đồng bộ 2 giá trị khi CEO chọn thương
hiệu — không nhét enum `'bm'|'cz'` vào hợp đồng (thương hiệu là dữ liệu, không
phải kiểu).

### 3. Thuê mặt bằng là INPUT của màn, KHÔNG đổi cost pool baseline
`annualPremiseLeaseVnd` THAY phần `costPool.sharedFixedCosts.annualLandRent` khi
engine planner tính — mô hình ĐI THUÊ, CEO đổi được từng năm (brief mục 4). Quyết
định đặt nó ở request (không sửa `SharedFixedCostsSchema`) vì:
- Màn CEO là công cụ **what-if**: tiền thuê là biến kịch bản, không phải sự thật
  đã chốt của scenario.
- Giữ nguyên `assumptions.json`/parity 328/328 — không phải tái lập số vàng.
- Muốn ghi tiền thuê vào baseline (đổi giá thành thực) là quyết định khác, ADR sau.

### 4. Tính toán = engine pure client-side, KHÔNG callable
Vai xem màn này (admin/pricing — mục 6) đọc trọn `ScenarioInput` nên chạy engine
tại client được (giống Dashboard dùng `calculateDashboardKpis`). Pha 3 dựng
`src/engine/ceo-planner.ts` orchestrate `pipe.ts`/`fitting.ts`/`price-ladder.ts`/
`cvp.ts`/`dashboard-support.ts` — **cấm chép công thức tay** từ prototype. Chỉ AI
tư vấn cần server (ADR-022).

### 5. Quyền: tầng chiến lược `admin`/`pricing` (ADR-006)
Sau ADR-020 (một view CEO = vai admin), màn hiển thị trong view CEO. `sales`/
`production` KHÔNG thấy (dữ liệu giá thành/đầu tư). Không có doc Firestore mới —
kết quả tính tại client, không ghi ra ngoài.

### 6. Thuế TNDN — 20% (user xác nhận 2026-07-16)
`CeoFactorySummarySchema.corporateIncomeTaxVnd` giữ trong hợp đồng; thuế suất
**20% — user XÁC NHẬN 2026-07-16** (thuế suất phổ thông VN; giải tỏa điểm treo
brief mục 9). Pha 3 đọc từ 1 hằng số có tên rõ (vd `CIT_RATE = 0.20`), không
hard-code rải rác; đổi thuế suất sau chỉ sửa 1 nơi.

## Hệ quả
- Pha 3: viết `src/engine/ceo-planner.ts` + màn `src/features/ceo-planner/` gắn
  vào view CEO (AppShell), thay công thức nhúng prototype bằng engine.
- Pha 4: parity test 8 điểm kiểm của brief (giá 2 dòng preset "Chuẩn Excel v3.4":
  ống 132.898,6 · phụ kiện 252.845,8 đ/kg · LN trước thuế 16,37 tỷ · payback
  0,816 năm) qua `src/engine/ceo-planner.ts`.
- Ràng buộc parity: quét bậc ca GIỮ phân bổ chi phí chung tại công suất chuẩn
  (khớp fixture `capacityTiers`/`mhrByCapacityTier`); thang giá đúng `price-ladder.ts`.
- `docs/contracts/ceo-planner.md` đóng băng schema + endpoint + phân quyền.
