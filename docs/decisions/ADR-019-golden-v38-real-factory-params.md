# ADR-019: Bộ số vàng v3.8 — tham số nhà máy thật thay số Excel v3.7 (dòng Ống)

## Ngữ cảnh
Commit "big update" (7d134f7, 2026-07-13) đưa tham số đầu tư THẬT của nhà máy vào
`tests/fixtures/pipe.json.params` và sửa 2 công thức engine (tách khấu hao khuôn
ống khỏi máy đùn; cộng khấu hao nhà xưởng vào chi phí chung — ADR-018) nhưng
KHÔNG cập nhật số vàng đầu ra → 47/328 assertion parity đỏ, chuỗi kiểm chứng
với nguồn chân lý bị đứt (vi phạm luật bất biến #1 của AGENTS.md).

User (2026-07-14) chốt các quyết định nghiệp vụ:
- Tốc độ đùn: **140 kg/h thực tế** (max ghi nhận 200) — KHÔNG dùng 250 kg/h lý thuyết.
- Cấu trúc kỳ chạy giữ dạng tham số hiệu chỉnh được (hiện 5 ngày chạy + 2 bảo trì, 287 ngày/năm → 41 kỳ).
- Base Cost tính đủ khoản mục theo engine (NVL/yield + bao bì + điện nước + lương + khấu hao + phân bổ chung).
- **"Giá bán tiêu chuẩn" = giá bán VF** (bậc 5 thang giá, `vfPricePerKg = fullCost × (1+markupVf)`).

## Thay đổi tham số (pipe.json.params, v3.7 → v3.8)
| Tham số | v3.7 (Excel) | v3.8 (nhà máy thật) |
|---|---|---|
| extruderCount | 1 | 3 |
| moldPullerCutterCost | 200.000.000 | 3.726.500.000 |
| moldDepreciationYears | (gộp 5 năm) | 3 (khấu hao riêng) |
| depreciationYears (máy đùn) | 5 | 10 |
| annualMaintenance | 200.000.000 | 120.000.000 |

Dòng Phụ kiện KHÔNG đổi tham số — mọi số vàng fitting giữ nguyên, trừ bậc 4
thang giá (doanh thu chéo dòng Ống đổi).

## Quyết định
1. Tái lập bộ số vàng theo kỷ luật `excel-parity-testing`: **tính tay độc lập
   bằng Python** (không gọi engine) từ công thức `docs/BUSINESS_MODEL.md`
   §2.1-2.4 + §4, đối chiếu khớp tuyệt đối với engine rồi mới ghi vào fixture.
   Script lưu tại session log 2026-07-14.
2. Số neo v3.8 (dòng Ống, BlazeMaster 3,03 USD/kg khóa giá, tỷ giá 26.500):
   - Khấu hao máy đùn + khuôn: 3.612.904.000×3/10 + 3.726.500.000/3 = **2.326.037.866,67 đ/năm**
   - fullCostPerKg (bậc 3): **108.711,86** (v3.7: 106.318,88)
   - vfPricePerKg (bậc 5 — GIÁ BÁN TIÊU CHUẨN VF): **135.889,83** (v3.7: 132.898,60)
   - CVP: định phí 4.989.390.480,69 đ/năm; CM 35.226,41 đ/kg; hòa vốn 141.637,79 kg/năm (22,85% CS bình thường)
   - DN50: niêm yết 318.000 đ/m trước VAT (v3.7: 311.000)
   - Đầu tư: vốn cố định 26,72 tỷ; EBIT tại CS bình thường 16,74 tỷ; hoàn vốn 1,24 năm (hết "0,8 năm không tưởng" — mục tiêu ADR-018)
3. Fixture cập nhật: `pipe.json` (costAtNormalCapacity/cvp/priceLadderByDN/capacityTiers),
   `price-list.json` (8 dòng Ống), `dashboard.json` (thang giá, capacityLevels,
   cvpAndCapacity, investment, dualCosting), `price-lock-scenarios.json` (5 kịch
   bản), số tính tay inline trong `pipe/plan/plan-support/corzan.test.ts`.
   `assumptions.json` thêm `factoryDepreciationYears: 10` (fixture thô không qua
   Zod default). `tests/helpers/scenario-fixture.ts` bổ sung map
   `moldDepreciationYears` (thiếu field mới → NaN toàn chuỗi khi build input thô).
4. Từ v3.8, **fixture + ADR là nguồn chân lý cho tham số đầu tư dòng Ống**
   (Excel v3.7 vẫn là nguồn chân lý cho CÔNG THỨC và các tham số chưa đổi).
   Muốn đổi tham số đầu tư lần nữa: sửa params + tính tay độc lập lại + ADR mới,
   không sửa số vàng tay không.

## Hệ quả
- 328/328 assertion xanh trở lại; mọi giá app in ra khớp bản tính tay độc lập.
- Giá niêm yết Ống tăng ~2,2-2,3% so với v3.7 (gánh khấu hao 3 máy đùn + khuôn 3,7 tỷ).
- Payback 1,24 năm phản ánh đúng tổng vốn 26,72 tỷ.
