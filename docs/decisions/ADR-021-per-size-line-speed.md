# ADR-021: Tốc độ chạy ống theo size (m/h) — giá thành theo giờ máy từng DN

## Ngữ cảnh
User cấp bảng "sản lượng kg/h" theo size (2026-07-14, chat):
DN20: 350 · DN25: 300 · DN32: 200 · DN40: 150 · DN50: 100 · DN65: 80 · DN80: 60 · DN100: 50.
Độ tin cậy user tự đánh giá: **DN20–40 tương đối chính xác; DN50 trở lên cần xác nhận**;
yêu cầu "hiệu chỉnh cập nhật sau" được trên app.

> **✅ USER XÁC NHẬN 14/07 (kèm ảnh bảng)**: "chính xác dữ liệu tôi đưa là 350 mét/giờ
> với ống DN20, các sản phẩm khác lần lượt 300/200/150/100/80/60/50" — cách đọc m/h
> dưới đây không còn là suy luận, đã là dữ liệu chốt.

## Phân tích đơn vị — số liệu là m/h, KHÔNG phải kg/h (đã được xác nhận)
Ba bằng chứng (script kiểm tra trong session log 14/07):
1. Hiểu literal kg/h → DN20 = 350 kg/h **vượt max máy đùn 200 kg/h** (fixture v3.8) — bất khả thi.
2. Hiểu là **m/h** → kg thành phẩm/h = m/h × đơn trọng: dải 101–215 kg/h, đơn điệu tăng
   theo size — đúng vật lý đùn (size lớn ăn kg/giờ cao hơn).
3. Trung bình đơn giản của kg/h suy ra = **140,3 kg/h ≈ đúng 140 kg/h "tốc độ thực tế"**
   đang dùng trong app; riêng DN50 (100 m/h × 1,26) = **126 kg/h = chính xác công suất
   thành phẩm/giờ của mô hình phẳng** (140 × yield 0,9). Con số 140 kg/h nhiều khả năng
   chính là trung bình của bảng này.
→ **Quyết định đọc dữ liệu: tốc độ dây chuyền theo mét/giờ (lineSpeedMPerHour).**
Còn chờ chốt: m/h là mét THÀNH PHẨM (sau loại phế) hay mét đùn thô — tạm hiểu là thành phẩm.

## Hệ quả nghiệp vụ — giá thành lệch theo size so với mô hình phẳng
Chi phí gia công đùn = 7.284.078.481 đ/năm ÷ 4.920 giờ = **1.480.504 đ/giờ máy**.
Phân bổ theo giờ máy từng size (thay vì đ/kg phẳng 11.750):

| DN | kg TP/h | Gia công đ/kg | fullCost đ/kg | Lệch vs phẳng v3.8 |
|---|---|---|---|---|
| DN20 | 101,5 | 14.586 | 111.548 | **+2,6%** |
| DN25–40 | 123–124 | ~12.000 | ~109.000 | +0,3% |
| DN50 | 126,0 | 11.750 | 108.712 | 0% (size neo) |
| DN65 | 147,2 | 10.058 | 107.020 | −1,6% |
| DN80 | 162,6 | 9.105 | 106.067 | −2,4% |
| DN100 | 215,2 | 6.880 | 103.841 | **−4,5%** |

Nghĩa là bảng giá phẳng hiện hành đang để **size nhỏ trợ giá cho size lớn**: DN100
đang bị tính đắt hơn thực ~26.000 đ/m tại giá VF. Sàn MOQ chuyên gia quy giờ chạy
bằng tốc độ thật: DN20 2.000m = 5,7h; DN40 = 13,3h; DN65 = 6,2h; DN100 = 10h —
đều cỡ nửa ca đến hơn 1 ca chạy ổn định, nhất quán với ADR-020.

## Quyết định
1. **Pha 2**: thêm `lineSpeedMPerHour` (+ cờ `speedConfirmed`) vào PipeProductSchema,
   sửa được trên màn Danh Mục Sản Phẩm (đáp ứng "hiệu chỉnh cập nhật sau").
2. **Pha 2/3**: engine thêm chế độ giá thành ống theo giờ máy
   (đ/giờ đùn × giờ/mét từng DN) — "MHR hóa" dòng Ống, song song mô hình phẳng;
   driver gốc kg (ADR-001) giữ cho công suất/CVP tổng, phân bổ CHI PHÍ GIA CÔNG
   chuyển sang giờ máy. Cần bộ số vàng mới (v3.9) tính tay độc lập + nghiệm thu
   trước khi thay bảng giá — TRONG LÚC CHỜ, bảng giá chính thức vẫn là v3.8 phẳng.
