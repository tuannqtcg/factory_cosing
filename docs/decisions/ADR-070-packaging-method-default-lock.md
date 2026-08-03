# ADR-070 — Chốt mặc định bao bì (per_box/per_bag), bỏ công tắc sidebar

- **Ngày**: 2026-08-03
- **Trạng thái**: Chấp nhận (user phiên 2026-08-03)
- **Kế thừa**: ADR-060 (fittingPackagingMethod), ADR-069 (pipePackagingMethod)

## Bối cảnh

User: *"tôi đã nhập đầy đủ rồi. bỏ sidebar bao bì ống và Bao bì Phụ kiện ... mặc định là bao bì cho ống là túi ni lông, và phụ kiện tính theo thùng carton"*. Sau khi nhập đủ dữ liệu thật (giá thùng + cái/thùng mọi SKU Phụ kiện; dữ liệu cuộn + cây/túi mọi DN Ống), không còn cần công tắc "thử 2 cách" nữa — chốt luôn cách tính đúng bản chất làm MẶC ĐỊNH.

## Quyết định

- `fittingPackagingMethod` default đổi `'flat_per_kg'` → **`'per_box'`**.
- `pipePackagingMethod` default đổi `'flat_per_kg'` → **`'per_bag'`**.
- Bỏ 2 khối công tắc sidebar ("Bao bì Phụ kiện", "Bao bì Ống") ở `AppShell.tsx` — không còn cách đổi qua UI.
- Cơ chế fallback GIỮ NGUYÊN (ADR-060/069): SKU/DN thiếu `piecesPerBox`/`piecesPerBag`, hoặc resource thiếu dữ liệu thùng/cuộn → vẫn tự fallback `flat_per_kg` cho đúng phần đó — không vỡ nếu sau này thêm SKU mới chưa kịp nhập đủ dữ liệu.

⚠️ **Lưu ý vận hành quan trọng**: đổi `.default()` trong Zod schema chỉ có tác dụng khi field **hoàn toàn KHÔNG có** trong document Firestore đã lưu — nếu `scenarios/{id}` đang có sẵn giá trị TƯỜNG MINH `fittingPackagingMethod: 'flat_per_kg'` / `pipePackagingMethod: 'flat_per_kg'` (từng ghi qua công tắc cũ trước khi ADR này xoá UI), giá trị đó VẪN ưu tiên hơn default mới — vì phiên làm việc này không có quyền truy cập trực tiếp Firestore production để kiểm tra/sửa, user cần tự xác nhận: nếu sau khi deploy mà Bảng Giá/Dashboard vẫn hiện "theo kg" dù đã nhập đủ dữ liệu, báo lại để xử lý (sẽ cần 1 lần ghi tay field này = `'per_box'`/`'per_bag'` vào đúng document, hoặc dựng lại 1 công tắc tạm).

## Verify

`tests/parity/fitting-packaging-method.test.ts` + `tests/parity/pipe-packaging-method.test.ts` cập nhật lại assertion "mặc định" theo giá trị mới; toàn bộ test parity gốc (438 ca, dùng fixture KHÔNG có piecesPerBox/piecesPerBag/dữ liệu thùng-cuộn) vẫn xanh nguyên — đúng thiết kế fallback, đổi default KHÔNG phá parity Excel khi fixture thiếu dữ liệu đóng gói. Typecheck + build sạch, suite 447/447.
