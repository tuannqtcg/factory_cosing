# ADR-052 — Dời P&L lên Tổng Quan + deep-link "xem chi tiết" về Thiết Lập

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user)
- **Kế thừa**: ADR-049 (Thiết Lập Dữ Liệu), ADR-026 (một view CEO)

## Bối cảnh
Tab "Báo cáo lãi/lỗ" nằm cuối màn Thiết Lập bị **trùng vai trò** với Tổng Quan (Dashboard) —
cả hai đều là "xem tổng hợp sau khi nhập", cùng nguồn `calculateDashboardKpis`. User yêu cầu:
dời P&L lên Dashboard, Thiết Lập thành thuần nhập; thêm nút "Thiết lập" + "xem chi tiết"
deep-link về đúng mục để xem/sửa.

## Quyết định
1. **Bảng P&L (kết quả kinh doanh)** đưa vào tab "overview" của Dashboard, dùng ĐÚNG
   `kpis.investment` như các thẻ trên cùng màn (doanh thu = expectedRevenueVf, EBIT =
   ebitAtNormalCapacityVfPrice) → không lệch số. Kèm breakdown doanh thu Ống/PK (từ ladder).
   Bỏ slider mix (what-if mix đã có ở Trợ Lý CEO) để 1 màn chỉ 1 con số doanh thu.
2. **Nút "⚙ Thiết lập dữ liệu →"** ở header P&L → `onNavigate('data-setup')`.
3. **"xem chi tiết →"** mỗi dòng P&L → `onNavigate('data-setup:<mục>')`:
   Doanh thu→pricing (⑦) · Giá vốn→conv (②) · Chi phí ngoài SX→oh (③).
4. **DataSetupScreen** nhận `initialSection` (từ `tabSub` — nav `activeTab.split(':')` sẵn có,
   như 'pricing:vf'); AppShell truyền `key={activeTab}` + `initialSection={tabSub}` → deep-link
   mở thẳng mục. Gỡ tab "Báo cáo lãi/lỗ" khỏi Thiết Lập → Thiết Lập = thuần nhập (1 chiều).

## Kiểm chứng
- Doanh thu Ống 84,24 tỷ + PK 11,36 tỷ = 95.600.020.628 = expectedRevenueVf (lệch 0);
  LN sau thuế 13,39 tỷ. typecheck + 382 test + build xanh.

## Còn treo
- SectionId còn literal 'pnl' chết (không lối vào) — vô hại, dọn sau nếu cần.
