# ADR-029: Màn "Quyết Định Nhận Đơn" + khóa giá what-if

Ngày: 2026-07-17 | Trạng thái: CHẤP NHẬN | Nối tiếp: ADR-004 (khóa giá), ADR-027/028

## Bối cảnh
Công cụ if–then thứ 3: "đơn này giá Y có nên nhận không?". User nhấn mạnh điểm nhạy
cảm: **khóa giá không phải luôn 3% — có khi thị trường tăng 10%**, lúc đó khóa vỡ, và
với ĐƠN MỚI phải mua NL mới nên **sàn giá đúng là giá thị trường (tái tạo), không phải
giá vốn cũ đã khóa**. CEO cần mở/điều chỉnh ngưỡng.

## Quyết định
- **Engine `src/engine/order-acceptance.ts`** (`decideOrder`): lấy sàn biến phí + giá
  thành đầy đủ theo dòng SP từ `calculateScenario` tại HAI cơ sở giá vốn (ép
  pricingPrice về giá thị trường / về baseline bằng deviation=0). KHÔNG công thức mới.
  Verdict theo sàn THỊ TRƯỜNG: ≥ full cost → NHẬN; ≥ biến phí → CÂN NHẮC (đóng góp
  dương, chỉ nhận nếu còn công suất trống); < biến phí → KHÔNG (lỗ tiền tươi).
- **Hiện CẢ HAI sàn** (thị trường + giá vốn khóa) theo yêu cầu CEO — khuyến nghị theo
  thị trường; sàn khóa chỉ đúng khi làm đơn bằng hàng tồn đã có.
- **Ngưỡng khóa giá = WHAT-IF (không lưu)**: slider ngay trong màn để thử 3%/10%/…,
  thấy giá niêm yết đang KHÓA/MỞ. Đổi CHÍNH THỨC (ảnh hưởng toàn bảng giá) vẫn ở tab
  Tham Số (admin, có audit) — không nhân đôi cơ chế ghi.
- Schema `src/schemas/order-acceptance.ts` đóng băng request/result.

## Hệ quả
- Thuần đọc engine đóng băng — parity giữ nguyên; +7 test (verdict 3 mức, 2 sàn tách
  khi lệch giá, ngưỡng what-if đổi trạng thái khóa). Suite 363/363.
- Điểm "cần chú ý" của user được xử đúng: verdict LUÔN theo sàn thị trường (đơn mới
  mua NL mới), khóa giá chỉ chi phối bảng giá niêm yết chứ không phải sàn nhận đơn.
- Verify (seed, Ống lệch +12,2%): sàn thị trường 112.320 vs sàn khóa 100.663 — chênh
  đúng phần NL tăng; giá chào 130k → NÊN NHẬN (+0,88 tỷ đóng góp).
- Còn 1 công cụ if–then: Tối ưu product-mix.
