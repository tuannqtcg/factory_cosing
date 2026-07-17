// ADR-029 — hợp đồng dữ liệu màn "Quyết Định Nhận Đơn". CEO nhập 1 đơn (dòng SP,
// sản lượng, giá chào) → app so với SÀN chi phí + giá thành đầy đủ → NÊN/CÂN NHẮC/
// KHÔNG nhận. Kèm panel khóa giá what-if (ngưỡng tạm, không lưu). Kết quả thuần từ
// engine đã đóng băng — xem engine/order-acceptance.ts.
import { z } from 'zod';

export const OrderDecisionRequestSchema = z.object({
  line: z.enum(['pipe', 'fitting']),
  quantityTons: z.number().nonnegative(),
  offeredPriceVndPerKg: z.number().nonnegative(),
  /** Ngưỡng khóa giá THỬ (thập phân, 0.1 = 10%). Bỏ trống = ngưỡng cấu hình hiện tại. */
  thresholdPctWhatIf: z.number().min(0).max(1).optional(),
});
export type OrderDecisionRequest = z.infer<typeof OrderDecisionRequestSchema>;

/** Trạng thái khóa giá tại ngưỡng đang xét (để CEO thấy giá niêm yết nào áp dụng). */
export const LockPanelSchema = z.object({
  baselineUsdPerKg: z.number(),
  replacementUsdPerKg: z.number(),
  deviationPct: z.number(),
  thresholdPct: z.number(),
  isLocked: z.boolean(),
  /** Giá vốn niêm yết áp dụng (USD/kg) = baseline nếu khóa, replacement nếu mở. */
  appliedPricingUsdPerKg: z.number(),
});
export type LockPanel = z.infer<typeof LockPanelSchema>;

export const OrderDecisionResultSchema = z.object({
  line: z.enum(['pipe', 'fitting']),
  materialId: z.string(),
  materialName: z.string(),
  lock: LockPanelSchema,
  quantityKg: z.number(),
  offeredPriceVndPerKg: z.number(),
  /** Sàn tiền tươi (biến phí/kg) tại GIÁ THỊ TRƯỜNG (tái tạo) — đơn mới phải mua NL mới. */
  marketVariableFloorVndPerKg: z.number(),
  /** Giá thành ĐẦY ĐỦ/kg tại giá thị trường (bù cả định phí). */
  marketFullCostVndPerKg: z.number(),
  /** Sàn tiền tươi tại GIÁ VỐN KHÓA (baseline) — chỉ đúng nếu dùng hàng tồn đã có. */
  lockedVariableFloorVndPerKg: z.number(),
  /** Biên đóng góp/kg = giá chào − sàn thị trường. */
  contributionPerKgVnd: z.number(),
  contributionTotalVnd: z.number(),
  /** Lãi/lỗ so giá thành đầy đủ = giá chào − full cost thị trường. */
  profitVsFullCostPerKgVnd: z.number(),
  profitVsFullCostTotalVnd: z.number(),
  verdict: z.enum(['accept', 'consider', 'reject']),
});
export type OrderDecisionResult = z.infer<typeof OrderDecisionResultSchema>;
