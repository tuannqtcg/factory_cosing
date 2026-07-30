# ADR-057 — Đặt lại tên "giá tái tạo", gộp nơi nhập baseline, thêm góc nhìn giá vốn kép (Giá VF dự kiến vs Bình quân gia quyền, dual EBIT Dashboard)

- **Ngày**: 2026-07-30 | **Trạng thái**: CHẤP NHẬN
- **Kế thừa**: ADR-002 (giá vốn kép), ADR-004 (khóa giá), ADR-012 (landed cost theo material), ADR-024 (Giá Vốn Theo Lô), ADR-025 (Bảng Giá neo VF), ADR-035 (giải thích tại chỗ), ADR-049 (Thiết Lập Dữ Liệu)

## Bối cảnh

User (CEO) nêu 2 vấn đề khi rà lại cấu hình Nguyên liệu theo lô:

1. **Thuật ngữ mù mờ**: "giá tái tạo" (`replacementPriceUsdPerKg`) không tự giải thích được — user đọc lại giải thích cũ vẫn không rõ nó khác `baseline` (mốc neo Giá VF) thế nào, và không biết baseline nhập ở đâu.
2. **Thiếu góc nhìn so sánh**: giá vốn có 2 dòng song song từ lâu (ADR-002: bình quân gia quyền sổ sách vs giá tái tạo định giá) nhưng KHÔNG thấy được tác động của 2 cơ sở giá này lên **Giá VF**, **giá hòa vốn**, và **EBIT cả năm** — cần để CEO tự tin quyết định giảm giá bán khi nguyên liệu tồn kho đang rẻ hơn baseline, và biết trước lợi nhuận THỰC TẾ (theo giá đã nhập kho) lệch bao nhiêu so với số theo baseline khi chốt Bảng Giá.

Rà code phát hiện: Giá VF trong Bảng Giá **không** dùng bình quân gia quyền (khác giả định ban đầu của user) — nó dùng cơ chế khóa giá (`baseline` khi trong ngưỡng, `replacement` khi vượt ngưỡng). Bình quân gia quyền chỉ tồn tại ở nhánh `bookCostPerKg` (Giá Vốn Theo Lô), không chảy vào Bảng Giá chính.

Rà nav cũng phát hiện `AssumptionsScreen.tsx` ("Tham Số") — nơi DUY NHẤT từng có ô baseline gõ tay tự do — đã bị gỡ khỏi `AppShell.tsx` từ ADR-049 (file còn trong repo nhưng KHÔNG route được nữa, dead code). Nơi nhập baseline reachable duy nhất trước ADR này là nút "Chốt baseline" ở `DataSetupScreen.tsx` mục ④ (chỉ copy giá mua mới hôm nay → baseline, không cho gõ số tùy ý).

## Quyết định

1. **Đổi tên hiển thị** (KHÔNG đổi field schema — `replacementPriceUsdPerKg`/`priceLock.baseline` giữ nguyên tên, chỉ đổi copy UI + 1 chuỗi cảnh báo do engine trả về):
   - "giá tái tạo" → **"Giá mua mới hôm nay"** (mọi UI: `DataSetupScreen`, `LotCostingScreen`, `Dashboard`, `PriceList`; chuỗi `provisionWarning()` trong `dual-costing.ts`).
   - `baseline` hiển thị **tường minh bằng số** (USD/kg) ở mọi nơi đang show nó, không còn ẩn sau badge KHÓA/MỞ KHÓA đơn thuần.
   - Thêm term `'baseline-mechanism'` vào `TermInfo.tsx` (khung ⓘ có sẵn từ ADR-035): giải thích baseline là mốc neo Giá VF ổn định, cơ chế lệch-trong-ngưỡng-giữ/lệch-vượt-ngưỡng-nhảy, khác Giá mua mới hôm nay và khác bình quân gia quyền. Gắn ⓘ này ở `DataSetupScreen` (cạnh ô baseline), `LotCostingScreen`, `Dashboard`, `PriceList`.

