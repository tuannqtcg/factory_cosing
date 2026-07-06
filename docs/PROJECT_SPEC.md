# PROJECT_SPEC.md — Costing App (Constitution đầy đủ)

## §1. Mục tiêu & người dùng
Engine giá thành cấu hình được cho sản xuất, khởi đầu bằng BlazeMaster (VF/TCG).
4 vai: **admin** (toàn quyền) / **pricing** (giả định, thang giá) /
**sales** (chỉ thang giá + bảng giá) / **production** (kế hoạch, công suất).

**2 tầng top-down (ADR-005, ADR-006)** — mỗi vai chỉ xem đúng tầng của mình:
- Tầng VẬN HÀNH — vai `production`: kế hoạch SX đã chốt → đối chiếu nguồn lực/
  tồn kho (T1, màn hình Plan_SX, đã có dạng đóng).
- Tầng CHIẾN LƯỢC — vai `pricing`/`admin`: mục tiêu ngoại sinh (lợi nhuận kỳ
  vọng, giá thị trường/giá thâm nhập) → biến vận hành cần đạt (T2/T3, màn hình
  Target Costing riêng, dùng inverse solver). `production` KHÔNG thấy màn hình này.

## §2. Phạm vi v1 (khớp Excel v3.4 + bổ sung xác nhận sau v3.4)
Sản lượng-công suất, giá thành kép (sổ sách/định giá), thang giá 5 bậc, CVP,
kế hoạch SX (bậc ca, khuôn, NVL, nhân công), tồn kho compound nhiều đợt, CƠ CHẾ
KHÓA BẢNG GIÁ baseline + ngưỡng (ADR-004), HOẠCH ĐỊNH HAI CHIỀU forward + inverse
solver phân tầng theo vai (ADR-005, ADR-006).

**Bổ sung ngoài Excel v3.4 (đã CHẤP NHẬN, có số liệu thật)**:
- KHẤU HAO KHUÔN THEO THỜI ĐIỂM MUA (ADR-007): `moldAssets[]` thay 1 số gộp
  tĩnh — MHR tính động theo mốc thời gian đánh giá (asOfYear), tự đổi khi mua
  thêm khuôn.
- REN KIM LOẠI MUA NGOÀI (ADR-008): dòng nguyên liệu thứ 2 cho SKU họ "Nối ren"
  (11/91 SKU hiện có khuôn), áp giá vốn kép (ADR-002) + khóa giá riêng (ADR-004
  mở rộng, ngưỡng 5% độc lập với compound), tồn kho riêng theo (renType, ptSize).
- Sản phẩm chưa có khuôn thật → tạm loại khỏi danh mục quản lý (8/91 SKU hiện
  tại), tự động hiện lại khi có `moldAsset` tương ứng.

NGOÀI phạm vi v1: routing đa công đoạn, MRP lịch tuần, multi-tenant SaaS (xem ADR-003).

## §3. Kiến trúc
- `src/engine/` pure TS: (ScenarioInput) → ScenarioOutput. Không I/O. Test parity Excel.
- `src/engine/solver.ts` (ADR-005): inverse solver chạy TRÊN forward function — không
  công thức ngược viết tay. Dùng cho tầng chiến lược (ADR-006).
- `src/schemas/` Zod duy nhất, dùng chung 2 đầu.
- Firestore: mỗi collection 1 loại doc; TÁCH doc giá bán khỏi doc giá vốn (rules không lọc field).
- Cost driver là plugin: continuous_kg | machine_hour (mở rộng: labor_hour, batch — ADR-003).

## §4. Design tokens (điền từ bộ BlazeMaster Brand Guidelines hiện có — placeholder [])
- Màu chủ đạo: [primary], [accent], nền sáng/tối; trạng thái: đỏ cảnh báo #DC2626, xanh OK #16A34A
- Font: [heading] / [body]; số liệu dùng tabular-nums
- Spacing 4px grid; bo góc 8px; bảng số căn phải, đơn vị mờ bên cạnh
- Ngôn ngữ UI: tiếng Việt; format số vi-VN; tiền tệ "đ" hậu tố

## §5. Chuẩn bảo mật nền
Default deny; phân quyền theo vai ở §1; sales không bao giờ đọc được cost;
Zod validate 2 đầu; không secret client; audit log đổi giá; xem skill security-review.

## §6. Chuẩn chất lượng
TS strict, không any lọt boundary; test parity Excel bắt buộc xanh trước merge;
mỗi PR ≤ 400 dòng diff hiệu dụng; đổi nghiệp vụ = Excel trước → fixture → code.
