# ADR-067 — Bảng tóm tắt Baseline / Bình quân gia quyền / Chênh lệch trên Bảng Giá

- **Ngày**: 2026-08-02
- **Trạng thái**: Chấp nhận (user phiên 2026-08-02)
- **Kế thừa**: ADR-002 (bình quân gia quyền tồn kho, `weightedAvgUsdPerKg`), ADR-004 (khóa giá baseline/replacement)

## Bối cảnh

User: *"Một loại thay đổi trước đó như trên bảng giá phải có cột giá base line, giá bình quân gia quyền, chênh lệch để còn biết"*. Trước đó, 2 con số này chỉ hiện RIÊNG LẺ ở 2 nơi khác nhau (baseline trong đánh giá khóa giá; bình quân gia quyền ở màn Thiết Lập/Tồn Kho) — không có chỗ nào đặt CẠNH NHAU để so trực tiếp "giá tôi đã chốt bán theo" vs "giá tôi đang THỰC MUA".

## Quyết định

Thêm 1 khối bảng ở đầu màn **Bảng Giá** (trước khối danh sách/phiếu giá SKU, chỉ hiện cho vai admin/pricing — cùng ranh giới sales-safe với các khối cost khác trên màn này), 1 dòng/nguyên liệu, 3 cột:

- **Baseline (USD/kg)** — `material.inventory.priceLock.baseline`, giá đã CHỐT dùng để tính giá bán hiện hành.
- **Bình quân gia quyền (USD/kg)** — `weightedAvgUsdPerKg(material.inventory.lots)` (dual-costing.ts, TÁI DÙNG nguyên hàm đã có, tính client-side từ `scenario` sẵn có — không thêm field mới). "— chưa nhập lô" nếu chưa có lô nào.
- **Chênh lệch** — `(bình quân − baseline) / baseline`, dương (đỏ) = đang mua ĐẮT hơn giá đã chốt, âm (xanh) = đang mua RẺ hơn.

Lưu ý phân biệt với banner cảnh báo "lệch ngưỡng" đã có sẵn phía trên (đó là **replacement THỊ TRƯỜNG** vs baseline — tín hiệu "có nên chốt lại giá bán không"); bảng mới này là **giá MUA THỰC TẾ đã trả** (bình quân gia quyền từ lô) vs baseline — câu hỏi khác: "tôi đang lãi/lỗ giữ kho bao nhiêu so với giá tôi đang bán theo".

## Verify

Thuần trình bày, không đổi engine/schema — không có test parity mới. Typecheck + build xanh, suite 438/438 giữ nguyên.
