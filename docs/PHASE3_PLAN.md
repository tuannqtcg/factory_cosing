# PHASE3_PLAN.md — Lộ trình Pha 3 (Code), chia milestone nhỏ

> Lý do file này tồn tại: Pha 3 (schema + engine + parity test 372 assertion +
> solver) quá lớn cho 1 phiên/1 lượt gọi. User yêu cầu (2026-07-06) chia nhỏ
> thành nhiều phiên để không tốn tool call và dừng được khi gần hết token. MỖI
> milestone dưới đây phải: (1) tự chứa — code xong + `npm test` xanh + commit,
> (2) không phụ thuộc milestone sau, (3) cập nhật bảng trạng thái này trước khi
> dừng, để phiên sau đọc 1 file này là biết chính xác việc tiếp theo, KHÔNG cần
> đọc lại toàn bộ session log.

## Cách phiên mới bắt đầu
1. Đọc bảng trạng thái bên dưới, tìm milestone đầu tiên chưa `[x]`.
2. Đọc đúng file contract liên quan trong `docs/contracts/*.md` + mục
   `BUSINESS_MODEL.md` được trỏ ở cột "Nguồn công thức".
3. Code milestone đó, viết parity test đối chiếu `tests/fixtures/*.json` (số
   vàng), chạy `npm test` + `npm run typecheck` xanh.
4. Commit, cập nhật bảng trạng thái (đổi `[ ]` → `[x]`, ghi ngày), dừng phiên.
   KHÔNG cần làm nhiều milestone trong 1 phiên trừ khi còn dư budget rõ ràng.

## Bảng trạng thái

| # | Milestone | Nguồn công thức | File chính | Trạng thái |
|---|---|---|---|---|
| M1 | Scaffold (package.json/tsconfig/vitest) + `src/schemas/*.ts` (5 file) + smoke test parse fixture thật | `docs/contracts/*.md` | `src/schemas/` | **[x] 2026-07-06** |
| M2 | Engine Ống — công suất + chi phí SX tại CS bình thường | BUSINESS_MODEL §2.1-2.2 | `src/engine/pipe.ts` | **[x] 2026-07-06** |
| M3 | Engine Phụ kiện — công suất ép phun + MHR (ADR-001) | BUSINESS_MODEL §3.1-3.3 | `src/engine/fitting.ts` | **[x] 2026-07-06** |
| M4 | Khấu hao khuôn động theo `asOfYear` (ADR-007) — nuôi vào MHR thay `moldSetCostTotal66` | ADR-007, `resource.md` | `src/engine/mold-depreciation.ts` | **[x] 2026-07-06** |
| M5 | Giá vốn kép (ADR-002) + khóa bảng giá (ADR-004) — cả compound Ống/Phụ kiện | BUSINESS_MODEL §1a, §5; `price-lock-scenarios.json` (5 kịch bản) | `src/engine/dual-costing.ts`, `src/engine/price-lock.ts` | **[x] 2026-07-06** |
| M6 | Dòng vật liệu ren kim loại (ADR-008) — giá vốn kép + khóa giá riêng + `materialCostPerUnit` mở rộng cho 11 SKU họ ren | ADR-008, `pricing-chain.md` | `src/engine/metal-insert.ts` | **[x] 2026-07-06** |
| M7 | Thang giá 5 bậc + chuỗi markup SKU (99 dòng: 8 ống + 91 phụ kiện) | BUSINESS_MODEL §2.3, §3.4, §4 | `src/engine/price-ladder.ts` | **[x] 2026-07-06** |
| M8 | CVP (Ống theo kg, Phụ kiện quy kg theo mix) | BUSINESS_MODEL §2.4, §3.6 | `src/engine/cvp.ts` | **[x] 2026-07-06 (làm TRƯỚC M7 — xem lý do trong "Nhật ký milestone")** |
| M9 | Plan_SX (T1 — tầng vận hành, dạng đóng, chưa có số vàng thật) | BUSINESS_MODEL §6; `scenario.md` §3 | `src/engine/plan.ts` | **[x] 2026-07-06** |
| M10 | Inverse solver (T2 dạng đóng CVP, T3 bisection) + forward-verify bắt buộc | ADR-005/006; skill `inverse-solver`; `scenario.md` §4 | `src/engine/solver.ts` | **[x] 2026-07-06** |
| M11 | Bộ test parity Excel đầy đủ 372 assertion (gom tất cả M2-M9 lại thành 1 suite hoàn chỉnh, đối chiếu skill `excel-parity-testing`) | Toàn bộ `tests/fixtures/*.json` | `tests/parity/` | [ ] |
| M12 | UI thật (React/TS/Tailwind theo prototype đã duyệt) + nối Firestore theo `scenario.md` §5-6 | `prototype/blazemaster-costing-app.dc.html`, `scenario.md` | `src/features/` | [ ] — CHỈ làm khi user xác nhận mở rộng phạm vi (ngoài "chỉ engine") |

