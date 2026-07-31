# ROADMAP — Dự án Tính Giá Thành & Định Giá (factory_cosing)

> **Mục đích:** File này là điểm neo (Anchor) cho AI ở đầu mỗi phiên. AI đọc file này để hiểu tổng quan dự án đang ở giai đoạn nào, những gì đã hoàn tất, và những gì cần làm tiếp theo. Không cần đọc lại toàn bộ lịch sử chat.

## 🟢 Tóm tắt trạng thái hiện tại
- **Pha 1 & 2:** Xong. **Pha 3 (Engine):** Xong — **suite 404/404 test** (parity Excel).
- **App = công cụ QUYẾT ĐỊNH của CEO** (ADR-020/026): MỘT view, đăng nhập production
  (admin/pricing), nav 2 nhóm (Phân Tích & Quyết Định + Điều Chỉnh Tham Số). Đã bỏ
  hết tab vận hành vai khác + guard vai chết.
- **Bộ 4 công cụ if–then** (ADR-027→031): Độ Nhạy (tornado) · So Sánh Kịch Bản · Quyết
  Định Nhận Đơn (+ khóa giá what-if) · Tối Ưu Product-mix (đa mẫu số + giá thị trường).
  Tất cả tái dùng engine đóng băng, đồng bộ EBIT **giá-bán-cố-định** (nền `scenario-drivers.ts`).
- **Định giá** (ADR-025): Bảng Giá neo giá **VF** + Bảng Giá **NPP** dẫn xuất + dải cảnh báo chốt giá.
- **Design system** (ADR-033): tokens + primitives, phong cách **TỐI GIẢN ĐEN–TRẮNG**
  (màu chỉ cho biểu đồ + ghi chú). ⚠ **MỚI DEMO 1 màn (Độ Nhạy)** — cần roll-out ~13 màn còn lại.

## 🎯 BÀN GIAO PHIÊN MỚI — việc tiếp theo (ưu tiên từ trên xuống)
0. **⚠ ƯU TIÊN NHẤT — đề xuất tái thiết kế bố cục đang CHỜ USER DUYỆT** (Pha 1,
   CHƯA code gì): user phản hồi UI hiện tại rối (quá nhiều mục menu, chữ nhỏ,
   nút bấm dày đặc). Đã thảo luận 3 vòng qua artifact tương tác, bản mới nhất
   lưu ở `prototype/layout-redesign-proposal.html` (mở thẳng bằng trình duyệt).
   Hướng đi (CHƯA CHỐT): sidebar rút còn 5 mục + Trợ Giúp ghim; mọi màn "chỉ
   xem" gộp thành danh sách, bấm 1 dòng mở panel bên phải LỒNG NHAU (nested,
   kiểu Twenty CRM) thay vì điều hướng sang trang khác; "Giá Vốn Theo Lô" (chốt
   lại giá) nằm ngay trong panel của nguyên liệu đó; Bảng Giá cũng đổi sang
   cùng kiểu danh sách+panel. Đọc chi tiết ở `docs/sessions/SESSION_2026-07-31.md`
   trước khi làm gì tiếp — **việc đầu tiên của phiên sau là trình lại mockup cho
   user chốt layout, RỒI mới viết ADR + sang Pha 2/3.** Đừng tự suy diễn code
   thật từ mô tả này — xem đúng file mockup.
1. **Roll-out design system đen–trắng** ra các màn còn lại (Dashboard, CEO Planner, 3
   công cụ if–then còn lại, Bảng Giá VF/NPP, Lot-costing, Pricing-analytics, Tham Số,
   Cấu Hình). Di trú lên `src/design/primitives.tsx` — thuần trình bày, KHÔNG đụng logic.
   Gu đã user duyệt: đen/trắng/xám chủ đạo, màu chỉ cho biểu đồ/ghi chú. Sửa ở
   `src/design/tokens.ts` là cả app đổi. (Font hiện Roboto; cân nhắc nạp Inter.)
2. **Product-mix**: chờ user cấp **giá thị trường thật của ống** (gõ vào ô là ra kết
   luận sát) + phân bổ **vốn dùng chung/lưu động** vào ROIC (mới tính vốn trực tiếp dòng).
3. **Trợ Lý CEO**: `firebase functions:secrets:set ANTHROPIC_API_KEY` để `adviseScenario`
   gọi Claude thật (đang fallback mock).
