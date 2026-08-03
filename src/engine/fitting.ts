// Nguồn công thức: docs/BUSINESS_MODEL.md §3.2-3.3 — driver GIỜ MÁY (ép phun, ADR-001).
// Verify: tests/fixtures/fitting.json.{capacity,costAtNormalCapacity} (số vàng Excel v3.4).
//
// Còn treo (milestone sau, xem docs/PHASE3_PLAN.md):
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
// - `MoldAsset.maintenancePerYearVnd` (per-asset override) CHƯA được dùng ở
//   đây — `moldMaintenancePerYear` lấy thẳng `annualMoldMaintenance` (tổng
//   duy nhất, khớp Excel) cho MỌI khuôn (phát hiện ở code review PR #1). Cần
//   quyết định nghiệp vụ trước khi sửa: annualMoldMaintenance có tính CỘNG
//   THÊM hay THAY THẾ phần của khuôn có override — xem
//   docs/contracts/resource.md để biết lý do chưa tự suy đoán công thức.
import type { MachineHourResource } from '../schemas/resource.js';
import type { FittingProduct } from '../schemas/product.js';
import type { CostPool } from '../schemas/cost-pool.js';
import { landedCostPerKgVnd, sharedFixedCostsTotalPerYear, type MaterialPricingInput } from './cost-pool.js';
import { moldDepreciationPerYear as calculateMoldDepreciationPerYear } from './mold-depreciation.js';

export interface FittingCapacity {
  batchesPerYear: number;
  totalMachines: number;
  designMachineHours3Shift: number;
  normalMachineHoursUtilized: number;
  estimatedProductionKgYear: number;
}

// ADR-011 — thay "năng suất mix" nhập tay cố định bằng tính bottom-up từ bảng
// khuôn: nhóm SKU theo moldSizeDN, mỗi nhóm = unitsPerHour × unitWeightKg bình
// quân nhóm, rồi lấy TRUNG BÌNH KHÔNG TRỌNG SỐ qua các nhóm (đúng giả định
// %mix đều 1/8 hiện có trong Excel — chưa có dữ liệu mix sản lượng thực).
export function computeMixAvgProductivityKgPerMachineHour(products: FittingProduct[]): number {
  const bySize = new Map<number, FittingProduct[]>();
  for (const product of products) {
    const group = bySize.get(product.moldSizeDN) ?? [];
    group.push(product);
    bySize.set(product.moldSizeDN, group);
  }

  const kgPerMachineHourBySize = Array.from(bySize.values()).map((group) => {
    const [first] = group;
    if (!first) throw new Error('unreachable: nhóm moldSizeDN rỗng');
    const unitsPerHour = (3600 / first.cycleTimeSec) * first.cavity;
    const avgUnitWeightKg = group.reduce((sum, p) => sum + p.unitWeightKg, 0) / group.length;
    return unitsPerHour * avgUnitWeightKg;
  });

  return kgPerMachineHourBySize.reduce((sum, v) => sum + v, 0) / kgPerMachineHourBySize.length;
}

/**
 * ADR-065 — quy đ/kg CHO CVP/hoà vốn khi `fittingPackagingMethod` = 'per_box'
 * (ADR-060): trước ADR-065, CVP/hoà vốn LUÔN dùng `resource.packagingCostPerKg`
 * phẳng dù đã cấu hình theo thùng carton (chỉ giá bán từng SKU đổi qua
 * `packagingCostPerUnitOverride`, KHÔNG lan sang hoà vốn — user phát hiện
 * 2026-08-02). Mỗi SKU có `piecesPerBox`: đ/kg = (packagingBoxCostVnd ÷
 * piecesPerBox) ÷ unitWeightKg (đúng công thức per-unit ở
 * `calculateFittingMaterialCostPerUnit`, quy đổi sang /kg); SKU thiếu
 * `piecesPerBox` (chưa nhập tay — ADR-060) fallback phẳng cho riêng SKU đó.
 * Chưa có dữ liệu SẢN LƯỢNG từng SKU (capacity model tính GỘP theo giờ máy,
 * không tách theo SKU) nên lấy TRUNG BÌNH KHÔNG TRỌNG SỐ qua mọi SKU — cùng
 * giả định "chưa có mix thật" đã dùng ở `computeMixAvgProductivityKgPerMachineHour`
 * phía trên, KHÔNG phát minh công thức trọng số mới. method='flat_per_kg'
 * (mặc định) hoặc thiếu `packagingBoxCostVnd`/không có SKU nào ⇒ trả nguyên
 * `resource.packagingCostPerKg` — parity tuyệt đối với trước ADR-065.
 */
