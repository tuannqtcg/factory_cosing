# ADR-035 — Nguyên tắc "giải thích tại chỗ" + truy nguyên giá per-SKU + vá đường nhập lô

- **Ngày**: 2026-07-18
- **Trạng thái**: Chấp nhận (user duyệt thiết kế trong phiên 2026-07-18)
- **Kế thừa**: ADR-025 (giá VF), ADR-004 (khóa giá), ADR-034 (nav theo tình huống)

## Bối cảnh

User (CEO) chỉ ra: các con số quan trọng (đặc biệt Bảng Giá — đầu ra thương mại
quan trọng nhất) không tự giải thích được gốc gác trên màn hình; lý do nằm trong
ADR/tài liệu kỹ thuật mà người dùng không đọc. Kèm 2 phát hiện qua rà soát:
(1) màn Tồn Kho (nhập/sửa lô) bị ADR-026 gỡ khỏi menu mà không chừa lối vào
thay thế → không có cách nhập lô trên UI; (2) what-if ngưỡng ở Nhận Đơn không
có đường "chốt" về Tham Số.

## Quyết định

1. **NGUYÊN TẮC (áp dụng từ nay về sau)**: mọi màn/mọi con số đưa cho CEO phải
   tự giải thích được gốc gác NGAY TẠI CHỖ, bằng **ngôn ngữ kinh doanh thuần
   Việt** — tuyệt đối không thuật ngữ lập trình/mã ADR trong chữ hiển thị cho
   người dùng. UI làm cho CEO xem, không phải cho lập trình viên xem.
2. **`ExplainPanel`** (nút ⓘ "Giải thích màn này", góc phải trên, mọi màn):
   nội dung tĩnh theo khung 4 mục — màn này trả lời gì / số từ đâu ra / khi nào
   cần hành động / màn liên quan (link chuyển thẳng). Nội dung đúc từ các ADR.
3. **Truy nguyên giá per-SKU trong Bảng Giá**: bấm dòng SKU → thác nước
   ①NVL → ②sản xuất+phân bổ → ③giá thành đầy đủ → ④+phần lời (markup) →
   **GIÁ VF** → ⑤TCG → ⑥niêm yết NPP (+VAT), kèm trạng thái khóa giá của
   nguyên liệu và lý do neo ở VF. Số lấy từ chuỗi giá đã persist
   (`skuPriceChains[].chain`) — client không tính lại.
4. **Vá đường nhập lô**: gắn màn Tồn Kho vào Giá Vốn Theo Lô (nút "Cập nhật
   lô hàng" → sub-view `lot-costing:edit`, có nút quay lại).
5. **Đường chốt what-if**: Nhận Đơn khi đang thử ngưỡng → banner "đây là số
   thử" + nút "Chốt ở màn Tham Số".

## Phạm vi

Thuần trình bày + điều hướng. Không đụng engine, schema, rules. InventoryScreen
dùng lại nguyên vẹn (đã có sẵn validate + audit).

## Hệ quả

- Bảng Giá tự trả lời "giá này từ đâu ra, tại sao thế" — không cần hỏi ngoài.
- Món nợ ADR-026 (mất đường nhập lô) được trả.
- Màn mới sau này BẮT BUỘC khai báo nội dung ExplainPanel khi thêm vào nav.
