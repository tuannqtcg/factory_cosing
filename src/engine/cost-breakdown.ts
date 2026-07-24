// Thác chi phí đ/kg — TÁCH giá thành đầy đủ thành 4 tầng để trả lời "tiền đi
// đâu?" (giải thích chênh lệch giữa cảm nhận vận hành của giám đốc nhà máy —
// chỉ phần tiền mặt gia công — với giá thành đầy đủ mà app tính).
//
// THUẦN TRÌNH BÀY: chỉ GOM LẠI các cấu phần chi phí ĐÃ được pipe.ts/fitting.ts
// tính sẵn, KHÔNG có công thức nghiệp vụ mới. Tổng 4 tầng = fullCostPerKg của
// engine (parity — xem tests/unit/cost-breakdown.test.ts).
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import type { PipeCostAtNormalCapacity } from './pipe.js';
import type { FittingCostAtNormalCapacity } from './fitting.js';

export interface CostLayersPerKg {
  /** Gia công tiền mặt trực tiếp: nhân công + điện + nước + bảo trì + bao bì — phần "tiền túi" nhà máy cảm nhận được. */
  cashDirect: number;
  /** Chi phí chung phân bổ (kiểm định + thuê đất + khấu hao tài sản chung) theo sản lượng. */
  sharedOverhead: number;
  /** Khấu hao máy + khuôn — không chi bằng tiền mặt hàng tháng nên dễ bị bỏ quên; GIẢM mạnh khi tăng ca/lấp công suất. */
  depreciation: number;
  /** Nguyên liệu compound / kg thành phẩm (đã ÷ hiệu suất) — sàn giá cứng, phần lớn là hạt nhựa nhập tính bằng USD. */
  material: number;
  /** = engine fullCostPerKg (tổng 4 tầng trên). */
  total: number;
}

/** Ống (driver kg) — chia mọi cấu phần/năm cho sản lượng bình thường (kg/năm). */
export function pipeCostLayersPerKg(
  cost: PipeCostAtNormalCapacity,
  resource: Pick<ContinuousKgResource, 'packagingCostPerKg'>,
  normalCapacityKgYear: number,
): CostLayersPerKg {
  const kg = normalCapacityKgYear;
  const cashDirect =
    (cost.laborPerYear + cost.electricityPerYear + cost.waterPerYear + cost.maintenancePerYear) / kg +
    resource.packagingCostPerKg;
  const sharedOverhead = cost.sharedCostAllocated / kg;
  const depreciation = cost.extruderDepreciationPerYear / kg;
  const material = cost.materialPerKgFinished;
  return { cashDirect, sharedOverhead, depreciation, material, total: cost.fullCostPerKg };
}

/** Phụ kiện (driver giờ máy) — chia cho sản lượng ước tính (kg/năm tại CS bình thường). */
export function fittingCostLayersPerKg(
  cost: FittingCostAtNormalCapacity,
  resource: Pick<MachineHourResource, 'packagingCostPerKg'>,
  estimatedProductionKgYear: number,
): CostLayersPerKg {
  const kg = estimatedProductionKgYear;
  const cashDirect =
    (cost.laborPerYear + cost.electricityPerYear + cost.waterPerYear + cost.moldMaintenancePerYear) / kg +
    resource.packagingCostPerKg;
  const sharedOverhead = cost.sharedCostAllocated / kg;
  const depreciation = (cost.machineDepreciationPerYear + cost.moldDepreciationPerYear) / kg;
  const material = cost.materialPerKgFinishedRef;
  return { cashDirect, sharedOverhead, depreciation, material, total: cost.fullCostPerKgRef };
}
