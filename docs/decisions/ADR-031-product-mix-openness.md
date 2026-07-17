# ADR-031: Product-mix "độ mở" — nhiều mẫu số + giá thị trường nhập tay + chọn ràng buộc

Ngày: 2026-07-17 | Trạng thái: CHẤP NHẬN | Nối tiếp: ADR-030

## Bối cảnh
ADR-030 kết luận "ưu tiên Ống" vì đóng góp/máy-giờ Ống cao (đùn nhanh). User (chuyên
môn ngành) phản biện đúng: THỰC TẾ phụ kiện/van lãi hơn ống. Lý do: (1) ống là
COMMODITY biên mỏng, phụ kiện/van có QUYỀN ĐỊNH GIÁ (khóa spec hệ thống); (2) mật độ
giá trị & vốn lưu động; (3) máy ép linh hoạt hơn đùn. Kiểm chứng: với số mô hình hiện
tại, Ống thắng CẢ máy-giờ LẪN vốn (ROIC 150% vs 57%) — vì mô hình giả định ống bán
620 tấn ở đúng giá cost+markup, điều KHÔNG đúng thực tế. → Cái sai là GIÁ, và công cụ
áp MỘT mẫu số là thiên lệch. User: "phần mềm phải có độ mở để hiệu chỉnh tham số".

## Quyết định
Nâng Product-mix thành công cụ ĐA-MẪU-SỐ, MỞ tham số (không đổi engine cốt lõi):
1. **Nhiều mẫu số**: đóng góp / kg · / máy-giờ · **/ đồng vốn cố định (ROIC)** — vốn
   tách theo dòng từ config (đùn+khuôn kéo/cắt vs máy ép+khuôn).
2. **Chọn RÀNG BUỘC**: máy-giờ / vốn / **sản lượng-kg (thị trường)**. Ưu tiên hiện
   theo ràng buộc đã chọn. Mặc định = thị trường (đúng ngành: phụ kiện/van thắng).
3. **Giá thị trường nhập tay/dòng** (mặc định = giá VF): commodity ống bán mỏng hơn
   cost+markup → nhập giá thật, đóng góp/ROIC/EBIT mô phỏng tính lại theo giá thật.
   Hook sẵn cho số giá thị trường user cung cấp sau.

## Hệ quả
- Schema `product-mix.ts` mở rộng (thêm effectivePrice, fixedCapital, contributionPerCapital,
  priorityByConstraint, MarketPriceOverride). Engine nhận `marketPrice` override; base
  (không override, mix 1/1) VẪN khớp `ebitAtNormalCapacityVfPrice`. Parity giữ nguyên,
  suite 370/370.
- Hết thiên lệch: theo thị trường → Phụ kiện ưu tiên (khớp thực tế); theo máy-giờ/vốn
  → Ống. CEO tự chọn theo ràng buộc thật + giá thật.
- CÒN TREO: vốn dùng chung/lưu động chưa phân bổ vào ROIC (mới tính vốn trực tiếp dòng);
  bổ sung khi cần. Chờ user cấp giá thị trường thật của ống để chốt kết luận.
