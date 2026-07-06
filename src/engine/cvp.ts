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
}

export function calculatePipeCvp(
  resource: ContinuousKgResource,
  capacity: PipeCapacity,
  cost: PipeCostAtNormalCapacity,
): PipeCvp {
  const variableCostPerKg =
    cost.materialPerKgFinished +
    resource.packagingCostPerKg +
    (resource.electricityKw * resource.electricityPricePerKwh + resource.waterM3PerHour * resource.waterPricePerM3) /
      (resource.actualCapacityKgPerHour * resource.yieldRate);
  const contributionMarginPerKg = cost.vfPricePerKg - variableCostPerKg;
  // KHÔNG gồm điện/nước — đã nằm trong biến phí (đúng BUSINESS_MODEL §2.4, tránh đếm 2 lần).
  const fixedCostPerYear = cost.extruderDepreciationPerYear + cost.maintenancePerYear + cost.laborPerYear + cost.sharedCostAllocated;
  const breakEvenKgYear = fixedCostPerYear / contributionMarginPerKg;
  const pctOfNormalCapacity = breakEvenKgYear / capacity.normalCapacityKgYear;

  return { variableCostPerKg, contributionMarginPerKg, fixedCostPerYear, breakEvenKgYear, pctOfNormalCapacity };
}

export interface FittingCvp {
  variableCostPerKg: number;
  contributionMarginPerKg: number;
  fixedCostPerYear: number;
  breakEvenKgYear: number;
  breakEvenMachineHours: number;
  pctOfUtilizedHours: number;
}

export function calculateFittingCvp(
  resource: MachineHourResource,
  capacity: FittingCapacity,
  cost: FittingCostAtNormalCapacity,
): FittingCvp {
  const variableCostPerKg =
    cost.compoundLandedPerKg / resource.yieldRate +
    resource.packagingCostPerKg +
    (resource.electricityKwPerMachineHour * resource.electricityPricePerKwh +
      resource.waterM3PerMachineHour * resource.waterPricePerM3) /
      resource.avgProductivityKgPerMachineHour;
  const contributionMarginPerKg = cost.vfPricePerKgRef - variableCostPerKg;
  // KHÔNG gồm điện/nước — đã nằm trong biến phí (đúng BUSINESS_MODEL §3.6).
  const fixedCostPerYear =
    cost.machineDepreciationPerYear + cost.moldDepreciationPerYear + cost.moldMaintenancePerYear + cost.laborPerYear + cost.sharedCostAllocated;
  const breakEvenKgYear = fixedCostPerYear / contributionMarginPerKg;
  const breakEvenMachineHours = breakEvenKgYear / resource.avgProductivityKgPerMachineHour;
  const pctOfUtilizedHours = breakEvenMachineHours / capacity.normalMachineHoursUtilized;

  return {
    variableCostPerKg,
    contributionMarginPerKg,
    fixedCostPerYear,
    breakEvenKgYear,
    breakEvenMachineHours,
    pctOfUtilizedHours,
  };
}
