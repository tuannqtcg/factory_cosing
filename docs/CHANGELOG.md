# CHANGELOG — Costing App Kit

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