4. (Tuỳ chọn) Google Sign-In cho owner; tắt tài khoản demo trên production; SCH80 catalog;
   trích lại fixture khi có Excel v3.7 chính thức.

## 🏆 Đã hoàn thành gần đây (Tháng 7/2026)
- [x] **(2026-07-31) Bảng Giá — cột Giá VF BQGQ + Chênh lệch trong danh sách chính**:
  trước chỉ hiện khi bấm mở dòng; giờ CEO quét cả bảng không cần bấm (PR #32).
- [x] **(2026-07-31) Nhập lô nguyên liệu theo kg thay vì tấn** (UI-level, 3 màn:
  Thiết Lập Dữ Liệu/Tồn Kho Compound/Giá Vốn Theo Lô) — lưu trữ vẫn ở field
  `tons` (schema đóng băng), quy đổi ×1000/÷1000 tại ô nhập, không đụng schema/
  công thức/dữ liệu Firestore cũ (PR #33).
- [x] **ADR-058 — Thuế NK/phí logistics RIÊNG từng lô**: `InventoryLotSchema`
  thêm 2 field optional `importTaxRate`/`customsLogisticsFeeRate` (bỏ trống =
  kế thừa material, parity tuyệt đối với dữ liệu cũ). Hàm mới
  `weightedAvgLandedCostPerKgVnd` (dual-costing.ts) tính landed cost TỪNG lô
  rồi mới bình quân — thay vì bình quân giá thô rồi nhân 1 rate chung (SAI khi
  lô khác xuất xứ/thuế). `holdingGainLossVnd` đổi sang nhận 2 landed cost đã
  tính sẵn. `usdPerKgForLandedCostVnd` (cost-pool.ts, nghịch đảo landedCostPerKgVnd)
  giúp `price-cost-scenarios.ts` quy đổi lại "giá tương đương" chảy đúng qua
  pipeline hiện có. UI: `InventoryScreen`/`DataSetupScreen` mục ④ thêm 2 cột
  thuế/phí riêng mỗi lô. Mọi nơi hiển thị "bình quân gia quyền" (Giá Vốn Theo
  Lô, Bảng Giá, Tổng Quan — ADR-057) giờ đúng theo từng lô. Suite 404/404 (+8
  test), typecheck + build xanh. **User CHỐT KHÔNG làm** trạng thái "lô kế
  hoạch/đang về" (chỉ đã-nhập-kho) — thêm sẽ gây rối, không cần nữa.
- [x] **ADR-057 — Đặt lại tên "giá tái tạo" + gộp nơi nhập baseline + góc nhìn
  giá vốn kép**: "giá tái tạo" → **"Giá mua mới hôm nay"** khắp UI + 1 chuỗi
  cảnh báo engine (`dual-costing.ts`); `baseline` hiển thị tường minh (USD/kg)
  mọi nơi + term `'baseline-mechanism'` (TermInfo/ⓘ) giải thích cơ chế khóa giá.
  Gộp nơi NHẬP baseline về **một chỗ duy nhất** — `Thiết Lập Dữ Liệu → mục ④`
  (thêm ô gõ tay, `AssumptionsScreen`/Tham Số đã là dead code từ ADR-049, không
  đụng thêm). Module mới `price-cost-scenarios.ts` (`scenarioWithCostBasis` —
  ép mọi material theo 1 cơ sở giá: giá mua mới hôm nay | bình quân gia quyền,
  tái dùng NGUYÊN `calculateScenario`/`makeFixedPriceModel`, không công thức
  mới) → (1) **Bảng Giá**: panel "Giá này từ đâu ra?" mỗi SKU thêm so sánh Giá
  VF dự kiến vs Giá VF bình quân gia quyền + chênh lệch; (2) **Tổng Quan**:
  khối mới "So sánh giá vốn: Baseline vs Bình quân gia quyền" — GIỮ NGUYÊN giá
  bán, đổi cơ sở nguyên liệu, hiện song song giá thành/kg + EBIT cả năm + chênh
  lệch (giúp CEO thấy dư địa giảm giá bán khi tồn kho đang rẻ hơn baseline).
  Suite 399/399 (+6 test mới), typecheck + build xanh. (Thuế NK/logistics
  riêng từng lô đã làm tiếp ngay sau đó — xem ADR-058 bên dưới; KHÔNG làm
  trạng thái "lô kế hoạch/đang về" — user chốt không cần, sẽ gây rối.)
- [x] **Thác chi phí đ/kg — "tiền đi đâu?"** (thuần trình bày, engine helper thuần +
  test parity). Tách giá thành đầy đủ mỗi dòng thành 4 tầng: **gia công tiền mặt**
  (nhân công·điện·nước·bảo trì·bao bì — phần quản đốc "cảm" được) → **+chi phí chung**
  → **+khấu hao máy/khuôn** → **+nguyên liệu nhập USD**. Giải thích khoảng vênh giữa
  cảm nhận vận hành (ống ~10.000 · phụ kiện ~14.000 đ/kg gia công) và giá thành đầy đủ
  (ống 108.712 · phụ kiện 180.604 đ/kg) — 88% giá ống là hạt CPVC nhập; phụ kiện khấu
  hao/kg tới 43.454đ vì chạy 1 ca × 60% (lấp công suất → tụt mạnh). `cost-breakdown.ts`
  (`pipe/fittingCostLayersPerKg`, GOM cấu phần đã tính, tổng = fullCostPerKg — 2 test
  parity), component `CostWaterfall`, cắm vào **Tổng Quan › Sản Xuất** + **Thiết Lập ②**.
  Suite 391/391, typecheck + build xanh.
- [x] **Thiết Lập: lộ 'số giờ/ca' + lô nguyên liệu nhiều giá** (thuần trình bày, KHÔNG
  đổi schema/engine — cả 2 field đã đóng băng, engine đã dùng). (1) Mục ② Chi phí chế
  biến: thêm ô **Số giờ/ca** (`hoursPerShift`, Ống + Phụ kiện) + số tự tính **Giờ vận
  hành/năm** & **Giờ máy huy động/năm** — CEO chỉnh 1 ca 12h / 2 ca 24h thì điện/nước
  tính lại đúng (không còn kẹt thông lệ 3×8h). (2) Mục ④ Nguyên liệu đổi sang thẻ/compound:
  lộ **các lô mua** (`inventory.lots[]`, tấn × USD/kg — vd lô 2,9 / lô 2,6) + **giá vốn
  bình quân gia quyền** (`weightedAvgUsdPerKg`) tách rõ khỏi **giá tái tạo**, kèm lãi/lỗ
  giữ kho + cảnh báo VAS-02 đọc thẳng engine. Suite 389/389, typecheck xanh.
- [x] **ADR-048 — 'meters' làm nghẽn tổng công suất**: chế độ m/giờ nay tính tổng
  sản lượng dòng ống từ tốc độ per-size (m/giờ × đơn trọng, chia đều thời gian máy)
  thay 1 tốc độ pha trộn → size chậm kéo tổng kg/năm xuống → Trợ Lý CEO ra doanh thu/
  LN KHÁC chế độ kg (trước đây giống hệt vì chỉ redistribution). Verify: bơm m/giờ →
  sản lượng −27%, doanh thu −21%. Parity kg + meters-chưa-đo giữ nguyên (suite 380/380).
  Kèm banner Danh Mục nhận biết chế độ kg/m + hướng dẫn khi máy chỉ 1 compound.
- [x] **ADR-038 — Danh Mục Sản Phẩm mở lại + khuôn dùng chung + phiếu giá 3 tầng**:
  tạo SKU mới trọn vòng (khai chuẩn/kích thước/đơn trọng → gán khuôn chung/chờ
  khuôn → lưu → tự lên Bảng Giá); phiếu giá phân biệt rõ nguyên liệu + tiêu chuẩn.
  ĐÃ XONG tiếp (ADR-039): rules mở products[] cho pricing; moldAssets giữ khóa
  admin — quy trình 2 nhịp (pricing tạo SKU "chờ khuôn" → admin gán khuôn).
- [x] **ADR-036 — Phiếu giá + Nhận đơn thương mại**: Bảng Giá thêm dạng "Phiếu
  giá từng sản phẩm" (chọn SP + size → 1 phiếu chi tiết: VF trước/có VAT cỡ lớn,
  TCG/NPP, truy nguyên giá) song song dạng danh sách; Nhận Đơn nhập theo SKU cụ
  thể + đơn vị thương mại (mét ống / cái phụ kiện, giá đ/mét|đ/cái, gợi ý sẵn
  giá VF niêm yết), UI quy về kg bằng đơn trọng — engine decideOrder giữ nguyên.
- [x] **ADR-035 — "Giải thích tại chỗ"**: nút ⓘ mọi màn (câu hỏi màn trả lời /
  số từ đâu ra / khi nào hành động / màn liên quan, ngôn ngữ CEO); Bảng Giá bấm
  từng SKU ra thác nước truy nguyên giá (NVL→SX→hoà vốn→+lời→VF→TCG→NPP) + trạng
  thái khóa giá; vá món nợ ADR-026: Tồn Kho (nhập/sửa lô) gắn lại vào Giá Vốn
  Theo Lô (`lot-costing:edit`); what-if ngưỡng ở Nhận Đơn có nút "Chốt ở Tham Số".
  CÒN TREO: Nhận đơn theo SKU + đơn vị thương mại (cây/cái) — bài UX riêng.
- [x] **ADR-034 — Sidebar theo tình huống CEO**: 4 nhóm (Hằng Ngày / Khi Có Việc /
  Hoạch Định / Thiết Lập) + caption 1 dòng mỗi mục; gộp 3 tab giá thành hub
  "Bảng Giá" (VF | NPP | Phân tích, `PricingHub.tsx`) → 12 mục còn 9; 3 link chéo
  theo mạch (Lô→Bảng Giá, Độ Nhạy→So Sánh KB, Nhận Đơn→Lô). Thuần trình bày.
- [x] **Đăng nhập production hoàn thiện**: gỡ hẳn lối tắt demo theo vai; thêm
  "Quên mật khẩu" (email đặt lại) + "Đăng nhập bằng Google" (popup). Cần bật
  provider Google + Authorized domains trên Console; Render cần điền 4 biến
  VITE_FIREBASE_* rồi rebuild (bản cũ đang chạy nhầm chế độ emulator).
- [x] **ADR-033 — Design system + phong cách đen–trắng**: `src/design/tokens.ts`
  (nguồn chân lý màu/chữ/spacing) + `primitives.tsx` (Screen/Card/Banner/Stat/Segmented…).
  Gu tối giản đen–trắng, màu chỉ cho biểu đồ + ghi chú. DEMO trên màn Độ Nhạy — CHỜ roll-out.
- [x] **ADR-032 — Product-mix progressive disclosure**: tách "nhìn nhanh" (mặc định) vs
  "phân tích sâu" (nút mở: vốn/ROIC + giá thị trường) — không nhồi vào flow chính.
- [x] **ADR-031 — Product-mix độ mở**: đa mẫu số (kg/máy-giờ/đồng vốn-ROIC) + nhập giá
  thị trường/dòng + chọn ràng buộc. Sửa hiểu lầm "dồn dòng biên cao" (theo thị trường → phụ kiện thắng).
- [x] **ADR-029/030 — Quyết Định Nhận Đơn + Tối Ưu Product-mix**: sàn nhận đơn theo giá
  thị trường (đơn mới mua NL mới) + khóa giá what-if; product-mix theo đóng góp/máy-giờ & vốn.
- [x] **ADR-028 — So Sánh Kịch Bản**: đặt tên Base/Xấu/Tốt, EBIT cạnh nhau (nền `scenario-drivers`).
- [x] **ADR-027 — Màn "Độ Nhạy" (tornado)**: công cụ if–then rủi ro — "biến nào bào
  EBIT mạnh nhất nếu lệch ±δ?". Engine `calculateSensitivity` giữ giá bán cố định,
  perturb 6 driver (compound, tỷ giá, lương, điện, chi phí ngoài SX, sản lượng), xếp
  theo swing. Base EBIT khớp KPI Dashboard (parity). UI tornado + bảng + chọn ±5/10/20%.
  Phát hiện: tỷ giá USD & compound mỗi cái ±77,5% EBIT (nguyên liệu định giá USD).
  +7 test, suite 350/350, verify Playwright.
- [x] **ADR-026 — Gọn về MỘT view CEO**: app chỉ phục vụ quyết định CEO. Bỏ 5 tab
  vận hành của vai khác khỏi nav (Kế Hoạch SX/production; Ống CPVC + Phụ Kiện báo
  cáo dây chuyền; Tồn Kho Compound; Danh Mục Sản Phẩm). Nav còn 2 nhóm: Phân Tích
  & Quyết Định (Tổng Quan, Trợ Lý CEO, Giá Vốn Theo Lô, Bảng Giá VF, Bảng Giá NPP,
  Phân Tích Định Giá) + Điều Chỉnh Tham Số (Tham Số, Cấu Hình Nhà Máy). Dọn guard
  "chỉ dành cho vai X" chết (PricingAnalytics/TargetCosting/Tham Số/Cấu Hình);
  GIỮ ranh giới bảo mật field-level (thresholdPct + strategic admin-only, khớp
  rules). Engine/backend không đổi — suite 343/343, typecheck xanh.
- [x] **ADR-025 — Bảng Giá neo theo giá VF + Bảng Giá NPP dẫn xuất**: Bảng Giá đổi
  từ niêm yết giá list (đã cộng markup nhà pp) sang **giá VF (xuất xưởng)** — cùng
  tầng với `targetPrice` màn Giá Vốn Theo Lô → 2 màn nhất quán, khóa giá (ADR-004)
  áp trực tiếp. Thêm màn **Bảng Giá NPP** (`DistributorPriceList`) trình bày quy
  trình dẫn xuất TỪ giá VF: VF → ×(1+markupTcg 30%) → TCG → ÷(1−biên NPP 30%) →
  niêm yết → +VAT 8%. CHỈ đọc `PriceListDoc.chain` đã persist (vf/tcg/list) — không
  schema/engine mới. Verify Playwright: Tê đều size20 VF 14.440 → NPP 26.900 (khớp
  fixture). Suite 343/343, typecheck xanh.
- [x] **ADR-024 — View "Giá Vốn Theo Lô"**: trả lời câu hỏi điều hành "5 lô khác
  giá → điều gì xảy ra → giá bán nào đúng?". Màn `LotCostingScreen` CHỈ đọc engine
  (giá vốn kép ADR-002 + khóa giá ADR-004) — mỗi nguyên liệu 1 thẻ: các lô → bình
  quân, giá tái tạo + lệch + trạng thái khóa, lãi/lỗ giữ kho (VAS-02 nếu lỗ), 2 giá
  bán (sổ sách vs chính thức), khuyến nghị chốt lại/giữ giá. Tách riêng khỏi Trợ Lý
  CEO ("câu hỏi khác"). KHÔNG ERP. Seed emulator làm giàu 3 lô Ống BM khác giá để
  minh hoạ. Verify emulator: banner đúng dấu lãi/lỗ (sửa bug cảnh báo VAS-02 sai).
  Suite 343/343.
- [x] **Trợ Lý CEO — XONG Pha 1→3**: prototype duyệt (Pha 1) → schema + ADR-021/022
  (Pha 2) → **engine `ceo-planner.ts` (tái dùng calculateScenario, parity 7 test) +
  màn `CeoPlannerScreen` gắn view CEO + callable `adviseScenario` (Claude API server,
  fallback mock, audit)** (Pha 3). Verify thật trên emulator: giá 135.890/252.846 đ/kg,
  LN trước thuế 16,7 tỷ, thu hồi vốn 1,2 năm. Suite 343/343.
- [x] **ADR-020 — Hợp nhất một view CEO**: bỏ điều hướng theo vai (role switcher +
  lọc tab), sidebar chia 2 nhóm ĐIỀU HÀNH / CẤU HÌNH & DỮ LIỆU, tự đăng nhập vai
  CEO. Backend theo vai giữ nguyên.
- [x] **ADR-019 — Ổn định parity v3.7**: tái lập số vàng theo tham số Ống mới sau
  "big update" (khấu hao khuôn kéo/cắt, 3 máy đùn). Suite 328/328 xanh.
- [x] Tách tồn kho Ren Kim Loại ra khỏi Tồn Kho Hạt Nhựa để UI không bị rối.
- [x] Sửa lỗi Focus Input khi nhập liệu trên bảng Sản Phẩm (Lỗi React re-render).
- [x] Bổ sung các công cụ nạp nhanh (Seed) cho nguyên liệu Corzan và sản phẩm Ống Corzan SCH40.
- [x] **Firebase thật (Production)**: project `bmcosting-ver-2`, database "manufacture" (ADR-016), seed baseline, deploy Render (Vite build).
- [x] **Phân quyền Custom Claims**: Cloud Function `setUserRole` + audit log (ADR-017), script tạo 4 user demo thật với role (admin/pricing/sales/production).
- [x] **Tham số Ống v3.7** (3 máy đùn, khấu hao 10 năm, khuôn kéo/cắt riêng 3 năm — ADR-019): tái lập toàn bộ số vàng fixture, `npm test` xanh lại 328/328.
- [x] CAPEX nhà xưởng + vốn lưu động nhập động (ADR-018), Dashboard chia 4 tab (Progressive Disclosure).

---

## 🚀 Việc cần làm tiếp theo (Pha 4 & Vận hành thực tế)

### 0. Trợ Lý CEO — bật Claude API thật (Pha 3 đã xong)
- [ ] Khi deploy: `firebase functions:secrets:set ANTHROPIC_API_KEY` để callable `adviseScenario` gọi Claude thật (hiện fallback mock rule-based, đã chạy end-to-end).
- [x] Engine + màn + callable + parity 7 test — XONG (verify emulator, suite 343/343).
- [ ] Ghi chú parity: số Ống brief (132.898,6 · payback 0,816) là tiền-v3.7; engine hiện cho 135.890 · 1,24 năm (đúng tham số v3.7 ADR-019). Không đuổi theo số cũ.

### 1. Bảo mật backend (rules) — vẫn còn giá trị sau ADR-020
> UI đã gộp thành một view CEO (ADR-020) nên không còn kiểm thử điều hướng 4 vai
> trên UI. Nhưng rules theo vai vẫn giữ ở server để bảo vệ dữ liệu thật.
- [x] Chạy `test:rules` (61/61) + `test:functions` (16/16) — XANH; thêm rule + test `adviceAudit` (ADR-022 §6).
- [x] **Đăng nhập production thật (ADR-023)**: form email/mật khẩu (LoginScreen), bỏ auto sign-in; cổng vào admin/pricing, chặn sales/production; nút Đăng xuất; lối tắt demo chỉ ở emulator. Verify: owner vào view CEO, sales bị chặn, sai mật khẩu báo lỗi.
- [ ] (Tuỳ chọn) Thêm nút Google Sign-In cho owner (Gmail) — không đổi kiến trúc (ADR-023 §Hệ quả).
- [ ] Vận hành: tắt/vô hiệu hoá tài khoản demo trên project thật (Firebase Console).

### 2. Tinh chỉnh và Vá lỗi nghiệp vụ (nếu có)
- [ ] **(2026-07-20) Cơ cấu sản lượng theo size (chế độ m/giờ)** — nâng cấp ADR-048:
  hiện giả định chia ĐỀU thời gian máy giữa các size (trung bình cộng). Cho nhập
  **tỷ trọng sản lượng %/size** (hoặc lấy từ nhu cầu/đơn hàng thực) → thay bằng
  trung bình có trọng số `K = H·yield / Σ(s_i / kg-giờ_i)`. CHƯA code, chờ user.
- [ ] **(2026-07-20) CEO Planner Chế độ 2** — mục tiêu sản lượng → cần thêm máy: nhập sản lượng mong muốn cả 2 loại; vượt trần 3 ca → tính số máy đùn/ép cần mua + CAPEX + payback. Kèm vá `calculatePipeCapacity` nhân `extruderCount` (no-op khi =1). Xem ADR-042.
- [ ] **(2026-07-20)** Đo thêm m/giờ đùn các size DN32/40/50/65/100 để thay số nội suy (hiện min(420, 163/đơn trọng)) — ADR-046.
- [ ] **(2026-07-20)** Cân nhắc TÁCH Firebase project riêng cho costing (project chung `bmcosting-ver-2` bị app khác xóa mất `onScenarioWrite`; app đã tự tính client-side theo ADR-045 nên không kẹt, nhưng nên tách để sạch).
- [ ] Chờ danh mục ống SCH80 chuẩn từ nhà cung cấp để cập nhật lại Seed Data.
- [ ] Kiểm tra lại toàn bộ quy trình từ khâu nhập Tồn kho -> Thay đổi định mức -> Tính giá thành -> Khóa giá -> Báo giá xem có bị khựng ở bước nào không.
- [ ] Khi có Excel v3.7 chính thức: trích lại fixture bằng cached-value để thay số vàng engine-derived (ghi chú ADR-019).

---

## 📝 Hướng dẫn cho AI bắt đầu phiên mới
1. Đọc lướt qua file `ROADMAP.md` này.
2. Nếu User giao task mới, hãy ghi chú task đó vào phần **Việc cần làm tiếp theo**.
3. Khi hoàn thành một tính năng lớn, hãy di chuyển nó lên phần **Đã hoàn thành gần đây**.
4. Giữ file này ngắn gọn, tránh viết quá chi tiết về mặt kỹ thuật (chi tiết kỹ thuật để ở các file ADR).
