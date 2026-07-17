# DESIGN BRIEF — Trợ Lý CEO (CEO Planner) + nút AI Tư Vấn

Ngày: 2026-07-15 | Pha: 1 (prototype) → 2 (schema) | Trạng thái: ✅ DUYỆT CỔNG PHA 1
(user 2026-07-16). Pha 2 đã đóng băng schema: `src/schemas/ceo-planner.ts`,
`docs/contracts/ceo-planner.md`, ADR-021 (planner) + ADR-022 (adviseScenario).
(đã qua 7 vòng góp ý 2026-07-15 — xem "Quyết định đã chốt" cuối file)
Nguồn yêu cầu: user 2026-07-15 — "Đơn giản hóa cách sử dụng app… với giá nguyên
liệu đầu vào X thì giá bán là bao nhiêu, nếu chạy liên tục 3 ca mỗi ngày và chạy
số lần tối đa trong năm thì hiệu suất là bao nhiêu với giá bán đó… Tôi là CEO,
chỉ đi đàm phán hợp đồng bán hàng và thiết lập mức margin mong muốn… cần nút
bấm để AI tư vấn sau khi chạy số liệu."

## Vấn đề
App hiện tại đầy đủ nghiệp vụ (Dashboard, Bảng Giá, Target Costing, Kế Hoạch SX,
Tồn Kho, What-If) nhưng bố cục theo VAI CHUYÊN MÔN (pricing/production/sales).
CEO chỉ cần trả lời 3 câu trước bàn đàm phán:
1. Nguyên liệu giá X (USD/kg) + margin mong muốn m% → **giá bán tối thiểu là bao nhiêu?**
2. Giá đó nằm đâu so với **sàn đàm phán** (thang giá 5 bậc — lùi tới đâu thì dừng)?
3. Chạy hết công suất (3 ca, số đợt tối đa/năm) với giá đó → **hiệu quả cả năm
   là bao nhiêu** (doanh thu, EBIT, % hòa vốn, payback)?
Hiện phải ghép tay số từ 3-4 màn hình mới ra câu trả lời → cần 1 màn hình duy
nhất kiểu "hỏi → trả lời", kèm nút AI tư vấn đọc kết quả và bình luận.

## Mục tiêu (phạm vi Pha 1 — chỉ UI mock)
1. **1 màn hình, 3 bước dọc**: (a) nhập giá compound Ống + Phụ kiện (USD/kg),
   margin mong muốn từng dòng, kịch bản chạy máy (số ca, % huy động giờ máy,
   preset "Chuẩn Excel v3.4" / "Chạy tối đa 3 ca"); (b) bấm **Chạy số liệu** →
   giá bán đề xuất đ/kg từng dòng + vị trí trên thang giá 5 bậc + bảng hiệu quả
   cả năm (sản lượng tối đa 41 đợt × 5 ngày × ca, doanh thu, EBIT, % công suất
   hòa vốn, payback) + bảng giá ống theo DN (đ/m); (c) nút **🤖 AI Tư Vấn** →
   panel nhận định (mock rule-based ở Pha 1).
2. **Margin đúng ngôn ngữ CEO**: chọn 1 trong 2 cách hiểu — markup trên giá
   thành (mặc định, khớp Excel 25%/40%) hoặc margin trên giá bán; UI ghi rõ
   đang dùng cách nào.
