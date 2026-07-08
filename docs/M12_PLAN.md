# M12_PLAN.md — Lộ trình M12 (UI thật + Firestore), chia milestone nhỏ

> M12 là milestone cuối của Pha 3 (`docs/PHASE3_PLAN.md`), nhưng bản thân nó
> quá lớn cho 1 phiên (frontend thật + Firebase Auth/Firestore/Security Rules
> + Cloud Functions + nhiều màn hình theo vai). Áp dụng ĐÚNG kỷ luật đã dùng
> cho M1-M11: chia nhỏ, mỗi milestone tự chứa (code + `npm test` xanh +
> commit), cập nhật bảng trạng thái trước khi dừng phiên.

## Quyết định hạ tầng (2026-07-06, user xác nhận)
- Firebase: **CHƯA có project thật** — dùng **Firebase Local Emulator Suite**
  để code/test toàn bộ Auth + Firestore + Security Rules + Cloud Functions.
  Khi user có project thật, chỉ cần dán `projectId`/config vào `.env` — KHÔNG
  sửa code.
- Stack đã chốt từ AGENTS.md, không đổi: React 18 + TS strict + Tailwind +
  Recharts; Firebase (Firestore + Auth + Rules).

## Bảng trạng thái

| # | Milestone | Nguồn | File chính | Trạng thái |
|---|---|---|---|---|
| M12.1 | Orchestrator `calculateScenario(ScenarioInput) → ScenarioOutput` nối toàn bộ M2-M9 | `docs/contracts/scenario.md` §1-2 | `src/engine/scenario.ts` | **[x] 2026-07-06** |
| M12.2 | Scaffold frontend thật (Vite + React 18 + TS strict + Tailwind + Recharts) | AGENTS.md stack | `src/features/`, `vite.config.ts`, `tailwind.config.ts` | **[x] 2026-07-06** |
| M12.3 | Firebase Emulator Suite: `firebase.json` + `firestore.rules` (bảng phân quyền §6) + `firestore.indexes.json` + rules unit test | `docs/contracts/scenario.md` §5-6 | `firebase.json`, `firestore.rules`, `tests/rules/` | **[x] 2026-07-06** |
| M12.4 | Cloud Function `onScenarioWrite` (Firestore trigger `scenarios/{id}`) — chạy `calculateScenario()` server-side, ghi `outputs/internal` + `outputs/priceList` | `scenario.md` §5, ADR-010 | `functions/src/index.ts` | **[x] 2026-07-06** |
| M12.4b | Cloud Function `onPlanInputWrite` (trigger `planInputs/{period}`) — ghi `outputs/plan` (T1) + engine `deriveMoldSetCountBySizeDN()`/`calculatePlanForScenario()` | ADR-010, `plan.ts` (M9) | `functions/src/index.ts`, `src/engine/plan-support.ts` | **[x] 2026-07-08** |
| M12.4c | HTTPS Callable `computeTargetCosting` — T2 + T3 (ADR-013: field chọn SKU, allowlist biến dò) + engine `target-costing.ts` | ADR-010, ADR-013, `solver.ts` (M10) | `functions/src/index.ts`, `src/engine/target-costing.ts` | **[x] 2026-07-08** |
| M12.5 | Màn hình Dashboard (React thật, nối Firestore qua emulator) + engine `dashboard-support.ts` (KPI có số vàng) + shell/auth/seed | prototype tab `dashboard` | `src/features/dashboard/`, `src/features/shell/`, `src/engine/dashboard-support.ts`, `src/lib/`, `scripts/seed-emulator.ts` | **[x] 2026-07-08** |
| M12.6 | Màn hình Bảng Giá (sales-safe — không có field giá vốn) + `unit`/`spec` vào doc priceList (ADR-009 #8) | prototype tab `pricelist` | `src/features/price-list/`, `PriceListDocSchema` | **[x] 2026-07-08** |
| M12.7 | Màn hình Kế Hoạch SX (vai `production`, Plan_SX input/output) + doc `outputs/productCatalog` (**ADR-014**) | prototype tab `plan`, `plan.ts` (M9), ADR-014 | `src/features/plan/`, `ProductCatalogDocSchema` | **[x] 2026-07-08** |
| M12.8 | Màn hình Target Costing (T2/T3, vai `pricing`/`admin`) — dùng `solver.ts` với `ScenarioInput`/`ScenarioOutput` thật thay generic | ADR-005/006, `solver.ts` (M10) | `src/features/target-costing/` | [ ] ← **BẮT ĐẦU TỪ ĐÂY** |
| M12.9 | Màn hình Tồn kho + Giả định + Cấu hình (vai `admin`/`pricing`, input form) | prototype tab `inventory/assumptions/config/ong/pk` | `src/features/config/` | [ ] |
| M12.10 | Security review (skill `security-review`) + chạy lại toàn bộ parity + chuẩn bị merge (Pha 4 gate) | AGENTS.md luật #2,#3 | — | [ ] |

## Cách phiên mới bắt đầu
1. Đọc bảng trên, tìm milestone đầu tiên chưa `[x]`.
2. Đọc đúng mục "Nguồn" tương ứng trước khi code.
3. Code xong: `npm test` + `npm run typecheck` xanh, cập nhật bảng NGAY (đừng
   để dồn sang phiên sau ghi lại — Phiên 15 đã quên tick M12.2 xong ngay lúc
   đó, phải vá lại ở Phiên 16), commit, push thẳng branch làm việc hiện tại
   của phiên đó (tên branch do hạ tầng phiên chỉ định lúc bắt đầu — KHÔNG cố
   định 1 tên qua nhiều phiên, xem branch Git hiện tại) (KHÔNG tạo PR — quy
   trình đã chốt từ Phiên 13).

## Việc tiếp theo ngay khi phiên sau vào
→ **M12.8: Màn hình Target Costing (vai `pricing`/`admin`).** Trước khi code:
1. Prototype đóng băng: KHÔNG có tab target-costing riêng — T2/T3 nằm ở panel
   "III. Phân tích ngược" của Dashboard (đã dựng M12.5 cho biến compound) +
   thiết kế ADR-005/006. Xem lại prototype + ADR trước: nếu cần MÀN RIÊNG
   (chọn SKU, chọn biến dò, T2 lợi nhuận mục tiêu) thì đó là bổ sung UI ngoài
   prototype đóng băng → cần quay lại Pha 1 hỏi user duyệt layout (1 mockup
   nhanh là đủ) TRƯỚC khi code, đúng quy trình.
2. Backend đã XONG HẾT: callable `computeTargetCosting` (M12.4c, ADR-013) —
   T2 (`TargetProfitRequest`: productLine + targetProfitVnd + materialId?) và
   T3 (`TargetPriceRequest`: productKey chọn SKU + targetListPriceVnd +
   freeVarPath trong allowlist). UI chỉ gọi httpsCallable + hiển thị
   kind/result (+ forward-verify đầy đủ của T3 — luật #4 inverse-solver).
3. Biến nguyên `shifts` nếu màn hình cần → bổ sung ADR-013 + allowlist +
   solveDiscrete (đã ghi chỗ chờ trong ADR-013).
4. Verify chạy thật như M12.5-M12.7 (emulator + seed + screenshot).

Sau M12.8: M12.9 (Tồn kho + Giả định + Cấu hình — form input cho
admin/pricing, ghi scenarios/{id}, trigger tự tính lại), M12.10 (security
review Pha 4 + chạy lại toàn bộ parity + chuẩn bị merge).

## Nhật ký milestone đã xong

- **M12.7 (2026-07-08, cùng phiên M12.4b→M12.6)**: Màn hình Kế Hoạch SX (vai
  production) + **ADR-014** (user chốt "phương án a" sau khi được trình 2
  lựa chọn): doc mới `outputs/productCatalog` (`ProductCatalogDocSchema`) —
  danh mục SP + tham số VẬN HÀNH tối thiểu (đơn trọng/chu kỳ/cavity/công
  suất — dữ liệu KỸ THUẬT, TUYỆT ĐỐI không field giá; test tích hợp kiểm cả
  chuỗi JSON không chứa price/cost/markup/usdVnd/inventory/lot) do
  `onScenarioWrite` ghi + dọn cùng vòng đời; rules cho production/admin/
  pricing đọc, sales ✗, client không ghi (4 case rules mới → 37/37);
  contract §5/§6 thêm dòng. UI `src/features/plan/` (PlanScreen + usePlanData
  — production chỉ đọc productCatalog + outputs/plan, đọc/ghi
  planInputs/{period}, KHÔNG chạm scenarios/{id}): bảng Ống nhập MÉT theo DN
  (kg/m, kg TP, giờ máy, ngày SX) + bảng Phụ kiện nhóm theo loại nhập SỐ CÁI
  (83 SKU active — pending_mold ẩn) + hàng nhập kỳ/nhân công/dự phòng (3
  field PlanInput ADR-009 #3 mà prototype mock không có) + nút "Lưu & tính".
  Ranh giới engine GIỮ NGHIÊM: cột dẫn xuất từng dòng là số học thuần từ
  catalog; "Ca máy cần"/NVL đ/nhân công/cảnh báo khuôn CHỈ hiển thị từ
  `outputs/plan` do onPlanInputWrite tính (khác prototype mock tự tính —
  đúng nguyên tắc client không lắp công thức engine). Form tự nạp lại
  planInputs đã lưu. Verify: rules 37/37, functions 9/9 (thêm assertion
  productCatalog + dọn khi xóa), `npm test` 328/328, typecheck, build; chạy
  thật vai production (DN50 50.000m + Tê đều 20 20.000 cái = kịch bản A
  plan.test.ts): preview 63.000 kg/500 giờ/62,5 ngày; server trả 2 ca Ống +
  1 ca PK + tuyển 0 người; NVL bm-orange-pipe 73.500 kg / 6.314.800.275 đ /
  222.705 $ + bm-fitting 1.283 kg / 140.097.329 đ — khớp tuyệt đối số tính
  tay unit test M12.4b.
- **M12.6 (2026-07-08, cùng phiên M12.4b/c/M12.5)**: Màn hình Bảng Giá
  (sales-safe). Phát hiện khi khảo sát: doc `outputs/priceList` THIẾU
  ĐVT/Quy cách mà bảng giá prototype (UI đóng băng) cần, và vai sales không
  đọc được `scenarios/{id}` để tự tra → bổ sung `unit`/`spec` hiển thị vào
  từng dòng skuPriceChains + định nghĩa **`PriceListDocSchema`** (doc vốn
  dựng ad-hoc từ M12.4, nay có schema validate CẢ 2 đầu — function ghi +
  client đọc, luật #2): bảng ADR-009 dòng #8 + cập nhật contract scenario.md
  §5. `toPriceListDoc(output, products)` zip theo index (calculateScenario
  giữ nguyên thứ tự products) + ĐỐI CHIẾU khóa từng dòng trước khi ghi
  (throw nếu lệch — không bao giờ ghi sai hàng). UI
  `src/features/price-list/PriceList.tsx` đúng prototype (search tên/kích cỡ
  + toggle Trước VAT/Có VAT [thuế suất suy từ chính dữ liệu — sales không đọc
  được costPool] + 10 nút lọc loại + bảng 6 cột), nguồn DUY NHẤT
  outputs/priceList cho MỌI vai; `useScenarioData` mở rộng đọc trọn doc
  priceList (sales không còn lấy riêng priceLadder). 2 chỗ CỐ Ý khác
  prototype (prototype mock sai so nguồn chân lý, ghi lại để khỏi tưởng
  thiếu): 8 SKU chưa khuôn ẩn bằng `managementStatus` (ADR-007) thay
  hard-code EXCLUDED_SKUS; KHÔNG có dòng #100 "Dung môi 550" (PriceList Excel
  99 dòng — solvent550PricePerBox là vật tư phụ trong CostPool, không phải
  SKU thương mại). Verify: `npm run test:functions` 9/9 (test on-scenario-write
  thêm assertion unit/spec), `npm test` 328/328, typecheck root+functions,
  build OK; chạy thật emulator + seed + screenshot vai sales: **91 SKU**
  (= 99 − 8 pending_mold), lọc "Tê giảm" đúng 18 dòng (19 − 1 chưa khuôn),
  giá khớp fixture v3.7 (DN20 71.600, Tê đều 20 26.900).
- **M12.5 (2026-07-08, cùng phiên M12.4b/c)**: Màn hình Dashboard THẬT — UI
  đầu tiên nối Firestore. 4 phần:
  (a) **Engine `src/engine/dashboard-support.ts`** — `calculateDashboardKpis()`
  cho 2 khối số vàng dashboard.json TRƯỚC GIỜ chưa có hàm engine:
  `capacityLevels` (3 mức công suất Ống — chạy lại mô hình chi phí tại
  normalShifts=1/2/3 NHƯNG phân bổ chi phí chung GIỮ mức tại CS bình thường;
  công thức GIẢI MÃ từ số vàng bằng Python độc lập khớp tuyệt đối TRƯỚC khi
  code) + `investment` (tổng vốn = thiết bị + khuôn + vốn đầu tư Lab/UL;
  EBIT = Σkg×(tier5−tier3) − chi phí ngoài SX; DT hòa vốn toàn DN = (định phí
  CVP 2 dòng + ngoài SX) ÷ tỷ lệ số dư đảm phí tại giá VF; payback = vốn ÷
  (EBIT + tổng khấu hao, khuôn theo asOfYear ADR-007)). 9 test parity
  `tests/parity/dashboard-kpis.test.ts` (+1 test Corzan không đổi KPI tham
  chiếu). KHÔNG thêm field vào ScenarioOutput (schema đóng băng) — đây là view
  dẫn xuất, vai admin/pricing gọi engine client-side (đọc được trọn
  ScenarioInput nên không xuyên ranh giới dữ liệu nào).
  (b) **Hạ tầng client**: `src/lib/firebase.ts` (mặc định emulator
  `demo-costing-app`, có VITE_FIREBASE_API_KEY là tự chuyển project thật —
  đúng quyết định hạ tầng M12), `scripts/seed-emulator.ts` chạy bằng
  `vite-node` (`npm run seed:emulator` — 4 user demo
  {role}@demo.local/demo-password + custom claim `role` + scenario baseline
  từ fixture, Cloud Function tự tính outputs), script `npm run emulators`.
  (c) **UI**: `src/features/shell/AppShell.tsx` (sidebar đúng prototype —
  brand, "Xem Như Vai" = ĐĂNG NHẬP user demo theo vai trên Auth Emulator
  [prototype chỉ đổi state; bản thật phải auth để rules chạy — cơ chế
  dev-only, project thật sẽ có login thật ở security-review Pha 4], nav
  USER/ADMIN theo ROLE_TAB_ACCESS ADR-006, tab chưa dựng → placeholder trỏ
  milestone) + `src/features/dashboard/` (Dashboard.tsx, useScenarioData.ts,
  useAuth.ts): lock bar ADR-004 theo material đang chọn + nút "Chốt Baseline
  Mới" (updateDoc baseline=replacement cho material MỞ KHÓA), thang giá 5 bậc
  byLineMaterial + MaterialPicker khi >1 material/line (ADR-012), 3 mức công
  suất, top-down panel (margin/SL hòa vốn = forward từ cvp+ladder; "Compound
  tối đa" = `solve()` bisection trên `calculateScenario` client-side — KHÔNG
  công thức ngược tay, luật inverse-solver #1; prototype mock dùng closed-form
  là đúng lỗi cần tránh), 6 KPI card mục IV. Nguồn dữ liệu tách theo VAI đúng
  scenario.md §5: admin/pricing đọc scenario+outputs/internal (onSnapshot,
  validate Zod cả client — luật #2); sales CHỈ đọc outputs/priceList (không
  chạm doc bị rules chặn); production không có tab dashboard.
  (d) **Verify chạy thật**: emulator + seed + `npm run dev` + Playwright
  screenshot cả 2 vai — pricing thấy đủ I-IV với số vàng v3.7 khớp màn hình
  (thang giá 100.663→132.899 / 3 mức 113.195/108.038/106.319 / KPI 15,97 tỷ
  · 16,37 tỷ · 33,78 tỷ · 0,82 năm; top-down 120.000đ → margin 11,4%,
  compound tối đa 3,46 USD/kg từ solver, banner "Lãi thấp"); sales chỉ thấy
  thang giá + ghi chú ADR-006 (đọc từ outputs/priceList thật qua rules).
  `npm test` 328/328 (+9 parity mới), typecheck + build OK. Lưu ý kỹ thuật:
  `src/vite-env.d.ts` (types vite/client cho import.meta.env);
  playwright-core cài `--no-save` khi cần chụp (không vào package.json).
- **M12.4c (2026-07-08, cùng phiên M12.4b)**: HTTPS Callable
  `computeTargetCosting` + engine `src/engine/target-costing.ts` + **ADR-013**
  (đóng khoảng trống #2 của ADR-010 và 3 khoảng trống lộ thêm khi bắt tay
  code): (1) `TargetPriceRequestSchema` thêm `productKey`
  {dn?/productName?/sizeLabel?/materialId?} chọn SKU — cùng ngữ nghĩa
  materialId-bỏ-trống với PlanInput ADR-012; (2) `TargetProfitRequestSchema`
  thêm `materialId` optional (CVP theo (line, material) sau ADR-012) — 2 dòng
  #6/#7 bảng ADR-009 + comment trong contract scenario.md §4; (3)
  `bounds`/`tol` KHÔNG do client cấp — allowlist `TARGET_PRICE_FREE_VARS`
  server-side (5 biến LIÊN TỤC v1 đúng skill inverse-solver mục 5; biến
  nguyên `shifts` HOÃN sang M12.8, chỉ cần thêm entry + solveDiscrete, không
  cần ADR mới); goal-seek giá compound đi qua path
  `materials.{i}.inventory.replacementPriceUsdPerKg` → QUA khóa giá ADR-004
  khi forward (f bậc thang đơn điệu — bisection vẫn đúng, nghiệm trong dải
  khóa không duy nhất, forwardOutput là chân lý); (4) doc
  `outputs/targetCosting` = GHI ĐÈ 1 doc {kind, request, result} (request gần
  nhất, đối xứng outputs/plan) + callable TRẢ kết quả trực tiếp; phân biệt
  T2/T3 bằng field đặc thù request, không phát minh envelope. Engine:
  `computeTargetProfitForScenario` (T2 — solveTargetProfit trên CVP từ
  calculateScenario) + `computeTargetPriceForScenario` (T3 — solve() bisection
  với forwardFn = `calculateScenario` NGUYÊN CON, lần đầu solver chạy trên
  forward function đầy đủ của app; target = `chain.listPriceBeforeVat`, tol
  0,5đ < bước làm tròn 100đ); helper `referenceMaterialOf` export từ
  scenario.ts dùng chung plan-support/target-costing. Callable: check
  `request.auth.token.role` ∈ {pricing, admin} → unauthenticated/
  permission-denied/invalid-argument/not-found chuẩn HttpsError. Test: 10 unit
  (`tests/unit/target-costing.test.ts` — T2 khớp breakEvenKgYear vàng v3.7 cả
  2 line, case Corzan materialId, case chuẩn T3 DN50 260.000đ/m forward-verify
  đúng 260.000 + round-trip, infeasible 10.000đ, allowlist chặn, productKey
  sai) + 4 tích hợp emulator (`tests/functions/compute-target-costing.test.ts`
  — Auth Emulator THẬT: user + custom claim + đổi custom token lấy idToken,
  gọi qua giao thức HTTP onCall; T2 pricing, T3 admin + ghi đè doc, sales bị
  403 PERMISSION_DENIED + anonymous 401, freeVarPath lạ 400 INVALID_ARGUMENT).
  Verify: `npm test` 319/319, `test:functions` 9/9, `test:rules` 33/33,
  typecheck root+functions, build OK.
- **M12.4b (2026-07-08)**: Cloud Function `onPlanInputWrite` + engine
  `src/engine/plan-support.ts`. 2 hàm engine mới (KHÔNG sửa schema nào → theo
  ADR-010 không cần dòng ADR-009): `deriveMoldSetCountBySizeDN(moldAssets,
  products)` — 1 `MoldAsset` = 1 bộ khuôn, cộng 1 vào TỪNG size DN distinct
  mà khuôn ép ra (join `producesSkus` → `moldSizeDN` qua
  productName+sizeLabel; SKU không có trong danh mục thì bỏ qua); và
  `calculatePlanForScenario(ScenarioInput, PlanInput)` — orchestration
  Plan_SX đặt Ở ENGINE (pure) thay vì viết thẳng trong Cloud Function, hơi
  rộng hơn mô tả gốc ("gọi lại trong index.ts") nhưng đúng tinh thần
  PROJECT_SPEC §3 (engine dùng chung mọi nơi): test được bằng `npm test`
  thường không cần emulator, và M12.7 (màn Kế Hoạch SX) tái dùng được nguyên.
  Wiring: material tham chiếu dòng Ống + khóa giá từng material giống hệt
  `calculateScenario()` (tái dùng `lastLotPriceOf` — export thêm từ
  scenario.ts); `compoundLandedPerKgVnd` = `landedCostPerKgVnd(giá ĐÃ KHÓA)`
  (trùng công thức `cost.compoundLandedPerKg`, verify bằng test);
  `calculateFittingCostAtNormalCapacity` hóa ra KHÔNG cần cho plan (mô tả cũ
  liệt kê thừa — `CalculateFittingPlanInputs` không nhận cost). Số kỳ vọng
  đếm tay độc lập từ mold-assets.json (66 khuôn):
  {20:4, 25:9, 32:8, 40:10, 50:11, 65:9, 80:7, 100:8}. `onPlanInputWrite`
  (trigger `scenarios/{id}/planInputs/{period}`): đọc scenario, parse 2 đầu
  Zod, ghi ĐÈ `outputs/plan` (1 doc duy nhất); planInput bị XÓA → dọn
  `outputs/plan` (không lưu period nguồn nên không phân biệt được — dọn cho
  khỏi stale); scenario không tồn tại → log + bỏ qua (v2 không retry).
  `onScenarioWrite` xóa scenario giờ dọn thêm `outputs/plan` (trước chỉ dọn
  2 doc nó tự ghi). `vitest.functions.config.ts` thêm
  `fileParallelism: false` — 2 file test functions cùng `recursiveDelete`
  collection `scenarios` ở afterAll, chạy song song sẽ xóa dữ liệu của nhau.
  Test: 12 unit (`tests/unit/plan-support.test.ts` — fixture thật + quy tắc
  đếm tổng hợp + đối chiếu số tính tay plan.test.ts kịch bản A + 2 case
  multi-material Corzan ADR-012) + 3 tích hợp emulator
  (`tests/functions/on-plan-input-write.test.ts` — tính đúng, ghi đè, dọn khi
  xóa). Verify: `npm test` 309/309, `npm run test:functions` 5/5,
  `npm run test:rules` 33/33, typecheck root+functions, `npm run build` OK.
- **M12.4 (2026-07-06)**: Cloud Function `onScenarioWrite`. Phát hiện khi bắt
  tay code (đã tưởng làm cả 4 doc `outputs/*` trong 1 hàm theo mô tả gốc của
  bảng): 2 khoảng trống thiết kế chặn `outputs/plan`/`outputs/targetCosting`
  (Plan_SX chưa được `calculateScenario()` orchestrate — thiếu hàm dẫn xuất
  `moldSetCountBySizeDN`; `TargetPriceRequestSchema` (T3) thiếu trường chọn
  SKU) — ghi **ADR-010** quyết định tách M12.4 thành 3 Cloud Function riêng
  (M12.4 lõi xong ngay, M12.4b/M12.4c hoãn có lý do rõ, không lặng lẽ bỏ sót).
  Scaffold `functions/` (Cloud Functions TS project riêng `package.json`):
  `firebase-functions@7` + `firebase-admin@13` (ghim `^13` vì `firebase-functions@7`
  peer-dep chỉ chấp nhận admin `^11|^12|^13`, KHÔNG phải `^14` mới nhất),
  `functions/tsconfig.json` dùng CHUNG kiểu module với root
  (`module: ESNext`, `moduleResolution: Bundler`) để tái dùng thẳng
  `src/engine`/`src/schemas` qua import tương đối `../../src/...` — `include`
  gồm cả `functions/src/**` lẫn `../src/{engine,schemas}/**`, tsc tự suy
  `rootDir` = gốc repo → output lồng `functions/lib/functions/src/index.js` +
  `functions/lib/src/engine/*.js` cùng cấp tương đối, import path GIỮ NGUYÊN
  lúc biên dịch nên tự khớp đúng (verify bằng chạy `node --experimental` import
  thử file compiled trước khi tin, không chỉ tin `tsc` không báo lỗi).
  `firebase.json` thêm block `functions` (source `functions/`, predeploy chạy
  `npm run build`) + emulator `functions` port 5001. Thêm `.firebaserc`
  (`demo-costing-app`) — BẮT BUỘC để Firestore Emulator + Functions Emulator
  cùng chạy chung 1 project ID khi dùng `firebase emulators:exec` (khác
  `tests/rules/` — ở đó `@firebase/rules-unit-testing` nói chuyện trực tiếp
  với Firestore Emulator nên project ID nào cũng được, không cần khớp CLI).
  `functions/src/index.ts`: `onScenarioWrite` (`onDocumentWritten`
  `scenarios/{scenarioId}`) — parse `ScenarioInputSchema`, gọi
  `calculateScenario()` (M12.1, TÁI DÙNG NGUYÊN), parse `ScenarioOutputSchema`,
  ghi `outputs/internal` (đầy đủ) + `outputs/priceList` (lược còn
  `productKey`/`managementStatus`/4 field giá cuối + `priceLadder` — đúng
  ranh giới sales-safe `scenario.md` §5); doc bị xóa → dọn 2 `outputs/*`.
  Tách `tests/helpers/scenario-fixture.ts` (dựng `ScenarioInput` thật từ
  fixture v3.4) ra khỏi `tests/parity/scenario.test.ts` (refactor thuần, không
  đổi hành vi — verify lại `npm test` vẫn 286/286 sau khi tách) để dùng lại ở
  `tests/functions/on-scenario-write.test.ts` (2 test, ghi thật lên Firestore
  Emulator bằng `firebase-admin`, đợi Cloud Function tự chạy trên Functions
  Emulator, xác nhận `outputs/internal` CÓ field giá vốn còn `outputs/priceList`
  KHÔNG CÓ — đúng bằng chứng ranh giới, không chỉ tin code đọc đúng; test xóa
  doc → 2 `outputs/*` bị dọn). Script `npm run test:functions`
  (build `functions/` trước, rồi `firebase emulators:exec --only
  firestore,functions,auth`), `vitest.functions.config.ts` riêng (như pattern
  `vitest.rules.config.ts` M12.3), loại `tests/functions/**` khỏi `npm test`
  thường (`vitest.config.ts`).
  **Verify THẬT**: `npm run test:functions` — 2/2 pass trên Firestore+Functions
  Emulator sống (không mock). `npm test` vẫn 286/286 (kể cả sau refactor
  fixture helper). `npm run typecheck` (root) sạch — phải sửa 1 lỗi
  `noUncheckedIndexedAccess` (`skuPriceChains[0]` có thể `undefined`) ở chính
  test mới. `cd functions && npm run typecheck` sạch riêng cho Cloud Functions
  project. `npm run test:rules` (M12.3) chạy lại vẫn 33/33 — xác nhận thêm
  `.firebaserc` không phá vỡ test cũ.

- **M12.3 (2026-07-06)**: Firebase Local Emulator Suite + Firestore Security
  Rules. Cài `firebase-tools@15`, `firebase@12` (SDK client),
  `@firebase/rules-unit-testing@5` (devDependency — Java 21 đã có sẵn trong
  môi trường, cần cho Firestore Emulator chạy thật, không mock). `firebase.json`
  khai báo emulator `firestore` (port 8080) + `auth` (port 9099) + `ui` — CHƯA
  có `hosting`/`functions` block (để dành M12.4). `firestore.indexes.json`
  rỗng (`indexes: []`) — chưa có composite query nào đòi index.
  `firestore.rules` dịch bảng `scenario.md` §5 (doc split theo collection
  path) + §6 (4 vai × 6 vùng dữ liệu) thành rules thật: role đọc từ Auth custom
  claim `request.auth.token.role`; mỗi doc path 1 khối `match` riêng
  (`scenarios/{id}`, `outputs/internal`, `outputs/priceList`, `outputs/plan`,
  `planInputs/{period}`, `outputs/targetCosting`, `moldAssets/{moldId}`); mọi
  `outputs/*` chặn client ghi (`allow write: if false` — Cloud Function dùng
  Admin SDK bỏ qua rules, đúng thiết kế §5); mặc định từ chối path không khai
  báo (`match /{document=**} { allow read, write: if false; }`).
  Field-lock cho `scenarios/{id}.update` khi vai `pricing` ghi (đúng câu
  scenario.md §5 dòng 1: "field KHÔNG nằm trong danh sách khóa
  (resource.md/cost-pool.md đã liệt kê)") — hàm
  `scenarioLockedFieldsUnchanged()` so `request.resource.data` với
  `resource.data` cho đúng 8 field khóa từ `resource.md`
  (`resources.pipe.{actualCapacityKgPerHour,extruderPriceEach,extruderCount,
  moldPullerCutterCost,yieldRate}`, `resources.fitting.{yieldRate,machineTypes,
  moldAssets}`) + 3 field khóa từ `cost-pool.md`
  (`costPool.{sharedFixedCosts,nonProductionCosts,solvent550PricePerBox}` —
  `markup`/`currency` mở cho pricing) + 2 field từ `pricing-chain.md`
  (`inventory.{pipe,fitting}.priceLock.thresholdPct`, không phải mảng nên khóa
  được trực tiếp).
  **Còn treo (phạm vi hẹp có chủ đích, không phải thiếu sót quên)**:
  `product.md` ("Product chỉ admin ghi" — toàn bộ `products[]`) và
  `pricing-chain.md` (`thresholdPct` admin-only TỪNG dòng trong
  `inventory.metalInsert[]`, theo `(renType, ptSize)`) CHƯA đưa vào field-lock
  vì `scenario.md` §5 dòng 1 chỉ trỏ rõ "resource.md/cost-pool.md" cho hàng
  này (không trỏ product.md/pricing-chain.md), và rules không có vòng lặp để
  khóa field trong TỪNG phần tử mảng — khóa cả mảng `products`/`metalInsert`
  sẽ chặn luôn phần pricing được phép sửa (vd `metalInsert[].lots`), không
  đúng ý đồ. Cần ADR/cập nhật `scenario.md` §5 nếu muốn khóa thêm — không tự
  quyết ở milestone này (AGENTS.md luật #5).
  Test: `tests/rules/firestore.rules.test.ts` (33 test) dùng
  `@firebase/rules-unit-testing` (`initializeTestEnvironment` +
  `assertSucceeds`/`assertFails`), chạy THẬT trên Firestore Emulator qua
  script mới `npm run test:rules` (`firebase emulators:exec --only
  firestore,auth "vitest run --config vitest.rules.config.ts"`). Bao phủ mỗi
  vai (admin/pricing/sales/production) × mỗi vùng dữ liệu ở bảng §6: đọc
  được/không đọc được, ghi field khóa bị từ chối/field không khóa được phép,
  tạo/xóa scenario chỉ admin, `outputs/internal` không ai ghi trực tiếp được
  kể cả admin, `sales` đọc `outputs/internal`/`outputs/plan` bị từ chối,
  `production` đọc `outputs/internal`/`outputs/targetCosting`/`scenarios/{id}`
  bị từ chối (đúng yêu cầu bắt buộc của milestone), path lạ mặc định từ chối.
  Thêm `vitest.config.ts` (loại `tests/rules/**` khỏi `npm test` thường —
  trước đây không có file này, `npm test` dùng default config của
  `vite.config.ts` không `test` field) + `vitest.rules.config.ts` (include
  riêng `tests/rules/**`, timeout 20s vì gọi mạng tới emulator). Verify THẬT:
  chạy `npm run test:rules` — emulator tự tải `cloud-firestore-emulator-v1.21.0.jar`
  lần đầu, 33/33 test pass trên emulator sống (không phải mock). `npm test`
  vẫn 286/286 (engine không đụng, `tests/rules` bị loại đúng ý). `npm run
  typecheck` sạch. `.gitignore` thêm `firebase-debug.log`,
  `firestore-debug.log`, `ui-debug.log`, `.firebase/` (artifact chạy emulator,
  không commit).

- **M12.2 (2026-07-06)**: Scaffold frontend thật — cài `react@18`/`react-dom@18`
  (ghim đúng bản 18 theo AGENTS.md, npm mặc định kéo về 19), `vite@5` +
  `@vitejs/plugin-react@4` (ghim bản tương thích `vite@5` vì `vitest@2` đang
  dùng — bản mới nhất của plugin-react đòi `vite@8`, xung đột peer dep),
  `tailwindcss@3`, `recharts@3`. Thêm `vite.config.ts` (KHÔNG có `test` field
  — `npm test` chạy độc lập, không phụ thuộc), `tailwind.config.ts`,
  `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx` (placeholder
  TRUNG THỰC hiển thị đúng bảng trạng thái M12.1-M12.10, KHÔNG giả lập dữ
  liệu — phân biệt rõ với `prototype/*.dc.html` là mockup Pha 1 dữ liệu giả),
  `src/index.css` (Tailwind directives). Sửa `tsconfig.json`: thêm
  `lib: [..., "DOM", "DOM.Iterable"]` + `jsx: "react-jsx"` — DÙNG CHUNG 1
  tsconfig cho engine Node-only lẫn frontend (không tách file, vì engine
  không đụng DOM nên an toàn). Thêm script `dev`/`build`/`preview` vào
  `package.json` (trước đây `dev` là placeholder cố ý báo lỗi).
  **Verify THẬT** (đúng skill `run`/`verify`, không chỉ tin build xanh):
  `npm run build` thành công (Tailwind sinh CSS thật ~7KB, không rỗng) +
  khởi động `npm run dev`, dùng Playwright chụp màn hình `127.0.0.1:5183` —
  xác nhận React render đúng, Tailwind áp dụng đúng style — rồi tắt dev
  server. `npm test` không đổi (286/286, engine không phụ thuộc frontend).
- **M12.1 (2026-07-06)**: `src/engine/scenario.ts` — `calculateScenario()`
  nối pipe/fitting/cvp/price-ladder/price-lock/dual-costing/metal-insert theo
  đúng thứ tự phụ thuộc chéo 2 dòng SP (Ống cần otherLine=Phụ kiện và ngược
  lại — capacity trước, cost/CVP/price-ladder sau). Bổ sung field thiếu ở
  schema đã đóng băng: `CompoundInventorySchema.replacementPriceUsdPerKg`,
  `MetalInsertCatalogEntrySchema.replacementPriceVnd` (ghi ADR-009 dòng #5) —
  `evaluatePriceLock()` cần "replacement" (giá thị trường hiện hành) làm
  input nhưng schema gốc chỉ có `lots` (lịch sử mua) + `priceLock.baseline`
  (chính sách), thiếu đúng chỗ nhập giá hiện hành.
  `bookCostPerKg` (ADR-002, sổ sách) tái dùng `landedCostPerKgVnd()` với
  `weightedAvgUsdPerKg` thay `pricingPrice` — CHƯA có số vàng Excel cho
  trường hợp lệch giá thật, verify bằng tự-đối-chiếu (weightedAvg=pricingPrice
  ở kịch bản mặc định → bookCostPerKg phải khớp tuyệt đối fullCostPerKg).
  **Phát hiện + sửa 2 lỗi có thật khi lần đầu chạy `ScenarioOutputSchema.parse()`
  trên toàn bộ 99 dòng SKU** (chưa ai gọi parse() ở quy mô này trước M12):
  (1) `listPriceWithVat` là float do sai số nhân dấu phẩy động, vi phạm
  `z.number().int()` — sửa `price-ladder.ts` làm tròn `Math.round()` (đ VND
  không có đơn vị lẻ, đúng ý nghĩa nghiệp vụ, khớp tuyệt đối fixture);
  (2) `tests/fixtures/mold-assets.json` dùng KÝ TỰ SAI cho "Cút 90°"/"Cút 45°"
  (dấu độ `°` U+00B0) thay vì đúng ký tự `fitting.json` dùng ("Cút 90º"/"Cút
  45º", dấu chỉ số thứ tự nam tính `º` U+00BA) — khiến `managementStatusOf()`
  (viết từ M1, CHƯA từng được gọi thật tới M12) nhận nhầm 11 SKU "Cút 90/45"
  thành `pending_mold`. Sửa 22 chỗ trong `mold-assets.json` (label +
  producesSkus.productName, 11 khuôn) về đúng ký tự nguồn `fitting.json`.
  Test: `tests/parity/scenario.test.ts` (8 test) — đối chiếu output với
  `dashboard.json`/`pipe.json`/`fitting.json`/`price-list.json` qua ĐÚNG 1
  cửa ngõ `calculateScenario()`, xác nhận toàn bộ 91+8 SKU phân loại
  active/pending_mold đúng, `ScenarioOutputSchema.parse()` không lỗi.
  `npm test` 286/286 xanh (từ 278 + 8 test mới), typecheck sạch.