## Ghi chú kỹ thuật xuyên suốt (áp dụng mọi milestone)
- Mọi hàm engine PURE — không I/O, không side-effect (PROJECT_SPEC §3).
- Trước khi migrate `tests/fixtures/metal-insert.json` vào M6: chuẩn hóa
  `thresholdPct` từ số nguyên % (5) sang thập phân (0.05) — xem cảnh báo đầu
  `src/schemas/pricing-chain.ts` và test `schemas.test.ts` đã chứng minh field
  gốc bị Zod từ chối nếu không chuẩn hóa (đây là hàng rào an toàn cố ý).
  `MoldAsset.costVnd` LƯU CỨNG giá trị tại thời điểm mua — không tính lại theo
  tỷ giá hiện hành khi `asOfYear` thay đổi (chỉ ảnh hưởng phần khấu hao còn lại,
  không ảnh hưởng giá trị đã ghi sổ tài sản).
- Bậc 2 và bậc 4 thang giá (M7) THAM CHIẾU CHÉO cả 2 dòng SP — đã có 2 lỗi công
  thức thật ở đây trong prototype Pha 1 (xem session log Phiên 5, 2026-07-05),
  viết test riêng cho đúng 2 điểm này trước khi tin kết quả.
- `npm test` phải xanh trước MỌI commit (CLAUDE.md) — không commit dở dang một
  milestone nếu test đỏ; thà dừng ở milestone trước.

## Việc tiếp theo ngay khi phiên sau vào
→ **M11: Bộ test parity Excel đầy đủ 372 assertion** (gom M2-M9 thành 1 suite
hoàn chỉnh trong `tests/parity/`, đối chiếu skill `excel-parity-testing`) —
KHÔNG viết engine mới, chỉ tổng hợp/đối chiếu lại toàn bộ `tests/fixtures/*.json`
trong 1 chỗ để dễ audit tổng số assertion đã khớp Excel v3.4. Sau M11 →
M12 (UI thật, CHỈ làm khi user xác nhận mở rộng phạm vi).

## Nhật ký milestone đã xong (chi tiết, tránh phải đọc lại session log)
- **M10 (2026-07-06)**: `src/engine/solver.ts` — `solve()`/`solveDiscrete()`
  (bisection thuần cho biến liên tục / quét rời rạc cho biến nguyên, đúng luật
  #1/#3/#5 skill `inverse-solver`) + `solveTargetProfit()` (T2, dạng đóng, tái
  dùng thẳng `fixedCostPerYear`/`contributionMarginPerKg` từ `cvp.ts` M8 —
  KHÔNG tính lại). Viết GENERIC `<TInput, TOutput>` thay vì khoá cứng
  `ScenarioInput`/`ScenarioOutput` (`scenario.ts`) vì CHƯA có hàm orchestration
  `calculateScenario()` nối toàn bộ engine thành 1 `ScenarioOutput` (thuộc phạm
  vi M11/M12) — solve() hoạt động với bất kỳ input/output nào, giống mọi module
  engine khác (pipe.ts không phụ thuộc ScenarioInput). Phát hiện thiếu sót ở
  `SolveParams` đã đóng băng: thiếu field `baseInput` (input gốc để set giá trị
  dò vào theo `freeVarPath`) — bổ sung vào `scenario.ts`/`scenario.md`, ghi vào
  bảng ADR-009 (dòng #4) theo đúng quy trình ADR-009 đã đặt ra (không lặp lại
  lỗi "chỉ ghi code comment" của 3 lần đầu).
  Test: `tests/unit/solver.test.ts` (5 test, hàm số học đơn giản — kiểm tra cơ
  chế bisection/quét rời rạc/infeasible độc lập nghiệp vụ) +
  `tests/parity/solver.test.ts` (5 test, trên forward function THẬT của
  `pipe.ts`/`price-ladder.ts` + fixture v3.4): round-trip
  `|forward(solve(target)) − target| < tol` hội tụ đúng
  `compoundReplacementPriceUsdPerKg` gốc (3.03); case chuẩn T3 skill
  `inverse-solver` — "giá niêm yết DN50 mục tiêu 260.000đ/m, huy động phụ kiện
  không đổi, hỏi giá compound tối đa được phép" → nghiệm ≈2.48 USD/kg,
  forward-verify khớp TUYỆT ĐỐI `listPriceBeforeVat=260000` (hàm bậc-thang do
  `roundUpToHundred`, bisection vẫn hội tụ đúng vì hàm đơn điệu không giảm);
  case infeasible (mục tiêu dưới sàn — dưới cả `listPriceBeforeVat` khi giá
  compound=0) → `feasible:false` kèm `achievableRange`; T2
  `solveTargetProfit(targetProfitVnd=0)` khớp tuyệt đối
  `pipe.json.cvp.breakEvenKgYear` (107039.627408882) vì Q hòa vốn KHÔNG lợi
  nhuận chính là breakEvenKgYear — cùng công thức, không phải 2 con số độc lập.
  `npm test` 185/185 xanh, `npm run typecheck` sạch.
