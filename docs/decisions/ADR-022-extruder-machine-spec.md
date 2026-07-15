# ADR-022: Thông số máy đùn ống chính thức — max 250 kg/h (sửa fixture 200)

## Ngữ cảnh
User cấp thông số kỹ thuật chính thức của máy đùn ống (2026-07-14, chat):

| Hạng mục | Thông số |
|---|---|
| Motor chính | 45 kW, biến tần ABB ACS580 |
| Trục vít | Φ 60/125 mm (đùn đôi côn) |
| Điều khiển | PLC Siemens S7-1200, HMI 12,1" |
| Điện nguồn | 380V / 3 pha / 50Hz |
| **Công suất tối đa** | **250 kg/h ống CPVC** |

## Đối chiếu & quyết định
1. **`extruderMaxCapacityKgPerHour`: 200 → 250** trong `tests/fixtures/pipe.json`.
   Con số 200 cũ không có nguồn spec; 250 là danh định máy — và cũng chính là con số
   "tốc độ đùn tối đa 250 kg/h" trong SOP nháp của user (nay rõ nguồn gốc: đó là
   MAX danh định, không phải tốc độ vận hành — SOP không được neo giá vào nó, ADR-019).
   Field này thuần hiển thị/tham chiếu (engine tính bằng `actualCapacityKgPerHour`
   = 140) → không đổi số vàng nào, 328 test giữ nguyên xanh.
2. **Củng cố ADR-021**: bảng tốc độ theo size đọc là m/h cho kg/h suy ra 101–215,
   tất cả ≤ 250 max ✓ (DN100 = 215 kg/h = 86% max — còn headroom hợp lý);
   đọc literal kg/h thì DN20 = 350 vẫn vượt cả max danh định 250 — loại hẳn.
3. **Điểm cần kiểm chứng (chưa sửa)**: fixture đang tính điện dòng Ống
   `electricityKw: 120` (× 2.120 đ/kWh × 4.920 h ≈ 1,25 tỷ/năm). Motor chính chỉ
   45 kW; 120 kW hợp lý nếu là TỔNG lắp đặt cả line (motor + vành nhiệt + hút chân
   không + kéo + cắt + chiller), nhưng tiêu thụ TRUNG BÌNH thường 50–70% lắp đặt.
   Nếu đo công tơ thật thấp hơn → giá thành/kg đang bị tính CAO hơn thực ở mọi size.
   → Việc cho xưởng: đo kWh thực tế 1 kỳ chạy 96–120h, đối chiếu, nếu lệch thì ADR mới + v3.9.

## Hệ quả
- Màn Cấu Hình hiển thị đúng "Công suất tối đa máy đùn: 250 kg/giờ".
- Không ảnh hưởng giá thành/giá bán (max không tham gia công thức nào).
