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
import type { PipeProduct } from '../schemas/product.js';
import { landedCostPerKgVnd, sharedFixedCostsTotalPerYear, type MaterialPricingInput } from './cost-pool.js';

export interface PipeCapacity {
  batchesPerYear: number;
  designHours3ShiftHours: number;
  designCapacity3ShiftKgYear: number;
  normalOperatingHours: number;
  normalCapacityKgYear: number;
}

/**
 * @param opts.effectiveFinishedKgPerHour — ADR-048 (chế độ 'meters'): tốc độ THÀNH
 *   PHẨM kg/giờ suy từ m/giờ per-size × đơn trọng (thay 1 tốc độ pha trộn cố định).
 *   Chỉ thay `normalCapacityKgYear` (sản lượng vận hành thực) — công suất thiết kế
 *   3 ca giữ theo tốc độ danh nghĩa. Vắng ⇒ dùng actualCapacityKgPerHour × yield
 *   (nguyên mô hình cũ ⇒ parity kg tuyệt đối).
 */
export function calculatePipeCapacity(
  resource: ContinuousKgResource,
  opts?: { effectiveFinishedKgPerHour?: number },
): PipeCapacity {
  const batchesPerYear =
    resource.operatingDaysPerYear / (resource.continuousRunDaysPerBatch + resource.maintenanceDaysPerBatch);
  const designHours3ShiftHours = batchesPerYear * resource.continuousRunDaysPerBatch * 3 * resource.hoursPerShift;
  const designCapacity3ShiftKgYear = resource.actualCapacityKgPerHour * designHours3ShiftHours * resource.yieldRate;
  const normalOperatingHours =
    batchesPerYear * resource.continuousRunDaysPerBatch * resource.normalShifts * resource.hoursPerShift;
  const finishedKgPerHour = opts?.effectiveFinishedKgPerHour ?? resource.actualCapacityKgPerHour * resource.yieldRate;
  const normalCapacityKgYear = finishedKgPerHour * normalOperatingHours;

  return {
    batchesPerYear,
    designHours3ShiftHours,
    designCapacity3ShiftKgYear,
    normalOperatingHours,
    normalCapacityKgYear,
  };
}

/**
 * ADR-063 — chia sản lượng máy đùn giữa 2 nguyên liệu chạy CHUNG 1 dây chuyền
 * (VD BlazeMaster + Corzan, ADR-055 "tỷ lệ đáy"/slider Trợ Lý CEO): SCH/đơn
 * trọng khác nhau ⇒ tốc độ THÀNH PHẨM kg/giờ khác nhau thật ⇒ đổi tỷ lệ chạy
 * phải đổi CẢ tổng công suất kg/năm, không chỉ đổi cách CHIA doanh thu trên 1
 * tổng kg cố định (khoảng trống trước ADR này — xem mục "Còn treo").
 */
export interface PipeMaterialMix {
  primaryMaterialId: string;
  /** 0..1 — tỷ lệ thời gian máy dành cho material chính; phần còn lại (1-frac) cho các material khác gộp chung. */
  primaryFrac: number;
}

/**
 * ADR-054 — tốc độ THÀNH PHẨM kg/giờ hiệu dụng theo phương pháp phân bổ (ADR-047).
 * Gói chung logic override m/giờ (ADR-048) để MỌI tầng dùng lại, không mỗi nơi
 * tự nhớ truyền tay:
 * - method 'kg' ⇒ `undefined` (dùng tốc độ danh nghĩa → parity Excel tuyệt đối).
 * - method 'meters' ⇒ trung bình (m/giờ × đơn trọng) các size đã nhập m/giờ; size
 *   chưa nhập dùng tốc độ danh nghĩa. KHÔNG size nào nhập ⇒ `undefined` (trùng khít kg).
 * - `mix` (ADR-063, optional): thay trung bình ĐƠN GIẢN mọi SKU bằng trung bình
 *   CÓ TRỌNG SỐ giữa material chính (đơn trọng/tốc độ riêng) và material còn
 *   lại, theo đúng % đang chọn ở slider "Chia thời gian máy" (Trợ Lý CEO) hoặc
 *   ô "Tỷ lệ đáy" (Thiết Lập Dữ Liệu). Vắng `mix`, hoặc chỉ 1 material trong
 *   `pipeProducts` ⇒ giống hệt hành vi cũ (parity-safe).
 */
export function effectivePipeFinishedKgPerHour(
  resource: ContinuousKgResource,
  pipeProducts: readonly PipeProduct[],
  method: 'kg' | 'meters',
  mix?: PipeMaterialMix,
): number | undefined {
  if (method !== 'meters') return undefined;
  const hasRate = pipeProducts.some((p) => p.capacityMetersPerHour !== undefined);
  if (!hasRate) return undefined;
  const fallback = resource.actualCapacityKgPerHour * resource.yieldRate;
  const rateOf = (p: PipeProduct) => (p.capacityMetersPerHour !== undefined ? p.capacityMetersPerHour * p.unitWeightKgPerM : fallback);
  const avgOf = (list: readonly PipeProduct[]) =>
    list.length > 0 ? list.reduce((sum, p) => sum + rateOf(p), 0) / list.length : fallback;

  if (!mix) return avgOf(pipeProducts);

  const primaryProducts = pipeProducts.filter((p) => p.materialId === mix.primaryMaterialId);
  const secondaryProducts = pipeProducts.filter((p) => p.materialId !== mix.primaryMaterialId);
  if (secondaryProducts.length === 0) return avgOf(pipeProducts); // chỉ 1 material ⇒ mix vô nghĩa, giữ nguyên hành vi cũ
  const primaryRate = avgOf(primaryProducts);
  const secondaryRate = avgOf(secondaryProducts);
  return mix.primaryFrac * primaryRate + (1 - mix.primaryFrac) * secondaryRate;
}