- **M9 (2026-07-06)**: `src/engine/plan.ts` — `calculatePlan()` theo
  BUSINESS_MODEL §6 (6 quy tắc: quy đổi giờ máy, đánh giá ca, ràng buộc khuôn
  theo size, nguyên liệu+ngoại tệ RAW không qua price-lock, nhân công cần
  tuyển, chi phí/kg thực tế so công suất nhàn rỗi). Bổ sung 2 field bị SÓT vào
  `PlanInputSchema` (đã đóng băng ở Pha 2): `periodMonths` (hệ số kỳ — công
  thức §6.2 luôn cần, không suy được từ chuỗi `period`) và
  `currentLaborHeadcount` (§6.5 cần, chưa có ở đâu trong schema). 2 giả định
  thiết kế (KHÔNG có Excel xác nhận, ghi rõ trong comment `plan.ts` để dễ chỉnh
  khi có kịch bản thật): "số máy cần thêm" khi thiếu cả 3 ca coi công suất
  3-ca hiện tại là 1 đơn vị, ROUNDUP số đơn vị cần thêm; `moldSetCountBySizeDN`
  nhận làm cross-ref input thay vì tự suy từ `moldAssets`+`products` (join phức
  tạp, để tầng orchestration cấp).
  Test `tests/parity/plan.test.ts` (9 test, 2 kịch bản tự chọn TÍNH TAY bằng
  script Python độc lập trước khi viết assertion — KHÔNG phải số vàng Excel,
  ghi rõ trong comment đầu file): kịch bản A (kế hoạch vừa công suất, 2 ca Ống/
  1 ca Phụ kiện, không cảnh báo khuôn) + kịch bản B (kế hoạch Phụ kiện vượt xa
  công suất → thiếu cả 3 ca cần thêm 1 máy, thiếu khuôn cần thêm 3 bộ, Ống
  không có kế hoạch → `idleCapacityCostPipePerKg=null` tránh chia 0).
  `npm test` 171/171 xanh.
