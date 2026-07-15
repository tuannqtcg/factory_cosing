# ADR-023: Phân tầng tham số & quản trị kịch bản — triết lý định giá của user (nhà đầu tư)

## Ngữ cảnh
User (nhà đầu tư/bán hàng) chốt triết lý sử dụng app (2026-07-14, chat — nguyên văn ý):
"Cái gì cố định thì là cố định (công suất tối đa, 1 ca 8h); còn lại hiệu suất hay mọi
thứ chỉ là con số tương đối; giá NVL thay đổi, giá điện/nước không thay đổi nhiều.
App luôn phải hiệu chỉnh được thông số. Khi đồng ý một phương án/kịch bản thì phiếu
báo giá ra một bản riêng, để so sánh các phương án. Mục tiêu: xây giá bán dựa trên
hiệu suất cơ sở. Câu hỏi thường trực: giá nguyên liệu a đồng thì giá bán bao nhiêu?
Kịch bản xấu / trung bình / khả quan là gì? Giá đối thủ/thị trường bàn sau — quan
trọng là biết chi phí sản xuất và điểm hòa vốn để xây giá bán an toàn."

## Quyết định 1 — Phân tầng tham số (mọi schema/UI từ nay theo taxonomy này)
| Tầng | Tính chất | Ví dụ | Hành vi UI |
|---|---|---|---|
| T1 BẤT BIẾN | Spec vật lý, chỉ đổi khi thay máy | Max 250 kg/h (ADR-022), 8h/ca, 3 ca/ngày, Φ trục vít | Khóa (locked), chỉ admin sửa, hiếm |
| T2 BÁN CỐ ĐỊNH | Đổi chậm (quý/năm) | Đơn giá điện/nước, lương, khấu hao, nhóm die (ADR-020) | Sửa được, có audit log |
| T3 VẬN HÀNH TƯƠNG ĐỐI | Phải đo, hiệu chỉnh liên tục | Tốc độ theo size (ADR-021), yield, hệ số huy động, phế setup | Sửa được + cờ "đã xác nhận/chưa" hiển thị theo giá trị |
| T4 THỊ TRƯỜNG | Biến động thường xuyên | Giá hạt USD, tỷ giá | Khóa giá ADR-004 + what-if là mặc định |

Nguyên tắc: **app không bao giờ hard-code T2-T4**; mọi số T3 chưa xác nhận phải
tự khai trên UI (như prototype đang làm với "(*)" và "CẦN XÁC NHẬN").

## Quyết định 2 — Vòng đời kịch bản (Pha 2 thiết kế schema theo đây)
1. **Nháp (what-if)**: chỉnh tham số tự do trên sidebar (layout finapp đã duyệt),
   KHÔNG đụng dữ liệu chính thức; giá hiện ra gắn nhãn "không dùng báo khách".
2. **Phương án (được duyệt)**: nháp được đặt tên + duyệt → ĐÓNG BĂNG snapshot
   toàn bộ tham số → sinh **phiếu báo giá riêng** (giá VF + ghi chú tự sinh +
   điểm hòa vốn) gắn với phương án đó.
3. **So sánh**: màn đặt N phương án cạnh nhau — giá VF/SKU, sàn biến phí,
   điểm hòa vốn, margin — để hệ ra quyết định chọn.
4. **Bộ 3 kịch bản chuẩn finapp** (preset, sửa được): XẤU / TRUNG BÌNH / KHẢ QUAN —
   khác nhau ở T3+T4 (giá NVL cao–thấp, tốc độ bảo thủ–lạc quan như 3 kịch bản
   DN100 trong ADR-021, mix size). Trả lời trực tiếp câu "kịch bản xấu là gì".
5. Câu "giá nguyên liệu a đồng → giá bán?" = forward `calculateScenario` với giá a
   trên kịch bản nháp (đã có trong prototype); mọi phiếu PHẢI hiện điểm hòa vốn
   (thang 5 bậc) bên cạnh giá đề xuất — "giá an toàn" = giá ≥ bậc hòa vốn đã chọn.

Ghi chú kỹ thuật: Firestore đã có collection `scenarios/{id}` — Pha 2 mở rộng
metadata (`status: draft|approved`, `label`, `baseScenarioId`, `approvedAt/by`)
thay vì phát minh cấu trúc mới. Đối thủ/giá thị trường: NGOÀI PHẠM VI hiện tại
(user chốt "bàn sau") — chỉ chừa chỗ trong so sánh phương án.

## Trạng thái nghiệp vụ tổng (để phiên mới nắm nhanh)
- v3.8 nghiệm thu, 328/328 xanh (ADR-019); giá tiêu chuẩn = giá VF.
- ADR-020 (die/MOQ 2 tầng), ADR-021 (tốc độ m/h theo size — user đã XÁC NHẬN đơn vị;
  DN65-100 chờ đo), ADR-022 (max 250, spec máy; nghi vấn điện 120kW vs motor 45kW).
- Chiến lược giá bất đối xứng đang hiệu lực: size nhỏ áp per-size được, size lớn
  giữ bảng phẳng v3.8 khi báo khách cho tới khi đo thật.
- Prototype Pha 1 (artifact "Phiếu Báo Giá Tiêu Chuẩn VF") đã duyệt hướng layout
  finapp: sidebar input trái, kết quả sống phải, what-if mặc định.

## Việc kế tiếp (Pha 2 — một lần đóng băng schema cho cả cụm)
`lineSpeedMPerHour`+`speedConfirmed`, `dieGroup`, `setupCost`, `moq` (2 tầng),
metadata vòng đời kịch bản (mục Quyết định 2), preset 3 kịch bản chuẩn.
