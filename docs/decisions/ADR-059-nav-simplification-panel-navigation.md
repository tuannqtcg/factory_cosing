# ADR-059 — Tối giản điều hướng: 5 mục + danh sách/panel lồng nhau (kiểu Twenty CRM)

- **Ngày**: 2026-07-31
- **Trạng thái**: Đã duyệt Pha 1 (user chốt layout qua `prototype/layout-redesign-proposal.html`, 3 vòng góp ý) → đang triển khai Pha 3.
- **Kế thừa**: ADR-034 (sidebar theo tình huống CEO), ADR-041 (nhãn vai XEM/THỬ/CHỈNH THẬT), ADR-024 (Giá Vốn Theo Lô, chỉ đọc), ADR-049 (Thiết Lập Dữ Liệu), ADR-057 (gộp nơi nhập baseline).
- **Bị sửa đổi**: ADR-057 mục "gộp nơi nhập baseline về MỘT chỗ (Thiết Lập Dữ Liệu → mục ④)" — chỗ đó nay CHUYỂN sang panel Nguyên Liệu (vẫn giữ nguyên tắc "một chỗ duy nhất", chỉ đổi địa chỉ).

## Bối cảnh
Sau nhiều đợt thêm tính năng, sidebar có 7 mục + hub con (Bảng Giá gộp 3 sub-tab), Tổng
Quan gánh cả giá vốn/sản xuất/P&L trên 1 trang dài, chữ nhỏ (9–11px), nhiều nút bấm/panel
nổi (ExplainPanel, AssistantChat) cùng lúc. User phản hồi: rối, khó thao tác, đặc biệt bộ
chọn nguyên liệu lặp lại 3 kiểu khác nhau ở 3 màn (Dashboard 2 chip riêng Ống/PK, Bảng Giá
chip lọc khác, Tồn Kho dropdown khác).

Đã thảo luận qua artifact tương tác (3 vòng, xem `docs/sessions/SESSION_2026-07-31.md`),
chốt hướng: **tối giản menu + danh sách/panel lồng nhau kiểu Twenty CRM** thay vì thêm
mục sidebar cho mỗi loại dữ liệu.

## Quyết định
### 1. Sidebar rút còn 5 mục + Trợ Giúp ghim
| Cũ (7 mục) | Mới (5 mục + Trợ Giúp) |
|---|---|
| Tổng Quan | Tổng Quan (không đổi) |
| Bảng Giá (hub 3 sub-tab: vf/npp/analytics) | Bảng Giá — sub-tab giữ nguyên, **chỉ đổi cách xem 1 dòng SKU** (mục 3) |
| Trợ Lý CEO | → tab "Trợ Lý CEO" trong mục **Kịch Bản & Hoạch Định** (mới) |
| So Sánh Kịch Bản | → tab "So Sánh Kịch Bản" trong mục **Kịch Bản & Hoạch Định** |
| Giá Vốn Theo Lô | **Xoá khỏi sidebar** — vai trò "xem giá vốn + quyết định chốt lại" chuyển vào panel của mục **Nguyên Liệu** (mới) |
| Thiết Lập Dữ Liệu | → tab "Thiết Lập Dữ Liệu" trong mục **Thiết Lập** (mới) |
| Danh Mục Sản Phẩm | → tab "Danh Mục Sản Phẩm" trong mục **Thiết Lập** |
| *(không có)* | **Nguyên Liệu** (mới) — xem mục 2 |
| *(không có)* | **Trợ Giúp** (mới, ghim cuối sidebar, luôn 1 click) |

Nhãn vai (XEM/THỬ/CHỈNH THẬT — ADR-041) **giữ nguyên cơ chế**, chỉ tính lại theo tab mới;
đây là tín hiệu an toàn riêng biệt với việc gộp sidebar, không bỏ.

### 2. Màn "Nguyên Liệu" (mới) — danh sách + panel, thay thế Giá Vốn Theo Lô + 1 phần Tồn Kho
- **Danh sách** (1 dòng/material — cả Ống lẫn Phụ kiện, mọi brand): Tên, Baseline, Giá
  mua mới hôm nay, Trạng thái khóa. Đọc từ `scenario.materials` + `internal.priceLock`
  — không tính lại, không engine mới.
