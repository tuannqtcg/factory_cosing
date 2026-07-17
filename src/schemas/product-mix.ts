// ADR-030 — hợp đồng dữ liệu màn "Tối Ưu Product-mix". So hiệu quả biên 2 dòng SX
// (Ống/Phụ kiện) theo đơn vị NGUỒN LỰC RÀNG BUỘC (máy-giờ), không chỉ theo % — để
// CEO thấy dồn lực vào đâu lãi hơn. Kết quả thuần từ engine — xem engine/product-mix.ts.
import { z } from 'zod';

export const LineMixMetricsSchema = z.object({
  line: z.enum(['pipe', 'fitting']),
  label: z.string(),
  materialName: z.string(),
  vfPriceVndPerKg: z.number(),
  variableCostVndPerKg: z.number(),
  /** Biên đóng góp/kg = giá VF − biến phí/kg. */
  marginPerKgVnd: z.number(),
  /** Biên đóng góp/kg ÷ giá VF (biên %). */
  marginPct: z.number(),
  annualVolumeKg: z.number(),
  annualMachineHours: z.number(),
  /** Đóng góp/MÁY-GIỜ — hiệu quả theo nguồn lực ràng buộc thật (khoá xếp ưu tiên). */
  contributionPerMachineHourVnd: z.number(),
  annualContributionVnd: z.number(),
});
export type LineMixMetrics = z.infer<typeof LineMixMetricsSchema>;

export const ProductMixProfileSchema = z.object({
  lines: z.array(LineMixMetricsSchema),
  /** Dòng nên ưu tiên khi MỞ RỘNG (đóng góp/máy-giờ cao hơn). */
  priorityLine: z.enum(['pipe', 'fitting']),
});
export type ProductMixProfile = z.infer<typeof ProductMixProfileSchema>;

export const MixEbitSchema = z.object({
  ebitVnd: z.number(),
  revenueVnd: z.number(),
});
export type MixEbit = z.infer<typeof MixEbitSchema>;