/**
 * ADR-054 — công suất Ống NHẤT QUÁN phương pháp phân bổ. Thay `calculatePipeCapacity`
 * trần ở mọi tầng (scenario/dashboard/ceo/plan/UI) để chế độ m/giờ áp ĐỒNG NHẤT,
 * không lệch số giữa Tổng Quan / Trợ Lý CEO / Thiết Lập.
 */
export function effectivePipeCapacity(
  resource: ContinuousKgResource,
  pipeProducts: readonly PipeProduct[],
  method: 'kg' | 'meters',
  mix?: PipeMaterialMix,
): PipeCapacity {
  const eff = effectivePipeFinishedKgPerHour(resource, pipeProducts, method, mix);
  return calculatePipeCapacity(resource, eff !== undefined ? { effectiveFinishedKgPerHour: eff } : undefined);
}

export interface PipeCostAtNormalCapacityInputs {
  resource: ContinuousKgResource;
  capacity: PipeCapacity;
  costPool: CostPool;
  /** Cross-ref sang Phụ kiện cho sharedCostAllocationRatio — xem ghi chú đầu file. */
  otherLineEstimatedProductionKgYear: number;
  /** ADR-012 — giá/thuế/markup THEO NGUYÊN LIỆU (thay compoundPricingPriceUsdPerKg + tax/markup toàn cục cũ). Gọi hàm này 1 lần cho MỖI material dùng bởi SP dòng Ống — phần chi phí gia công (unitProcessingCostPerKg...) không phụ thuộc material nên trùng nhau giữa các lần gọi. */
  material: MaterialPricingInput;
  /**
   * ADR-069 — đ/kg bao bì THAY cho resource.packagingCostPerKg phẳng, khi
   * pipePackagingMethod='per_bag' (averagePipePackagingCostPerKg bên dưới).
   * undefined (mặc định) = giữ nguyên hành vi cũ (parity). PHẢI truyền CÙNG
   * giá trị đã đưa vào calculatePipeCvp() cho cùng scenario — nếu không,
   * fullCostPerKg (ở đây) và variableCostPerKg (CVP) sẽ LỆCH nhau.
   */
  packagingCostPerKgOverride?: number;
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
  const { resource, capacity, costPool, otherLineEstimatedProductionKgYear, material, packagingCostPerKgOverride } = inputs;
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

  const fullCostPerKg = materialPerKgFinished + (packagingCostPerKgOverride ?? resource.packagingCostPerKg) + unitProcessingCostPerKg;
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

/**
 * ADR-069 — giá tiền vật liệu TIÊU HAO cho 1 túi ni lông (đ), suy từ cuộn: giá
 * vật liệu (đ/kg) × khối lượng cuộn (kg) ÷ chiều dài cuộn (m) = giá vật liệu
 * đ/m, nhân chiều dài 1 túi (m). undefined nếu thiếu bất kỳ field nào trong 4
 * field cuộn (resource.ts, cả 4 đều optional).
 */
export function pipePackagingBagCostVnd(resource: ContinuousKgResource): number | undefined {
  const priceKg = resource.packagingBagMaterialPricePerKgVnd;
  const rollKg = resource.packagingRollWeightKg;
  const rollM = resource.packagingRollLengthM;
  const bagM = resource.packagingBagLengthM;
  if (priceKg === undefined || rollKg === undefined || rollM === undefined || bagM === undefined) return undefined;
  return ((priceKg * rollKg) / rollM) * bagM;
}

/**
 * ADR-069 — đối xứng averageFittingPackagingCostPerKg (fitting.ts): quy đ/kg
 * CHO CVP/hoà vốn khi pipePackagingMethod='per_bag'. Mỗi DN có `piecesPerBag`:
 * đ/kg = (giá 1 túi ÷ số cây/túi) ÷ (đơn trọng × chiều dài túi) — 1 túi bọc
 * `piecesPerBag` cây ống, mỗi cây dài `packagingBagLengthM`. DN thiếu
 * `piecesPerBag` (chưa nhập tay) fallback phẳng cho riêng DN đó. Chưa có dữ
 * liệu SẢN LƯỢNG từng DN nên lấy TRUNG BÌNH KHÔNG TRỌNG SỐ qua mọi DN — cùng
 * giả định đã dùng ở averageFittingPackagingCostPerKg. method='flat_per_kg'
 * (mặc định) hoặc thiếu dữ liệu cuộn/không có SP nào ⇒ trả nguyên
 * `resource.packagingCostPerKg` — parity tuyệt đối với trước ADR-069.
 */
export function averagePipePackagingCostPerKg(
  products: readonly PipeProduct[],
  resource: ContinuousKgResource,
  method: 'flat_per_kg' | 'per_bag',
): number {
  const bagCostVnd = pipePackagingBagCostVnd(resource);
  if (method !== 'per_bag' || bagCostVnd === undefined || products.length === 0) {
    return resource.packagingCostPerKg;
  }
  const bagLengthM = resource.packagingBagLengthM!;
  const perKgOf = (p: PipeProduct) =>
    p.piecesPerBag !== undefined ? bagCostVnd / p.piecesPerBag / (p.unitWeightKgPerM * bagLengthM) : resource.packagingCostPerKg;
  return products.reduce((sum, p) => sum + perKgOf(p), 0) / products.length;
}
