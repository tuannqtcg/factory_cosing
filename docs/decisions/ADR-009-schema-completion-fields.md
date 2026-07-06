# ADR-009: Ghi nhận retroactive các field bổ sung vào schema đã đóng băng (Pha 3)

Ngày: 2026-07-06 | Trạng thái: CHẤP NHẬN (retroactive — viết sau khi code review PR #1 phát hiện thiếu ADR)

## Bối cảnh
AGENTS.md luật bất biến #5: "Mỗi quyết định kiến trúc → 1 file ADR trong
`docs/decisions/`. Không quyết ngầm." Trong lúc code Pha 3 (M2, M3, M9), engine
liên tục phát hiện các trường dữ liệu bị THIẾU SÓT trong schema đã đóng băng ở
Pha 2 (`docs/contracts/*.md`, `src/schemas/*.ts`) — công thức trong
`BUSINESS_MODEL.md` (đã có TỪ TRƯỚC Pha 2) cần các trường này, nhưng người viết
schema (cùng agent, cùng phiên) đã bỏ sót khi dịch sang Zod. Mỗi lần phát hiện,
quyết định tại chỗ là "đây là sửa lỗi thiếu sót, không phải quyết định kiến
trúc mới" và chỉ ghi chú trong code comment — KHÔNG viết ADR riêng.

Code review PR #1 (2026-07-06) chỉ ra đúng: dù đúng là các field này không đổi
NGHIỆP VỤ (công thức/ý nghĩa kinh doanh giữ nguyên, chỉ là thiếu chỗ chứa dữ
liệu đầu vào), việc SỬA CẤU TRÚC 1 schema đã đóng băng — bất kể lý do — vẫn là
đúng loại thay đổi mà luật #5 yêu cầu có ADR, để có dấu vết cho người đọc sau
này (không phải đoán qua rải rác code comment ở nhiều file).

## Quyết định
Ghi nhận retroactive TOÀN BỘ các field đã bổ sung vào schema Pha 2 trong lúc
code Pha 3, xác nhận đây KHÔNG phải thay đổi kiến trúc/nghiệp vụ (không đổi ý
nghĩa hay công thức nào đã chốt ở ADR-001..008), chỉ là hoàn thiện dữ liệu đầu
vào còn thiếu:

| # | File | Field bổ sung | Lý do thiếu | Phát hiện ở |
|---|---|---|---|---|
| 1 | `ContinuousKgResourceSchema` (resource.ts) | `packagingCostPerKg`, `avgSalaryMonthly`, `monthsSalaryPerYear`, `electricityKw`, `electricityPricePerKwh`, `waterM3PerHour`, `waterPricePerM3` | Công thức chi phí SX Ống (§2.2) luôn cần lương/điện/nước/bao bì — sót khi dịch ADR-001 sang schema | M2 (`pipe.ts`) |
| 2 | `MachineHourResourceSchema` (resource.ts) | Cùng nhóm field trên (bản Phụ kiện) + `avgProductivityKgPerMachineHour`, `depreciationYears` (khấu hao MÁY ép, tách khỏi `MoldAsset.usefulLifeYears` là khấu hao KHUÔN) | Công thức MHR (§3.3) cần đủ các field này | M3 (`fitting.ts`) |
| 3 | `PlanInputSchema` (scenario.ts) | `periodMonths` (hệ số kỳ), `currentLaborHeadcount` (nhân công hiện có) | Công thức Plan_SX (§6.2, §6.5) cần 2 dữ liệu này, không suy được từ `period` (chuỗi tự do) | M9 (`plan.ts`) |

Từ ADR này trở đi: **mọi lần sửa cấu trúc field ở `src/schemas/*.ts` hoặc
`docs/contracts/*.md`, dù được đánh giá là "sửa lỗi thiếu sót", PHẢI thêm 1
dòng vào bảng trên (hoặc 1 ADR mới nếu quy mô lớn hơn) TRƯỚC KHI commit** — thay
vì chỉ ghi code comment tại chỗ như 3 lần đầu. Không tạo tiền lệ "tự phán là
không kiến trúc nên bỏ qua ADR".

## Hệ quả
- Không đổi code/schema nào thêm — ADR này thuần ghi nhận lại các thay đổi đã
  xảy ra, đóng khoảng trống quy trình mà code review PR #1 phát hiện.
- `docs/contracts/resource.md` và `docs/contracts/scenario.md` đã có comment
  "Sửa 2026-07-06 (Pha 3 M...)" tại đúng vị trí field — nay trỏ thêm về ADR
  này thay vì đứng riêng lẻ.
