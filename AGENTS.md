# AGENTS.md — Costing App (VF/TCG Manufacturing Costing & Pricing)

> File này là LUẬT CHUNG cho mọi AI agent (Claude, Gemini, Copilot, Cursor).
> Đọc file này TRƯỚC KHI làm bất cứ việc gì. Chi tiết đầy đủ: `docs/PROJECT_SPEC.md`.

## Dự án là gì
Web app tính giá thành sản xuất & định giá bán cho nhà máy CPVC (BlazeMaster),
chuyển thể từ Excel model `BlazeMaster_Model_v3_4.xlsx` (nguồn chân lý về nghiệp vụ).
Hai cost driver: ống theo **kg** (đùn liên tục), phụ kiện theo **giờ máy / MHR** (ép phun).

## Stack đã chốt — KHÔNG tự ý đổi
- Frontend: React 18 + TypeScript strict + Tailwind + Recharts
- Validation: Zod (schema-first, dùng chung client/server)
- Backend/Auth/DB: Firebase (Firestore + Auth + Security Rules)
- Engine tính toán: pure functions TypeScript, KHÔNG side-effect, KHÔNG gọi network

## Quy trình 4 pha — có cổng duyệt, không nhảy cóc
0. Design brief (1 trang) → 1. Prototype (artifact, mock data, chưa backend)
→ ⛔ duyệt UI → 2. Flow + Zod schema + API contract → ⛔ đóng băng schema
→ 3. Code (frontend đúng prototype, backend đúng contract — KHÔNG phát minh mới)
→ 4. Test parity với Excel fixture + security checklist → merge.

Muốn đổi thiết kế ở pha 3? DỪNG. Quay lại pha 1/2, ghi ADR mới.

## Luật bất biến
1. Mọi số liệu engine phải khớp Excel fixture (`tests/fixtures/` — 372 assertion + 5 kịch bản khóa giá từ v3.4).
2. Mọi input qua Zod ở CẢ client và server. Không tin dữ liệu từ client.
3. Không secret/API key trong code client. Firebase rules theo vai (xem PROJECT_SPEC §5).
4. UI tiếng Việt, số theo định dạng VN (1.234.567 đ), thuật ngữ theo `docs/GLOSSARY.md`.
5. Mỗi quyết định kiến trúc → 1 file ADR trong `docs/decisions/`. Không quyết ngầm.
6. Cuối phiên làm việc → ghi `docs/sessions/SESSION_<date>.md` theo template.

## Cấu trúc thư mục nguồn
```
src/engine/    # pure functions: costing, pricing ladder, CVP, capacity
src/schemas/   # Zod: Scenario, Resource, CostPool, Product, PricingChain
src/features/  # UI theo màn hình (dashboard, pricing, plan, inventory)
tests/fixtures/# số liệu vàng xuất từ Excel v3.3
```
