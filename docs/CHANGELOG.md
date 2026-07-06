# CHANGELOG — Costing App Kit

## v1.23 (2026-07-06) — Đóng gói tri thức cho phiên mới (checkpoint sau M12.4)
Không đổi nghiệp vụ/code — rà soát + chốt sổ theo yêu cầu user, cùng thông lệ
"kit vX" đã thiết lập ở v1.5/v1.16/v1.20. Phát hiện + vá 2 chỗ tài liệu lỗi
thời (không phải bug code): `CONTEXT_PASTE.md` thiếu ADR-009/010 trong danh
sách ADR đã chấp nhận; `PROJECT_SPEC.md` §3 chưa nhắc `functions/`/Cloud
Function dù đã có ADR-010.

| File | Kiểm tra | Kết quả |
|---|---|---|
| docs/CONTEXT_PASTE.md | Danh sách "ADR đã CHẤP NHẬN" đủ chưa | Thiếu 009/010 — đã bổ sung |
| docs/PROJECT_SPEC.md | §3 Kiến trúc có nhắc Cloud Function chưa | Thiếu — thêm 1 dòng khớp ADR-010 |
| docs/M12_PLAN.md | Bảng M12.1-M12.4 `[x]` đúng chưa, M12.4b con trỏ đúng chưa | Đã đúng từ Phiên 17-18, không cần sửa |
| docs/PHASE3_PLAN.md | M12 trỏ đúng `M12_PLAN.md` chưa | Đã đúng |
| docs/GLOSSARY.md | Thuật ngữ mới (`moldSetCountBySizeDN`, tên Cloud Function...) cần thêm không | Không cần — nội bộ engine/hạ tầng, chưa lên UI |
| AGENTS.md | Thứ tự đọc file đầu phiên còn đúng không | Đúng |
| git | `git status` sạch, đã push hết lên `claude/firebase-emulator-security-rules-5eij5z` | Sạch, 2 commit (M12.3, M12.4) |
| test | `npm test` / `npm run typecheck` / `npm run build` | 286/286 xanh, sạch, build được |

## v1.22 (2026-07-06) — Pha 3 M12.4: Cloud Function onScenarioWrite (lõi) + ADR-010
`docs/decisions/ADR-010-cloud-function-boundaries.md` (mới) — tách M12.4
thành 3 phần sau khi phát hiện Plan_SX chưa được `calculateScenario()`
orchestrate (thiếu `moldSetCountBySizeDN`) và `TargetPriceRequestSchema` (T3)
thiếu trường chọn SKU: M12.4 (lõi, xong ngay) / M12.4b (`outputs/plan`, hoãn)
/ M12.4c (`outputs/targetCosting`, hoãn).
Scaffold `functions/` (Cloud Functions TS riêng `package.json`,
`firebase-functions@7`+`firebase-admin@13`, tsconfig dùng chung kiểu module
ESM/Bundler với root để tái dùng thẳng `src/engine`/`src/schemas`).
`firebase.json` +block `functions` + emulator port 5001; `.firebaserc` mới
(`demo-costing-app`, bắt buộc để Firestore+Functions Emulator chung project
khi chạy `emulators:exec`). `functions/src/index.ts`: `onScenarioWrite`
(Firestore trigger `scenarios/{id}`) → `calculateScenario()` (tái dùng M12.1)
→ ghi `outputs/internal` (đầy đủ) + `outputs/priceList` (lược field giá vốn —
sales-safe); xóa doc → dọn cả 2.
Tách `tests/helpers/scenario-fixture.ts` khỏi `tests/parity/scenario.test.ts`
(refactor thuần) để dùng lại ở `tests/functions/on-scenario-write.test.ts` (2
test, chạy thật trên Firestore+Functions Emulator qua `npm run test:functions`
mới, tách khỏi `npm test`).
`npm test` 286/286, `npm run typecheck` (root + `functions/`) sạch, `npm run
test:rules` (M12.3) vẫn 33/33 sau khi thêm `.firebaserc`.

