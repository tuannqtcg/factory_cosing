# ADR-032: Product-mix — tách "nhìn nhanh" vs "phân tích sâu" (progressive disclosure)

Ngày: 2026-07-17 | Trạng thái: CHẤP NHẬN | Nối tiếp: ADR-031, ADR-018/020 (progressive disclosure)

## Bối cảnh
ADR-031 nhồi vào MỘT màn: 3 mẫu số + chọn ràng buộc + nhập giá thị trường + ROIC/vốn
→ màn chính rối. User: "phần vốn & giá thị trường để sang một màn hình khác nếu thực
sự muốn tra cứu, trả lời câu hỏi sâu hơn — đây là lựa chọn của CEO; tuân thủ nguyên
tắc không làm phức tạp quá quy trình UI".

## Quyết định
Chia màn Product-mix thành 2 chế độ (KHÔNG thêm tab — giữ nav gọn):
- **Nhìn nhanh (mặc định, đơn giản)**: 2 thẻ (biên %, đóng góp/kg, đóng góp/máy-giờ,
  sản lượng, giờ máy), banner trung lập ("X lãi hơn/kg, Y lãi hơn/máy-giờ — tuỳ ràng
  buộc"), mô phỏng mix (giá VF). Trả lời câu hỏi cơ bản, KHÔNG tham số nặng.
- **Phân tích sâu (nút mở, tuỳ chọn)**: chọn ràng buộc (máy-giờ/vốn/thị trường) +
  nhập giá thị trường/dòng + ROIC/vốn cố định + verdict ưu tiên. Nút "← Về nhìn nhanh".

## Hệ quả
- Engine/schema/test KHÔNG đổi (thuần tổ chức lại UI) — suite 370/370.
- Màn chính nhẹ, đúng "một câu hỏi = xem đến đâu cần đến đó"; phần tra cứu sâu (vốn,
  giá thị trường) là LỰA CHỌN của CEO, không ép vào flow chính.
- Không thêm tab → nav 10 mục nhóm Phân Tích & Quyết Định giữ nguyên.