2. **Gộp nơi nhập baseline về MỘT chỗ — `DataSetupScreen.tsx` mục ④ Nguyên liệu**: thêm ô gõ tay trực tiếp "Giá baseline (USD/kg)" (admin-only, cạnh ô "Giá mua mới hôm nay"), giữ nút "Chốt baseline = giá hôm nay" làm lối tắt. `AssumptionsScreen.tsx` không đụng tới (đã là dead code từ ADR-049, không cần dọn thêm ở ADR này).

3. **`src/engine/price-cost-scenarios.ts`** (module mới, pure, KHÔNG công thức mới): `scenarioWithCostBasis(scenario, basis)` với `basis: 'market-today' | 'weighted-avg'` — ép MỌI material's `replacementPriceUsdPerKg` VÀ `priceLock.baseline` về cùng 1 giá trị (giá mua mới hôm nay, hoặc bình quân gia quyền `weightedAvgUsdPerKg` — fallback giá mua mới hôm nay nếu chưa có lô), khiến `evaluatePriceLock` luôn khóa đúng giá đó bất kể ngưỡng/trạng thái khóa thật. Dùng để tái tính TOÀN BỘ chuỗi giá (`calculateScenario`) hoặc EBIT giá-bán-cố-định (`makeFixedPriceModel` — ADR-028) theo 1 cơ sở giá vốn duy nhất, tách biệt khỏi trạng thái khóa hiện tại.

4. **Bảng Giá (`PriceList.tsx`)** — trong khối "Giá này từ đâu ra?" mỗi SKU, thêm so sánh: **Giá VF dự kiến** (chuỗi giá tính lại với `scenarioWithCostBasis(..., 'market-today')`) | **Giá VF bình quân gia quyền** (`'weighted-avg'`) | **Chênh lệch**. Không thêm cột vào bảng danh sách chính (tránh vỡ layout) — đặt trong panel mở rộng theo từng dòng, đúng pattern ADR-035.

5. **Tổng Quan (`Dashboard.tsx`)** — thêm khối "So sánh giá vốn: Baseline vs Bình quân gia quyền" ngay dưới P&L (tab Tổng Quan): **giữ NGUYÊN giá bán** (Giá VF chính thức đang niêm yết), chỉ đổi cơ sở giá nguyên liệu, hiện song song Giá thành đầy đủ/kg (Ống + Phụ kiện) và EBIT cả năm — theo Baseline (chính thức, `makeFixedPriceModel(scenario).baseEbitVnd`) vs theo Bình quân gia quyền (`ebitAt(scenarioWithCostBasis(scenario,'weighted-avg'), 1)`) — kèm cột chênh lệch. Tái dùng nguyên `makeFixedPriceModel` (ADR-028, "giá bán cố định" — đã có sẵn cho Độ Nhạy/So Sánh Kịch Bản).
   - **Giới hạn đã biết**: giống mọi công cụ if-then khác dùng `makeFixedPriceModel` (Độ Nhạy, So Sánh Kịch Bản — ADR-027/050), model chỉ theo material THAM CHIẾU từng dòng SX — có material phụ (vd Corzan chạy chung line BlazeMaster) thì đây là XẤP XỈ, không phải số tuyệt đối như KPI Dashboard chính (vốn có ADR-055 tỷ lệ đáy).

## Hệ quả

- KHÔNG đổi schema input/output đã đóng băng (`MaterialSchema`, `InventoryLotSchema`, `ScenarioOutputSchema`) — mọi số mới đều tính TẠI CHỖ (client) từ `ScenarioInput` + `calculateScenario`/`makeFixedPriceModel` đã có, đúng tinh thần ADR-024/045 (view dẫn xuất, không phải dữ liệu contract).
- Parity Excel giữ nguyên tuyệt đối — không sửa 1 công thức nào trong `pipe.ts`/`fitting.ts`/`price-ladder.ts`/`cost-pool.ts`. Suite 399/399 (+6 test mới `price-cost-scenarios.test.ts`), typecheck + build xanh.
- Vẫn CHƯA làm (ngoài phạm vi ADR này, để dành nếu user yêu cầu tiếp): thuế NK/logistics/xuất xứ THEO TỪNG LÔ (hiện vẫn theo material — ADR-012), trạng thái "đã nhập kho" cho từng lô. Đây là 2 điểm user nêu ở phiên trước nhưng đã tạm gác lại để tập trung vào phần thuật ngữ + góc nhìn dual-cost trước.
