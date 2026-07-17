// ADR-027 — hợp đồng dữ liệu màn "Độ Nhạy" (tornado) cho CEO. Câu hỏi if–then:
// "biến nào bào lợi nhuận (EBIT) mạnh NHẤT nếu lệch ±δ?". Kết quả thuần từ engine
// đã đóng băng (calculateScenario) — xem src/engine/sensitivity.ts.
//
// EBIT ở đây là EBIT GIÁ-BÁN-CỐ-ĐỊNH: giữ giá bán VF ở mức baseline rồi cho từng
// driver lệch → đo phần lợi nhuận bị nén (đúng bản chất RỦI RO; KHÁC EBIT engine
// tự-định-giá-lại theo cost-plus, vốn tăng khi chi phí tăng).
import { z } from 'zod';

export const SensitivityDriverResultSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** EBIT khi driver ở mức −δ (đã giữ giá bán baseline). */
  lowEbitVnd: z.number(),
  /** EBIT khi driver ở mức +δ. */
  highEbitVnd: z.number(),
  /** min(low,high) − base — thường ≤ 0 (kịch bản xấu của driver này). */
  downsideVnd: z.number(),
  /** max(low,high) − base — thường ≥ 0 (kịch bản tốt). */
  upsideVnd: z.number(),
  /** |high − low| — độ dài thanh tornado; khoá sắp xếp. */
  maxAbsSwingVnd: z.number(),
});
export type SensitivityDriverResult = z.infer<typeof SensitivityDriverResultSchema>;

export const SensitivityResultSchema = z.object({
  /** Biên độ lệch áp cho mọi driver (0,1 = ±10%). */
  deltaPct: z.number().positive(),
  /** EBIT baseline (giá bán = giá thành thực tế) — khớp KPI Dashboard. */
  baseEbitVnd: z.number(),
  /** Driver đã xếp giảm dần theo maxAbsSwingVnd (rủi ro lớn nhất trước). */
  drivers: z.array(SensitivityDriverResultSchema),
});
export type SensitivityResult = z.infer<typeof SensitivityResultSchema>;
