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
| M12.4c | HTTPS Callable `computeTargetCosting` — T2 (`solveTargetProfit`, dạng đóng, làm được ngay) + T3 (`solve()`, CẦN sửa `TargetPriceRequestSchema` thêm trường chọn SKU trước — đóng băng Pha 2, cần ADR riêng) | ADR-010, `solver.ts` (M10) | `functions/src/index.ts` | [ ] ← **BẮT ĐẦU TỪ ĐÂY** |
| M12.5 | Màn hình Dashboard (React thật, nối Firestore qua emulator) | prototype tab `dashboard` | `src/features/dashboard/` | [ ] |
| M12.6 | Màn hình Bảng Giá (sales-safe — không có field giá vốn) | prototype tab `pricelist` | `src/features/price-list/` | [ ] |
| M12.7 | Màn hình Kế Hoạch SX (vai `production`, Plan_SX input/output) | prototype tab `plan`, `plan.ts` (M9) | `src/features/plan/` | [ ] |
| M12.8 | Màn hình Target Costing (T2/T3, vai `pricing`/`admin`) — dùng `solver.ts` với `ScenarioInput`/`ScenarioOutput` thật thay generic | ADR-005/006, `solver.ts` (M10) | `src/features/target-costing/` | [ ] |
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
→ **M12.4c: HTTPS Callable `computeTargetCosting`.** Đọc ADR-010 mục 3 (lý do
chọn `onCall` thay trigger) + `docs/contracts/scenario.md` §4
(`TargetPriceRequestSchema`/`TargetProfitRequestSchema`) + ADR-005/006 trước
khi viết. Phạm vi 2 nấc, làm T2 TRƯỚC:
1. **T2 (làm được ngay)**: callable nhận `TargetProfitRequestSchema`, đọc
   `scenarios/{id}`, gọi `solveTargetProfit()` (M10, dạng đóng, tái dùng
   cvp.ts) → trả kết quả (hoặc ghi `outputs/targetCosting` theo `scenario.md`
   §5 — đọc kỹ contract để chọn đúng, request rời rạc có thể chỉ cần trả về).
   Nhớ kiểm tra vai `pricing`/`admin` từ auth context (custom claims — xem
   tests/rules/ M12.3 cách đặt claim).
2. **T3 (BỊ CHẶN — cần ADR trước)**: `solve()` cần trường chọn SKU trong
   `TargetPriceRequestSchema` (đóng băng Pha 2). Ghi ADR mới (hoặc bổ sung
   ADR-010) quyết định cấu trúc field chọn SKU (Ống: `dn`+`materialId`;
   Phụ kiện: `productName`+`sizeLabel`+`materialId` — ADR-012 làm khóa cũ
   không còn duy nhất), cập nhật bảng ADR-009, RỒI mới code. KHÔNG tự thêm
   field ngầm. Nếu hết thời gian phiên: làm T2 xong commit được ngay, T3 để
   phiên sau.

## Nhật ký milestone đã xong

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
