# CONTEXT PASTE — Costing App (dán vào đầu phiên Claude Design / chat mới)

Dự án: web app giá thành & định giá cho nhà máy CPVC BlazeMaster (VF/TCG).
Nguồn chân lý nghiệp vụ: Excel `BlazeMaster_Model_v3_4.xlsx`. Stack chốt:
React 18 + TS strict + Zod + Tailwind + Recharts; storage v1 = JSON file qua
repository interface (đổi Firestore ở v2, không sửa engine/UI).

NGHIỆP VỤ LÕI (không được phát minh khác đi):
1. Hai cost driver (ADR-001): ống theo kg; phụ kiện theo GIỜ MÁY —
   MHR = chi phí gia công năm ÷ giờ máy huy động; giờ máy/sp = chu kỳ/(3600×cavity×yield).
2. Giá vốn kép (ADR-002): sổ sách = bình quân gia quyền kho; định giá = giá tái tạo.
   Lãi/lỗ giữ kho = (tái tạo − bình quân) × tồn kho. Cảnh báo dự phòng VAS 02 khi giảm.
3. Khóa bảng giá (ADR-004): pricingPrice = |repl/baseline−1| > ngưỡng% ? repl : baseline.
   Trong ngưỡng bảng giá đứng yên; vượt ngưỡng → chuyển + nhắc chốt lại baseline.
   Ngoại tệ mua NVL luôn theo replacement. Cảnh báo staleness so đợt nhập gần nhất.
4. Thang giá 5 bậc (ống, đ/kg): sàn biến phí 100.663 / hòa vốn tiền mặt 104.298 /
   giá thành đầy đủ 106.205 / hòa vốn toàn DN 110.604 / giá mục tiêu 132.756.
   Thẩm quyền giảm giá phân tầng theo bậc; bậc 1 không ai được thủng.
5. Số vàng để kiểm tra: MHR = 1.344.176 đ/giờ máy (1 ca × 60%); BE@3,50 = 121.012;
   BE@2,80 = 98.958; 8 giá ống + 91 SKU trong tests/fixtures/prices.json.

QUY TRÌNH: 4 pha có cổng — brief → prototype (mock, duyệt UI) → schema+contract
(đóng băng) → code (không phát minh mới) → test parity + security → merge.
UI tiếng Việt, số định dạng vi-VN, thuật ngữ theo docs/GLOSSARY.md.
Vai sales KHÔNG BAO GIỜ thấy chi phí gốc — chỉ thang giá + bảng giá.
