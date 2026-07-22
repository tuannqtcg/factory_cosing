# ADR-056 — Trợ Lý CEO: công cụ "câu hỏi ngược" (goal-seek) + mở rộng Áp dụng

- **Ngày**: 2026-07-22
- **Trạng thái**: Chấp nhận (user — "A/B/C kết hợp")
- **Kế thừa**: ADR-013 (target costing T2/T3), ADR-021/041 (CEO Planner + cầu nối giả định→thật), ADR-042 (chia công suất; chế độ 2), ADR-054/055 (nền nhất quán)

## Bối cảnh
Trợ Lý CEO trước đây CHỈ trả lời câu hỏi XUÔI (nhập giá compound + margin →
ra giá bán, thang giá, hiệu quả năm). Engine đã có sẵn lời giải NGƯỢC
(`computeTargetProfitForScenario` T2, `computeTargetPriceForScenario` T3 —
ADR-013) nhưng **không có lối vào UI**. Ngoài ra "mục tiêu sản lượng → cần thêm
máy" (ADR-042 chế độ 2) chưa làm, và nút "Áp dụng vào thật" chỉ ghi giá + markup
(bỏ tỷ giá/tiền thuê dù CEO nhập được ở what-if).

## Quyết định
**A — Câu hỏi ngược (goal-seek)** — component mới `CeoReverseTools.tsx`, 3 tab,
đặt ngay dưới Bước 1 (độc lập luồng xuôi). KHÔNG công thức ngược tay (skill
inverse-solver): mọi lời giải qua bisection/CVP trên `calculateScenario`, luôn
forward-verify:
- ① **Target costing (T3)**: giá niêm yết mục tiêu 1 SKU → giá compound USD/kg
  tối đa được phép (`computeTargetPriceForScenario`, freeVarPath =
  `materials.<idx>.inventory.replacementPriceUsdPerKg`). Infeasible → báo khoảng
  đạt được.
- ② **Lợi nhuận mục tiêu (T2)**: LN trước thuế/năm 1 dòng → sản lượng + số ca cần
  (`computeTargetProfitForScenario`).

**B — Sản lượng mục tiêu → số máy** (ADR-042 chế độ 2) — engine mới
`capacity-planning.ts` (`planCapacityForTargetVolume`): nhập kg/năm mục tiêu 2
dòng; trần 3 ca per-máy (Ống: `designCapacity3ShiftKgYear` = 1 đầu đùn; Phụ kiện:
giờ máy 3 ca ÷ tổng máy × huy động × năng suất mix) → số máy cần (ceil), máy mua
thêm, CAPEX (đơn giá máy), hồi vốn = CAPEX ÷ (sản lượng vượt × biên đóng góp/kg
từ CVP baseline). Tab ③ trong CeoReverseTools.

**C — Áp dụng mở rộng**: nút "Áp dụng vào thật" nay ghi thêm **tỷ giá USD/VND** +
**tiền thuê mặt bằng/năm** (opt-in checkbox, chỉ hiện khi giá trị what-if khác
thật; cảnh báo tỷ giá ảnh hưởng mọi chi phí USD). Confirm liệt kê đủ trước khi
`setDoc`. Giá + markup + audit price-lock giữ nguyên như ADR-041.

## Kiểm chứng
- 3 test mới `capacity-planning.test.ts`: mục tiêu ≤ hiện tại ⇒ 0 máy/CAPEX;
  vượt trần ⇒ machinesNeeded = ceil, trần phủ mục tiêu; hồi vốn = CAPEX ÷ LN tăng.
- A dùng engine T2/T3 đã có parity (ADR-013). typecheck + build + 389 test xanh.

## Còn treo
- B: định phí tăng thêm khi mở rộng (lương/khấu hao máy mới) CHƯA cộng vào hồi
  vốn — mới tính theo biên đóng góp hiện tại (ước tính lạc quan, có ghi chú UI).
- B phụ kiện: CAPEX dùng đơn giá máy BÌNH QUÂN (nhiều machineType) — thô khi các
  loại máy chênh giá lớn.
