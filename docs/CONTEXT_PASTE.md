# CONTEXT PASTE — Costing App (dán vào đầu phiên Claude Design / chat mới)

## TRẠNG THÁI HIỆN TẠI (cập nhật mỗi khi đổi pha hoặc chốt ADR — xem chi tiết ở
## docs/sessions/SESSION_<ngày mới nhất>.md, đây chỉ là bản tóm tắt để orient nhanh)
- **Pha: 3 (Code) — ĐANG LÀM, chia milestone nhỏ**. Pha 1 (Prototype) đã được
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
  doanh thu VF, không theo kg). `npm test` 162/162 xanh. **M9 tiếp theo**:
  Plan_SX (T1, dạng đóng, KHÔNG có số vàng Excel — sheet gốc là template).
- ADR đã CHẤP NHẬN: 001, 002, 003, 004, 005, 006 (đầy đủ), **007 và 008 (đầy đủ dữ
  liệu cho phạm vi hiện có — xem chi tiết bên dưới điểm 8, 9, 10)**.
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
4. Thang giá 5 bậc (ống, đ/kg): sàn biến phí 100.663 / hòa vốn tiền mặt 104.298 /
   giá thành đầy đủ 106.205 / hòa vốn toàn DN 110.604 / giá mục tiêu 132.756.
   Thẩm quyền giảm giá phân tầng theo bậc; bậc 1 không ai được thủng.
5. Số vàng để kiểm tra: MHR = 1.344.176 đ/giờ máy (1 ca × 60%); BE@3,50 = 121.012;
   BE@2,80 = 98.958; 8 giá ống + 91 SKU trong tests/fixtures/prices.json.
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
