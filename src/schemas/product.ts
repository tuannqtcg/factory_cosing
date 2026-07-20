// Nguồn nghiệp vụ: docs/contracts/product.md — ADR-001, ADR-007, ADR-008.
// ĐÓNG BĂNG cùng docs/contracts/*.md — sửa cấu trúc field phải có ADR mới.
// Sửa 2026-07-07 (ADR-012, contract material.md đóng băng cùng ngày): thêm
// `materialId` bắt buộc — mỗi SP trỏ về đúng 1 Material (compound). Validate
// materialId tồn tại ở tầng parse ScenarioInput (không refine tại đây vì
// Product không thấy danh sách materials).
import { z } from 'zod';
import type { MoldAsset } from './resource.js';

export const PipeProductSchema = z.object({
  kind: z.literal('pipe'),
  dn: z.string(),
  spec: z.string(),
  odMm: z.number().positive(),
  minWallThicknessMm: z.number().positive(),
  unitWeightKgPerM: z.number().positive(),
  materialId: z.string(), // ADR-012
  // ADR-046 — tốc độ đùn thực đo THEO SIZE (mét/giờ). Optional: hiện chỉ để
  // nhập + kiểm tra công suất (cảnh báo khi m/giờ × đơn trọng > kg/giờ max của
  // máy) — CHƯA dùng tính giá thành (giữ parity). Sẽ dùng ở bước nâng mô hình.
  capacityMetersPerHour: z.number().positive().optional(),
});
export type PipeProduct = z.infer<typeof PipeProductSchema>;

// BOM ren kim loại (ADR-008) — chỉ có ở SKU họ "Nối ren trong/ngoài" (11/91).
const MetalInsertBomSchema = z.object({
  renType: z.enum(['trong', 'ngoài']),
  ptSize: z.string(),
  insertQtyPerUnit: z.number().int().positive(),
});
export type MetalInsertBom = z.infer<typeof MetalInsertBomSchema>;

export const FittingProductSchema = z.object({
  kind: z.literal('fitting'),
  productName: z.string(),
  sizeLabel: z.string(),
  unit: z.string(),
  schedule: z.string().optional(),
  moldSizeDN: z.number().int().positive(),
  cycleTimeSec: z.number().positive(),
  cavity: z.number().int().positive(),
  unitWeightKg: z.number().positive(),
  metalInsert: MetalInsertBomSchema.optional(),
  materialId: z.string(), // ADR-012
});
export type FittingProduct = z.infer<typeof FittingProductSchema>;

export const ProductSchema = z.discriminatedUnion('kind', [PipeProductSchema, FittingProductSchema]);
export type Product = z.infer<typeof ProductSchema>;

export type ManagementStatus = 'active' | 'pending_mold';

/**
 * ADR-007 (quyết định bổ sung): managementStatus KHÔNG lưu trên Product — tính
 * ra từ moldAssets để tránh lỗi đồng bộ tay (đúng lỗi EXCLUDED_SKUS ở Pha 1).
 * Ống luôn 'active' — không có khái niệm khuôn theo SKU (xem resource.md).
 */
export function managementStatusOf(product: FittingProduct, moldAssets: MoldAsset[]): ManagementStatus {
  const hasMold = moldAssets.some((asset) =>
    asset.producesSkus.some(
      (sku) => sku.productName === product.productName && sku.sizeLabel === product.sizeLabel,
    ),
  );
  return hasMold ? 'active' : 'pending_mold';
}