export function averageFittingPackagingCostPerKg(
  products: readonly FittingProduct[],
  resource: MachineHourResource,
  method: 'flat_per_kg' | 'per_box',
): number {
  if (method !== 'per_box' || resource.packagingBoxCostVnd === undefined || products.length === 0) {
    return resource.packagingCostPerKg;
  }
  const boxCost = resource.packagingBoxCostVnd;
  const perKgOf = (p: FittingProduct) =>
    p.piecesPerBox !== undefined ? boxCost / p.piecesPerBox / p.unitWeightKg : resource.packagingCostPerKg;
  return products.reduce((sum, p) => sum + perKgOf(p), 0) / products.length;
}

export function calculateFittingCapacity(
  resource: MachineHourResource,
  fittingProducts: FittingProduct[],
): FittingCapacity {
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
  const avgProductivityKgPerMachineHour =
    resource.avgProductivityKgPerMachineHour ?? computeMixAvgProductivityKgPerMachineHour(fittingProducts);
  const estimatedProductionKgYear = normalMachineHoursUtilized * avgProductivityKgPerMachineHour;

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
  /** ADR-012 — giá/thuế/markup THEO NGUYÊN LIỆU. Gọi 1 lần/material; MHR + toàn bộ chi phí gia công KHÔNG phụ thuộc material (chỉ các field *Ref vật liệu quy kg đổi theo). */
  material: MaterialPricingInput;
  /** ADR-007 — mốc thời gian đánh giá khấu hao khuôn động (src/engine/mold-depreciation.ts). */
  asOfYear: number;
  /**
   * ADR-065 — đ/kg bao bì THAY cho resource.packagingCostPerKg phẳng, khi
   * fittingPackagingMethod='per_box' (averageFittingPackagingCostPerKg phía
   * trên). undefined (mặc định) = giữ nguyên hành vi cũ (parity). PHẢI truyền
   * CÙNG giá trị đã đưa vào calculateFittingCvp() cho cùng scenario — nếu
   * không, fullCostPerKgRef (ở đây) và variableCostPerKg+fixedCostPerYear/kg
   * (CVP) sẽ LỆCH nhau (2 công thức vốn được thiết kế cộng khớp — xem
   * cost-breakdown.ts, tổng 5 tầng = fullCostPerKgRef).
   */
  packagingCostPerKgOverride?: number;
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
  /** ADR-065 — giá trị bao bì/kg THẬT SỰ dùng trong fullCostPerKgRef (flat hoặc bình quân theo thùng). */
  packagingCostPerKg: number;
}

export function calculateFittingCostAtNormalCapacity(
  inputs: FittingCostAtNormalCapacityInputs,
): FittingCostAtNormalCapacity {
  const { resource, capacity, costPool, otherLineNormalCapacityKgYear, material, asOfYear } = inputs;
  const { currency } = costPool;

  const compoundLandedPerKg = landedCostPerKgVnd(material.pricingPriceUsdPerKg, {
    importTaxRate: material.importTaxRate,
    customsLogisticsFeeRate: material.customsLogisticsFeeRate,
    usdVndRate: currency.usdVndRate,
  });
  const materialPerKgFinishedRef = compoundLandedPerKg / resource.yieldRate;

  const machineDepreciationPerYear =
    resource.machineTypes.reduce((sum, m) => sum + m.priceVnd * m.count, 0) / resource.depreciationYears;
  const moldDepreciationPerYear = calculateMoldDepreciationPerYear(resource.moldAssets, asOfYear);
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
  const packagingCostPerKg = inputs.packagingCostPerKgOverride ?? resource.packagingCostPerKg;
  const fullCostPerKgRef = materialPerKgFinishedRef + packagingCostPerKg + processingCostPerKgRef;
  const vfPricePerKgRef = fullCostPerKgRef * (1 + material.markupVf); // ADR-012 — markup VF theo material

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
    packagingCostPerKg,
  };
}
