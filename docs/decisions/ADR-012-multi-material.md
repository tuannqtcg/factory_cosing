# ADR-012: Nguyên liệu là entity độc lập, gán theo sản phẩm (multi-material — Corzan)

Ngày: 2026-07-07 | Trạng thái: CHẤP NHẬN (kiến trúc; schema chi tiết chờ ĐÓNG BĂNG
ở `docs/contracts/material.md`) | Nguồn: yêu cầu user 2026-07-07 + duyệt layout
prototype `prototype/multi-material-catalog.html` cùng ngày.

## Bối cảnh

Kiến trúc Phase 1 (ADR-003) gắn cứng 1 compound cho mỗi dòng sản xuất:
`ScenarioInput.inventory.pipe|fitting` chứa giá + tồn kho + khóa giá; thuế NK là
1 số chung (`CurrencyParams.compoundImportTaxRate = 6%`, kịch bản EU). Yêu cầu
mới: sản phẩm dòng Corzan dùng compound **Corzan 3710** (ống 3,47 USD/kg, phụ
kiện 3,97 USD/kg — giá user cung cấp 2026-07-07), nhập từ **Ấn Độ**, chạy CHUNG
line đùn/ép với BlazeMaster. Đây là ca dùng thứ 2 mà ADR-003 đặt làm điều kiện
mở Phase 2 — tổng quát hóa CÓ nhu cầu thật, không universal hóa suông.

Ba quyết định phạm vi đã chốt với user (2026-07-07, qua AskUserQuestion):
1. **Thuế NK theo TỪNG nguyên liệu** — user yêu cầu tra cứu: compound nhựa
   chương 39 (HS 3904) nhập Ấn Độ có C/O form AI theo AIFTA (NĐ 122/2022/NĐ-CP,
   hiệu lực 2022-2027) → **thuế NK 0%**; không C/O thì MFN ~5-10% tùy mã con.
   BlazeMaster giữ 6% (kịch bản EU). → `importTaxRate` chuyển từ số chung sang
   thuộc tính của Material. GHI CHÚ: 0% dựa trên nguồn logistics công khai, cần
   forwarder xác nhận đúng mã HS con của Corzan 3710 khi nhập lô đầu.
2. **Markup Corzan RIÊNG** — không dùng chung 25%/40% của BlazeMaster. → markup
   VF chuyển từ cặp số chung (`markupVfPipe`/`markupVfFitting`) sang thuộc tính
   của Material. Giá trị % cho Corzan CHƯA có — user sẽ cung cấp; tạm dùng
   giá trị BlazeMaster làm placeholder có đánh dấu.
3. **Chung line, chung MHR** — Corzan chỉ khác NGUYÊN LIỆU; công suất, khấu hao,
   nhân công, điện nước, MHR, phân bổ chi phí chung (theo kg, 2 dòng) giữ
   nguyên. KHÔNG thêm driver/resource mới.

## Quyết định

1. **`Material` là entity độc lập** (schema mới `src/schemas/material.ts`,
   contract `docs/contracts/material.md`): danh tính thương mại (tên, mã, xuất
   xứ) + tham số landed cost riêng (`importTaxRate`, `customsLogisticsFeeRate`)
   + markup VF riêng (`markupVf`) + tồn kho/khóa giá TÁI DÙNG NGUYÊN
   `CompoundInventorySchema` (ADR-002/004 — không viết cơ chế mới).
2. **`Product` thêm `materialId`** — mỗi sản phẩm trỏ về đúng 1 compound.
   Ren kim loại (ADR-008) giữ nguyên cơ chế riêng, KHÔNG gộp vào Material.
3. **`ScenarioInput`**: thêm `materials: Material[]`; `inventory.pipe|fitting`
   bị THAY THẾ bởi tồn kho nằm trong từng Material (`inventory.metalInsert`
   giữ nguyên). `CurrencyParams` bỏ `compoundImportTaxRate`/
   `customsLogisticsFeeRate` (chuyển vào Material); `MarkupChain` bỏ
   `markupVfPipe`/`markupVfFitting` (chuyển vào Material), GIỮ `markupTcg` +
   `listPriceMargin` là chính sách kênh phân phối chung — nếu user muốn TCG/
   niêm yết riêng cho Corzan thì sửa contract trước khi đóng băng.
4. **`ScenarioOutput`**: `priceLock.pipe|fitting` → `priceLock.byMaterial[]`;
   `dualCosting.pipe|fitting` → `dualCosting.byMaterial[]`; thang giá 5 bậc và
   CVP tính theo cặp (dòng SX, material) — chi tiết ở contract. Công thức từng
   bậc/CVP KHÔNG đổi, chỉ giá compound đầu vào lấy theo material.
5. **Plan_SX**: nhu cầu nguyên liệu (`materialRequirement`) tách theo
   materialId — kế hoạch mua/ngoại tệ vẫn dùng replacement THÔ từng material
   (đúng ADR-004, không qua khóa).
6. **Migration**: scenario hiện hành sinh 2 Material mặc định
   (`bm-orange-pipe` 3,03/6%, `bm-fitting` 3,85/6%) từ `inventory.pipe|fitting`
   cũ + markup từ `MarkupChain` cũ — số vàng v3.7 PHẢI khớp tuyệt đối sau
   migration (parity test là cổng nghiệm thu).

## Hệ quả

- Đây là thay đổi cấu trúc schema đã đóng băng → contract mới
  `docs/contracts/material.md` + sửa `product.md`/`scenario.md`/`cost-pool.md`,
  tất cả phải qua cổng ĐÓNG BĂNG (user duyệt) trước khi code Pha 3.
- Fixture vàng hiện tại KHÔNG đổi giá trị (BlazeMaster giữ nguyên số v3.7);
  cần fixture MỚI cho Corzan khi có danh mục SKU thật (đơn trọng, chu kỳ,
  cavity, khuôn — ADR-007 áp dụng cho khuôn Corzan y hệt).
- Còn thiếu từ user trước khi nghiệm thu Pha 3/4: (a) % markup VF cho Corzan
  ống + phụ kiện; (b) danh mục SKU Corzan + khuôn; (c) xác nhận thuế NK 0% với
  forwarder (mã HS con); (d) tồn kho Corzan ban đầu (hiện 0).
- Excel v3.7 KHÔNG có Corzan — nguồn chân lý cho Corzan sẽ là bản Excel mới
  hoặc dữ liệu user cung cấp trực tiếp (ghi rõ nguồn vào fixture như ADR-007/008).
