# ADR-030: Màn "Tối Ưu Product-mix" — dồn lực vào dòng nào lãi hơn

Ngày: 2026-07-17 | Trạng thái: CHẤP NHẬN | Nối tiếp: ADR-027/028 (nền giá-cố-định)

## Bối cảnh
Công cụ if–then thứ 4 (cuối bộ): "dồn công suất sang dòng biên cao thì tổng lợi
nhuận đổi ra sao?". Bẫy điển hình: Phụ kiện biên 49% > Ống 25% ⇒ tưởng dồn sang Phụ
kiện. Nhưng nguồn lực ràng buộc thật trong mỗi dòng là **MÁY-GIỜ**, và đùn Ống rất
nhanh (nhiều kg/giờ) → đóng góp/máy-giờ Ống > Phụ kiện. Biên % KHÔNG phải thước đo.

## Quyết định
- **Engine `src/engine/product-mix.ts`**:
  - `calculateProductMixProfile`: mỗi dòng → biên/kg, biên %, **đóng góp/máy-giờ**
    (đóng góp năm ÷ giờ máy — giờ Ống từ `calculatePipeCapacity`, giờ Phụ kiện từ
    `capacity.fitting.normalMachineHoursUtilized`). `priorityLine` = dòng có đóng
    góp/máy-giờ cao nhất.
  - `calculateMixEbit(pipeVF, fittingVF)`: EBIT/doanh thu khi nhân sản lượng mỗi dòng
    ĐỘC LẬP (máy Ống ≠ máy Phụ kiện — không chuyển đổi), giữ giá bán cố định; định
    phí mỗi dòng không đổi theo sản lượng (đòn bẩy vận hành). base (1,1) khớp KPI.
  - KHÔNG công thức chi phí mới.
- **Schema `src/schemas/product-mix.ts`** đóng băng.
- **Màn `ProductMixScreen`** (tab "Tối Ưu Product-mix"): 2 thẻ dòng (nổi bật đóng
  góp/máy-giờ + badge ƯU TIÊN), banner chống bẫy, 2 slider mô phỏng mix → EBIT live.

## Hệ quả
- Thuần đọc engine đóng băng — parity giữ nguyên; +7 test (đóng góp/máy-giờ đúng,
  priorityLine theo /máy-giờ chứ không theo %, mix base khớp KPI). Suite 370/370.
- Sửa hiểu lầm điều hành: (seed) Phụ kiện biên 49% nhưng 2,85 tr/máy-giờ; Ống biên
  25% nhưng **4,81 tr/máy-giờ** → ưu tiên mở rộng ỐNG.
- HOÀN TẤT bộ 4 công cụ if–then cho CEO (Độ Nhạy · So Sánh Kịch Bản · Nhận Đơn ·
  Product-mix), tất cả tái dùng engine đã đóng băng, đồng bộ EBIT giá-bán-cố-định.
