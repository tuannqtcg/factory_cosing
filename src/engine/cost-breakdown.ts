// Thác chi phí đ/kg — TÁCH giá thành đầy đủ thành 5 tầng để trả lời "tiền đi
// đâu?" (giải thích chênh lệch giữa cảm nhận vận hành của giám đốc nhà máy —
// chỉ phần tiền mặt gia công — với giá thành đầy đủ mà app tính).
//
// THUẦN TRÌNH BÀY: chỉ GOM LẠI các cấu phần chi phí ĐÃ được pipe.ts/fitting.ts
// tính sẵn, KHÔNG có công thức nghiệp vụ mới. Tổng 5 tầng = fullCostPerKg của
// engine (parity — xem tests/unit/cost-breakdown.test.ts).
//
// ADR-066 — TRƯỚC ADR này, bao bì bị GỘP vào `cashDirect` (cùng nhân
// công/điện/nước/bảo trì) — user 2026-08-02: "toàn bị gộp vào thế này", không
// thấy được riêng bao bì là bao nhiêu. Tách thành tầng `packaging` riêng, và
// nhận giá trị packagingCostPerKg TỪ NGOÀI truyền vào (không tự đọc
// resource.packagingCostPerKg nữa) để phản ánh đúng khi Phụ kiện bật
// fittingPackagingMethod='per_box' (ADR-065) — caller (dashboard-support.ts,
// scenario.ts) phải truyền ĐÚNG giá trị đã dùng để tính `cost.fullCostPerKg(Ref)`
// truyền vào, nếu không tổng 5 tầng sẽ không khớp `total`.
import type { PipeCostAtNormalCapacity } from './pipe.js';
import type { FittingCostAtNormalCapacity } from './fitting.js';

export interface CostLayersPerKg {
  /** Gia công tiền mặt trực tiếp: nhân công + điện + nước + bảo trì — phần "tiền túi" nhà máy cảm nhận được (KHÔNG gồm bao bì — ADR-066 tách riêng). */
  cashDirect: number;
  /** ADR-066 — Bao bì (túi ni lông Ống / carton hoặc phẳng Phụ kiện) tách riêng khỏi cashDirect. */
  packaging: number;
  /** Chi phí chung phân bổ (kiểm định + thuê đất + khấu hao tài sản chung) theo sản lượng. */
  sharedOverhead: number;
  /** Khấu hao máy + khuôn — không chi bằng tiền mặt hàng tháng nên dễ bị bỏ quên; GIẢM mạnh khi tăng ca/lấp công suất. */
  depreciation: number;
  /** Nguyên liệu compound / kg thành phẩm (đã ÷ hiệu suất) — sàn giá cứng, phần lớn là hạt nhựa nhập tính bằng USD. */
  material: number;
  /** = engine fullCostPerKg (tổng 5 tầng trên). */
  total: number;
}

/** Ống (driver kg) — chia mọi cấu phần/năm cho sản lượng bình thường (kg/năm). Ống luôn phẳng theo kg (chưa có chế độ per_box như Phụ kiện — ADR-062). */
export function pipeCostLayersPerKg(
  cost: PipeCostAtNormalCapacity,
  packagingCostPerKg: number,
  normalCapacityKgYear: number,
): CostLayersPerKg {
  const kg = normalCapacityKgYear;
  const cashDirect = (cost.laborPerYear + cost.electricityPerYear + cost.waterPerYear + cost.maintenancePerYear) / kg;
  const sharedOverhead = cost.sharedCostAllocated / kg;
  const depreciation = cost.extruderDepreciationPerYear / kg;
  const material = cost.materialPerKgFinished;
  return { cashDirect, packaging: packagingCostPerKg, sharedOverhead, depreciation, material, total: cost.fullCostPerKg };
}

/**
 * Phụ kiện (driver giờ máy) — chia cho sản lượng ước tính (kg/năm tại CS
 * bình thường). `packagingCostPerKg` PHẢI là giá trị `cost.packagingCostPerKg`
 * (ADR-065 — đã đúng theo fittingPackagingMethod, do calculateFittingCostAtNormalCapacity
 * trả về), KHÔNG phải resource.packagingCostPerKg trực tiếp — nếu không tổng
 * 5 tầng sẽ lệch `cost.fullCostPerKgRef`.
 */
export function fittingCostLayersPerKg(
  cost: FittingCostAtNormalCapacity,
  packagingCostPerKg: number,
  estimatedProductionKgYear: number,
): CostLayersPerKg {
  const kg = estimatedProductionKgYear;
  const cashDirect = (cost.laborPerYear + cost.electricityPerYear + cost.waterPerYear + cost.moldMaintenancePerYear) / kg;
  const sharedOverhead = cost.sharedCostAllocated / kg;
  const depreciation = (cost.machineDepreciationPerYear + cost.moldDepreciationPerYear) / kg;
  const material = cost.materialPerKgFinishedRef;
  return { cashDirect, packaging: packagingCostPerKg, sharedOverhead, depreciation, material, total: cost.fullCostPerKgRef };
}
