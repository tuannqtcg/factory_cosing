# ADR-024: View riêng "Giá Vốn Theo Lô & Giá Bán" cho CEO (câu hỏi đa-lô)

Ngày: 2026-07-16 | Trạng thái: CHẤP NHẬN

## Bối cảnh
User nêu câu hỏi điều hành cốt lõi: *"Nếu 5 lô hàng có giá vật liệu khác nhau thì
điều gì xảy ra, và giá bán thế nào là phù hợp?"* — và nhấn mạnh đây **KHÔNG phải
phần mềm ERP**: không làm luồng tác nghiệp Tồn kho→định mức→... Đây là **câu hỏi
KHÁC** với màn Trợ Lý CEO (màn đó: "giá what-if → giá bán → hiệu quả năm"). Nhồi
chung sẽ rối → user chốt: **tách một view riêng**.

Toàn bộ logic đã có sẵn trong engine (giá vốn kép ADR-002 + khóa giá ADR-004):
`weightedAvgUsdPerKg` (bình quân lô), `holdingGainLossVnd` (lãi/lỗ giữ kho),
`evaluatePriceLock` (khi nào chốt lại). ScenarioOutput đã xuất `dualCosting`,
`priceLock`, `priceLadder`. Nhưng chưa được đóng khung thành "câu trả lời cho CEO".

## Quyết định
Thêm màn `src/features/lot-costing/LotCostingScreen.tsx` (tab **"Giá Vốn Theo Lô"**,
nhóm ĐIỀU HÀNH), **CHỈ đọc** `ScenarioOutput` + `ScenarioInput` — KHÔNG engine mới,
KHÔNG schema mới, KHÔNG sửa dữ liệu (nhập/sửa lô vẫn ở màn Tồn Kho admin). Mỗi
nguyên liệu 1 thẻ, trả lời trực diện:
1. **5 lô đang có** (tồn tấn + giá USD/kg) → **giá vốn bình quân** (sổ sách).
2. **Giá tái tạo** (mua mới) + độ lệch so baseline + trạng thái khóa (±ngưỡng ADR-004).
3. **Lãi/lỗ giữ kho** = (tái tạo − bình quân) × tồn; cảnh báo dự phòng VAS-02 nếu lỗ.
4. **2 giá bán**: theo giá vốn sổ sách (`bookCostPerKg × (1+markupVf)`) vs **giá
   chính thức theo khóa giá** (`priceLadder.targetPrice`).
5. **Khuyến nghị**: lệch vượt ngưỡng (mở khóa) → NÊN CHỐT LẠI; trong ngưỡng → giữ giá.

## Hệ quả
- UI thuần trên engine đã đóng băng — không đụng parity (343/343 giữ nguyên).
- Phạm vi hẹp, đúng "một câu hỏi = một view" (đồng bộ ADR-018/020). KHÔNG mở sang ERP.
- Màn Tồn Kho admin giữ vai trò nhập/sửa lô; view này chỉ để CEO ĐỌC & QUYẾT ĐỊNH.
- Vai xem: admin/pricing (tầng chiến lược, chứa giá vốn — ADR-006), như view CEO.
