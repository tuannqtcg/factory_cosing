---
name: security-review
description: Checklist bảo mật cho Costing App trên Firebase — security rules theo vai, secrets, validate 2 đầu. Dùng ở Pha 4 trước merge, hoặc khi viết/sửa Firestore rules, auth, hay bất kỳ code chạm dữ liệu giá.
---

# Skill: Security Review (Pha 4)

## Ngữ cảnh riêng của dự án
Dữ liệu nhạy nhất = CẤU TRÚC CHI PHÍ (giá vốn, MHR, margin). Rò rỉ cho khách/đối thủ
là thiệt hại kinh doanh trực tiếp. Vai `sales` chỉ được thấy thang giá & bảng giá,
KHÔNG thấy chi phí gốc.

## Checklist bắt buộc
- [ ] Firestore rules: default deny; mỗi collection khai báo vai đọc/ghi tường minh
- [ ] Vai sales: đọc `priceLadder`, `priceList`; CẤM đọc `costPools`, `resources`, `inventoryLots`
- [ ] Field-level: nếu 1 doc trộn giá bán + giá vốn → TÁCH doc, rules không lọc được field
- [ ] Mọi write qua Zod parse ở Cloud Function / rules validate — không tin client
- [ ] Không secret trong repo: quét `.env`, `serviceAccount`, key trong code
- [ ] Emulator test rules: user mỗi vai chạy thử đọc/ghi trái phép phải FAIL
- [ ] Audit log cho thao tác đổi giá (ai, khi nào, giá cũ → mới)
