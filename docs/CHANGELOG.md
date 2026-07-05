# CHANGELOG — Costing App Kit

## v1.4 (2026-07) — khấu hao khuôn theo thời gian + ren kim loại mua ngoài (CHỜ DỮ LIỆU)
KHÁC BIỆT so với kit v1.3:

| File | Thay đổi | Lý do |
|---|---|---|
| docs/decisions/ADR-007-time-phased-mold-depreciation.md | MỚI — khuôn phụ kiện tách thành `moldAsset` riêng (giá, năm mua, số năm khấu hao) thay vì 1 số gộp; MHR tính động theo `asOfYear` | User xác nhận: chuẩn bị cho khuôn mua sau (mở rộng SKU) — khấu hao lệch pha, không còn là hằng số |
| docs/decisions/ADR-008-purchased-metal-insert.md | MỚI — ren kim loại (đồng thau) cho 4 họ SKU ren là dòng nguyên liệu thứ 2, áp giá vốn kép (ADR-002) thay vì cộng thẳng `brassInsertCost` tĩnh | User xác nhận: xử lý giống hệt compound (bình quân gia quyền vs giá tái tạo) |
| docs/GLOSSARY.md | +4 thuật ngữ: moldAsset, asOfYear, purchasedMetalInsert, insertQtyPerUnit | UI tiếng Việt nhất quán |
| docs/CONTEXT_PASTE.md | +điểm 8, 9: khấu hao khuôn theo thời gian, ren kim loại mua ngoài | Đồng bộ bản nén 1 trang |

**LƯU Ý**: cả 2 ADR ở trạng thái "CHẤP NHẬN nguyên tắc — CHỜ DỮ LIỆU". Chưa đủ số
liệu thật (giá/năm mua từng khuôn; đơn giá, ngoại tệ, số lượng/SKU của ren kim
loại) để vào schema Pha 2 chính thức — xem mục "Còn treo" trong từng ADR.

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
