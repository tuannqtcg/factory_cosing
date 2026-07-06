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
| M12.4 | Cloud Function `onScenarioWrite` — chạy `calculateScenario()` server-side, ghi tách 4 doc con theo vai | `scenario.md` §5 | `functions/src/index.ts` | [ ] ← **BẮT ĐẦU TỪ ĐÂY** |
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
→ **M12.4: Cloud Function `onScenarioWrite`.** Đọc `docs/contracts/scenario.md`
§5 (bảng doc split — cột "Ghi") trước khi viết. Ý chính: 1 Cloud Function
Firestore trigger (`onWrite` trên `scenarios/{id}`) chạy `calculateScenario()`
(đã có, `src/engine/scenario.ts`, M12.1) bằng Admin SDK (đọc được toàn bộ
`ScenarioInput` kể cả giá vốn), rồi ghi tách kết quả vào 4 doc con đúng ranh
giới đã khóa ở `firestore.rules` (M12.3): `outputs/internal` (toàn bộ
`ScenarioOutput`), `outputs/priceList` (chỉ `skuPriceChains[].chain` 4 field
cuối + `priceLadder`), `outputs/plan` (từ `planInputs/{period}` + `PlanResult`,
`src/engine/plan.ts` M9), `outputs/targetCosting` (từ T2/T3 request, `solver.ts`
M10). `firestore.rules` hiện đã chặn client ghi trực tiếp cả 4 doc `outputs/*`
(`allow write: if false`) — đúng ý đồ, vì Admin SDK bỏ qua rules nên Cloud
Function không bị chặn. Cần thêm `functions/` (Node runtime riêng, `package.json`
riêng theo yêu cầu Cloud Functions) + khai báo `functions` block trong
`firebase.json` (hiện chưa có, chỉ có `firestore`/`emulators`). Test: rules
unit test (`tests/rules/`) đã tự chứng minh client không ghi được `outputs/*`
trực tiếp — cần thêm test riêng cho function (dùng `firebase-functions-test`
hoặc gọi trực tiếp function đã export, chạy trên emulator `functions`+`firestore`).

## Nhật ký milestone đã xong

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
