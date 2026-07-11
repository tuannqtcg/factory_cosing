# CONTEXT PASTE — Costing App (dán vào đầu phiên Claude Design / chat mới)

## TRẠNG THÁI HIỆN TẠI (cập nhật mỗi khi đổi pha hoặc chốt ADR — xem chi tiết ở
## docs/sessions/SESSION_<ngày mới nhất>.md, đây chỉ là bản tóm tắt để orient nhanh)
- **PHA 4 ĐANG CHẠY (2026-07-11) — chuẩn bị thêm Firebase Hosting song song
  Render** (xem `docs/sessions/SESSION_2026-07-11.md`). Thêm block `hosting`
  vào `firebase.json` (site riêng `bmcosting-app`, không dùng site mặc định
  vì project `bmcosting-ver-2` dùng chung nhiều app khác), verify
  `npm run build` ra đúng `dist/index.html`. **CHƯA deploy thật** (cần user
  tự `firebase hosting:sites:create` + `firebase deploy --only hosting` +
  tự thêm domain vào Auth Authorized Domains — xem file session để có lệnh
  đầy đủ). Chưa chốt Render hay Firebase Hosting (hay cả 2) là kênh chính
  thức — cần hỏi user ở phiên có deploy thật.
- (Lịch sử 2026-07-10) **PHA 4 — có Firebase project THẬT + đã deploy.**
  User tạo project thật `bmcosting-ver-2` (dùng CHUNG với nhiều app khác:
  `financial-suite`, `landingpage`, `sso-tcg`, `ai-studio-*`...) với Firestore
  Database ID **`manufacture`** (không phải `(default)`) — sinh ra
  **ADR-016** (tham số hóa tên database qua `firebase-functions/params`,
  CẢ trigger `onDocumentWritten` LẪN `getFirestore()` đều phải dùng chung 1
  tham số, không thì trigger lắng nghe nhầm database trống và không bao giờ
  chạy — lỗi âm thầm). Cũng chốt **ADR-017**: cơ chế cấp/thu hồi custom claim
  `role` cho user Auth thật — Cloud Function `setUserRole` (onCall,
  admin-only) + audit log `roleAudit/{entryId}` (append-only) +
  `scripts/bootstrap-admin.ts` (cấp admin đầu tiên, phá vòng con-gà-quả-trứng).
  **Đã deploy + verify THẬT trên project thật** (qua Google Cloud Shell —
  service account key mặc định KHÔNG đủ quyền deploy rules/functions, chỉ
  đủ quyền Admin SDK runtime, xem `docs/sessions/SESSION_2026-07-10.md` phần
  2 cho toàn bộ chi tiết): `firestore.rules` publish thủ công qua Console,
  4 Cloud Function deploy qua `firebase deploy --only functions` (giữ nguyên
  function `api` của app khác trong project dùng chung — chọn "No" khi CLI
  hỏi xóa), `npm run bootstrap-admin` cấp `role=admin` thật cho
  `tuannq6886@gmail.com`, `npm run seed:production` ghi baseline v3.4 vào
  `scenarios/baseline-v3.4` — Cloud Function tự tính đủ 3
  `outputs/{internal,priceList,productCatalog}` với dữ liệu không rỗng, xác
  nhận trên Console THẬT (không phải Emulator).
  `render.yaml` (cấu hình Pha 1 cũ trỏ mockup `prototype/*.dc.html`) đã cập
  nhật để deploy app THẬT (`npm run build` → `dist/`) — CHƯA verify deploy
  Render thật trong phiên này (cần user tự làm trên Render Dashboard, 4 biến
  `VITE_FIREBASE_*` phải điền tay, KHÔNG sync tự động từ file).
  **Còn treo**: gọi thử `setUserRole` (không phải `bootstrap-admin.ts`) trên
  project thật để xác nhận `roleAudit` ghi đúng; thu hồi service account key
  đã upload trong chat (không đủ quyền gây hại nhưng nên thu hồi); deploy
  thật lên Render + thêm domain Render vào Firebase Auth "Authorized domains"
  (bắt buộc, nếu không đăng nhập sẽ lỗi "unauthorized domain").
  **Đã MERGE vào nhánh mặc định 2026-07-10** (merge commit `fcf25b5`, kit
  v1.31, verify đủ 5 cổng SAU merge trên `claude/project-knowledge-setup-2au4hr`).
