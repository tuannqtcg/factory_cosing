// Nguồn công thức: docs/BUSINESS_MODEL.md §2.1-2.2 — driver KG (đùn liên tục, ADR-001).
// Verify: tests/fixtures/pipe.json.{capacity,costAtNormalCapacity} (số vàng Excel v3.4).
//
// Còn treo (milestone sau, xem docs/PHASE3_PLAN.md):
// - `compoundPricingPriceUsdPerKg` hiện nhận trực tiếp làm input — M5 sẽ thay
//   bằng output của price-lock engine (ADR-004): priceLock.pipe.pricingPrice.
// - `otherLineEstimatedProductionKgYear` là cross-ref sang Phụ kiện
//   (sharedCostAllocationRatio tham chiếu chéo 2 dòng SP, BUSINESS_MODEL §2.2) —
//   M3 sẽ cấp giá trị này qua 1 hàm orchestration ở tầng Scenario, pipe.ts
//   KHÔNG import fitting.ts để giữ 2 module độc lập/pure.
// - `bookFullCostPerKg` (dòng SỔ SÁCH, dùng weightedAvgUsd thay compound
//   replacement — ADR-002) CHƯA làm ở đây, thuộc M5 (giá vốn kép).
import type { ContinuousKgResource } from '../schemas/resource.js';
import type { CostPool } from '../schemas/cost-pool.js';
import { landedCostPerKgVnd, sharedFixedCostsTotalPerYear, type MaterialPricingInput } from './cost-pool.js';

export interface PipeCapacity {
  batchesPerYear: number;
  designHours3ShiftHours: number;
  designCapacity3ShiftKgYear: number;
  normalOperatingHours: number;
  normalCapacityKgYear: number;
}

export function calculatePipeCapacity(resource: ContinuousKgResource): PipeCapacity {
  const batchesPerYear =
    resource.operatingDaysPerYear / (resource.continuousRunDaysPerBatch + resource.maintenanceDaysPerBatch);
  const designHours3ShiftHours = batchesPerYear * resource.continuousRunDaysPerBatch * 3 * resource.hoursPerShift;
  const designCapacity3ShiftKgYear = resource.actualCapacityKgPerHour * designHours3ShiftHours * resource.yieldRate;
  const normalOperatingHours =
    batchesPerYear * resource.continuousRunDaysPerBatch * resource.normalShifts * resource.hoursPerShift;
  const normalCapacityKgYear = resource.actualCapacityKgPerHour * normalOperatingHours * resource.yieldRate;

  return {
    batchesPerYear,
    designHours3ShiftHours,
    designCapacity3ShiftKgYear,
    normalOperatingHours,
    normalCapacityKgYear,
  };
}

export interface PipeCostAtNormalCapacityInputs {
  resource: ContinuousKgResource;
  capacity: PipeCapacity;
  costPool: CostPool;
  /** Cross-ref sang Phụ kiện cho sharedCostAllocationRatio — xem ghi chú đầu file. */
  otherLineEstimatedProductionKgYear: number;
  /** ADR-012 — giá/thuế/markup THEO NGUYÊN LIỆU (thay compoundPricingPriceUsdPerKg + tax/markup toàn cục cũ). Gọi hàm này 1 lần cho MỖI material dùng bởi SP dòng Ống — phần chi phí gia công (unitProcessingCostPerKg...) không phụ thuộc material nên trùng nhau giữa các lần gọi. */
  material: MaterialPricingInput;
}

export interface PipeCostAtNormalCapacity {
  compoundLandedPerKg: number;
  materialPerKgFinished: number;
  extruderDepreciationPerYear: number;
  maintenancePerYear: number;
  laborPerYear: number;
  electricityPerYear: number;
  waterPerYear: number;
  sharedCostAllocationRatio: number;
  sharedCostAllocated: number;
  totalProcessingCostPerYear: number;
  unitProcessingCostPerKg: number;
  fullCostPerKg: number;
  vfPricePerKg: number;
}

export function calculatePipeCostAtNormalCapacity(
  inputs: PipeCostAtNormalCapacityInputs,
): PipeCostAtNormalCapacity {
  const { resource, capacity, costPool, otherLineEstimatedProductionKgYear, material } = inputs;
  const { currency } = costPool;

  const compoundLandedPerKg = landedCostPerKgVnd(material.pricingPriceUsdPerKg, {
    importTaxRate: material.importTaxRate,
    customsLogisticsFeeRate: material.customsLogisticsFeeRate,
    usdVndRate: currency.usdVndRate,
  });
  const materialPerKgFinished = compoundLandedPerKg / resource.yieldRate;

  const extruderDepreciationPerYear =
    (resource.extruderPriceEach * resource.extruderCount) / resource.depreciationYears +
    resource.moldPullerCutterCost / resource.moldDepreciationYears;
  const maintenancePerYear = resource.annualMaintenance;
  const laborPerYear =
    resource.normalShifts *
    resource.peoplePerShift *
    resource.avgSalaryMonthly *
    resource.monthsSalaryPerYear *
    (1 + currency.mandatoryInsuranceRate);
  const electricityPerYear = resource.electricityKw * resource.electricityPricePerKwh * capacity.normalOperatingHours;
  const waterPerYear = resource.waterM3PerHour * resource.waterPricePerM3 * capacity.normalOperatingHours;

  const sharedCostAllocationRatio =
    capacity.normalCapacityKgYear / (capacity.normalCapacityKgYear + otherLineEstimatedProductionKgYear);
  const sharedCostAllocated = sharedFixedCostsTotalPerYear(costPool.sharedFixedCosts) * sharedCostAllocationRatio;

  const totalProcessingCostPerYear =
    extruderDepreciationPerYear + maintenancePerYear + laborPerYear + electricityPerYear + waterPerYear + sharedCostAllocated;
  const unitProcessingCostPerKg = totalProcessingCostPerYear / capacity.normalCapacityKgYear;

  const fullCostPerKg = materialPerKgFinished + resource.packagingCostPerKg + unitProcessingCostPerKg;
  const vfPricePerKg = fullCostPerKg * (1 + material.markupVf); // ADR-012 — markup VF theo material

  return {
    compoundLandedPerKg,
    materialPerKgFinished,
    extruderDepreciationPerYear,
    maintenancePerYear,
    laborPerYear,
    electricityPerYear,
    waterPerYear,
    sharedCostAllocationRatio,
    sharedCostAllocated,
    totalProcessingCostPerYear,
    unitProcessingCostPerKg,
    fullCostPerKg,
    vfPricePerKg,
  };
}
