# DESIGN BRIEF — Trợ Lý CEO (CEO Planner) + nút AI Tư Vấn

Ngày: 2026-07-15 | Pha: 0 (brief) → 1 (prototype) | Trạng thái: CHỜ DUYỆT UI
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

## Ràng buộc kỹ thuật khi sang Pha 3
- Toàn bộ công thức nhúng trong prototype PHẢI thay bằng `src/engine/*` (pipe,
  fitting, price-ladder, cvp, dashboard-support) — cấm chép công thức tay.
- Quy ước thang giá theo `price-ladder.ts` (bậc 2 không gồm khấu hao, bậc 4
  phân bổ theo tỷ trọng doanh thu tại giá VF — 2 lỗi cũ Phiên 5 không tái phạm).
- Quét bậc ca giữ NGUYÊN phân bổ chi phí chung tại công suất chuẩn (khớp
  fixture `capacityTiers`/`mhrByCapacityTier`).