- **M7+M8 (2026-07-06, làm M8 TRƯỚC M7)**: kiểm tra lại công thức bậc 2/4 bằng
  tính tay đối chiếu `dashboard.json` TRƯỚC khi code (theo yêu cầu user) — phát
  hiện bậc 1 (`variableCostFloor`) CHÍNH LÀ `cvp.variableCostPerKg`, nghĩa là
  price-ladder (M7) phụ thuộc CVP (M8) → đảo thứ tự làm CVP trước để tái dùng,
  không tính trùng công thức.
  `src/engine/cvp.ts` — `calculatePipeCvp()`/`calculateFittingCvp()`, nhận
  thẳng output đã có từ `pipe.ts`/`fitting.ts` (M2/M3) làm input, không tính
  lại từ đầu. Test `tests/parity/cvp.test.ts` (8 test) khớp tuyệt đối
  `{pipe,fitting}.json.cvp`.
  `src/engine/price-ladder.ts` — `calculatePipePriceLadder5Tier()`/
  `calculateFittingPriceLadder5Tier()` (bậc 2 chỉ cộng phần compliance+rent qua
  `sharedCostAllocationRatio`, KHÔNG gồm khấu hao lab/UL — tránh đúng bug cũ;
  bậc 4 dùng `revenueShare = ownRevenue/(ownRevenue+otherLineRevenue)`, KHÔNG
  chia theo kg — tránh đúng bug cũ thứ 2), `calculatePipeSkuPriceChain()`/
  `calculateFittingSkuPriceChain()` (bỏ hẳn tham số `brassInsertCost` cộng
  riêng — ADR-008 đã gập vào `materialCostPerUnit` từ M6, không giữ field cũ).
  Test `tests/parity/price-ladder.test.ts` (101 test): 2 test thang giá 5 bậc
  (cả 2 dòng SP) + 8 test bảng giá Ống theo DN + 91 test bảng giá SKU Phụ kiện
  (11 SKU ren gọi `materialCostPerUnitWithInsert()` M6, còn lại dùng
  `materialCostPerUnit` gốc). Phát hiện thêm: 7 SKU `pending_mold` (Cút/Tê ren
  trong) có `brassInsertCost` trong fixture nhưng KHÔNG được cộng (số chưa xác
  nhận, ADR-008 "stillOpen") — xử lý riêng trong test bằng `mold-assets.json.skusWithoutMold`.
  Sửa 1 lỗi test nhỏ: `listPriceWithVat` phải dùng `toBeCloseTo` thay vì `toBe`
  (sai số float từ phép nhân `× (1+vatOutputRate)`, KHÔNG phải lỗi công thức).
  `npm test` 162/162 xanh.
  `materialCostPerUnitWithInsert()`, `weightedAvgInsertPriceVnd()`,
  `metalInsertHoldingGainLossVnd()` (bản KHÔNG quy đổi ngoại tệ — viết hàm
  riêng thay vì tái dùng `dual-costing.ts` với tham số giả để vô hiệu hóa quy
  đổi, giữ code trung thực dễ đọc). `evaluatePriceLock()` (M5) DÙNG LẠI NGUYÊN
  cho cả policy compound lẫn ren kim loại.
  **PHÁT HIỆN QUAN TRỌNG** (sửa nhận định sai trong BUSINESS_MODEL/ADR-008):
  `tests/fixtures/fitting.json.skus[].brassInsertCost` KHÔNG phải 0 cho toàn bộ
  91 SKU như tài liệu cũ ghi — 18 SKU họ "ren" (kể cả 7 SKU `pending_mold`
  Cút/Tê ren trong) đã có giá trị thật khớp `metal-insert.json`. Dùng chính
  `materialCostPerUnit + brassInsertCost` (fixture) làm số vàng tự-đối-chiếu
  cho `materialCostPerUnitWithInsert()` — khớp tuyệt đối cả 11/11 SKU ren có
  khuôn thật (`tests/parity/metal-insert.test.ts`, 14 test). 7 SKU
  Cút/Tê ren trong vẫn KHÔNG dùng số này làm chính thức (per ADR-008 "stillOpen"
  — giá chưa xác nhận, chỉ là số kế thừa từ Excel gốc theo pattern PT-size);
  không ảnh hưởng vì SKU này đã bị `managementStatus='pending_mold'` ẩn khỏi
  danh mục vận hành (M1). `npm test` 57/57 xanh.
