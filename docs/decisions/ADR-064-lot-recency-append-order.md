# ADR-064 — Lô nhập nguyên liệu: "gần nhất" = số thứ tự CAO NHẤT (append), không phải Lô 1

- **Ngày**: 2026-08-02
- **Trạng thái**: Chấp nhận (user phiên 2026-08-02)
- **Kế thừa**: ADR-004 (khóa giá theo baseline/replacement/lô gần nhất — cảnh báo staleness), ADR-002 (bình quân gia quyền tồn kho)

## Bối cảnh

User nhập 2 lô BlazeMaster (Lô 1, Lô 2) ở màn Thiết Lập Dữ Liệu/Tồn Kho, phát hiện hệ thống tính SAI lô nào là "gần nhất": *"lô có số thứ tự cao hơn luôn là gần nhất chứ không phải lô 1"*.

Nguyên nhân: quy ước cũ (comment gốc `CompoundInventorySchema`) giả định `lots[0]` = lô gần nhất, dựa trên việc nút "+ Thêm lô" ở cả `DataSetupScreen.tsx` và `InventoryScreen.tsx` **CHÈN LÔ MỚI LÊN ĐẦU mảng** (`[newLot, ...lots]`), đồng thời nhãn hiển thị luôn gắn "gần nhất"/"(gần nhất)" vào **index 0** bất kể nội dung. Quy ước này chỉ đúng NẾU user luôn bấm "+Thêm lô" rồi điền ngay, không sửa lại lô cũ sau đó — sai lệch ngay khi user bấm thêm nhiều lô rỗng trước rồi điền sau, hoặc thao tác không đúng thứ tự đó. Kết quả: lô hiển thị "Lô 1"/"Đợt 1" (vị trí đầu bảng) lại được engine coi là gần nhất — ngược trực giác thông thường (số thứ tự tăng dần = nhập sau).

Hệ quả: `lastLotPriceOf()`/`lastInsertLotPriceOf()` (dùng để đánh giá khóa giá — `evaluatePriceLock`, cảnh báo staleness ADR-004) có thể đọc NHẦM lô, khiến giá vốn/cảnh báo khóa giá sai.

## Quyết định

1. **Đổi chiều chèn lô mới**: cả 4 nút "+Thêm lô"/"+Thêm đợt nhập" (`DataSetupScreen.tsx` × material, `InventoryScreen.tsx` × material + × ren kim loại) đổi từ `[newLot, ...lots]` (prepend) sang `[...lots, newLot]` (**append**). Từ nay: Lô 1 = nhập đầu tiên/cũ nhất, Lô N (số cao nhất) = nhập sau cùng/gần nhất — khớp đúng trực giác user.

2. **Nhãn hiển thị "(gần nhất)"** ở cả 3 vị trí (2 màn nhập/sửa lô compound + 1 khối lô ren kim loại) đổi từ gắn cứng `index === 0` sang gắn vào **phần tử CUỐI mảng** (`i === lots.length - 1`).

3. **Engine `lastLotPriceOf()`/`lastInsertLotPriceOf()`** (`scenario.ts`) đổi từ đọc `lots[0]` sang quét NGƯỢC từ cuối mảng, lấy lô đầu tiên có `tons > 0` (hoặc `qtyOnHand > 0` với ren kim loại) — **bỏ qua lô placeholder chưa điền** (vừa bấm "+Thêm lô", `tons` mặc định 0) và bỏ qua phần đệm rỗng còn sót trong dữ liệu fixture/migration cũ (`assumptions.json` có 5 slot lô, 4 slot cuối `tons:0` — dữ liệu Excel gốc, không phải lô thật). Việc bỏ qua lô rỗng này làm công thức ĐÚNG cả khi mảng có lẫn placeholder, không phụ thuộc vào việc UI luôn append đúng thứ tự.

4. **Không đổi** cách tính giá vốn bình quân gia quyền (`weightedAvgLandedCostPerKgVnd`, `totalInventoryKg`) — các hàm này CỘNG/BÌNH QUÂN toàn bộ lots theo trọng số `tons`, không phân biệt thứ tự, nên không bị ảnh hưởng bởi bug này (đúng như ghi chú gốc đã xác nhận).

## Verify

`tests/unit/lot-recency.test.ts` (6 test mới) — mảng rỗng, 1 lô, 2 lô (lô 2 phải thắng lô 1), lô cuối chưa điền bị bỏ qua, dữ liệu fixture đệm rỗng ở cuối vẫn ra đúng lô thật, toàn bộ lô đều rỗng ⇒ null. Suite 433/433 (427 cũ + 6 mới), typecheck + build xanh — **không lệch số vàng** nào (fixture baseline chỉ có 1 lô thật, luôn được nhận diện đúng dù trước/sau fix).

## Còn treo

- Chưa có field lưu NGÀY NHẬP LÔ tường minh (chỉ suy luận thứ tự qua vị trí mảng) — nếu sau này cần sắp xếp lại lô đã nhập (không chỉ thêm mới ở cuối), nên cân nhắc thêm `enteredAt`/`lotNumber` tường minh thay vì tiếp tục suy luận qua index.
