# ADR-006: Phân tầng đối tượng top-down — vận hành (SX) vs chiến lược (CEO/giá)
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN

## Bối cảnh
ADR-005 đã tách top-down thành 3 câu hỏi (T1/T2/T3) nhưng chưa gắn với AI xem,
xem khi nào, và trên màn hình nào. Quan sát: T1 và T2/T3 khác nhau không chỉ về
công thức mà về **nguồn gốc mục tiêu** và **người ra quyết định**:
- T1 (kế hoạch vs nguồn lực): mục tiêu là **kế hoạch bán đã chốt nội bộ** (đã
  biết trước, do `production` nhập) — câu hỏi thuần vận hành "có làm được không".
- T2 (lợi nhuận mục tiêu) / T3 (giá thị trường, kể cả **giá thâm nhập** — giá bị
  ép từ đối thủ/đấu thầu chứ không phải công ty tự đặt): mục tiêu đến từ **bên
  ngoài hoặc từ ban điều hành**, do `pricing`/`admin` nhập — câu hỏi chiến lược
  "phải vận hành thế nào để đạt mục tiêu đó, có đáng làm không".
Gộp chung 2 loại top-down này vào 1 màn hình "what-if" sẽ làm sai đối tượng xem
(`production` không nên thấy bài toán lợi nhuận mục tiêu/giá thâm nhập — đây là
dữ liệu chiến lược, cùng lý do `sales` không thấy chi phí gốc ở PROJECT_SPEC §5).

## Quyết định
Hai tầng top-down, tách biệt về vai, tần suất, và màn hình:

| | Tầng VẬN HÀNH | Tầng CHIẾN LƯỢC |
|---|---|---|
| Câu hỏi | T1: kế hoạch có khả thi với nguồn lực hiện có? | T2: cần bán bao nhiêu/mấy ca để đạt lợi nhuận X? T3: giá thị trường/giá thâm nhập Y đòi hỏi biến vận hành nào? |
| Input | Kế hoạch SX đã chốt (số lượng/kỳ) | Mục tiêu ngoại sinh: lợi nhuận kỳ vọng, hoặc giá bị ép bởi thị trường/đối thủ |
| Vai xem | `production` | `pricing` / `admin` |
| Công cụ | Plan_SX — forward, dạng đóng (đã có) | Inverse solver (ADR-005, skill `inverse-solver`) |
| Tần suất | Theo kỳ kế hoạch (tháng/quý) | Khi ra quyết định giá/đầu tư — không cố định theo kỳ |
| Màn hình | `src/features/plan` | Màn hình riêng (tạm gọi "Target Costing"), KHÔNG chung với Plan_SX |

"Giá thâm nhập" (penetration price) là MỘT trường hợp của T3 — khác T3 thông
thường ở chỗ mục tiêu đến từ áp lực thị trường/đấu thầu thay vì công ty tự đặt,
nhưng dùng chung cơ chế solver, chung màn hình tầng chiến lược.

## Hệ quả
1. `PROJECT_SPEC.md §1` cập nhật bảng vai để ghi rõ tầng top-down mỗi vai được xem.
2. `docs/GLOSSARY.md` thêm thuật ngữ: `operationalTopDown`, `strategicTopDown`,
   `targetProfit`, `penetrationPrice`.
3. Pha 1 (prototype): dựng **2 màn hình riêng**, không gộp — mock theo đúng vai.
4. Pha 2 (schema): phân quyền đọc màn hình Target Costing/giá thâm nhập giới hạn
   `pricing`/`admin`, tách khỏi phân quyền Plan_SX của `production` — cùng
   nguyên tắc field-level tách doc như security-review đã yêu cầu cho giá vốn.