3. **Prototype Pha 1**: thêm toggle "Giá thành theo tốc độ size (thí điểm)" mặc định
   TẮT, giá bật lên phải gắn nhãn chưa nghiệm thu; tốc độ ≥DN50 gắn nhãn "cần xác nhận".
4. Công suất năm trở thành hàm của MIX sản phẩm khi dùng tốc độ theo size —
   neo chuẩn chuyển dần về 4.920 giờ máy/năm thay vì 619.920 kg (ghi nhận,
   triển khai ở Pha 2 màn Plan).

## Bổ sung 14/07 (chiều) — phân tích khả dĩ sau khi user KHẲNG ĐỊNH max 250 kg/h (ADR-022)
User xác nhận: 350 kg/h cho DN20 bất khả thi, max 250 là chắc chắn; yêu cầu dùng
hồi quy/giả lập/logic ngành đánh giá kg/h từng size để xây giá và chi phí hợp lý.

**Mọi con số khớp thành một hệ nhất quán khi đọc bảng là m/h THÔ (kg nạp máy):**
- kg/h thô = m/h × đơn trọng: 101,5 → 215,2; KHÔNG size nào vượt 250 (cao nhất 86%) ✓
- Trung bình thô 140,3 = đúng số "140 kg/h thực tế" của app ✓
- DN100 thành phẩm = 215,2 × 0,9 = **193,7 ≈ con số "190 kg/h" user từng được tư vấn** ✓
→ Chốt cách đọc: `lineSpeedMPerHour` là tốc độ ĐÙN THÔ; kg thành phẩm = × yield 0,9.

**Logic ngành — 3 vùng nút thắt & độ tin cậy:**
| Vùng | kg/h thô | Nút thắt | Đánh giá |
|---|---|---|---|
| DN20 | 101,5 (41% max) | Kéo/định hình | User xác nhận — TIN CẬY |
| DN25–50 | 123–126 (≈50% max) | Phẳng lỳ ở ~125 → nghi là TRẦN GIẢI NHIỆT của dàn làm nguội | Hợp lý về vật lý |
| DN65–100 | 147–215 (59–86% max) | Vượt trần giải nhiệt nghi vấn ở trên → chỉ khả thi nếu chạy ống lớn có nối thêm bể làm nguội | RỦI RO SỐ LIỆU — trùng vùng user tự đánh dấu "cần xác nhận" |

Giả lập chi phí gia công DN100 theo 3 kịch bản: bảng user (215) → 6.880 đ/kg;
bảo thủ 75% max (187,5) → 7.896 đ/kg; trần giải nhiệt (126) → 11.750 đ/kg (= phẳng v3.8).

**Chiến lược áp giá BẤT ĐỐI XỨNG (nguyên tắc: không bao giờ GIẢM giá trên số liệu chưa kiểm chứng):**
1. Size nhỏ DN20–40 (số tin cậy, per-size làm giá TĂNG +0,3→+2,6%): áp dụng được ngay — an toàn.
2. Size lớn DN65–100 (per-size làm giá GIẢM tới −4,5% nhưng số chưa kiểm chứng):
   GIỮ bảng phẳng v3.8 (giá cao hơn = bảo thủ) cho tới khi đo thật; phần chênh coi là
   dư địa đàm phán tiềm năng, không phải giá niêm yết mới.
3. Đo thật qua vận hành bình thường (không cần chạy thử): HMI S7-1200 (m/h),
   biến tần ACS580 (% tải motor), cân kg thành phẩm, công tơ kWh — mỗi nhóm die 1 đợt.
   Có số đo → hồi quy lại bảng tốc độ → bộ số vàng v3.9 → mới đổi giá size lớn.

## Còn chờ chốt
- Số đo thật DN50–DN100 (phương pháp ở trên; đặc biệt DN100: 215 hay ~187 hay bị trần nguội ~126).
- Cấu hình làm nguội khi chạy ống lớn (có nối thêm bể không) — quyết định trần kg/h vùng lớn.
- Tốc độ Corzan có khác BlazeMaster không (tạm dùng chung).
