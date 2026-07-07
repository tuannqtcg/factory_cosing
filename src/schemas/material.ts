// Nguồn nghiệp vụ: docs/contracts/material.md — ADR-012 (multi-material/Corzan).
// ĐÓNG BĂNG 2026-07-07 (user duyệt "đóng băng, markup như đề xuất") — sửa cấu
// trúc field phải có ADR mới.
//
// Material = danh tính thương mại + landed cost + markup VF + tồn kho/khóa giá
// của MỘT loại compound. Cơ chế giá TÁI DÙNG NGUYÊN ADR-002/004 qua
// CompoundInventorySchema — entity này chỉ là CHỖ CHỨA theo nguyên liệu thay vì
// theo dòng sản xuất. Ren kim loại (ADR-008) KHÔNG thuộc Material.
import { z } from 'zod';
import { CompoundInventorySchema } from './pricing-chain.js';

export const MaterialSchema = z.object({
  id: z.string(), // slug ổn định: 'bm-orange-pipe' | 'bm-fitting' | 'corzan-pipe' | 'corzan-fitting'
  name: z.string(), // nhãn hiển thị: "Corzan 3710 (ống)"
  code: z.string(), // mã nội bộ: "CZ-3710-P"
  originLabel: z.string(), // "EU" | "Ấn Độ (AIFTA)" — nhãn hiển thị, không enum (nguồn nhập có thể đổi)
  // Landed cost RIÊNG từng nguyên liệu (ADR-012 #1) — trước đây là
  // CurrencyParams.compoundImportTaxRate/customsLogisticsFeeRate chung:
  importTaxRate: z.number().min(0).max(1), // BlazeMaster 0.06 (EU); Corzan 0 (AIFTA C/O form AI, NĐ 122/2022)
  customsLogisticsFeeRate: z.number().min(0).max(1),
  // Markup VF RIÊNG (ADR-012 #2) — trước đây là MarkupChain.markupVfPipe/markupVfFitting.
  // Corzan: user duyệt "markup như đề xuất" 2026-07-07 = ống 0.25 / phụ kiện 0.40
  // (cùng giá trị BlazeMaster nhưng là FIELD RIÊNG — đổi độc lập được về sau):
  markupVf: z.number().min(0),
  // Tồn kho + khóa giá — TÁI DÙNG NGUYÊN schema ADR-002/004, không thêm field:
  inventory: CompoundInventorySchema,
});
export type Material = z.infer<typeof MaterialSchema>;
