# tests/fixtures — số liệu vàng từ BlazeMaster_Model_v3_4.xlsx

Trích xuất 2026-07 bằng script đọc trực tiếp giá trị đã tính (cached values) của
từng ô công thức trong Excel — không gõ tay, không làm tròn thêm. File Excel gốc
KHÔNG lưu trong repo (xem `.gitignore` gốc) vì chứa số liệu chi phí/giá thành/
margin nhạy cảm kinh doanh; tài liệu thuật toán tương ứng nằm ở
`docs/BUSINESS_MODEL.md`.

| File | Nội dung | Nguồn sheet |
|---|---|---|
| `assumptions.json` | Tham số chung: tỷ giá, thuế, markup chain, chi phí chung dùng chung, tồn kho compound 2 dòng, **`priceLock`** (baseline/ngưỡng/deviation/trạng thái khóa — ADR-004) | Assumptions |
| `pipe.json` | Tham số riêng, công suất, chi phí SX, bảng giá 8 DN, thang ca 1-3, CVP | Ống |
| `fitting.json` | Tham số riêng, bảng khuôn 8 size, công suất xưởng ép, MHR, **91 SKU đầy đủ**, MHR theo 6 kịch bản ca/huy động, CVP | Phụ kiện |
| `dashboard.json` | Thang giá 5 bậc, 3 mức sản lượng, CVP+công suất nhàn rỗi, đầu tư, tồn kho giá vốn kép, `priceLockSummary` | Dashboard |
| `price-list.json` | Bảng phẳng 99 dòng (8 ống + 91 SKU) — giá trước/có VAT, đúng thứ tự hiển thị | PriceList |
| `price-lock-scenarios.json` | 5 kịch bản nghiệm thu cơ chế khóa bảng giá (ADR-004) — kịch bản 1 trích từ cell, kịch bản 2-5 verify bằng công thức tuyến tính | ADR-004 (không phải 1 cell snapshot đơn) |

## Dùng khi viết engine (Pha 3+) / parity test (Pha 4)
So khớp output engine với các field tương ứng — dung sai ±0,5đ trước làm tròn,
khớp tuyệt đối sau `ROUNDUP(-2)`. Xem công thức đầy đủ tại `docs/BUSINESS_MODEL.md`,
skill `excel-parity-testing`.

## Khi có Excel bản mới (v3.4+)
Lặp lại quy trình trích xuất bằng script đọc cached-value của workbook (không gõ
tay), ghi đè các file JSON này, KHÔNG commit file `.xlsx` gốc vào repo. Nếu công
thức nghiệp vụ thay đổi (không chỉ số liệu) → viết ADR mới trước khi cập nhật
fixture.
