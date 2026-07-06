// Nguồn công thức: docs/BUSINESS_MODEL.md §3.2-3.3 — driver GIỜ MÁY (ép phun, ADR-001).
// Verify: tests/fixtures/fitting.json.{capacity,costAtNormalCapacity} (số vàng Excel v3.4).
//
// Còn treo (milestone sau, xem docs/PHASE3_PLAN.md):
// - `moldDepreciationPerYear` cộng Σ(asset.costVnd/asset.usefulLifeYears) cho
//   MỌI moldAsset, KHÔNG lọc theo asOfYear (asset hết khấu hao vẫn cộng đủ) —
//   đúng số vàng hiện tại vì toàn bộ 66 khuôn `purchaseYear=2026` (năm đầu khấu
//   hao). M4 sẽ thêm điều kiện lọc theo asOfYear (ADR-007), không đổi công thức
//   này, chỉ thêm 1 filter trước khi Σ.
// - `compoundPricingPriceUsdPerKg` nhận trực tiếp làm input — M5 sẽ thay bằng
//   output price-lock (ADR-004): priceLock.fitting.pricingPrice.
// - `otherLineNormalCapacityKgYear` là cross-ref sang Ống (sharedCostAllocationRatio
//   tham chiếu chéo 2 dòng SP) — nhận trực tiếp làm input, KHÔNG import pipe.ts,
//   giữ 2 module độc lập/pure (cùng pattern đã dùng ở pipe.ts, M2).
// - `fullCostPerKgRef`/`vfPricePerKgRef`/`processingCostPerKgRef` là số QUY-KG
//   THAM CHIẾU (BUSINESS_MODEL §3.3) — KHÔNG dùng để định giá SKU (SKU dùng
//   `mhrPerMachineHour` trực tiếp, xem §3.4 — thuộc M7).
// - Dòng SỔ SÁCH (bookFullCostPerKgRef, dùng weightedAvgUsd — ADR-002) chưa làm,
//   thuộc M5 (giá vốn kép), cùng phạm vi với pipe.ts.
import type { MachineHourResource } from '../schemas/resource.js';
import type { CostPool } from '../schemas/cost-pool.js';
import { sharedFixedCostsTotalPerYear } from './cost-pool.js';

export interface FittingCapacity {
  batchesPerYear: number;
  totalMachines: number;
  designMachineHours3Shift: number;
  normalMachineHoursUtilized: number;
  estimatedProductionKgYear: number;
}

export function calculateFittingCapacity(resource: MachineHourResource): FittingCapacity {
  const batchesPerYear =
    resource.operatingDaysPerYear / (resource.continuousRunDaysPerBatch + resource.maintenanceDaysPerBatch);
  const totalMachines = resource.machineTypes.reduce((sum, m) => sum + m.count, 0);
  const designMachineHours3Shift =
    batchesPerYear * resource.continuousRunDaysPerBatch * 3 * resource.hoursPerShift * totalMachines;
  const normalMachineHoursUtilized =
    batchesPerYear *
    resource.continuousRunDaysPerBatch *
    resource.normalShifts *
    resource.hoursPerShift *
    totalMachines *
    resource.normalUtilizationFactor;
  const estimatedProductionKgYear = normalMachineHoursUtilized * resource.avgProductivityKgPerMachineHour;

  return {
    batchesPerYear,
    totalMachines,
    designMachineHours3Shift,
    normalMachineHoursUtilized,
    estimatedProductionKgYear,
  };
}

export interface FittingCostAtNormalCapacityInputs {
  resource: MachineHourResource;
  capacity: FittingCapacity;
  costPool: CostPool;
  /** Cross-ref sang Ống cho sharedCostAllocationRatio — xem ghi chú đầu file. */
  otherLineNormalCapacityKgYear: number;
  /** ADR-004 pricingPrice (tạm nhận trực tiếp tới khi M5 nối dây price-lock). */
  compoundPricingPriceUsdPerKg: number;
}

export interface FittingCostAtNormalCapacity {
  compoundLandedPerKg: number;
  materialPerKgFinishedRef: number;
  machineDepreciationPerYear: number;
  moldDepreciationPerYear: number;
  moldMaintenancePerYear: number;
  laborPerYear: number;
  electricityPerYear: number;
  waterPerYear: number;
  sharedCostAllocationRatio: number;
  sharedCostAllocated: number;
  totalProcessingCostPerYear: number;
  mhrPerMachineHour: number;
  processingCostPerKgRef: number;
  fullCostPerKgRef: number;
  vfPricePerKgRef: number;
}

export function calculateFittingCostAtNormalCapacity(
  inputs: FittingCostAtNormalCapacityInputs,
): FittingCostAtNormalCapacity {
  const { resource, capacity, costPool, otherLineNormalCapacityKgYear, compoundPricingPriceUsdPerKg } = inputs;
  const { currency, markup } = costPool;

  const compoundLandedPerKg =
    compoundPricingPriceUsdPerKg *
    (1 + currency.compoundImportTaxRate + currency.customsLogisticsFeeRate) *
    currency.usdVndRate;
  const materialPerKgFinishedRef = compoundLandedPerKg / resource.yieldRate;

  const machineDepreciationPerYear =
    resource.machineTypes.reduce((sum, m) => sum + m.priceVnd * m.count, 0) / resource.depreciationYears;
  const moldDepreciationPerYear = resource.moldAssets.reduce(
    (sum, asset) => sum + asset.costVnd / asset.usefulLifeYears,
    0,
  );
  const moldMaintenancePerYear = resource.annualMoldMaintenance;

  const laborPerYear =
    resource.normalShifts *
    resource.peoplePerShift *
    resource.avgSalaryMonthly *
    resource.monthsSalaryPerYear *
    (1 + currency.mandatoryInsuranceRate);
  const electricityPerYear =
    resource.electricityKwPerMachineHour * resource.electricityPricePerKwh * capacity.normalMachineHoursUtilized;
  const waterPerYear =
    resource.waterM3PerMachineHour * resource.waterPricePerM3 * capacity.normalMachineHoursUtilized;

  const sharedCostAllocationRatio =
    capacity.estimatedProductionKgYear / (capacity.estimatedProductionKgYear + otherLineNormalCapacityKgYear);
  const sharedCostAllocated = sharedFixedCostsTotalPerYear(costPool.sharedFixedCosts) * sharedCostAllocationRatio;

  const totalProcessingCostPerYear =
    machineDepreciationPerYear +
    moldDepreciationPerYear +
    moldMaintenancePerYear +
    laborPerYear +
    electricityPerYear +
    waterPerYear +
    sharedCostAllocated;
  const mhrPerMachineHour = totalProcessingCostPerYear / capacity.normalMachineHoursUtilized;

  const processingCostPerKgRef = totalProcessingCostPerYear / capacity.estimatedProductionKgYear;
  const fullCostPerKgRef = materialPerKgFinishedRef + resource.packagingCostPerKg + processingCostPerKgRef;
  const vfPricePerKgRef = fullCostPerKgRef * (1 + markup.markupVfFitting);

  return {
    compoundLandedPerKg,
    materialPerKgFinishedRef,
    machineDepreciationPerYear,
    moldDepreciationPerYear,
    moldMaintenancePerYear,
    laborPerYear,
    electricityPerYear,
    waterPerYear,
    sharedCostAllocationRatio,
    sharedCostAllocated,
    totalProcessingCostPerYear,
    mhrPerMachineHour,
    processingCostPerKgRef,
    fullCostPerKgRef,
    vfPricePerKgRef,
  };
}