## v1.21 (2026-07-06) — Pha 3 M12.3: Firebase Emulator Suite + Firestore Security Rules
Cài `firebase-tools@15`/`firebase@12`/`@firebase/rules-unit-testing@5`.
`firebase.json` (emulator firestore:8080 + auth:9099 + ui) +
`firestore.indexes.json` (rỗng). `firestore.rules` dịch bảng phân quyền
`docs/contracts/scenario.md` §5-6 (4 vai admin/pricing/sales/production × 6
vùng dữ liệu, doc split vật lý cho `scenarios/{id}`/`outputs/internal`/
`outputs/priceList`/`outputs/plan`/`planInputs/{period}`/`outputs/targetCosting`/
`moldAssets/{moldId}`) — field-lock cho `pricing` ghi `scenarios/{id}` đúng
danh sách `resource.md`/`cost-pool.md` (+ `thresholdPct` từ `pricing-chain.md`
cho 2 field không phải mảng); CHƯA khóa `products[]`/
`metalInsert[].priceLock.thresholdPct` (mảng, ngoài phạm vi câu chữ scenario.md
§5 dòng 1 — ghi rõ còn treo, cần ADR nếu muốn mở rộng).
`tests/rules/firestore.rules.test.ts` (33 test, chạy THẬT trên Firestore
Emulator qua `npm run test:rules` mới, tách khỏi `npm test` bằng
`vitest.config.ts`/`vitest.rules.config.ts`) — bao phủ mỗi vai × mỗi vùng dữ
liệu, xác nhận `sales` không đọc được `outputs/internal`, `production` không
đọc được `outputs/internal`/`outputs/targetCosting`/`scenarios/{id}`.
`npm test` vẫn 286/286, `npm run typecheck` sạch.

