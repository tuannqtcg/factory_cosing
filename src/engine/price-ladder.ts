// Nguồn công thức: docs/BUSINESS_MODEL.md §2.3 (Ống), §3.4 (Phụ kiện), §4
// (thang giá 5 bậc). Verify: tests/fixtures/{pipe,fitting,dashboard}.json.
//
// ⚠ Bậc 2 (cashBreakEven) và bậc 4 (enterpriseBreakEven) đã từng sai 2 lần
// trong prototype Pha 1 (xem docs/sessions/SESSION_2026-07-05.md Phiên 5):
// bậc 2 lỡ cộng cả khấu hao Lab/UL vào chi phí tiền mặt (SAI — phải loại toàn
// bộ phần khấu hao, kể cả phần chia sẻ); bậc 4 lỡ chia thẳng theo kg thay vì
// theo TỶ TRỌNG DOANH THU tại giá VF giữa 2 dòng SP. Đã tính tay đối chiếu lại
// dashboard.json trước khi viết file này (khớp tuyệt đối) — xem PHASE3_PLAN.md.
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import type { CostPool, MarkupChain } from '../schemas/cost-pool.js';
import type { PipeCapacity, PipeCostAtNormalCapacity } from './pipe.js';
import type { PipeCvp, FittingCvp } from './cvp.js';
import type { FittingCapacity, FittingCostAtNormalCapacity } from './fitting.js';

export interface PriceLadder5Tier {
  variableCostFloor: number;
  cashBreakEven: number;
  breakEvenFullCost: number;
  enterpriseBreakEven: number;
  targetPrice: number;
}

export function calculatePipePriceLadder5Tier(inputs: {
  capacity: PipeCapacity;
  cost: PipeCostAtNormalCapacity;
  cvp: PipeCvp;
  costPool: CostPool;
  /** = otherLine(Phụ kiện).estimatedProductionKgYear × otherLine.vfPricePerKgRef (cross-ref — xem ghi chú đầu file; sửa comment sai ở code review PR #1, trước ghi nhầm tên field bên Ống). */
  otherLineRevenueVnd: number;
}): PriceLadder5Tier {
  const { capacity, cost, cvp, costPool, otherLineRevenueVnd } = inputs;
  const { sharedFixedCosts, nonProductionCosts } = costPool;

  const variableCostFloor = cvp.variableCostPerKg;

  const cashSharedCostAllocated =
    (sharedFixedCosts.annualComplianceFee + sharedFixedCosts.annualLandRent) * cost.sharedCostAllocationRatio;
  const cashBreakEven =
    variableCostFloor + (cost.maintenancePerYear + cost.laborPerYear + cashSharedCostAllocated) / capacity.normalCapacityKgYear;

  const breakEvenFullCost = cost.fullCostPerKg;

  const ownRevenueVnd = capacity.normalCapacityKgYear * cost.vfPricePerKg;
  const revenueShare = ownRevenueVnd / (ownRevenueVnd + otherLineRevenueVnd);
  const enterpriseBreakEven =
    cost.fullCostPerKg +
    ((nonProductionCosts.operatingCostPerYear + nonProductionCosts.financialCostPerYear) * revenueShare) /
      capacity.normalCapacityKgYear;

  const targetPrice = cost.vfPricePerKg;

  return { variableCostFloor, cashBreakEven, breakEvenFullCost, enterpriseBreakEven, targetPrice };
}

export function calculateFittingPriceLadder5Tier(inputs: {
  capacity: FittingCapacity;
  cost: FittingCostAtNormalCapacity;
  cvp: FittingCvp;
  costPool: CostPool;
  /** = otherLine.normalCapacityKgYear × otherLine.vfPricePerKg (cross-ref — xem ghi chú đầu file). */
  otherLineRevenueVnd: number;
}): PriceLadder5Tier {
  const { capacity, cost, cvp, costPool, otherLineRevenueVnd } = inputs;
  const { sharedFixedCosts, nonProductionCosts } = costPool;

  const variableCostFloor = cvp.variableCostPerKg;

  const cashSharedCostAllocated =
    (sharedFixedCosts.annualComplianceFee + sharedFixedCosts.annualLandRent) * cost.sharedCostAllocationRatio;
  const cashBreakEven =
    variableCostFloor +
    (cost.moldMaintenancePerYear + cost.laborPerYear + cashSharedCostAllocated) / capacity.estimatedProductionKgYear;

  const breakEvenFullCost = cost.fullCostPerKgRef;

  const ownRevenueVnd = capacity.estimatedProductionKgYear * cost.vfPricePerKgRef;
  const revenueShare = ownRevenueVnd / (ownRevenueVnd + otherLineRevenueVnd);
  const enterpriseBreakEven =
    cost.fullCostPerKgRef +
    ((nonProductionCosts.operatingCostPerYear + nonProductionCosts.financialCostPerYear) * revenueShare) /
      capacity.estimatedProductionKgYear;

  const targetPrice = cost.vfPricePerKgRef;

  return { variableCostFloor, cashBreakEven, breakEvenFullCost, enterpriseBreakEven, targetPrice };
}