- **Bấm 1 dòng → panel bên phải** (component dùng chung `SlideOverPanel`, xem mục 4):
  4 số so sánh (Baseline/Giá mua mới hôm nay/Lệch/Bình quân gia quyền) + trạng thái +
  danh sách lô (đọc `material.inventory.lots`) + nút **"Chốt baseline = giá hôm nay"**
  khi MỞ KHÓA (ghi `materials[].inventory.priceLock.baseline`, cùng field/cùng quyền
  admin/pricing như `DataSetupScreen.updBaseline` hiện có — CHUYỂN chỗ, không nhân bản).
- **Bấm 1 lô trong panel → panel con lồng (nested, cấp 2)**: xem/sửa đúng lô đó (kg,
  giá, thuế/phí riêng ADR-058) — tái dùng `updateLot`/`updateLotRate` của
  `InventoryScreen.tsx`, không viết lại logic ghi.
- **Thiết Lập Dữ Liệu mục ④** bỏ ô "Giá baseline" + nút "Chốt baseline" (dời sang đây);
  giữ lại: nhập lô, `replacementPriceUsdPerKg`, ngưỡng khóa (`thresholdPct`, admin-only).
- `LotCostingScreen.tsx` (đọc-only, ADR-024) không còn route riêng — nội dung "vì sao
  nên/không nên chốt lại" gộp vào panel Nguyên Liệu (không dùng 2 câu chuyện song song).

### 3. Bảng Giá — đổi cách mở chi tiết SKU, KHÔNG đổi dữ liệu/cột
`PriceList.tsx` (dạng "Danh sách"): bấm 1 dòng mở `SlideOverPanel` (tái dùng nguyên
`renderOrigin()` đã có — "Giá này từ đâu ra?" + so sánh Baseline/BQGQ) thay vì mở rộng
ngay dưới dòng (`expandedKey` cũ). Bảng vẫn đủ toàn bộ SKU + 2 cột Giá VF BQGQ/Chênh
lệch đã có (PR #32) — không lùi tính năng, chỉ đổi nơi hiển thị chi tiết.

### 4. Component dùng chung `SlideOverPanel`
`src/features/shell/SlideOverPanel.tsx` (mới) — panel bên phải trượt vào, backdrop mờ
nền (giữ ngữ cảnh phía sau, không điều hướng rời trang), hỗ trợ **lồng tối đa 2 cấp**
(cấp 2 hẹp hơn, z-index cao hơn, có nút "← Quay lại"). Đóng bằng nút X / bấm backdrop /
phím Esc (đóng cấp trong cùng trước). Thuần trình bày (React state cục bộ, không Firebase/
API) — mọi component con bên trong panel vẫn tự gọi đúng hàm ghi/đọc đã có.

### 5. Kịch Bản & Hoạch Định / Thiết Lập — gộp bằng tab, KHÔNG đổi component con
2 mục mới chỉ là **wrapper tab** quanh `CeoPlannerScreen`/`ScenarioCompareScreen` và
`DataSetupScreen`/`ProductsScreen` hiện có — props/logic bên trong giữ nguyên 100%.

### 6. Trang Trợ Giúp (mới)
`src/features/shell/HelpScreen.tsx` — nội dung tĩnh (không đọc scenario), gom từ
`TermInfo.tsx` (định nghĩa khái niệm giá đã viết) + `docs/GLOSSARY.md`, tổ chức theo
từng màn + mục tra cứu thuật ngữ, có ô tìm kiếm lọc client-side. Ghim cuối sidebar.

## KHÔNG đổi
- Không schema mới, không field mới trong `ScenarioInput`/`ScenarioOutput`/`PriceListDoc`.
- Không công thức engine mới — mọi số vẫn tính bởi `calculateScenario`/
  `calculateDashboardKpis`/`dual-costing.ts` đã đóng băng.
- Không đổi quyền (admin/pricing) cho hành động chốt baseline/sửa lô — vẫn đúng field,
  đúng validate `ScenarioInputSchema.safeParse`, đúng Firestore rules hiện có.

## Còn treo (ghi rõ để phiên sau biết, tránh làm lại)
- Chưa quyết định: `AssumptionsScreen.tsx`/`ConfigScreen` (dead code từ ADR-049) và
  `src/features/order-acceptance/` (dead code, user xác nhận giữ nguyên 2026-07-31) —
  KHÔNG đụng trong đợt này.
- Chưa roll-out design system đen–trắng (ADR-033, mục 1 "BÀN GIAO PHIÊN MỚI" cũ trong
  ROADMAP) — làm sau, không lẫn vào đợt tái cấu trúc điều hướng này.
