# ADR-037 — Đơn hàng nhiều dòng + `decideOrder` nhận materialId + sửa truy nguyên giá Ống

- **Ngày**: 2026-07-18
- **Trạng thái**: Chấp nhận (user yêu cầu trực tiếp trong phiên 2026-07-18)
- **Kế thừa**: ADR-029 (nhận đơn), ADR-036 (đơn vị thương mại), ADR-035 (giải thích tại chỗ)

## Bối cảnh

User: (1) đơn hàng thực tế gồm NHIỀU dòng sản phẩm (ống + phụ kiện, BlazeMaster
lẫn Corzan) — màn chọn 1 SKU/lần là vô dụng; (2) truy nguyên giá của Ống hiện
"Tiền sản xuất & chi phí chung phân bổ = 0" — vô lý với người xem.

## Quyết định

1. **Engine `decideOrder` nhận `materialId` optional** (thay đổi engine ADDITIVE
   duy nhất): bỏ trống = nguyên liệu tham chiếu của dòng (hành vi ADR-029, mọi
   test cũ giữ nguyên); chỉ định = sàn tính theo đúng nguyên liệu đó (dòng
   Corzan không còn mượn sàn BlazeMaster). +3 test (tương thích cũ, khác
   nguyên liệu → khác sàn, id sai → lỗi rõ). Suite 373/373.
2. **Màn Nhận Đơn = một ĐƠN nhiều dòng**: bảng dòng (sản phẩm, kích cỡ, số
   mét/cái, giá chào đ/đv — gợi ý sẵn giá VF niêm yết), mỗi dòng gọi engine
   riêng với materialId của dòng, hiện sàn tiền tươi + giá thành đầy đủ đ/đv
   và kết luận TỪNG DÒNG; tổng hợp CẢ ĐƠN = cộng tổng các dòng, verdict tổng
   theo cùng quy tắc sàn (lãi full cost ≥ 0 → nhận; đóng góp ≥ 0 → cân nhắc;
   âm → không). Panel khóa giá liệt kê theo TỪNG nguyên liệu có trong đơn;
   slider ngưỡng what-if áp chung + nút chốt về Tham Số.
3. **Sửa truy nguyên giá Ống** (hiển thị, không đụng số): mô hình Excel gốc
   không tách nguyên liệu/chế biến per-SKU cho ống (chế biến = 0 trong chuỗi)
   → thay bằng phân rã **chi phí biến đổi / chi phí cố định phân bổ** lấy từ
   thang giá đ/kg đã persist, quy về đơn vị theo đơn trọng ẩn. Phụ kiện giữ
   cặp nguyên liệu / giờ máy (chuỗi có tách thật).

## Hệ quả

- Verdict tổng là phép cộng các dòng — KHÔNG mô hình ràng buộc công suất chung
  của đơn (đơn quá lớn chiếm máy vẫn phải nhìn thêm Product-mix). Ghi chú rõ
  trong màn.
- Schema request thêm field optional — hợp đồng cũ vẫn parse được, không migration.