export interface SkuPriceChain {
  materialCostPerUnit: number;
  processingCostPerUnit: number;
  breakEvenPerUnit: number;
  vfPricePerUnit: number;
  tcgPricePerUnit: number;
  listPriceBeforeVat: number;
  listPriceWithVat: number;
}

/** ROUNDUP(value, -2) của Excel — làm tròn LÊN hàng trăm. */
function roundUpToHundred(value: number): number {
  return Math.ceil(value / 100) * 100;
}

interface ChainFromBreakEvenInputs {
  breakEvenPerUnit: number;
  materialCostPerUnit: number;
  processingCostPerUnit: number;
  markupVf: number;
  markup: Pick<MarkupChain, 'markupTcg' | 'listPriceMargin'>;
  vatOutputRate: number;
}

// Sửa 2026-07-06 (code review PR #1): đổi 6 tham số vị trí sang 1 object —
// tránh nhầm thứ tự 2 tham số cùng kiểu number cạnh nhau (breakEvenPerUnit,
// materialCostPerUnit), nhất quán với mọi hàm nhiều tham số khác trong repo.
function chainFromBreakEven(inputs: ChainFromBreakEvenInputs): SkuPriceChain {
  const { breakEvenPerUnit, materialCostPerUnit, processingCostPerUnit, markupVf, markup, vatOutputRate } = inputs;
  const vfPricePerUnit = breakEvenPerUnit * (1 + markupVf);
  const tcgPricePerUnit = vfPricePerUnit * (1 + markup.markupTcg);
  const listPriceBeforeVat = roundUpToHundred(tcgPricePerUnit / (1 - markup.listPriceMargin));
  const listPriceWithVat = listPriceBeforeVat * (1 + vatOutputRate);
  return { materialCostPerUnit, processingCostPerUnit, breakEvenPerUnit, vfPricePerUnit, tcgPricePerUnit, listPriceBeforeVat, listPriceWithVat };
}

/** Ống (§2.3) — không tách material/processing riêng, breakEvenPerM = fullCostPerKg × unitWeightKgPerM. */
export function calculatePipeSkuPriceChain(
  fullCostPerKg: number,
  unitWeightKgPerM: number,
  costPool: Pick<CostPool, 'markup' | 'currency'>,
): SkuPriceChain {
  const breakEvenPerUnit = fullCostPerKg * unitWeightKgPerM;
  return chainFromBreakEven({
    breakEvenPerUnit,
    materialCostPerUnit: breakEvenPerUnit,
    processingCostPerUnit: 0,
    markupVf: costPool.markup.markupVfPipe,
    markup: costPool.markup,
    vatOutputRate: costPool.currency.vatOutputRate,
  });
}

export function calculateMachineHoursPerUnit(cycleTimeSec: number, cavity: number, yieldRate: number): number {
  return cycleTimeSec / (3600 * cavity * yieldRate);
}

/**
 * Phụ kiện (§3.4) — `materialCostPerUnit` truyền vào PHẢI đã gồm chi phí ren
 * kim loại nếu SKU thuộc họ ren (gọi `materialCostPerUnitWithInsert()` ở
 * `metal-insert.ts`, M6, TRƯỚC khi gọi hàm này) — hàm này KHÔNG còn cộng thêm
 * hằng số `brassInsertCost` riêng (thiết kế cũ), theo đúng ADR-008.
 */
export function calculateFittingSkuPriceChain(
  materialCostPerUnit: number,
  machineHoursPerUnit: number,
  mhrPerMachineHour: number,
  costPool: Pick<CostPool, 'markup' | 'currency'>,
): SkuPriceChain {
  const processingCostPerUnit = machineHoursPerUnit * mhrPerMachineHour;
  const breakEvenPerUnit = materialCostPerUnit + processingCostPerUnit;
  return chainFromBreakEven({
    breakEvenPerUnit,
    materialCostPerUnit,
    processingCostPerUnit,
    markupVf: costPool.markup.markupVfFitting,
    markup: costPool.markup,
    vatOutputRate: costPool.currency.vatOutputRate,
  });
}
