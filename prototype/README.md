# Prototype — Pha 1 (mockup, chưa backend)

## `ceo-planner.html` — Trợ Lý CEO (2026-07-15, CHỜ DUYỆT UI)
Màn hình 1 trang cho vai admin/pricing (tầng chiến lược ADR-006): nhập giá
compound X + margin mong muốn → giá bán đề xuất, vị trí trên thang giá 5 bậc
(sàn đàm phán), hiệu quả cả năm khi chạy tối đa 3 ca × 41 đợt, kèm nút
🤖 AI tư vấn (MOCK rule-based — bản thật là Cloud Function gọi Claude API,
cần ADR ở Pha 2). Mở trực tiếp bằng trình duyệt, không cần build. Toàn bộ số
mặc định khớp `tests/fixtures/` (đã kiểm chứng bằng script: 5 bậc ống + phụ
kiện, EBIT 16,37 tỷ, payback 0,816 năm, 6 bậc MHR — khớp tuyệt đối).
Brief: `docs/briefs/BRIEF-2026-07-15-ceo-planner.md`.

`blazemaster-costing-app.dc.html` — mở trực tiếp bằng trình duyệt (không cần build/server).
Toàn bộ state = `useState`-kiểu thuần trong file, KHÔNG gọi API/Firebase/localStorage,
đúng luật skill `prototype`.

## Vai trò & khung nhìn (ADR-006)
Sidebar có bộ chuyển "**Xem Như Vai**" — 4 vai đúng PROJECT_SPEC §1:

| Vai | Tab thấy được | Ghi chú |
|---|---|---|
| Quản Lý — Định Giá (`pricing`, mặc định khi mở) | Tổng Quan (đầy đủ), Bảng Giá, Tồn Kho, Tham Số, Ống CPVC, Phụ Kiện | Tầng chiến lược ADR-006 — thấy cả top-down + cơ cấu chi phí |
| Bán Hàng (`sales`) | Tổng Quan (CHỈ mục I. Thang giá), Bảng Giá | Không thấy công suất/top-down/đầu tư — đúng luật security-review "sales không đọc được cost" |
| Sản Xuất (`production`) | Kế Hoạch SX | Tầng vận hành ADR-006 — chỉ đối chiếu kế hoạch vs nguồn lực, không thấy giá/chi phí |
| Toàn Quyền (`admin`) | Tất cả 8 tab kể cả Cấu Hình Nhà Máy | Không đổi so với bản gốc |

Đây là phân quyền MOCK (chỉ ẩn/hiện UI phía client) — chưa phải Firestore Security
Rules thật. Khi sang Pha 2, field/doc-level tách biệt phải làm lại đúng chuẩn
security-review (rules không lọc field, phải tách doc).

## Đã sửa trong phiên này (so với bản upload gốc)
Khi thêm khung nhìn theo vai, đối chiếu số liệu với `tests/fixtures/dashboard.json`
phát hiện 2 lỗi công thức thật ở Dashboard (không liên quan tới việc thêm vai) —
đã sửa, số khớp lại đúng 100.663 / 104.298 / 106.205 / 110.604 / 132.756 (ống) và
125.673 / 130.518 / 153.435 / 160.553 / 214.809 (phụ kiện):
1. **Bậc 2 (Hòa vốn tiền mặt)**: bản gốc cộng nhầm toàn bộ chi phí chung phân bổ
   (gồm cả phần khấu hao Lab/UL) vào chi phí tiền mặt — sửa lại chỉ cộng phần
   THỰC LÀ TIỀN MẶT (tuân thủ + thuê đất), khớp nguyên tắc "không gồm khấu hao".
2. **Bậc 4 (Hòa vốn toàn DN)**: bản gốc chia thẳng (chi phí ngoài SX) cho sản
   lượng riêng từng dòng — sai nặng ở Phụ Kiện (lệch ~31.000đ/kg vì sản lượng PK
   nhỏ hơn ống nhiều lần). Sửa lại phân bổ theo TỶ TRỌNG DOANH THU tại giá VF
   giữa 2 dòng (đúng công thức Dashboard gốc — xem `docs/BUSINESS_MODEL.md` §4).

## Còn treo — biết nhưng CHƯA sửa trong phiên này
- Tab **Tồn Kho Compound**: dòng "Tồn đầu kỳ 80.000kg @2,60 USD" là số MINH HỌA để
  demo lãi giữ kho cho sinh động, KHÔNG lấy từ Excel gốc (Excel chỉ có 5 "Đợt",
  không có khái niệm tồn đầu kỳ). Cần thay bằng số thật hoặc ghi chú rõ "giả định
  minh họa" ngay trên UI trước khi trình duyệt chính thức.
- Panel "III. Phân Tích Ngược (Top-down)" ở Dashboard dùng công thức đại số suy
  ngược viết tay cho ỐNG (hợp lệ vì quan hệ compound↔giá thành ống là tuyến tính
  tuyệt đối) — nhưng đây CHÍNH LÀ pattern ADR-005 cấm ở engine thật (Pha 3). Ở Pha 1
  được phép nhúng công thức thật để demo (skill `prototype`), nhưng khi sang Pha 3
  PHẢI thay bằng `src/engine/solver.ts` (bisection), và KHÔNG được nhân bản kiểu
  đại số này sang Phụ Kiện (MHR nằm cả tử lẫn mẫu — không còn tuyến tính).
- Panel top-down hiện chỉ có cho Ống, chưa có cho Phụ Kiện.
