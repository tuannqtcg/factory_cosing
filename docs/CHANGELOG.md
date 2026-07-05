# CHANGELOG — Costing App Kit

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
