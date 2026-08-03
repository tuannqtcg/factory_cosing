// Nguồn công thức: docs/BUSINESS_MODEL.md §2.4 (Ống, theo kg) + §3.6 (Phụ kiện,
// quy kg theo mix). Verify: tests/fixtures/{pipe,fitting}.json.cvp.
//
// LÀM TRƯỚC price-ladder.ts (dù kế hoạch gốc đánh số M7=price-ladder,
// M8=CVP): bậc 1 thang giá (`variableCostFloor`) CHÍNH LÀ `cvp.variableCostPerKg`
// — phát hiện khi kiểm tra lại công thức bậc 2/4 trước khi code M7, nên đảo
// thứ tự để price-ladder.ts tái dùng CVP thay vì tính trùng công thức.
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import type { PipeCapacity, PipeCostAtNormalCapacity } from './pipe.js';
import type { FittingCapacity, FittingCostAtNormalCapacity } from './fitting.js';

export interface PipeCvp {
  variableCostPerKg: number;
  contributionMarginPerKg: number;
  fixedCostPerYear: number;
  breakEvenKgYear: number;
  pctOfNormalCapacity: number;
  /** ADR-065/069 — bao bì túi ni lông/kg THẬT SỰ dùng trong variableCostPerKg (flat hoặc bình quân theo túi — đối xứng FittingCvp.packagingCostPerKg). */
  packagingCostPerKg: number;
}

export function calculatePipeCvp(
  resource: ContinuousKgResource,
  capacity: PipeCapacity,
  cost: PipeCostAtNormalCapacity,
  // ADR-069 — đ/kg bao bì THAY cho resource.packagingCostPerKg phẳng, khi
  // pipePackagingMethod='per_bag' (xem averagePipePackagingCostPerKg, pipe.ts).
  // undefined (mặc định) = giữ nguyên hành vi cũ (parity).
  packagingCostPerKgOverride?: number,
): PipeCvp {
  const packagingCostPerKg = packagingCostPerKgOverride ?? resource.packagingCostPerKg;
  const variableCostPerKg =
    cost.materialPerKgFinished +
    packagingCostPerKg +
    (resource.electricityKw * resource.electricityPricePerKwh + resource.waterM3PerHour * resource.waterPricePerM3) /
      (resource.actualCapacityKgPerHour * resource.yieldRate);
  const contributionMarginPerKg = cost.vfPricePerKg - variableCostPerKg;
  // KHÔNG gồm điện/nước — đã nằm trong biến phí (đúng BUSINESS_MODEL §2.4, tránh đếm 2 lần).
  const fixedCostPerYear = cost.extruderDepreciationPerYear + cost.maintenancePerYear + cost.laborPerYear + cost.sharedCostAllocated;
  const breakEvenKgYear = fixedCostPerYear / contributionMarginPerKg;
  const pctOfNormalCapacity = breakEvenKgYear / capacity.normalCapacityKgYear;

  return { variableCostPerKg, contributionMarginPerKg, fixedCostPerYear, breakEvenKgYear, pctOfNormalCapacity, packagingCostPerKg };
}

export interface FittingCvp {
  variableCostPerKg: number;
  contributionMarginPerKg: number;
  fixedCostPerYear: number;
  breakEvenKgYear: number;
  breakEvenMachineHours: number;
  pctOfUtilizedHours: number;
  /** ADR-065 — giá trị bao bì/kg THẬT SỰ dùng trong variableCostPerKg (flat hoặc bình quân theo thùng). */
  packagingCostPerKg: number;
}

export function calculateFittingCvp(
  resource: MachineHourResource,
  capacity: FittingCapacity,
  cost: FittingCostAtNormalCapacity,
  // ADR-065 — đ/kg bao bì THAY cho resource.packagingCostPerKg phẳng, khi
  // fittingPackagingMethod='per_box' (xem averageFittingPackagingCostPerKg,
  // fitting.ts). undefined (mặc định) = giữ nguyên hành vi cũ (parity).
  packagingCostPerKgOverride?: number,
): FittingCvp {
  // ADR-011: avgProductivityKgPerMachineHour có thể là GHI ĐÈ (resource) hoặc
  // tự tính bottom-up (fitting.ts) — đọc lại từ capacity đã tính thay vì tự
  // giải quyết override 1 lần nữa ở đây (capacity.estimatedProductionKgYear =
  // normalMachineHoursUtilized × avgProductivityKgPerMachineHour đã dùng).
  const avgProductivityKgPerMachineHour = capacity.estimatedProductionKgYear / capacity.normalMachineHoursUtilized;
  const packagingCostPerKg = packagingCostPerKgOverride ?? resource.packagingCostPerKg;
  const variableCostPerKg =
    cost.compoundLandedPerKg / resource.yieldRate +
    packagingCostPerKg +
    (resource.electricityKwPerMachineHour * resource.electricityPricePerKwh +
      resource.waterM3PerMachineHour * resource.waterPricePerM3) /
      avgProductivityKgPerMachineHour;
  const contributionMarginPerKg = cost.vfPricePerKgRef - variableCostPerKg;
  // KHÔNG gồm điện/nước — đã nằm trong biến phí (đúng BUSINESS_MODEL §3.6).
  const fixedCostPerYear =
    cost.machineDepreciationPerYear + cost.moldDepreciationPerYear + cost.moldMaintenancePerYear + cost.laborPerYear + cost.sharedCostAllocated;
  const breakEvenKgYear = fixedCostPerYear / contributionMarginPerKg;
  const breakEvenMachineHours = breakEvenKgYear / avgProductivityKgPerMachineHour;
  const pctOfUtilizedHours = breakEvenMachineHours / capacity.normalMachineHoursUtilized;

  return {
    variableCostPerKg,
    contributionMarginPerKg,
    fixedCostPerYear,
    breakEvenKgYear,
    breakEvenMachineHours,
    pctOfUtilizedHours,
    packagingCostPerKg,
  };
}
