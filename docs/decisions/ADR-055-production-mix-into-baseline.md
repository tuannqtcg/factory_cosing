# ADR-055 — Đưa "tỷ lệ đáy" (cơ cấu sản lượng 2 compound) vào Thiết Lập (baseline)

- **Ngày**: 2026-07-22
- **Trạng thái**: Chấp nhận (user — "làm cả 2")
- **Kế thừa**: ADR-012 (multi-material), ADR-042 (CEO chia công suất 2 thương hiệu), ADR-049 (Thiết Lập), ADR-052 (P&L trên Dashboard)

## Bối cảnh
Doanh thu baseline trước giờ định giá TOÀN BỘ sản lượng dòng theo **1 material
tham chiếu** (BlazeMaster) — `revenueVf = pipeKg × refLadder.targetPrice + …`
(xem ghi chú ADR-012 "xấp xỉ CÓ CHỦ ĐÍCH, chưa có dữ liệu mix sản lượng"). Việc
**chia đáy** giữa 2 compound chung máy (BlazeMaster/Corzan) CHỈ tồn tại như 1
what-if ở Trợ Lý CEO (`allocationPipePrimaryPct`), KHÔNG nằm trong luồng nhập 1
chiều ⇒ Tổng Quan không phản ánh được cơ cấu sản lượng thực.

User: "doanh thu được tạo bởi cả 2 loại sản phẩm, có bước chọn phân bổ tỷ lệ đáy";
chọn phương án "trong mỗi dòng chia % giữa 2 compound chung máy".

## Quyết định
1. **Thêm field baseline** vào `ScenarioInputSchema` (contract scenario.md, cần ADR):
   - `productionMixPipePrimaryPct` (0–100, default **100**)
   - `productionMixFittingPrimaryPct` (0–100, default **100**)
   % dành cho compound CHÍNH (material tham chiếu) của dòng; phần còn lại cho
   material thứ 2 của dòng. Mặc định 100 ⇒ phần phụ 0kg ⇒ **parity tuyệt đối**
   (doc cũ không field → 100).
2. **Doanh thu/EBIT/biến phí** ở `dashboard-support.ts` chuyển sang `splitBy`:
   `Σ (phần_kg × chỉ_số_thang_giá_của_loại_đó)` cho chính + phụ. Material phụ =
   material đầu tiên (khác tham chiếu) có ≥1 SP của dòng dùng; vắng ⇒ 100% chính.
3. **Lộ per-line VF revenue** trong `InvestmentKpis`: `expectedRevenuePipeVf`,
   `expectedRevenueFittingVf` → Dashboard P&L đọc TRỰC TIẾP (khớp tuyệt đối
   `expectedRevenueVf`, không tự nhân lại theo ref ladder như trước).
4. **UI**: card "Tỷ lệ đáy · Cơ cấu sản lượng" ở Thiết Lập ⑦ (Chính sách giá) —
   slider + ô % mỗi dòng, hiện kg chính/phụ trực tiếp. Dòng chỉ 1 compound → báo
   "chưa cần chia đáy".
5. **Trợ Lý CEO GHI ĐÈ tạm**: `allocation*PrimaryPct` thiếu trong request ⇒ fallback
   `baseline.productionMix*PrimaryPct` (thay vì cứng 100). CEO = lớp what-if trên
   cùng dữ liệu baseline (đúng ADR-026 tinh thần 1 view).

## Kiểm chứng
- Default 100 ⇒ 382 test vàng xanh (chỉ nới `dashboard-kpis` multi-material sang
  `toBeCloseTo` do lộ per-line revenue làm hiện nhiễu 1 ULP — bất biến "thêm
  Corzan không đổi KPI" vẫn giữ).
- 4 test mới: mix 50/50 = trung bình cộng 100%/0% (tuyến tính theo kg); đổi tỷ lệ
  đổi doanh thu Ống; chỉnh đáy Ống không đụng Phụ kiện; tổng = Ống + Phụ kiện. 386 xanh.

## Còn treo
- Mix theo NHIỀU hơn 2 compound/dòng chưa hỗ trợ (hiện chính + phụ). Mở rộng khi
  có ≥3 compound chung 1 dòng.
