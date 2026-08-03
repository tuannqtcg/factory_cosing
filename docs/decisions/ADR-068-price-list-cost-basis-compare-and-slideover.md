# ADR-068 — Bảng Giá: cột giá theo Bình quân gia quyền, SlideOver panel, dropdown lọc

- **Ngày**: 2026-08-03
- **Trạng thái**: Chấp nhận (user phiên 2026-08-03)
- **Kế thừa**: ADR-061 (`scenarioWithCostBasis`, 2 kịch bản giá vốn song song), ADR-059 (`SlideOverPanel`), ADR-067 (bảng tóm tắt baseline/bình quân gia quyền)

## Bối cảnh

3 việc user yêu cầu cùng lúc trên màn **Bảng Giá**:

1. Bảng danh sách SKU (dưới khối tóm tắt ADR-067) chưa phản ánh giá bình quân gia quyền — chỉ có 1 cột giá (theo baseline).
2. Bấm vào 1 dòng SKU mở khối "Giá này từ đâu ra?" NGAY TRONG bảng (đẩy layout, mất ngữ cảnh danh sách) — user muốn dạng panel nổi bên phải như Twenty CRM.
3. 2 hàng chip lọc (Nguyên liệu, Loại sản phẩm) chiếm nhiều chỗ, gây rối khi thao tác.

## Quyết định

1. **Cột giá 2 + chênh lệch**: tái dùng `scenarioWithCostBasis(scenario, 'weighted-avg')` (ADR-061, đã có test) + `calculateScenario` gốc để tính lại TOÀN BỘ chuỗi giá VF với NVL = bình quân gia quyền thay vì baseline, giữ nguyên % lời nhà máy — KHÔNG viết công thức tay. Zip kết quả vào từng dòng SKU theo `productKey` (materialId + dn/productName+sizeLabel), thêm 2 cột "Giá theo BQ gia quyền" và "Chênh lệch" (dương/đỏ = giá đang niêm yết đã thấp hơn chi phí thực theo giá mua mới nhất).
2. **SlideOverPanel**: bỏ khối mở rộng tại chỗ trong bảng, dùng `SlideOverPanel` có sẵn (đã dùng ở Nguyên Liệu) — bấm dòng SKU mở panel bên phải chứa `renderOrigin()`, danh sách phía sau giữ nguyên ngữ cảnh, Esc đóng.
3. **Dropdown lọc**: gộp 2 hàng chip (Nguyên liệu, Loại sản phẩm) thành 2 `<select>` gọn, đặt cùng khu vực với ô tìm kiếm.

## Verify

Thuần trình bày + tái dùng hàm engine đã test sẵn, không đổi schema. Typecheck + build xanh, suite 438/438 giữ nguyên (không có ca mới vì `scenarioWithCostBasis`/`calculateScenario` đã có test riêng ở `tests/unit/price-cost-scenarios.test.ts`).