- (Lịch sử Pha 3) **PHA 3 (M1-M12.10) HOÀN TẤT 2026-07-10 — xem `docs/sessions/SESSION_2026-07-10.md`
  và mục "Nhật ký milestone đã xong" trong `docs/M12_PLAN.md` cho chi tiết đầy
  đủ M12.8/M12.9a-d/M12.10 (KHÔNG lặp lại ở đây, đoạn dưới giữ nguyên làm lịch
  sử tới M12.7).** Toàn bộ 9 tab của prototype đã dựng thật (không còn
  placeholder trong `AppShell.tsx`); **ADR-015** (khóa `thresholdPct` trong
  `materials[]`/`inventory.metalInsert[]` bằng unroll theo index cố định,
  M12.9d); M12.10 (security-review) vá 2 lỗ hổng rules thật (M12.9a: bug
  đường dẫn chết chặn MỌI lần pricing ghi scenario + thiếu khóa `products[]`),
  vá 2 contract doc trôi khỏi schema từ ADR-012 (`cost-pool.md`/`product.md`),
  bổ sung audit log `priceLockAudit` cho "Chốt Baseline Mới" (checklist bắt
  buộc của skill security-review, trước đó chưa có). Đủ 5 cổng: `npm test`
  328/328, `test:rules` 55/55, `test:functions` 9/9, typecheck root+functions,
  build OK — verify thật qua emulator, không chỉ fixture.
  **Còn treo trước khi trỏ Firebase project THẬT (không phải rủi ro khi còn
  dùng Emulator)**: cơ chế cấp custom claim `role` cho user thật — xem mục
  "Còn treo" `docs/contracts/scenario.md`.
  **Tiếp theo**: merge nhánh làm việc lên nhánh mặc định (chưa làm, cần user
  xác nhận) → cân nhắc bước "đóng gói tri thức" (kit version) nếu cần trước
  khi giao phiên sau.
