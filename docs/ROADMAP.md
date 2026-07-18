# ROADMAP — Dự án Tính Giá Thành & Định Giá (factory_cosing)

> **Mục đích:** File này là điểm neo (Anchor) cho AI ở đầu mỗi phiên. AI đọc file này để hiểu tổng quan dự án đang ở giai đoạn nào, những gì đã hoàn tất, và những gì cần làm tiếp theo. Không cần đọc lại toàn bộ lịch sử chat.

## 🟢 Tóm tắt trạng thái hiện tại
- **Pha 1 & 2:** Xong. **Pha 3 (Engine):** Xong — **suite 370/370 test** (parity Excel).
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
- [ ] Chờ danh mục ống SCH80 chuẩn từ nhà cung cấp để cập nhật lại Seed Data.
- [ ] Kiểm tra lại toàn bộ quy trình từ khâu nhập Tồn kho -> Thay đổi định mức -> Tính giá thành -> Khóa giá -> Báo giá xem có bị khựng ở bước nào không.
- [ ] Khi có Excel v3.7 chính thức: trích lại fixture bằng cached-value để thay số vàng engine-derived (ghi chú ADR-019).

---

## 📝 Hướng dẫn cho AI bắt đầu phiên mới
1. Đọc lướt qua file `ROADMAP.md` này.
2. Nếu User giao task mới, hãy ghi chú task đó vào phần **Việc cần làm tiếp theo**.
3. Khi hoàn thành một tính năng lớn, hãy di chuyển nó lên phần **Đã hoàn thành gần đây**.
4. Giữ file này ngắn gọn, tránh viết quá chi tiết về mặt kỹ thuật (chi tiết kỹ thuật để ở các file ADR).