## v1.20 (2026-07-06) — Đóng gói tri thức cho phiên mới (checkpoint M12.3)
Không đổi nghiệp vụ — rà soát + chốt sổ theo yêu cầu user ("lưu lại tri thức
đánh dấu các mission xong để phiên kế tiếp khởi tạo mới sẽ hiểu và làm
tiếp"), cùng thông lệ "kit vX" đã thiết lập ở v1.5/v1.16. Nhân dịp rà soát,
phát hiện + vá 1 lỗ hổng quy trình: `docs/M12_PLAN.md` bị BỎ SÓT cập nhật
M12.2 → `[x]` ngay sau khi làm xong (Phiên 15) — CONTEXT_PASTE.md/session log
đã ghi đúng nhưng file theo dõi chính thức (nguồn duy nhất phiên sau đọc để
biết việc tiếp theo) thì chưa — đã vá lại trong phiên này.

| File | Kiểm tra | Kết quả |
|---|---|---|
| docs/M12_PLAN.md | M12.2 đã tick `[x]` chưa? Có "Việc tiếp theo ngay" chi tiết cho M12.3 chưa? | Thiếu cả 2 — đã bổ sung (tick M12.2 + thêm 6 bước cụ thể cho M12.3) |
| docs/CONTEXT_PASTE.md | Tiến độ M12.1/M12.2 đã đúng chưa | Đã đúng từ Phiên 15, không cần sửa |
| docs/PHASE3_PLAN.md | M12 trỏ đúng `M12_PLAN.md` chưa | Đã đúng, không cần sửa |
| docs/GLOSSARY.md | Thuật ngữ mới (`replacementPriceUsdPerKg`...) cần thêm không | Không cần — đã có sẵn `replacementCost` (Giá tái tạo) bao quát đúng khái niệm |
| AGENTS.md | Thứ tự đọc file đầu phiên còn đúng không | Đúng, không cần sửa |
| git | `git status` sạch, đã push hết lên `claude/project-knowledge-setup-2au4hr` | Sạch |
| test | `npm test` / `npm run typecheck` / `npm run build` | 286/286 xanh, sạch, build được |

## v1.19 (2026-07-06) — Pha 3 M12.1+M12.2: orchestrator + scaffold frontend thật
User xác nhận mở rộng phạm vi sang M12 (UI thật + Firestore) — chia nhỏ
M12.1-M12.10 ở `docs/M12_PLAN.md` (mới), quyết định hạ tầng: CHƯA có project
Firebase thật → dùng Firebase Local Emulator Suite trước.

**M12.1** — `src/engine/scenario.ts`: `calculateScenario(ScenarioInput) →
ScenarioOutput` nối toàn bộ pipe/fitting/cvp/price-ladder/price-lock/
dual-costing/metal-insert qua 1 cửa ngõ duy nhất. Bổ sung field thiếu ở
schema đã đóng băng: `CompoundInventorySchema.replacementPriceUsdPerKg`,
`MetalInsertCatalogEntrySchema.replacementPriceVnd` (ADR-009 dòng #5).
Phát hiện + sửa 2 lỗi có thật khi lần đầu chạy `ScenarioOutputSchema.parse()`
trên toàn bộ 99 SKU: (1) `listPriceWithVat` float vi phạm `z.number().int()`
→ làm tròn `Math.round()` trong `price-ladder.ts`; (2) `mold-assets.json`
dùng sai ký tự Unicode cho "Cút 90°/45°" (U+00B0) thay vì đúng ký tự
`fitting.json` ("Cút 90º/45º", U+00BA) → 11 SKU bị phân loại nhầm
`managementStatus`. Test `tests/parity/scenario.test.ts` (8 test).

**M12.2** — scaffold Vite + React 18 (ghim đúng bản, npm mặc định kéo 19) +
TS strict + Tailwind + Recharts. Verify chạy thật bằng `npm run build` +
`npm run dev` + screenshot Playwright (không chỉ tin build xanh).

`npm test` 286/286 xanh (từ 278), typecheck sạch, `npm run build` chạy được.

## v1.18 (2026-07-06) — Pha 3 M11: audit fixture coverage
Rà soát toàn bộ `tests/fixtures/*.json`, phát hiện `price-list.json` (bảng
phẳng 99 dòng, sheet "PriceList") là fixture DUY NHẤT chưa có test nào tham
chiếu (mọi test khác đối chiếu qua `pipe.json`/`fitting.json` trung gian).
Viết `tests/parity/price-list-snapshot.test.ts` (93 test) đối chiếu ĐỘC LẬP —
8 dòng Ống + 83/91 dòng Phụ kiện khớp tuyệt đối (8 SKU `pending_mold` cố tình
bỏ qua so giá trị, đúng ADR-008). Mọi fixture vàng nay đều có ít nhất 1 test.

`npm test` 278/278 xanh (từ 185), typecheck sạch.

## v1.17 (2026-07-06) — Pha 3 M10: Inverse solver (T2/T3, ADR-005/006)
`src/engine/solver.ts` — `solve()`/`solveDiscrete()` (bisection thuần cho
biến liên tục, quét rời rạc cho biến nguyên — skill `inverse-solver`) +
`solveTargetProfit()` (T2 dạng đóng, tái dùng `cvp.ts`, KHÔNG qua solver vì
đây CHÍNH LÀ forward CVP). Generic `<TInput, TOutput>` vì chưa có
orchestrator `calculateScenario()` (làm ở M12.1). Bổ sung field `baseInput`
thiếu ở `SolveParams` đã đóng băng (ADR-009 dòng #4).

Test: round-trip trên fixture thật; case chuẩn T3 (DN50 mục tiêu 260.000đ/m,
forward-verify khớp tuyệt đối `listPriceBeforeVat=260000`); case infeasible
(dưới sàn biến phí) → `feasible:false` kèm `achievableRange`; T2 khớp tuyệt
đối `pipe.json.cvp.breakEvenKgYear`.

`npm test` 185/185 xanh (từ 171), typecheck sạch.

## v1.16 (2026-07-06) — Đóng gói tri thức cuối ngày cho phiên mới
Không đổi nghiệp vụ — chỉ rà soát + chốt sổ cuối ngày (9/12 milestone Pha 3
xong: M1-M9), theo đúng thông lệ "kit vX" đã thiết lập ở v1.5 (2026-07-05).

| File | Kiểm tra | Kết quả |
|---|---|---|
| docs/CONTEXT_PASTE.md | Thêm dòng tóm tắt tiến độ ngay đầu khối trạng thái | Đã cập nhật |
| docs/PHASE3_PLAN.md | Bảng M1-M9 `[x]`, con trỏ M10 chính xác | Đã đúng, không cần sửa |
| docs/GLOSSARY.md | Rà soát thuật ngữ mới phát sinh ở M1-M9 | Không có thuật ngữ UI mới (các field mới như `periodMonths`, `moldSetCountBySizeDN` là nội bộ engine, chưa lên UI) |
| AGENTS.md | Thứ tự đọc file đầu phiên còn đúng không (đã có PHASE3_PLAN.md) | Đúng — CONTEXT_PASTE.md tự trỏ sang PHASE3_PLAN.md, không cần sửa AGENTS.md |
| git | `git status` sạch, đã push hết lên `claude/nifty-dirac-wuamy6` | Sạch |
| test | `npm test` | 171/171 xanh |

## v1.15 (2026-07-06) — Pha 3 M9: Plan_SX (T1, BUSINESS_MODEL §6)
`src/engine/plan.ts` — `calculatePlan()` hiện thực đủ 6 quy tắc §6: quy đổi kế
hoạch → giờ máy, đánh giá bậc ca, ràng buộc khuôn theo size (chỉ Phụ kiện),
nguyên liệu+ngoại tệ cần (dùng giá RAW, không qua price-lock — khác mọi hàm
trước), nhân công cần tuyển, chi phí/kg thực tế so công suất nhàn rỗi (chỉ Ống).

Bổ sung 2 field bị sót vào `PlanInputSchema` (đã đóng băng Pha 2):
`periodMonths`, `currentLaborHeadcount` — không phải đổi kiến trúc, chỉ sửa
thiếu sót khi công thức yêu cầu dữ liệu chưa có chỗ chứa.

**Khác biệt quan trọng với mọi milestone trước**: sheet `Plan_SX` gốc trong
Excel là template (input=0) nên KHÔNG có số vàng thật để đối chiếu.
`tests/parity/plan.test.ts` (9 test) dùng 2 kịch bản TỰ CHỌN, tính tay độc lập
bằng script Python trước khi viết assertion — không phải parity Excel.

`npm test` 171/171 xanh, typecheck sạch. **M10 tiếp theo**: inverse solver
(T2/T3) — xem `docs/PHASE3_PLAN.md`.

## v1.14 (2026-07-06) — Pha 3 M7+M8: thang giá 5 bậc + CVP (làm M8 trước M7)
Kiểm tra lại công thức bậc 2/4 bằng tính tay đối chiếu `dashboard.json` TRƯỚC
khi code (theo yêu cầu user, tránh lặp lại 2 lỗi công thức thật đã xảy ra ở
prototype Pha 1 — xem `docs/sessions/SESSION_2026-07-05.md` Phiên 5). Phát hiện
bậc 1 (`variableCostFloor`) CHÍNH LÀ `cvp.variableCostPerKg` → đảo thứ tự, làm
CVP (M8) trước price-ladder (M7).

`src/engine/cvp.ts` — `calculatePipeCvp()`/`calculateFittingCvp()`, tái dùng
output đã có từ M2/M3. `src/engine/price-ladder.ts` —
`calculate{Pipe,Fitting}PriceLadder5Tier()` (bậc 2 chỉ cộng compliance+rent qua
`sharedCostAllocationRatio`, KHÔNG gồm khấu hao lab/UL; bậc 4 dùng
`revenueShare` theo doanh thu VF, KHÔNG chia theo kg — cả 2 đúng ngược lại với
2 lỗi cũ), `calculate{Pipe,Fitting}SkuPriceChain()` (bỏ hẳn tham số
`brassInsertCost` cộng riêng — ADR-008 đã gập vào `materialCostPerUnit` từ M6).

Test: `tests/parity/cvp.test.ts` (8 test) + `tests/parity/price-ladder.test.ts`
(101 test: thang giá 5 bậc cả 2 dòng SP, 8 dòng bảng giá Ống, 91 dòng bảng giá
SKU Phụ kiện — xử lý riêng 7 SKU `pending_mold` có `brassInsertCost` chưa xác
nhận trong fixture).

`npm test` 162/162 xanh, typecheck sạch. **M9 tiếp theo**: Plan_SX (T1) — xem
`docs/PHASE3_PLAN.md`.

## v1.13 (2026-07-06) — Pha 3 M6: dòng vật liệu ren kim loại (ADR-008)
`src/engine/metal-insert.ts` — `materialCostPerUnitWithInsert()`,
`weightedAvgInsertPriceVnd()`, `metalInsertHoldingGainLossVnd()` (bản KHÔNG quy
đổi ngoại tệ, vì ren mua VND trong nước). `evaluatePriceLock()` (M5) dùng lại
nguyên cho cả policy compound lẫn ren kim loại.

**Phát hiện quan trọng (sửa nhận định sai trong BUSINESS_MODEL/ADR-008)**:
`fitting.json.skus[].brassInsertCost` KHÔNG phải 0 cho toàn bộ 91 SKU như tài
liệu cũ ghi — 18 SKU họ "ren" đã có giá trị thật khớp `metal-insert.json`. Dùng
`materialCostPerUnit + brassInsertCost` (fixture) làm số vàng tự-đối-chiếu —
khớp tuyệt đối 11/11 SKU ren có khuôn thật (`tests/parity/metal-insert.test.ts`,
14 test). 7 SKU Cút/Tê ren trong (`pending_mold`) không dùng số này làm chính
thức (ADR-008 "stillOpen"), nhưng vô hại vì đã bị ẩn khỏi danh mục vận hành.

`npm test` 57/57 xanh, typecheck sạch. **M7 tiếp theo**: thang giá 5 bậc +
chuỗi markup SKU — xem `docs/PHASE3_PLAN.md`.

## v1.12 (2026-07-06) — Pha 3 M5: khóa bảng giá (ADR-004) + giá vốn kép (ADR-002)
`src/engine/price-lock.ts` — `evaluatePriceLock()`, dùng CHUNG cho compound
(USD) và ren kim loại (VND, sẽ dùng lại ở M6) vì công thức không phụ thuộc đơn
vị tiền. `src/engine/dual-costing.ts` — `weightedAvgUsdPerKg()`,
`holdingGainLossVnd()`, `provisionWarning()`.

**Nối dây** (`tests/parity/price-lock-integration.test.ts`): với mỗi kịch bản
ADR-004, gọi `evaluatePriceLock()` rồi feed `pricingPrice` vào
`calculatePipeCostAtNormalCapacity()` (M2) — khớp `fullCostPerKg` cả 5 kịch bản
kể cả 2 kịch bản MỞ KHÓA (121.012 và 98.958). KHÔNG sửa signature
`pipe.ts`/`fitting.ts`, chỉ thay nguồn giá trị đầu vào ở tầng gọi.

Test mới: `tests/unit/price-lock.test.ts` (5 kịch bản ADR-004),
`tests/unit/dual-costing.test.ts` (kịch bản kho 2 đợt, lãi giữ kho =
1.332.685.000đ, khớp skill excel-parity-testing), `tests/parity/price-lock-integration.test.ts`
(5 test tích hợp). `npm test` 43/43 xanh, typecheck sạch.

**M6 tiếp theo**: dòng vật liệu ren kim loại (ADR-008) — xem `docs/PHASE3_PLAN.md`.

## v1.11 (2026-07-06) — Pha 3 M4: khấu hao khuôn động theo asOfYear (ADR-007)
`src/engine/mold-depreciation.ts` — `isMoldAssetStillDepreciating()` +
`moldDepreciationPerYear()`, nối vào `fitting.ts` (thêm `asOfYear` vào
`FittingCostAtNormalCapacityInputs`, thay reduce inline bằng gọi hàm mới, không
đổi công thức khác).

`tests/unit/mold-depreciation.test.ts` (10 test): kịch bản TỔNG HỢP 3 khuôn mua
3 năm/đời sống khác nhau chứng minh lọc CHỌN LỌC đúng (dữ liệu thật hiện tại
mọi khuôn cùng `purchaseYear=2026` không đủ phân biệt tất-cả-hoặc-không); + test
trên `mold-assets.json` thật tại `asOfYear` 2026 (năm gốc)/2030 (còn hạn)/2031
(hết hạn cả 66 khuôn → khấu hao về 0).

`npm test` 28/28 xanh, typecheck sạch. **M5 tiếp theo**: giá vốn kép (ADR-002)
+ khóa bảng giá (ADR-004) — xem `docs/PHASE3_PLAN.md`.

## v1.10 (2026-07-06) — Pha 3 M3: engine Phụ kiện (fitting.ts)
`src/engine/fitting.ts` — `calculateFittingCapacity()` +
`calculateFittingCostAtNormalCapacity()` (BUSINESS_MODEL §3.2-3.3), khớp tuyệt
đối `mhrPerMachineHour = 1344175.79463858` (trái tim ADR-001).

**Sửa lỗi thiếu sót**: `MachineHourResourceSchema` (M1) thiếu `depreciationYears`
(khấu hao MÁY ép — tách khỏi `MoldAsset.usefulLifeYears` là khấu hao KHUÔN) —
bổ sung vào `src/schemas/resource.ts` + `docs/contracts/resource.md`.

**Quyết định thiết kế**: tách `machineDepreciationPerYear` và
`moldDepreciationPerYear` thành 2 field riêng (Excel gộp chung 1
`machineMoldDepreciation`) — chuẩn bị sẵn cho M4 (khấu hao khuôn động theo
`asOfYear`, ADR-007) chỉ cần sửa field mold, không đụng field máy. Verify: 2
field cộng lại khớp tuyệt đối số Excel gốc.

`npm test` 18/18 xanh. **M4 tiếp theo**: lọc `moldDepreciationPerYear` theo
`asOfYear` — xem `docs/PHASE3_PLAN.md`.

## v1.9 (2026-07-06) — Pha 3 M2: engine Ống (pipe.ts)
`src/engine/pipe.ts` — `calculatePipeCapacity()` + `calculatePipeCostAtNormalCapacity()`
(BUSINESS_MODEL §2.1-2.2), khớp tuyệt đối `tests/fixtures/pipe.json.costAtNormalCapacity`
(`fullCostPerKg=106204.729733113`, `vfPricePerKg=132755.912166391`).

**Sửa lỗi thiếu sót phát hiện khi viết engine** (không phải ADR — không đổi
nghiệp vụ): `ContinuousKgResourceSchema`/`MachineHourResourceSchema` (M1) THIẾU
12 field mà công thức §2.2/§3.3 luôn cần (`packagingCostPerKg`,
`avgSalaryMonthly`, `monthsSalaryPerYear`, `electricityKw(PerMachineHour)`,
`electricityPricePerKwh`, `waterM3Per(Machine)Hour`, `waterPricePerM3`,
`avgProductivityKgPerMachineHour`) — bổ sung vào `src/schemas/resource.ts` +
`docs/contracts/resource.md` + `tests/unit/schemas.test.ts`, vẫn 10/10 xanh.

`npm run typecheck` sạch, `npm test` 14/14 xanh (10 schema + 4 parity pipe).
**M3 tiếp theo**: `src/engine/fitting.ts` — xem `docs/PHASE3_PLAN.md`.

## v1.8 (2026-07-06) — Schema ĐÓNG BĂNG, mở Pha 3 (M1: scaffold + src/schemas)
User duyệt schema Pha 2 ("thực hiện theo đề xuất") → 5 file `docs/contracts/*.md`
chính thức ĐÓNG BĂNG. Yêu cầu chia Pha 3 thành nhiều milestone nhỏ để tiết kiệm
tool call/token — xem `docs/PHASE3_PLAN.md` (bảng trạng thái M1..M12).

| File | Thay đổi |
|---|---|
| docs/PHASE3_PLAN.md | MỚI — lộ trình 12 milestone, mỗi milestone tự chứa (code + test xanh + commit) |
| package.json, tsconfig.json | MỚI — scaffold TypeScript strict + Zod + Vitest |
| src/schemas/{resource,product,cost-pool,pricing-chain,scenario}.ts | MỚI — code thật từ 5 file contract, không sửa cấu trúc so với `.md` |
| tests/unit/schemas.test.ts | MỚI — 10 test parse toàn bộ fixture thật (mold-assets 66 dòng, fitting.skus 91 dòng, pipe 8 dòng) + test xác nhận Zod từ chối `thresholdPct` chưa chuẩn hóa đơn vị |
| docs/CONTEXT_PASTE.md | Pha 2 → Pha 3, trỏ PHASE3_PLAN.md, ghi rõ M1 đã xong |

**M1 hoàn tất**: `npm run typecheck` sạch, `npm test` 10/10 xanh. **M2 tiếp theo**:
`src/engine/pipe.ts` (công suất + chi phí SX Ống tại CS bình thường).

## v1.7 (2026-07-06) — Schema nháp Pha 2 (5 file contract, CHƯA đóng băng)
Hiện thực hóa ADR-001..008 thành Zod schema cụ thể. Chưa phải quyết định kiến
trúc mới (không ADR), chỉ là bước chuyển ADR → schema đúng vai trò Pha 2.

| File | Nội dung | Nguồn |
|---|---|---|
| docs/contracts/resource.md | `Resource` (continuous_kg \| machine_hour) + `MoldAsset` | ADR-001, ADR-003, ADR-007 |
| docs/contracts/product.md | `Product` (pipe \| fitting) + BOM ren kim loại + `managementStatusOf()` tính ra | ADR-001, ADR-007, ADR-008 |
| docs/contracts/cost-pool.md | SharedFixedCosts, NonProductionCosts, CurrencyParams, MarkupChain | assumptions.json |
| docs/contracts/pricing-chain.md | PriceLockPolicy generic (input/output tách), CompoundInventory + MetalInsertCatalog, thang giá 5 bậc | ADR-002, ADR-004, ADR-008 |
| docs/contracts/scenario.md | ScenarioInput/Output tổng hợp, Plan_SX (T1), solver contract (T2/T3), Firestore doc split + bảng phân quyền 4 vai × 6 vùng | ADR-005, ADR-006, PROJECT_SPEC §3/§5 |

**Phát hiện cần xử lý trước Pha 3**: `thresholdPct` lệch đơn vị giữa
`assumptions.json` (thập phân 0.03) và `metal-insert.json` (số nguyên 5) —
schema chốt dùng thập phân, cần chuẩn hóa khi migrate fixture.

**Trạng thái**: schema NHÁP, chưa đóng băng — chờ user duyệt cổng thứ 2.

## v1.6 (2026-07-06) — Pha 1 duyệt, mở cổng Pha 2
User duyệt UI chính thức cho prototype (Pha 1). Không đổi nghiệp vụ, chỉ chuyển
pha trong quy trình 4 pha có cổng.

| File | Thay đổi | Lý do |
|---|---|---|
| docs/CONTEXT_PASTE.md | Đổi khối "TRẠNG THÁI HIỆN TẠI" Pha 1 → Pha 2 | Phản ánh đúng cổng vừa mở, việc tiếp theo là flow + schema Zod |
| docs/sessions/SESSION_2026-07-06.md | MỚI — ghi lại quyết định duyệt Pha 1 | Luật bất biến #6 (AGENTS.md): mọi phiên phải ghi session log |

## v1.5 (2026-07) — đóng gói tri thức cho phiên mới (ADR-007/008 đã đủ dữ liệu)
KHÁC BIỆT so với kit v1.4 (thuần đồng bộ tài liệu, không đổi nghiệp vụ so với các
bản cập nhật cuối v1.4):

| File | Thay đổi | Lý do |
|---|---|---|
| docs/CONTEXT_PASTE.md | Thêm khối "TRẠNG THÁI HIỆN TẠI" ở đầu file; viết lại điểm 8, 9 (ADR-007/008 từ "chờ dữ liệu" → "đã có số liệu thật"); thêm điểm 10 (8 SKU tạm loại khỏi danh mục quản lý) | File này là bản duy nhất được dán vào đầu phiên mới — phải phản ánh đúng trạng thái mới nhất, không được để "chờ dữ liệu" khi đã có rồi |
| docs/PROJECT_SPEC.md §2 | Thêm mục "Bổ sung ngoài Excel v3.4" ghi rõ ADR-007/008 đã trong phạm vi v1 | Constitution phải khớp thực tế các ADR đã chấp nhận |
| docs/GLOSSARY.md | +2 thuật ngữ: insertCatalog, managementStatus | UI tiếng Việt nhất quán khi lên Pha 2 |

**Lý do bump version dù không đổi nghiệp vụ**: các bản ghi "Cập nhật lần 1-5" bên
dưới (trong v1.4) đã đưa nghiệp vụ vào trạng thái ổn định, nhưng nằm rải rác thành
nhiều đoạn nhỏ khó quét nhanh — v1.5 gom lại thành 1 bản CONTEXT_PASTE.md sạch, để
phiên chat mới không cần đọc lại toàn bộ lịch sử session mới nắm được trạng thái.

## v1.4 (2026-07) — khấu hao khuôn theo thời gian + ren kim loại mua ngoài (CHỜ DỮ LIỆU)
KHÁC BIỆT so với kit v1.3:

| File | Thay đổi | Lý do |
|---|---|---|
| docs/decisions/ADR-007-time-phased-mold-depreciation.md | MỚI — khuôn phụ kiện tách thành `moldAsset` riêng (giá, năm mua, số năm khấu hao) thay vì 1 số gộp; MHR tính động theo `asOfYear` | User xác nhận: chuẩn bị cho khuôn mua sau (mở rộng SKU) — khấu hao lệch pha, không còn là hằng số |
| docs/decisions/ADR-008-purchased-metal-insert.md | MỚI — ren kim loại (đồng thau) cho 4 họ SKU ren là dòng nguyên liệu thứ 2, áp giá vốn kép (ADR-002) thay vì cộng thẳng `brassInsertCost` tĩnh | User xác nhận: xử lý giống hệt compound (bình quân gia quyền vs giá tái tạo) |
| docs/GLOSSARY.md | +4 thuật ngữ: moldAsset, asOfYear, purchasedMetalInsert, insertQtyPerUnit | UI tiếng Việt nhất quán |
| docs/CONTEXT_PASTE.md | +điểm 8, 9: khấu hao khuôn theo thời gian, ren kim loại mua ngoài | Đồng bộ bản nén 1 trang |

**Cập nhật cùng ngày**: user cung cấp thêm — khuôn `purchaseYear = 2026` (giá để
trống, tự nhập sau); ren kim loại mua VND trong nước (không ngoại tệ/DUTY), có
tồn kho riêng, và có khóa giá riêng độc lập với compound (mở rộng ADR-004). Cả 2
ADR nay đã CHẤP NHẬN đầy đủ về nguyên tắc.

**Cập nhật lần 2 cùng ngày — nhận số liệu thật**: user upload 2 file hợp đồng/bảng
giá thật:
- `tests/fixtures/mold-assets.json` — giá 66/66 khuôn (từ
  `contract_mold_price_from_David2506062.pdf`). Verify: Σ giá USD × 26.500 =
  6.542.850.000đ, khớp tuyệt đối `moldSetCostTotal66` hiện có. Phát hiện: 66 khuôn
  chỉ sản xuất được 83/91 SKU (nhiều khuôn dùng chung nhiều biến thể); 8 SKU
  (Cút ren trong ×3, Tê ren trong ×4, Tê giảm 50x40 ×1) CHƯA có khuôn — user xác
  nhận đúng (chưa sản xuất thật), khớp đúng kịch bản ADR-007.
- `tests/fixtures/metal-insert.json` — đơn giá 11/11 SKU ren kim loại (từ
  `Gia_phu_kien_ren.pdf`). Phạm vi thu hẹp đúng thực tế: CHỈ Nối ren trong (7) +
  Nối ren ngoài (4) = 11 SKU cần ren kim loại — khớp chính xác với 11 SKU có khuôn
  ở trên; Cút/Tê ren trong không có cả khuôn lẫn giá ren (nhất quán).
- ADR-007/008 cập nhật trạng thái "ĐÃ CÓ SỐ LIỆU" — còn thiếu: giá khuôn mới khi
  mua thêm cho 8 SKU kia; baseline/ngưỡng khóa giá ban đầu + tồn kho ban đầu cho
  ren kim loại (ADR-008).

**Cập nhật lần 3 cùng ngày — tồn kho ban đầu ren kim loại**: user cung cấp số lượng
tồn kho (10 dòng, đơn vị Cái). Phát hiện quan trọng: ren kim loại thực chất chỉ có
**10 loại vật tư theo (renType, ptSize)**, không phải 11 loại theo SKU — SKU
"20xPT15" và "25xPT15" dùng CHUNG 1 loại ren PT15 (cùng giá 16.200đ, xác nhận qua
đối chiếu giá đã có). Thêm `insertCatalog` (10 dòng, có tồn kho) + `skuToInsertMap`
vào `tests/fixtures/metal-insert.json`. Tổng tồn kho: 29.000 cái, 1.016.300.000đ (1
lô duy nhất → bình quân gia quyền = giá tái tạo). ADR-008 chỉ còn thiếu
baseline/ngưỡng khóa giá ban đầu.

**Cập nhật lần 4 cùng ngày — chốt ngưỡng khóa giá**: user xác nhận **ngưỡng khóa
giá ren kim loại = 5%**, baseline = giá hiện hành tại lần chốt đầu tiên (độ lệch=0%,
KHÓA). Thêm `priceLock` vào cả 10 dòng `insertCatalog`. **ADR-008 nay ĐẦY ĐỦ DỮ
LIỆU cho 11 SKU hiện có** — sẵn sàng lên schema Pha 2 chính thức.

**Cập nhật lần 5 cùng ngày — loại tạm 8 SKU khỏi danh mục quản lý**: user xác nhận
loại TẠM THỜI cả 8 SKU chưa có khuôn (7 SKU ren + Tê giảm 50x40, nhất quán theo
tiêu chí "chưa có khuôn thật", không chỉ riêng nhóm ren). Prototype: thêm
`EXCLUDED_SKUS` + `isExcludedSku()`, filter tại 3 nơi — bảng giá SKU Phụ Kiện,
tab Bảng Giá (100→92 dòng), Kế Hoạch SX Phụ Kiện (91→83). Dữ liệu Excel gốc KHÔNG
xóa, chỉ ẩn khỏi màn hình vận hành. ADR-007 cập nhật quyết định bổ sung.

## v1.3 (2026-07) — phân tầng top-down theo đối tượng xem
KHÁC BIỆT so với kit v1.2:

| File | Thay đổi | Lý do |
|---|---|---|
| docs/decisions/ADR-006-audience-tiers.md | MỚI — 2 tầng top-down: vận hành (`production`, T1, Plan_SX) vs chiến lược (`pricing`/`admin`, T2/T3 + giá thâm nhập, Target Costing) | Mức độ quan tâm/quyết định của SX quản lý và CEO khác nhau — không gộp 1 màn hình |
| docs/PROJECT_SPEC.md §1, §2, §3 | Gắn 2 tầng vào bảng vai; thêm `src/engine/solver.ts` vào kiến trúc | Đồng bộ constitution với ADR-005/006 |
| docs/GLOSSARY.md | +4 thuật ngữ: operationalTopDown, strategicTopDown, targetProfit, penetrationPrice | UI tiếng Việt nhất quán |
| docs/CONTEXT_PASTE.md | +điểm 7: phân tầng top-down theo vai | Đồng bộ bản nén 1 trang |

## v1.2 (2026-07) — chốt ý đồ hoạch định hai chiều
KHÁC BIỆT so với kit v1.1:

| File | Thay đổi | Lý do |
|---|---|---|
| docs/decisions/ADR-005-dual-direction.md | MỚI — forward engine + inverse solver, 3 câu hỏi top-down (T1/T2/T3) | Chốt ý đồ gốc: app là công cụ hoạch định, không phải máy tính giá |
| skills/inverse-solver | MỚI — luật giải ngược bằng bisection trên forward function, cấm công thức ngược viết tay | Solver là module bắt buộc của engine, không phải tính năng cơi nới sau |
| docs/CONTEXT_PASTE.md | +điểm 6: hai chiều hoạch định (bottom-up/top-down) | Đồng bộ bản nén 1 trang với ADR-005 |

## v1.1 (2026-07) — bổ sung cơ chế khóa bảng giá | nguồn Excel: v3.4
KHÁC BIỆT so với kit v1.0 (nguồn v3.3):

| File | Thay đổi | Lý do |
|---|---|---|
| docs/decisions/ADR-004-price-lock.md | MỚI — luật khóa baseline+ngưỡng, 5 kịch bản nghiệm thu | Nghiệp vụ mới chốt: bảng giá chỉ đổi khi lệch vượt ngưỡng % |
| skills/excel-parity-testing | Nguồn chân lý v3.3→v3.4; thêm fixture khóa giá | Engine phải tái tạo hành vi khóa |
| skills/schema-design | Thêm `PriceLockPolicy` vào mô hình lõi; luật ngoại tệ dùng replacement | Schema pha 2 phải chứa policy này |
| AGENTS.md, CLAUDE.md, PROJECT_SPEC §2 | Trỏ nguồn v3.4; phạm vi thêm khóa giá | Đồng bộ constitution |
| docs/GLOSSARY.md | +4 thuật ngữ: baselinePrice, priceLockThreshold, priceLockStatus, stalenessWarning | UI tiếng Việt nhất quán |
| docs/CONTEXT_PASTE.md | MỚI — bản nén 1 trang để paste vào phiên chat/design mới | Khởi động phiên không cần cả repo |

## v1.0 (2026-07) — khởi tạo
AGENTS.md, CLAUDE.md, 4 skills theo pha, PROJECT_SPEC, ADR-001..003,
GLOSSARY, SESSION_TEMPLATE, settings.json guardrails. Nguồn Excel: v3.3.