- (Lịch sử tới M12.7, giữ nguyên tham khảo) M12 tự chia nhỏ M12.1-M12.10
  ở **`docs/M12_PLAN.md`** (đọc file đó, KHÔNG lặp lại chi tiết ở đây) — đã
  xong M12.1 (orchestrator `calculateScenario()`, `src/engine/scenario.ts`),
  M12.2 (scaffold Vite+React 18+TS strict+Tailwind+Recharts, đã verify chạy
  thật bằng dev server + screenshot), M12.3 (Firebase Emulator Suite +
  `firestore.rules` theo bảng phân quyền `scenario.md` §5-6, 33 test rules
  chạy thật trên emulator qua `npm run test:rules`), M12.4 (Cloud Function
  `onScenarioWrite` — `functions/`, ghi `outputs/internal`+`outputs/priceList`;
  ADR-010 tách M12.4b/c hoãn có lý do), M12.4b (2026-07-08 — Cloud Function
  `onPlanInputWrite` ghi `outputs/plan` + engine mới
  `src/engine/plan-support.ts`: `deriveMoldSetCountBySizeDN()` và
  orchestrator pure `calculatePlanForScenario()` — M12.7 tái dùng được),
  M12.4c (2026-07-08 — HTTPS Callable `computeTargetCosting` T2+T3 + engine
  `src/engine/target-costing.ts` + **ADR-013**: `productKey` chọn SKU cho T3,
  `materialId` optional cho T2 (bảng ADR-009 #6/#7), allowlist biến dò
  server-side, doc `outputs/targetCosting` ghi đè {kind, request, result};
  9 test tích hợp thật qua `npm run test:functions` gồm test quyền trên Auth
  Emulator). **Cả 3 Cloud Function của scenario.md §5 đã xong.** M12.5
  (2026-07-08 cùng phiên — màn Dashboard THẬT, UI đầu tiên nối Firestore:
  engine `dashboard-support.ts` cho 2 khối số vàng dashboard.json chưa từng
  có hàm [capacityLevels + investment, công thức giải mã từ số vàng, 9 parity
  test], shell + auth theo vai [sidebar "Xem Như Vai" = đăng nhập user demo
  claim `role` trên Auth Emulator], seed script `npm run seed:emulator`,
  Dashboard đủ I-IV đúng prototype [top-down "Compound tối đa" dùng solve()
  trên calculateScenario client-side — không công thức ngược tay]; verify
  chạy thật bằng emulator + dev server + screenshot 2 vai, số vàng v3.7 hiện
  đúng trên màn hình). M12.6 (2026-07-08 cùng phiên — màn Bảng Giá sales-safe:
  thêm `unit`/`spec` vào doc priceList + `PriceListDocSchema` [bảng ADR-009
  #8], UI search/lọc loại/toggle VAT/bảng 6 cột từ outputs/priceList cho mọi
  vai, ẩn 8 SKU pending_mold bằng managementStatus, KHÔNG dòng Dung môi 550
  [Excel 99 dòng là chân lý]; verify chạy thật vai sales 91 SKU giá v3.7
  đúng). M12.7 (2026-07-08 cùng phiên — màn Kế Hoạch SX vai production +
  **ADR-014** [user chốt phương án a]: doc mới `outputs/productCatalog`
  danh mục SP + tham số vận hành KHÔNG giá, rules production đọc được
  [37/37], PlanScreen nhập Ống/PK + "Lưu & tính" → onPlanInputWrite tính
  outputs/plan, verify chạy thật khớp kịch bản A plan.test.ts). Tiếp theo:
  **M12.8** (màn Target Costing — LƯU Ý prototype KHÔNG có tab riêng, nếu
  cần màn riêng phải mockup hỏi user duyệt trước — xem "Việc tiếp theo"
  trong `docs/M12_PLAN.md`). `npm test` 328/328 xanh (286 + 11 Corzan + 12
  plan-support + 10 target-costing + 9 dashboard-kpis), rules 37/37,
  functions 9/9, `npm run build` chạy được. **PR #2 (M12.3-M12.4) đã MERGE 2026-07-06 (`fc6d5fc`); nhánh ADR-011 +
  ADR-012/M13 đã MERGE 2026-07-07 (`a4badf1`); nhánh M12.4b→M12.7 + kit v1.28
  (`claude/next-session-work-iz1i9g`) đã MERGE 2026-07-08 (merge commit
  `be2bdd2`, verify sau merge đủ 5 cổng: 328/328 + typecheck + build + rules
  37/37 + functions 9/9 trên emulator thật) vào
  `claude/project-knowledge-setup-2au4hr`** — đây
  là nhánh mặc định thật của repo (repo KHÔNG có `main`). Mọi commit push thẳng vào branch làm việc do hạ tầng
  phiên chỉ định lúc bắt đầu (tên đổi theo từng phiên — xem branch Git hiện
  tại, KHÔNG cố định 1 tên qua nhiều phiên); quy trình mặc định vẫn KHÔNG tự
  tạo PR (yêu cầu user 2026-07-06), nhưng nếu hạ tầng tự tạo PR và user yêu
  cầu merge thì merge bình thường — sau merge, việc mới trên tên branch đã
  merge phải khôi phục lại từ nhánh mặc định mới nhất, không lắp thêm commit
  lên lịch sử đã merge. Chi tiết đầy đủ bên dưới + `docs/PHASE3_PLAN.md` +
  `docs/M12_PLAN.md`.
- **Pha: 3 (Code) — HOÀN TẤT 2026-07-10 (M1-M12.10), chuẩn bị merge/Pha 4.**
  Đoạn dưới đây (lịch sử M1-M11 + trạng thái "ĐANG LÀM") giữ nguyên làm tham
  khảo, xem bullet đầu trang cho trạng thái THẬT hiện tại. Pha 1 (Prototype) đã được
  user **DUYỆT UI chính thức ngày 2026-07-06**;
  `prototype/blazemaster-costing-app.dc.html` là nguồn tham chiếu UI/UX đóng
  băng — đổi thiết kế màn hình phải quay lại Pha 1 ghi ADR mới. Schema Pha 2
  (`docs/contracts/{resource,product,cost-pool,pricing-chain,scenario}.md`) đã
  được user duyệt **ĐÓNG BĂNG ngày 2026-07-06** ("thực hiện theo đề xuất") —
  sửa cấu trúc field bắt buộc có ADR mới.
  **QUAN TRỌNG — đọc `docs/PHASE3_PLAN.md` TRƯỚC KHI CODE TIẾP**: theo yêu cầu
  user, Pha 3 chia thành nhiều milestone nhỏ (M1..M12), mỗi milestone tự chứa
  (code + `npm test` xanh + commit) để không tốn tool call và dừng được khi gần
  hết token — KHÔNG cố làm hết Pha 3 trong 1 phiên. File đó có bảng trạng thái
  M1..M12 và "việc tiếp theo ngay" — đọc đúng dòng đầu tiên chưa `[x]`.
  **Đã xong M1-M8** (chi tiết đầy đủ từng milestone → mục "Nhật ký milestone đã
  xong" trong `docs/PHASE3_PLAN.md`, KHÔNG lặp lại ở đây): schema thật
  (`src/schemas/`), engine Ống (`pipe.ts`), engine Phụ kiện + MHR (`fitting.ts`),
  khấu hao khuôn động theo `asOfYear` (`mold-depreciation.ts`, ADR-007), khóa
  bảng giá + giá vốn kép (`price-lock.ts`/`dual-costing.ts`, ADR-002/004, đã nối
  dây vào `pipe.ts`), dòng vật liệu ren kim loại (`metal-insert.ts`, ADR-008),
  CVP (`cvp.ts`, làm TRƯỚC price-ladder vì bậc 1 = `cvp.variableCostPerKg`),
  thang giá 5 bậc + chuỗi markup 99 dòng (`price-ladder.ts`) — đã tính tay đối
  chiếu `dashboard.json` trước khi code để tránh lặp lại đúng 2 lỗi công thức
  cũ ở bậc 2 (loại khấu hao lab/UL khỏi cash cost) và bậc 4 (chia theo tỷ trọng
  doanh thu VF, không theo kg). **M9** — Plan_SX (`plan.ts`, T1, BUSINESS_MODEL
  §6) — KHÁC mọi milestone trước: KHÔNG có số vàng Excel (sheet gốc là
  template), verify bằng 2 kịch bản tự chọn tính tay (script Python độc lập)
  thay vì đối chiếu Excel. **M10** — Inverse solver (`solver.ts`, T2/T3,
  ADR-005/006): `solve()`/`solveDiscrete()` GENERIC (chưa có orchestrator
  `calculateScenario()` nối toàn bộ engine → M11/M12) + `solveTargetProfit()`
  (T2 dạng đóng, tái dùng `cvp.ts`). Phát hiện thiếu field `baseInput` ở
  `SolveParams` đã đóng băng — bổ sung + ghi ADR-009 dòng #4. Test case chuẩn
  T3 (DN50 mục tiêu 260.000đ/m) forward-verify khớp tuyệt đối; case infeasible
  trả đúng `achievableRange`. **M11** — audit toàn bộ `tests/fixtures/*.json`,
  phát hiện `price-list.json` (bảng phẳng 99 dòng, sheet "PriceList") là
  fixture DUY NHẤT chưa có test tham chiếu → viết
  `tests/parity/price-list-snapshot.test.ts` (93 test) đối chiếu ĐỘC LẬP,
  khớp 100% (trừ 8 SKU `pending_mold` cố tình bỏ qua so giá trị — đúng ADR-008).
  `npm test` 278/278 xanh, mọi fixture vàng nay đều có ít nhất 1 test tham
  chiếu. **Engine lõi Pha 3 (M1-M11) coi như HOÀN THÀNH** — chỉ còn M12 (UI
  thật + Firestore), CHỜ user xác nhận mở rộng phạm vi trước khi bắt đầu.
- ADR đã CHẤP NHẬN: 001-008 (đầy đủ, xem chi tiết bên dưới điểm 8, 9, 10),
  **009** (retroactive — bảng field bổ sung vào schema đã đóng băng, Pha 3;
  dòng #6/#7 thêm 2026-07-08 theo ADR-013),
  **010** (ranh giới Cloud Function cho ScenarioOutput/Plan/TargetCosting, M12.4),
  **011** (2026-07-07 — đối chiếu Excel `BlazeMaster_Model_v3_7.xlsx`: Phụ kiện
  `avgProductivityKgPerMachineHour` đổi từ nhập tay 44,6 sang tính bottom-up từ
  bảng khuôn, có ghi đè tùy chọn; kéo theo MHR/giá thành 2 dòng/99 giá SKU/thang
  giá/CVP đổi số — đã cập nhật engine (`resource.ts` field optional,
  `fitting.ts` thêm `computeMixAvgProductivityKgPerMachineHour()`, `cvp.ts` đọc
  lại từ capacity thay vì resource trực tiếp) + toàn bộ fixture liên quan
  (`pipe.json`, `fitting.json`, `dashboard.json`, `price-list.json`,
  `price-lock-scenarios.json`), `npm test` 286/286 xanh, `npm run build` OK).
  **012** (2026-07-07 — multi-material/Corzan: `Material` entity độc lập
  (landed cost + markup VF + tồn kho/khóa giá theo TỪNG nguyên liệu, tái dùng
  ADR-002/004), `materialId` trên Product, chung line/chung MHR. UI DUYỆT +
  schema ĐÓNG BĂNG + **Pha 3 M13 ĐÃ XONG cùng ngày** (M13.1 engine
  multi-material, M13.2 danh mục Corzan): `src/schemas/material.ts`,
  ScenarioInput có `materials[]` (bỏ `inventory.pipe|fitting`), ScenarioOutput
  theo (line, materialId), thuế NK + markup VF chuyển từ CostPool vào
  Material. Corzan: giá thật ống 3,47 / phụ kiện 3,97 USD/kg (Ấn Độ, thuế 0%
  AIFTA — user XÁC NHẬN 0%), markup 25%/40% (field
  riêng), SKU = BlazeMaster cùng tên/size (ống đơn trọng ×1,1, phụ kiện giống
  hệt, CHUNG khuôn) — rule sinh chương trình ở `tests/fixtures/corzan.json` +
  `buildCorzanScenarioInput()`. Verify: 297/297 test xanh = parity BM v3.7
  nguyên vẹn + 11 test Corzan (số tính tay độc lập + test cách ly). User xác
  nhận KHÔNG cần Excel Corzan riêng — logic BlazeMaster áp nguyên, engine
  forward + rule corzan.json LÀ nguồn chân lý. KHÔNG còn việc treo cho
  ADR-012. Chi tiết: `docs/contracts/material.md` (có mục "Bổ sung khi code
  Pha 3 M13") + `docs/sessions/SESSION_2026-07-07.md`.)
  **013** (2026-07-08 — M12.4c `computeTargetCosting`: `productKey` chọn SKU
  T3 + `materialId` T2, allowlist biến dò server-side [5 biến liên tục v1,
  `shifts` hoãn M12.8], doc `outputs/targetCosting` ghi đè
  {kind, request, result}, quyền pricing/admin qua custom claim),
  **014** (2026-07-08 — M12.7, user chốt "phương án a": doc
  `outputs/productCatalog` danh mục SP + tham số vận hành cho vai production
  dựng form Kế Hoạch SX — TUYỆT ĐỐI không field giá; production/admin/pricing
  đọc, sales ✗, Cloud Function ghi),
  **015** (2026-07-09/10 — M12.9d, security-review M12.10: khóa `thresholdPct`
  admin-only TRONG TỪNG phần tử `materials[]`/`inventory.metalInsert[]` bằng
  UNROLL theo index cố định trong `firestore.rules` [cận trên 8/10, mảng thực
  tế nhỏ hơn nhiều] — user được hỏi giữa unroll thật vs defense-in-depth
  client-side, chốt theo khuyến nghị. UI M12.9d luôn APPEND material mới vào
  cuối mảng để giữ đúng giả định index cố định),
  **016** (2026-07-10 — Pha 4, project thật `bmcosting-ver-2` dùng Firestore
  Database ID `manufacture` thay vì `(default)`: tham số hóa
  `FIRESTORE_DATABASE_ID` qua `firebase-functions/params.defineString`, dùng
  CHUNG cho trigger `onDocumentWritten` + `getFirestore()` — verify thật cả
  Emulator lẫn project thật, xem `docs/decisions/ADR-016-named-firestore-database.md`),
  **017** (2026-07-10 — Pha 4, cấp/thu hồi custom claim `role` cho user Auth
  thật: Cloud Function `setUserRole` [onCall, admin-only] + audit log
  `roleAudit/{entryId}` [append-only] + `scripts/bootstrap-admin.ts` [phá
  vòng con-gà-quả-trứng cho admin đầu tiên] — verify thật cả Emulator
  [13/13 test] lẫn project thật [cấp `role=admin` thành công cho
  `tuannq6886@gmail.com`], xem `docs/decisions/ADR-017-custom-claim-role-management.md`),
- File tri thức cần đọc khi vào phiên mới: `AGENTS.md` → `CLAUDE.md` → file này →
  `docs/PROJECT_SPEC.md` (nếu cần chi tiết) → `docs/decisions/ADR-*.md` (nếu đụng
  đúng vùng nghiệp vụ đó).

NGHIỆP VỤ LÕI (không được phát minh khác đi):
1. Hai cost driver (ADR-001): ống theo kg; phụ kiện theo GIỜ MÁY —
   MHR = chi phí gia công năm ÷ giờ máy huy động; giờ máy/sp = chu kỳ/(3600×cavity×yield).
2. Giá vốn kép (ADR-002): sổ sách = bình quân gia quyền kho; định giá = giá tái tạo.
   Lãi/lỗ giữ kho = (tái tạo − bình quân) × tồn kho. Cảnh báo dự phòng VAS 02 khi giảm.
3. Khóa bảng giá (ADR-004): pricingPrice = |repl/baseline−1| > ngưỡng% ? repl : baseline.
   Trong ngưỡng bảng giá đứng yên; vượt ngưỡng → chuyển + nhắc chốt lại baseline.
   Ngoại tệ mua NVL luôn theo replacement. Cảnh báo staleness so đợt nhập gần nhất.
4. Thang giá 5 bậc (ống BlazeMaster, đ/kg, sau ADR-011 v3.7): sàn biến phí
   100.663,42 / hòa vốn tiền mặt 104.369,04 / giá thành đầy đủ 106.318,88 /
   hòa vốn toàn DN 111.070,84 / giá mục tiêu 132.898,60. Từ ADR-012 thang giá
   tính theo TỪNG (dòng SX, nguyên liệu) — số trên là cặp (pipe, bm-orange-pipe).
   Thẩm quyền giảm giá phân tầng theo bậc; bậc 1 không ai được thủng.
5. Số vàng để kiểm tra (sau ADR-011, nguồn v3.7): MHR = 1.308.217,93 đ/giờ máy
   (1 ca × 60%); BE ống đầy đủ = 106.318,88; BE@3,50 = 121.126,49; BE@2,80 =
   99.072,60; 8 giá ống + 91 SKU trong tests/fixtures/price-list.json. (Số cũ
   v3.4, KHÔNG còn vàng: MHR 1.344.176; BE 106.204,73; BE@3,50 121.012; BE@2,80
   98.958 — đổi vì Phụ kiện §3.2 avgProductivityKgPerMachineHour chuyển từ nhập
   tay 44,6 sang tính bottom-up từ bảng khuôn, xem ADR-011.)
6. HAI CHIỀU HOẠCH ĐỊNH (ADR-005): bottom-up = nguồn lực → công suất → giá
   (forward, đã có). Top-down = mục tiêu → yêu cầu vận hành: (T1) kế hoạch vs
   nguồn lực; (T2) lợi nhuận mục tiêu → sản lượng + số ca; (T3) giá thị trường
   → chi phí mục tiêu → biến vận hành (qua solver, cấm công thức ngược tay).
   Mọi kết quả top-down phải forward-verify trước khi hiển thị.
7. PHÂN TẦNG TOP-DOWN THEO VAI (ADR-006): tầng VẬN HÀNH (T1, vai `production`,
   màn hình Plan_SX, theo kỳ) KHÁC tầng CHIẾN LƯỢC (T2/T3 + giá thâm nhập, vai
   `pricing`/`admin`, màn hình Target Costing riêng, khi ra quyết định giá/đầu
   tư). Không gộp 2 tầng vào 1 màn hình; `production` không thấy Target Costing.
8. KHẤU HAO KHUÔN THEO THỜI ĐIỂM MUA (ADR-007 — ĐÃ CÓ SỐ LIỆU): khuôn phụ kiện
   KHÔNG còn là 1 số gộp tĩnh (`moldSetCostTotal66`) — mỗi khuôn là 1 `moldAsset`
   riêng (giá, năm mua, số năm khấu hao). MHR tính động theo `asOfYear` — sẽ tự
   đổi khi mua thêm khuôn hoặc khuôn cũ hết khấu hao. Dữ liệu thật: 66/66 khuôn
   có giá (`tests/fixtures/mold-assets.json`, verify khớp tuyệt đối
   `moldSetCostTotal66` cũ), `purchaseYear=2026` cho toàn bộ. 66 khuôn chỉ tạo
   được 83/91 SKU (nhiều khuôn dùng chung nhiều biến thể) — 8 SKU còn lại chưa
   có khuôn, xem điểm 10.
9. REN KIM LOẠI MUA NGOÀI (ADR-008 — ĐÃ CÓ ĐỦ DỮ LIỆU): Nối ren trong (7 SKU) +
   Nối ren ngoài (4 SKU) = 11 SKU có thêm dòng nguyên liệu THỨ 2 (ren đồng thau,
   mua VND trong nước, KHÔNG ngoại tệ/DUTY) — áp ĐÚNG giá vốn kép như ADR-002 +
   khóa giá riêng (ngưỡng 5%, độc lập với compound). PHÁT HIỆN: ren thực chất
   chỉ có 10 loại vật tư theo (renType, ptSize) — không phải 11 loại theo SKU
   (2 SKU nhựa khác nhau có thể dùng chung 1 loại ren, vd 20xPT15 và 25xPT15
   cùng dùng ren PT15). Tồn kho ban đầu: 29.000 cái, 1.016.300.000đ. Dữ liệu ở
   `tests/fixtures/metal-insert.json` (`insertCatalog` 10 dòng có priceLock,
   `skuToInsertMap` 11 dòng, `metalInsertSkus` 11 dòng theo SKU).
10. DANH MỤC QUẢN LÝ TẠM THU HẸP: 8 SKU chưa có khuôn thật (Cút ren trong ×3,
    Tê ren trong ×4, Tê giảm 50x40 ×1 — xem `mold-assets.json.skusWithoutMold`)
    bị loại TẠM THỜI khỏi Bảng Giá/Kế Hoạch SX/bảng giá SKU trong prototype
    (`EXCLUDED_SKUS` trong file .dc.html) — dữ liệu Excel gốc KHÔNG xóa, chỉ ẩn
    hiển thị. Khi mua khuôn thật cho 1 SKU: PHẢI làm 2 việc cùng lúc — thêm
    `moldAsset` vào fixture VÀ gỡ key khỏi `EXCLUDED_SKUS`.

QUY TRÌNH: 4 pha có cổng — brief → prototype (mock, duyệt UI) → schema+contract
(đóng băng) → code (không phát minh mới) → test parity + security → merge.
UI tiếng Việt, số định dạng vi-VN, thuật ngữ theo docs/GLOSSARY.md.
Vai sales KHÔNG BAO GIỜ thấy chi phí gốc — chỉ thang giá + bảng giá.
