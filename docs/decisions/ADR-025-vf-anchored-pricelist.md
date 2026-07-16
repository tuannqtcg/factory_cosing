# ADR-025: Bảng Giá niêm yết theo giá VF, tách bảng giá Nhà Phân Phối thành bước dẫn xuất

Ngày: 2026-07-16 | Trạng thái: CHẤP NHẬN

## Bối cảnh
User xây **giá bán của nhà máy (VF)** làm giá gốc; **markup nhà phân phối
không thuộc phạm vi quyết định của CEO nhà máy**. Nhưng màn "Bảng Giá" đang
niêm yết `listPriceBeforeVat` — tức giá đã cộng chồng markup TCG (30%) + biên
nhà phân phối (30%) — cao hơn giá VF ~86% (VD Tê đều DN20: VF 14.440 vs list
26.900). Trong khi màn "Giá Vốn Theo Lô" (ADR-024) lại niêm yết `targetPrice =
giá VF/kg`. → Hai màn nói **2 tầng giá khác nhau**, không nhất quán, và Bảng Giá
đang hiển thị nhầm tầng so với thứ CEO thực sự chốt.

Quan trọng: cơ chế "giá cố định đến ngưỡng" (khóa giá ADR-004) chốt ở **tầng giá
vật liệu** (`pricingPrice` = baseline khi trong ±ngưỡng, = giá tái tạo khi vượt).
Vì markup TCG/NPP chỉ là **hệ số nhân cố định**, giá VF / TCG / list đứng yên
cùng nhau khi khóa và nhảy cùng nhau khi mở khóa → nhìn tầng nào thì ngưỡng "khi
nào đổi giá" cũng y hệt. Do đó neo bảng niêm yết về VF **không mất** tính ổn định.

## Quyết định
1. **Bảng Giá → niêm yết giá VF** (`chain.vfPricePerUnit`, kèm bản có VAT =
   `round(vf × (1+vatRate))`). Đây là **giá xuất xưởng** — cùng tầng với
   `targetPrice` mà Giá Vốn Theo Lô dùng → 2 màn nhất quán, khóa giá áp trực tiếp.
2. **Thêm màn "Bảng Giá NPP"** (Nhà Phân Phối) — **CHỈ đọc** cùng `PriceListDoc`,
   trình bày **quy trình dẫn xuất TỪ giá VF**: VF → ×(1+markupTcg) = TCG →
   ROUNDUP(TCG/(1−listMargin)) = niêm yết NPP → ×(1+VAT). Mỗi bước hiện rõ % để
   thấy đây là **một quy trình nối tiếp**, không phải bảng giá tách rời.

Không schema mới, không engine mới: `PriceListDoc.skuPriceChains[].chain` đã
persist đủ `vfPricePerUnit`, `tcgPricePerUnit`, `listPriceBeforeVat/WithVat`
(scenario.ts). markupTcg/listMargin suy ngược per-SKU từ chuỗi (đồng nhất toàn cục).

## Hệ quả
- Parity engine không đổi (chuỗi giá vẫn tính đủ 5 bậc; chỉ đổi cột UI hiển thị) —
  343/343 giữ nguyên.
- Bảng Giá vẫn "sales-safe" (VF là GIÁ BÁN, không phải giá vốn; không lộ cost).
- Hai màn giá cùng neo tầng VF → dải cảnh báo "nối 2 màn" (việc kế tiếp) nhất quán.
- Quy trình rõ: CEO chốt giá VF (ổn định theo khóa giá) → bảng giá NPP tự dẫn xuất.
