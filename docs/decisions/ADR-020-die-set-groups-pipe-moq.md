# ADR-020: Nhóm die set ống, hao phí khởi động theo size, và MOQ chạy ống 2 tầng

## Ngữ cảnh
User (nhà đầu tư/bán hàng) cung cấp tri thức vận hành thực tế từ xưởng + chuyên gia
(2026-07-14, chat) — KHÔNG có trong Excel v3.4/v3.7, cùng loại "ngoài Excel" như ADR-007/008:

1. **3 ca liên tục là chế độ chuẩn** của máy đùn: máy cần đủ nhiệt và lực đùn;
   để nguội rồi làm nóng lại gây hao phí nguyên liệu lớn. (Khớp `normalShifts: 3`
   trong fixture v3.8 — xác nhận thêm từ thực tế.)
2. **3 nhóm die set**: DN20–DN40 (nhỏ), DN40–DN80 (trung), DN100 (lớn).
   Mỗi lần đổi die set thường chỉ làm trong MỘT đợt → đơn hàng trải size từ
   DN20 đến DN100 phải chia tối thiểu 3 ngày/đợt chạy.
   (Ranh giới DN40/DN50 user ghi chồng lấn "dn20 đến DN40, d40 đến d80" —
   tạm xếp DN40 vào nhóm nhỏ, DN50–80 nhóm trung; cần user chốt.)
3. **Hao phí khởi động phụ thuộc size**: size nhỏ hao ít, size lớn hao nhiều.
   Số đo thật: dừng qua đêm + khởi động lại với D80/DN100 ≈ **100 kg phế**.
   (~10 triệu đ nguyên liệu mỗi lần nguội máy — lý do kinh tế của nguyên tắc #1.)
4. **Sàn MOQ chuyên gia**: ống nhỏ tối thiểu **2.000 m**/lần chạy; ống lớn
   DN65–DN100 tối thiểu **500 m**. (DN50 chưa được nêu — cần chốt.)

## Phân tích — vì sao cần MOQ 2 tầng
Quy sàn chuyên gia ra kg (đơn trọng v3.8): DN20 2.000m = 580 kg (~4,6h máy);
DN40 2.000m = 1.640 kg (~13h); DN100 500m = 2.152 kg (~17h ≈ 1 ngày chạy 3 ca).
MOQ hòa vốn thuần `C_setup ÷ CM` (CM = giá VF − sàn biến phí = 35.226 đ/kg BM)
với phế 100 kg + 4h dừng máy ≈ 350 kg ≈ 82 m DN100 — thấp hơn sàn chuyên gia ~6 lần.
→ Với ống, ràng buộc trói buộc là **vật lý/chất lượng** (thời gian chạy ổn định,
đáng một đợt đổi die), không phải chi phí setup. Chi phí setup vẫn cần đo thật
để tính phụ phí đơn lẻ, nhưng KHÔNG được dùng một mình làm MOQ.

## Quyết định
1. **MOQ chạy ống = MAX(MOQ hòa vốn, Sàn vật lý chuyên gia)**:
   - MOQ hòa vốn = C_setup(nhóm die) ÷ (giá VF/kg − sàn biến phí/kg), quy mét theo đơn trọng.
   - Sàn vật lý: DN20–40 = 2.000 m; DN65–100 = 500 m; DN50 = **tạm 1.000 m (chờ chốt)**.
2. **C_setup theo nhóm die** (phế xả máy mặc định): nhỏ 30 kg (giả định),
   trung 60 kg (giả định), DN80/DN100 100 kg (số user cấp). Giờ dừng + công setup
   chờ xưởng đo. Mọi giá trị giả định phải hiển thị rõ là giả định trên UI.
3. **Luật ghép đơn (piggyback) sửa lại**: điều kiện = CÙNG NHÓM DIE + cùng nguyên
   liệu (không còn "cùng OD" — trong 1 nhóm die, đổi size là hao phí nhỏ, xếp
   liền nhau trong 1 đợt). Đơn trải N nhóm die → kế hoạch tách ≥ N đợt.
4. **Kế hoạch chạy tránh nguội máy**: xếp lịch để không dừng qua đêm giữa đợt —
   mỗi lần nguội/khởi động lại nhóm lớn đốt ~100 kg ≈ 10 tr đ.
5. Phạm vi: ADR này là ĐẦU VÀO nghiệp vụ cho Pha 2 (schema `setup-cost`/`moq`
   + trường `dieGroup` trên PipeProduct). Chưa sửa engine trong ADR này.

## Còn chờ chốt (user/xưởng)
- DN40 thuộc nhóm nhỏ hay trung; DN65 thuộc trung hay lớn (die vs sàn MOQ đang lệch nhau).
- Sàn MOQ cho DN50.
- Số đo thật: phế + giờ dừng + công cho MỖI loại chuyển đổi (đổi size trong nhóm /
  đổi nhóm die / khởi động lại sau nguội máy) — 3 con số khác nhau.
