// ADR-030/031 — hợp đồng dữ liệu màn "Tối Ưu Product-mix". So hiệu quả biên 2 dòng
// SX theo NHIỀU mẫu số (kg · máy-giờ · đồng vốn) để CEO chọn theo ràng buộc thật,
// KHÔNG ép một thước đo. Cho phép nhập GIÁ THỊ TRƯỜNG thật/dòng (ADR-031 — độ mở):
// commodity ống bán mỏng hơn cost+markup, nhập giá thật để kết luận sát thực tế.
import { z } from 'zod';

export const LineMixMetricsSchema = z.object({
  line: z.enum(['pipe', 'fitting']),
  label: z.string(),
  materialName: z.string(),
  vfPriceVndPerKg: z.number(),
  /** Giá dùng để tính đóng góp = giá thị trường nhập vào (nếu có), mặc định = giá VF. */
  effectivePriceVndPerKg: z.number(),
  variableCostVndPerKg: z.number(),
  /** Biên đóng góp/kg = giá hiệu lực − biến phí/kg. */
  marginPerKgVnd: z.number(),
  /** Biên đóng góp/kg ÷ giá hiệu lực (biên %). */
  marginPct: z.number(),
  annualVolumeKg: z.number(),
  annualMachineHours: z.number(),
  /** Vốn cố định của dòng (máy + khuôn), tách từ config (ADR-031). */
  fixedCapitalVnd: z.number(),
  /** Đóng góp/MÁY-GIỜ — hiệu quả theo giờ máy. */
  contributionPerMachineHourVnd: z.number(),
  /** Đóng góp năm ÷ vốn cố định (kiểu ROIC) — hiệu quả theo đồng vốn. */
  contributionPerCapital: z.number(),
  annualContributionVnd: z.number(),
});
export type LineMixMetrics = z.infer<typeof LineMixMetricsSchema>;

export const ProductMixProfileSchema = z.object({
  lines: z.array(LineMixMetricsSchema),
  /** Dòng thắng theo TỪNG ràng buộc — CEO chọn ràng buộc thật của mình. */
  priorityByConstraint: z.object({
    machineHour: z.enum(['pipe', 'fitting']),
    fixedCapital: z.enum(['pipe', 'fitting']),
    volumeKg: z.enum(['pipe', 'fitting']), // theo đóng góp/kg
  }),
});
export type ProductMixProfile = z.infer<typeof ProductMixProfileSchema>;

/** Giá thị trường thật nhập vào (đ/kg) — bỏ trống dòng nào thì dùng giá VF dòng đó. */
export const MarketPriceOverrideSchema = z.object({
  pipe: z.number().nonnegative().optional(),
  fitting: z.number().nonnegative().optional(),
});
export type MarketPriceOverride = z.infer<typeof MarketPriceOverrideSchema>;

export const MixEbitSchema = z.object({
  ebitVnd: z.number(),
  revenueVnd: z.number(),
});
export type MixEbit = z.infer<typeof MixEbitSchema>;
