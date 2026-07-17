# ADR-027: Màn "Độ Nhạy" (tornado) — công cụ if–then rủi ro cho CEO

Ngày: 2026-07-17 | Trạng thái: CHẤP NHẬN | Nối tiếp: ADR-021 (tái dùng engine)

## Bối cảnh
Vị trí CEO là "if–then": *"NẾU điều này lệch THÌ tôi sao, cần canh gì?"*. App đã có
**một** what-if (Trợ Lý CEO) nhưng thiếu câu trả lời **"biến nào bào lợi nhuận mạnh
NHẤT"** — rủi ro số 1 để phòng hộ. User chọn làm cái này trước.

## Vấn đề bản chất: EBIT nào mới đúng "rủi ro"
EBIT gốc của engine dùng **cost-plus** (`targetPrice = fullCost×(1+markup)`), nên chi
phí tăng ⇒ giá bán tự tăng ⇒ EBIT TĂNG. Vô nghĩa cho tornado rủi ro. → Phải đo EBIT
khi **GIỮ GIÁ BÁN cố định** ở baseline (bản chất "chi phí tăng mà không đẩy được giá
thì lãi hụt bao nhiêu").

## Quyết định
- **Engine `src/engine/sensitivity.ts`** (`calculateSensitivity(baseline, δ)`): cho
  từng driver lệch ±δ, gọi LẠI `calculateScenario`, tính EBIT theo phân rã CVP
  (Σ(giá_baseline − biến phí/kg)·sản lượng − định phí SX − chi phí ngoài SX). KHÔNG
  công thức chi phí mới. **Base EBIT (δ=0 hiệu quả) khớp
  `calculateDashboardKpis().ebitAtNormalCapacityVfPrice`** (parity, test bắt buộc).
- **6 driver**: giá compound (mọi NL, scale replacement+baseline ⇒ pricingPrice scale,
  giữ trạng thái khoá), tỷ giá USD/VND, lương, giá điện, chi phí ngoài SX, sản lượng
  (hệ số nhân roll-up — đòn bẩy vận hành). Xếp giảm dần theo |swing|.
- **Schema `src/schemas/sensitivity.ts`** đóng băng SensitivityResult (driver: low/high
  EBIT, downside/upside, maxAbsSwing).
- **Màn `SensitivityScreen`** (tab "Độ Nhạy", nhóm Phân Tích & Quyết Định): tornado
  ngang + bảng + chọn biên độ ±5/10/20%, banner "rủi ro số 1".

## Hệ quả
- Thuần đọc engine đã đóng băng — parity 343 giữ nguyên; +7 test unit (base khớp KPI,
  chi phí↑ ⇒ EBIT↓, ranking, đơn điệu theo δ). Suite 350/350.
- Kết quả điều hành nổi bật (seed demo): **tỷ giá USD & giá compound mỗi cái ±77,5%
  EBIT khi ±10%** — vì nguyên liệu định giá USD → CEO thấy ngay phải phòng hộ FX/khoá
  giá compound trước. Sản lượng ±31,5%; lương/điện <2%.
- Mở đường cho So Sánh Kịch Bản (nhiều driver cùng lúc) — việc kế tiếp nếu cần.