3. **Số khớp Excel v3.4** tại preset chuẩn: giá ống 132.898,6 đ/kg, phụ kiện
   252.845,8 đ/kg, EBIT 16,37 tỷ, payback 0,816 năm (tests/fixtures/*).

## Ngoài phạm vi (nói rõ để không lạm phát)
- KHÔNG thay thế các màn hình chuyên môn hiện có — đây là màn hình TÓM LƯỢC
  cho vai admin/pricing (tầng chiến lược ADR-006); production/sales không thấy.
- AI tư vấn Pha 1 là MOCK (rule-based tại chỗ). Pha 2 sẽ ra ADR riêng: callable
  Cloud Function `adviseScenario` (pattern ADR-010/013) gọi Claude API phía
  server — KHÔNG API key ở client, chỉ gửi số liệu output đã tính (không gửi
  dữ liệu thô ngoài phạm vi vai), có audit log.
- KHÔNG tính ngược margin→biến vận hành ở màn này (đã có Target Costing).
- Phụ kiện chỉ hiển thị giá THAM CHIẾU đ/kg + MHR — báo giá SKU lẻ vẫn ở Bảng Giá.

## Quyết định ĐÃ CHỐT với user qua các vòng duyệt (2026-07-15) — nguồn chân lý cho phiên mới
1. **Markup tính TRÊN GIÁ VỐN** (giá bán = giá thành × (1+markup)) — mặc định
   25% ống / 40% phụ kiện; vẫn giữ lựa chọn phụ "lãi trên giá bán".
2. **Không dùng từ viết tắt trong UI**: lãi gộp / lợi nhuận trước thuế /
   lợi nhuận sau thuế TNDN / tỷ suất lợi nhuận / chi phí 1 giờ máy ép
   (không EBIT, không MHR). Chú thích dài đặt CHỮ NHỎ DƯỚI giá trị, không ngoặc.
3. **Tổng quan trước → chi tiết sau**: chi phí sản xuất (chưa gồm nguyên liệu)
   hiện live ngay Bước 1; mỗi số lớn có nút "Xem bảng chi tiết" (giá thành
   3 bảng: nguyên liệu → chi phí SX cả năm → cộng giá vốn; panel thu hồi vốn
   liệt kê chi phí đã trừ + phép tính dòng tiền).
4. **Vốn đầu tư**: chi phí xây nhà xưởng + vốn lưu động TẠM = 0 (mô hình ĐI
   THUÊ). **Chi phí thuê mặt bằng 800 triệu đ/năm, đổi được từng năm** — thay
   "thuê đất 525 triệu" của Excel v3.4 (Pha 2: schema mới + ADR, xem dưới).
   Payback = 15,97 tỷ ÷ (lợi nhuận trước thuế + khấu hao 3.193,3 triệu).
5. **Doanh thu trên màn CEO = doanh thu VF** (giá bán VF = giá thành + markup).
   **Bỏ giá TCG và giá niêm yết** khỏi màn CEO (vẫn ở màn Bảng Giá cho sales).
6. **Font Be Vietnam Pro** (nhúng data-URI, không CDN) hoặc sans-serif.
7. **Dòng sản phẩm ghi rõ + chọn 1 NƠI cho cả 2 line**: BlazeMaster ↔ Corzan
   (ADR-012: Corzan ống 3,47/phụ kiện 3,97 USD, thuế NK 0% AIFTA + phí 1%,
   đơn trọng ống +10%, tồn kho 0). Chọn dòng → giá compound cả 2 line nhảy theo.
8. **Bảng giá phụ kiện theo CÁI**: 83 SKU có khuôn (66 khuôn vật lý ADR-007,
   8/91 SKU chưa khuôn tự ẩn), giá động theo nguyên liệu + bậc ca + markup,
   11 SKU họ ren cộng đơn giá ren (ADR-008); có ô lọc tên/size.
9. Thuế TNDN **20% — user XÁC NHẬN 2026-07-16** (thuế suất phổ thông VN). Hết treo.

## Ràng buộc kỹ thuật khi sang Pha 3
- Toàn bộ công thức nhúng trong prototype PHẢI thay bằng `src/engine/*` (pipe,
  fitting, price-ladder, cvp, dashboard-support) — cấm chép công thức tay.
- Quy ước thang giá theo `price-ladder.ts` (bậc 2 không gồm khấu hao, bậc 4
  phân bổ theo tỷ trọng doanh thu tại giá VF — 2 lỗi cũ Phiên 5 không tái phạm).
- Quét bậc ca giữ NGUYÊN phân bổ chi phí chung tại công suất chuẩn (khớp
  fixture `capacityTiers`/`mhrByCapacityTier`).