- **M5 (2026-07-06)**: `src/engine/price-lock.ts` — `evaluatePriceLock({baseline,
  thresholdPct, replacement, lastLotPrice}) → {deviationPct, isLocked,
  pricingPrice, stalenessWarning}`, dùng CHUNG cho compound (USD) và ren kim
  loại (VND, M6 sẽ dùng lại) vì công thức không phụ thuộc đơn vị tiền. Test
  `tests/unit/price-lock.test.ts` khớp đủ 5 kịch bản `price-lock-scenarios.json`.
  `src/engine/dual-costing.ts` — `weightedAvgUsdPerKg()`, `totalInventoryKg()`,
  `holdingGainLossVnd()`, `provisionWarning()`; test
  `tests/unit/dual-costing.test.ts` khớp tuyệt đối kịch bản kho 2 đợt trong
  skill `excel-parity-testing` (lãi giữ kho = 1.332.685.000đ). **NỐI DÂY**:
  `tests/parity/price-lock-integration.test.ts` — với MỖI kịch bản ADR-004, gọi
  `evaluatePriceLock()` rồi feed `pricingPrice` vào
  `calculatePipeCostAtNormalCapacity()` (M2), verify `fullCostPerKg` khớp cả 5
  kịch bản (kể cả 2 kịch bản MỞ KHÓA: 121.012 và 98.958) — KHÔNG sửa signature
  `pipe.ts`/`fitting.ts`, chỉ thay nguồn giá trị ở tầng gọi. `npm test` 43/43
  xanh.
- **M4 (2026-07-06)**: `src/engine/mold-depreciation.ts` —
  `isMoldAssetStillDepreciating(asset, asOfYear)` +
  `moldDepreciationPerYear(moldAssets, asOfYear)`. Nối vào `fitting.ts` (thêm
  `asOfYear` vào `FittingCostAtNormalCapacityInputs`, thay vòng lặp reduce inline
  bằng gọi hàm mới — KHÔNG đổi công thức, chỉ thêm điều kiện lọc). Test:
  `tests/unit/mold-depreciation.test.ts` (10 test) — gồm 1 kịch bản TỔNG HỢP 3
  khuôn mua 3 năm/đời sống khác nhau chứng minh lọc CHỌN LỌC đúng (không phải
  tất-cả-hoặc-không, vì dữ liệu thật hiện tại mọi khuôn cùng `purchaseYear=2026`
  không đủ phân biệt), + test trên `mold-assets.json` thật tại `asOfYear=2026`
  (khớp năm gốc), `2030` (còn hạn), `2031` (hết hạn cả 66 khuôn → về 0).
  `npm test` 28/28 xanh.
- **M3 (2026-07-06)**: `src/engine/fitting.ts` — `calculateFittingCapacity()` +
  `calculateFittingCostAtNormalCapacity()`. Phát hiện + sửa: `MachineHourResourceSchema`
  (M1) thiếu field `depreciationYears` (khấu hao MÁY ép, tách khỏi
  `MoldAsset.usefulLifeYears` — khấu hao KHUÔN) — đã bổ sung vào
  `src/schemas/resource.ts` + `docs/contracts/resource.md`. Thiết kế
  `machineDepreciationPerYear` và `moldDepreciationPerYear` THÀNH 2 field TÁCH
  RIÊNG (thay vì gộp `machineMoldDepreciation` như Excel) để M4 chỉ cần sửa
  đúng 1 field (`moldDepreciationPerYear`) mà không đụng máy — verify: 2 field
  cộng lại khớp tuyệt đối `machineMoldDepreciationPerYear` gốc (Excel). Cross-ref
  sang Ống (`otherLineNormalCapacityKgYear`) nhận trực tiếp làm input, giống
  pattern `pipe.ts`. Test: `tests/parity/fitting.test.ts` (4 test, khớp tuyệt
  đối `mhrPerMachineHour = 1.344.175,79463858`).
- **M2 (2026-07-06)**: `src/engine/pipe.ts` — `calculatePipeCapacity()` +
  `calculatePipeCostAtNormalCapacity()`. Phát hiện + sửa: `ContinuousKgResourceSchema`/
  `MachineHourResourceSchema` (M1) THIẾU 12 field (lương/điện/nước/bao bì/năng
  suất quy đổi) — đã bổ sung vào `src/schemas/resource.ts` +
  `docs/contracts/resource.md` (ghi chú "sửa lỗi thiếu sót", không phải ADR).
  `otherLineEstimatedProductionKgYear` và `compoundPricingPriceUsdPerKg` là 2
  tham số CHƯA nối dây thật (cross-ref Phụ kiện chưa tồn tại tới M3; price-lock
  chưa tồn tại tới M5) — nhận trực tiếp làm input, ghi rõ trong comment đầu
  `pipe.ts`. Test: `tests/parity/pipe.test.ts` (4 test, khớp tuyệt đối
  `fullCostPerKg`/`vfPricePerKg` và toàn bộ field trung gian).
