# ADR-048 — Chế độ 'meters': m/giờ per-size làm NGHẼN tổng công suất (tổng sản lượng đổi)

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user phiên 2026-07-20 — "trong danh mục đã nhập m/giờ thì theo đơn trọng mà tính lên sản lượng")
- **Kế thừa / sửa**: ADR-046 (m/giờ per-size), ADR-047 (pipeCostMethod kg|meters)

## Bối cảnh
Sau ADR-047, công tắc kg↔m/giờ chỉ **chia lại chi phí máy GIỮA các size** nhưng
**bảo toàn TỔNG** (revenue = (1+markup)×tổng giá thành, tổng không đổi) → Trợ Lý
CEO (tổng hợp mức toàn nhà máy) cho **doanh thu/sản lượng y hệt** ở cả 2 chế độ,
khác biệt chỉ hiện ở bảng giá theo DN. User coi đây là bất cập: 1 máy đùn, size
lớn chạy chậm (m/giờ thấp) thì tổng sản lượng/năm PHẢI thấp hơn — "máy nghẽn".

Mô hình cũ dùng 1 tốc độ pha trộn cố định `actualCapacityKgPerHour` cho công suất
→ tổng kg/năm độc lập với size đang chạy → không diễn tả được nghẽn.

## Quyết định
Ở chế độ `pipeCostMethod === 'meters'`, tính TỔNG công suất dòng từ tốc độ
per-size thay vì 1 tốc độ pha trộn:

1. Tốc độ THÀNH PHẨM mỗi size: `kg/giờ_i = capacityMetersPerHour_i × unitWeightKgPerM_i`
   (đúng ý user: đã nhập m/giờ → nhân đơn trọng ra kg/giờ).
2. **Giả định cơ cấu**: mỗi size chia ĐỀU thời gian máy → effective kg/giờ thành
   phẩm = **trung bình cộng** `kg/giờ_i` trên các size. Size CHƯA nhập m/giờ dùng
   tốc độ pha trộn cũ (`actualCapacityKgPerHour × yield`).
3. `normalCapacityKgYear = effectiveKgPerHour × normalOperatingHours`. Chỉ thay
   sản lượng VẬN HÀNH; công suất thiết kế 3 ca (`designCapacity3ShiftKgYear`) giữ
   theo tốc độ danh nghĩa.
4. Vì công suất là MỘT con số nhất quán, mọi hạ nguồn (giá vốn/kg, phân bổ chi phí
   chung pipe↔fitting, CVP, thang giá, Dashboard KPI, Trợ Lý CEO) tự tính lại ở
   điểm vận hành mới. Máy nghẽn ⇒ tổng kg ↓ ⇒ doanh thu/LN đổi.

## Parity-safe (suite 379/379 giữ xanh)
- `pipeCostMethod` mặc định `'kg'` → không đụng nhánh này → parity Excel v3.4 nguyên vẹn.
- `'meters'` mà KHÔNG size nào nhập m/giờ → không override (trung bình của toàn
  fallback = chính fallback) → trùng khít 'kg' tuyệt đối (test ADR-047 case 2 giữ).
- `'meters'` CÓ nhập m/giờ → verify: baseline bơm DN≤25=420 m/h, còn lại 60 m/h →
  sản lượng ống **−27,1%** (619.920→452.173 kg), doanh thu VF **−21,3%** (95,6→75,3 tỷ).

## Còn treo
- Giả định "chia đều thời gian máy" là xấp xỉ v1. Nâng cấp tương lai: nhập **cơ cấu
  sản lượng theo size (%)** hoặc lấy từ nhu cầu/đơn hàng thực → thay trung bình đều
  bằng trung bình có trọng số (công thức tổng quát `K = H·yield / Σ(s_i/kg-giờ_i)`).
- Cân nhắc áp cùng cơ chế cho phụ kiện (hiện đã machine-hour per-SKU).
