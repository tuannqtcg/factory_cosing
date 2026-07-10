# ADR-015: Khóa field admin-only TRONG phần tử mảng (Firestore rules) — unroll theo index cố định

Ngày: 2026-07-09 | Trạng thái: CHẤP NHẬN

## Bối cảnh
`docs/contracts/pricing-chain.md`/`material.md` quy định `thresholdPct` (ngưỡng
khóa giá, ADR-004) là field **admin-only** theo TỪNG phần tử mảng:
- `materials[].inventory.priceLock.thresholdPct` (ADR-012 — mỗi nguyên liệu 1
  ngưỡng riêng)
- `inventory.metalInsert[].priceLock.thresholdPct` (ADR-008 — mỗi
  (renType, ptSize) 1 ngưỡng riêng)

`firestore.rules` (M12.3) documented đây là "còn treo" — Firestore Security
Rules language không có vòng lặp để so sánh field bên trong TỪNG phần tử của
1 mảng mà không lỡ khóa luôn các field khác trong CÙNG phần tử mà `pricing`
ĐƯỢC sửa (vd `lots`, `baseline`). Khóa cả mảng (`incoming.materials ==
existing.materials`) sẽ chặn luôn phần `pricing` được phép sửa — sai theo
đúng bảng phân quyền.

Khi dựng M12.9d (màn Tồn Kho + Tham Số — nơi DUY NHẤT `thresholdPct` được
hiển thị làm field nhập liệu, trước đó chưa có UI nào chạm tới), câu hỏi này
buộc phải quyết trước khi code, không thể tiếp tục hoãn — nếu không, `pricing`
có thể tự sửa ngưỡng khóa giá qua gọi Firestore SDK trực tiếp (không qua UI)
dù UI có disable field, vì "khóa" chỉ nằm ở client.

User được hỏi 2 phương án — chọn phương án **unroll theo index cố định**.

## Quyết định
`firestore.rules` so sánh TỪNG phần tử của `materials[]` và
`inventory.metalInsert[]` theo **index cố định** (không phải vòng lặp động —
CEL của Firestore Rules không hỗ trợ; unroll = viết tường minh so sánh cho
từng index 0..N-1, N là cận trên đã biết thực tế):

- `materials[]`: hiện có 4 phần tử (2 line × BlazeMaster/Corzan). Cận trên
  chọn **8** (biên an toàn — không kỳ vọng vượt quá trong tương lai gần; nếu
  vượt, hệ thống CỐ Ý fail-safe — xem mục "Hệ quả — giới hạn").
- `inventory.metalInsert[]`: **CỐ ĐỊNH đúng 10 dòng** theo business model
  (ADR-008, 5 size PT × 2 renType) — không kỳ vọng thay đổi số lượng, chỉ giá
  trị trong từng dòng thay đổi.

Với mỗi index `i` trong cận trên, hàm kiểm tra: NẾU phần tử tồn tại ở CẢ 2
phía (existing/incoming) VÀ `pricing` đang cố sửa nó → `thresholdPct` của
phần tử đó phải giữ nguyên. Cụ thể (rút gọn ý tưởng, xem `firestore.rules`
cho code thật):

```
function materialThresholdLocked(existing, incoming, i) {
  // Ngoài phạm vi mảng ở CẢ 2 phía → không có gì để khóa (không chặn thêm/bớt material — đó là quyền pricing/admin khác, không phải phạm vi ADR này)
  return i >= existing.materials.size() || i >= incoming.materials.size()
    || incoming.materials[i].inventory.priceLock.thresholdPct
       == existing.materials[i].inventory.priceLock.thresholdPct;
}
```
Lặp lại cho `i` = 0..7 (materials) và 0..9 (metalInsert), nối bằng `&&`.

**Phạm vi ADR này CHỈ khóa `thresholdPct`** — không khóa việc thêm/bớt phần tử
mảng (thêm material mới, hay thêm dòng metalInsert) vì đó không phải nội dung
`pricing-chain.md`/`material.md` yêu cầu khóa (thêm nguyên liệu mới là
`pricing`/`admin` theo `material.md` §"Vai trò"). Việc thêm/bớt LÀM DỊCH INDEX
của các phần tử phía sau — nếu `pricing` thêm 1 material ở giữa mảng trong
CÙNG 1 lần ghi vừa đổi thứ tự vừa đổi giá trị khác, rule theo index tĩnh có
thể so sánh nhầm cặp phần tử. Đây là **giới hạn đã biết, chấp nhận được**: UI
thật (M12.9d) LUÔN ghi material mới vào CUỐI mảng (append), không chèn giữa —
giữ đúng bất biến "thứ tự materials[] có ý nghĩa, phần tử đầu = tham chiếu"
(đã có từ ADR-012), nên tình huống đổi thứ tự không xảy ra qua UI thật.

## Hệ quả
- `firestore.rules`: `scenarioLockedFieldsUnchanged()` thêm 2 helper function
  (`materialThresholdLocked`, `metalInsertThresholdLocked`) unroll theo index,
  gọi trong danh sách `&&` hiện có.
- `tests/rules/firestore.rules.test.ts`: thêm test — `pricing` sửa
  `thresholdPct` của 1 material/metalInsert entry bị từ chối; `pricing` sửa
  field KHÁC trong CÙNG phần tử (vd `materials[0].inventory.replacementPriceUsdPerKg`,
  `materials[0].inventory.lots`) vẫn được phép (không lỡ khóa nhầm); `admin`
  sửa `thresholdPct` được phép.
- **Giới hạn (documented, không phải bug)**: nếu `materials[]` vượt quá 8
  phần tử, các phần tử từ index 8 trở đi KHÔNG được rule bảo vệ field
  `thresholdPct` (rule chỉ unroll tới 7) — `pricing` có thể sửa ngưỡng của
  material thứ 9 trở đi mà rules không chặn. Rủi ro THẤP (danh mục nguyên
  liệu nhà máy tăng chậm, mỗi lần thêm material là quyết định kinh doanh có
  chủ đích, không phải thao tác hàng ngày) — nếu vượt ngưỡng 8, cần bump cận
  trên trong rules (đổi 1 dòng, không cần ADR mới, chỉ ghi chú ở đây).
  `inventory.metalInsert[]` không có giới hạn này (cận trên = đúng số lượng
  cố định theo business model).
- M12.9d (Tồn Kho + Tham Số) dựa vào quyết định này để enable field
  `thresholdPct` với 🔒 (disable client-side) VÀ tin tưởng rules chặn thật ở
  server — không còn là "chỉ disable UI" như mockup đã ghi chú.
