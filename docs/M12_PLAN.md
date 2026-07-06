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
| M12.3 | Firebase Emulator Suite: `firebase.json` + `firestore.rules` (bảng phân quyền §6) + `firestore.indexes.json` + rules unit test | `docs/contracts/scenario.md` §5-6 | `firebase.json`, `firestore.rules`, `tests/rules/` | [ ] ← **BẮT ĐẦU TỪ ĐÂY** |
| M12.4 | Cloud Function `onScenarioWrite` — chạy `calculateScenario()` server-side, ghi tách 4 doc con theo vai | `scenario.md` §5 | `functions/src/index.ts` | [ ] |
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
   đó, phải vá lại ở Phiên 16), commit, push thẳng
   `claude/project-knowledge-setup-2au4hr` (KHÔNG tạo PR — quy trình đã chốt
   từ Phiên 13).

## Việc tiếp theo ngay khi phiên sau vào
→ **M12.3: Firebase Emulator Suite + Firestore Security Rules.** Đọc
`docs/contracts/scenario.md` §5-6 (bảng phân quyền 4 vai × 6 vùng dữ liệu +
lý do tách doc vật lý — "sales không đọc được cost") TRƯỚC khi viết rules.
1. Cài `firebase-tools` (CLI, để chạy emulator) + `firebase` (SDK client) +
   `@firebase/rules-unit-testing` (devDependency, để viết test rules chạy
   trên emulator qua vitest — KHÔNG cần project thật, emulator tự cấp
   `projectId` giả).
2. `firebase.json` — khai báo emulator: `firestore` (port mặc định 8080),
   `auth` (port 9099). CHƯA cần `hosting`/`functions` block cho tới M12.4.
3. `firestore.rules` — dịch ĐÚNG bảng phân quyền `scenario.md` §5-6 thành
   rules thật (KHÔNG phát minh quy tắc mới): mỗi collection/doc path trong
   bảng đó → 1 khối `match` riêng, role đọc lấy từ Auth custom claims (`role`
   ∈ {admin, pricing, sales, production}). Nhớ đúng nguyên tắc "tách DOC vật
   lý cho mỗi tầng đọc" — `scenarios/{id}` (đầy đủ) KHÁC
   `scenarios/{id}/outputs/priceList` (sales đọc được) KHÁC
   `scenarios/{id}/outputs/internal` (sales KHÔNG đọc được).
4. `firestore.indexes.json` — để trống/mặc định trừ khi rules-unit-test đòi
   composite index cụ thể.
5. Test bắt buộc: `tests/rules/*.test.ts` dùng
   `@firebase/rules-unit-testing` (`initializeTestEnvironment`) chạy NHẮM
   VÀO EMULATOR (cần emulator đang chạy — cân nhắc script `npm run
   test:rules` riêng gọi `firebase emulators:exec`, KHÔNG gộp vào `npm test`
   hiện tại vì `vitest run` (engine) không cần emulator, tránh làm chậm/hỏng
   suite engine nếu thiếu Firebase CLI ở môi trường CI). Test tối thiểu mỗi
   vai × mỗi vùng dữ liệu trong bảng phân quyền: 1 test ĐƯỢC phép, 1 test BỊ
   từ chối — đặc biệt `sales` đọc `outputs/internal`/`outputs/targetCosting`
   PHẢI bị từ chối (luật bất biến PROJECT_SPEC §5, AGENTS.md).
6. Cập nhật bảng trạng thái (M12.3 → `[x]`) + nhật ký bên dưới TRƯỚC khi
   dừng phiên, dù chỉ làm xong 1 phần (ghi rõ phần nào xong/dở dang).

## Nhật ký milestone đã xong

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
