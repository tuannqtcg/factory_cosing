# ADR-004: Cơ chế khóa bảng giá — baseline + ngưỡng (price lock with threshold)
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN | Nguồn Excel: BlazeMaster_Model_v3_4.xlsx

## Bối cảnh
Giá tái tạo (ADR-002) nếu chảy thẳng vào bảng giá thì bảng giá rung theo mọi
biến động NVL, mất niềm tin kênh phân phối; nếu nhập tay thuần thì rủi ro quên
cập nhật, bảng giá chạy trên giá cũ vô thời hạn.

## Quyết định
Ba tham số: `baselineUsd` (giá đã chốt bảng giá hiện hành), `replacementUsd`
(giá tái tạo thị trường), `thresholdPct` (ngưỡng, mặc định 3%).

```
deviation    = replacement / baseline − 1
pricingPrice = |deviation| > threshold ? replacement : baseline   // ổ khóa
```
- Trong ngưỡng: bảng giá ĐỨNG YÊN tuyệt đối tại baseline (nuốt biến động nhỏ).
- Vượt ngưỡng (hai chiều): toàn chuỗi giá chuyển theo tái tạo + trạng thái
  "MỞ KHÓA — chốt lại baseline = replacement sau khi duyệt" (reset thủ công, có audit).
- Cảnh báo staleness: |replacement/lastLotPrice − 1| > threshold → "giá tái tạo có thể cũ".
- Kế hoạch ngoại tệ mua NVL luôn dùng REPLACEMENT (thị trường), không dùng giá khóa.

## Acceptance criteria (fixture cho engine — đã verify trên Excel v3.4)
| # | Kịch bản (ống, baseline 3,03, ngưỡng 3%) | Kỳ vọng |
|---|---|---|
| 1 | replacement 3,03 | BE 106.205 — KHÓA |
| 2 | replacement 3,10 (+2,3%) | BE giữ 106.205 — KHÓA; USD kế hoạch = 3,10 |
| 3 | replacement 3,50 (+15,5%) | BE 121.012 — MỞ KHÓA, nhắc chốt baseline |
| 4 | replacement 2,80 (−7,6%) | BE 98.958 — MỞ KHÓA (đối xứng 2 chiều) |
| 5 | lô mới 3,50 nhưng replacement quên ở 3,03 | KHÓA + cảnh báo "GIÁ TÁI TẠO CÓ THỂ CŨ" |
