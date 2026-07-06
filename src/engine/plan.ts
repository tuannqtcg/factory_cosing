// Nguồn nghiệp vụ: docs/BUSINESS_MODEL.md §6 — Kế hoạch sản xuất (Plan_SX, T1,
// tầng VẬN HÀNH, ADR-005/006). QUY TẮC, KHÔNG CÓ SỐ VÀNG EXCEL (sheet gốc là
// template input=0) — khác MỌI milestone trước, verify bằng input mẫu tự chọn
// + tính tay, không phải parity Excel thật (xem tests/parity/plan.test.ts, đặt
// ở `parity/` chỉ vì đối chiếu công thức tài liệu, KHÔNG phải đối chiếu Excel).
//
// Giả định thiết kế (không có Excel để xác nhận, ghi rõ để dễ chỉnh khi có kịch
// bản thật):
// - "Số máy cần thêm" khi thiếu cả 3 ca: coi công suất 3-ca hiện tại là 1 đơn
//   vị công suất, ROUNDUP số đơn vị công suất giống hệt cần thêm để bù thiếu
//   hụt (khớp đúng việc công thức capacity gốc §2.1/§3.2 KHÔNG nhân thêm theo
//   extruderCount/machineCount ở phần SẢN LƯỢNG, chỉ dùng ở phần CHI PHÍ).
// - `moldSetCountBySizeDN` là cross-ref (số bộ khuôn theo từng size DN) — nhận
//   trực tiếp làm input thay vì tự suy ra từ `moldAssets`+`products` bên trong
//   (join phức tạp, để tầng orchestration cấp, giữ plan.ts thuần/độc lập, cùng
//   pattern cross-ref đã dùng ở pipe.ts/fitting.ts).
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import type { PipeProduct, FittingProduct } from '../schemas/product.js';
import type { PlanInput, PlanResult } from '../schemas/scenario.js';
import type { PipeCostAtNormalCapacity } from './pipe.js';
import type { PipeCvp } from './cvp.js';
import type { FittingCostAtNormalCapacity } from './fitting.js';
import { calculateMachineHoursPerUnit } from './price-ladder.js';

type ShiftsNeeded = 1 | 2 | 3 | { status: 'insufficient'; extraMachinesNeeded: number };

/**
 * ROUNDUP số ĐƠN VỊ công suất cần thêm để bù thiếu hụt — dùng chung cho "số
 * máy cần thêm" (đánh giá ca) và "số bộ khuôn cần thêm" (ràng buộc khuôn theo
 * size), 2 chỗ trước đây viết `Math.ceil(deficit / perUnit)` độc lập (code
 * review PR #1). `perUnitCapacity` là công suất của ĐÚNG 1 đơn vị (1 máy /
 * 1 bộ khuôn) — ý nghĩa "1 đơn vị" khác nhau ở 2 nơi gọi, xem comment tại chỗ gọi.
 */
function ceilExtraUnitsNeeded(deficit: number, perUnitCapacity: number): number {
  return Math.ceil(deficit / perUnitCapacity);
}

function evaluateShiftsNeeded(requiredHours: number, hoursAvailableAtShift: (shifts: 1 | 2 | 3) => number): ShiftsNeeded {
  if (requiredHours <= hoursAvailableAtShift(1)) return 1;
  if (requiredHours <= hoursAvailableAtShift(2)) return 2;
  const hours3 = hoursAvailableAtShift(3);
  if (requiredHours <= hours3) return 3;
  // "1 đơn vị" ở đây = TOÀN BỘ công suất 3-ca hiện tại (xem giả định đầu file).
  return { status: 'insufficient', extraMachinesNeeded: ceilExtraUnitsNeeded(requiredHours - hours3, hours3) };
}

function resolvedShiftCount(shiftsNeeded: ShiftsNeeded): number {
  return typeof shiftsNeeded === 'number' ? shiftsNeeded : 3;
}

export interface CalculatePipePlanInputs {
  resource: ContinuousKgResource;
  products: PipeProduct[];
  cost: PipeCostAtNormalCapacity;
  cvp: PipeCvp;
  /** ADR-004 §1a — giá RAW cho kế hoạch mua ngoại tệ, KHÔNG qua khóa giá. */
  replacementUsdPerKgRaw: number;
}

export interface CalculateFittingPlanInputs {
  resource: MachineHourResource;
  products: FittingProduct[];
  cost: FittingCostAtNormalCapacity;
  replacementUsdPerKgRaw: number;
  moldSetCountBySizeDN: Record<number, number>;
}

export function calculatePlan(
  input: PlanInput,
  pipe: CalculatePipePlanInputs,
  fitting: CalculateFittingPlanInputs,
): PlanResult {
  const periodFactor = input.periodMonths / 12;

  // ── 1+2. Ống: quy đổi kế hoạch → giờ máy, đánh giá ca ──────────────────────
  let pipeKgLoaded = 0;
  for (const entry of input.pipePlan) {
    const product = pipe.products.find((p) => p.dn === entry.dn);
    if (!product) continue; // DN không có trong danh mục — bỏ qua, không throw (kế hoạch có thể nhập nhầm)
    const kgFinished = entry.meters * product.unitWeightKgPerM;
    pipeKgLoaded += kgFinished / pipe.resource.yieldRate;
  }
  const pipeRequiredMachineHours = pipeKgLoaded / pipe.resource.actualCapacityKgPerHour;

  const pipeBatchesPerYear =
    pipe.resource.operatingDaysPerYear / (pipe.resource.continuousRunDaysPerBatch + pipe.resource.maintenanceDaysPerBatch);
  const pipeHoursAvailable = (shifts: 1 | 2 | 3) =>
    pipeBatchesPerYear * pipe.resource.continuousRunDaysPerBatch * shifts * pipe.resource.hoursPerShift * periodFactor;
  const pipeShiftsNeeded = evaluateShiftsNeeded(pipeRequiredMachineHours, pipeHoursAvailable);

  // ── 1+2. Phụ kiện: quy đổi kế hoạch → giờ máy, đánh giá ca ─────────────────
  let fittingKgLoaded = 0;
  let fittingRequiredMachineHours = 0;
  const machineHoursBySizeDN = new Map<number, number>();
  for (const entry of input.fittingPlan) {
    const product = fitting.products.find((p) => p.productName === entry.productName && p.sizeLabel === entry.sizeLabel);
    if (!product) continue;
    const machineHoursPerUnit = calculateMachineHoursPerUnit(product.cycleTimeSec, product.cavity, fitting.resource.yieldRate);
    const machineHours = entry.qty * machineHoursPerUnit;
    fittingRequiredMachineHours += machineHours;
    fittingKgLoaded += (entry.qty * product.unitWeightKg) / fitting.resource.yieldRate;
    machineHoursBySizeDN.set(product.moldSizeDN, (machineHoursBySizeDN.get(product.moldSizeDN) ?? 0) + machineHours);
  }

  const fittingTotalMachines = fitting.resource.machineTypes.reduce((sum, m) => sum + m.count, 0);
  const fittingBatchesPerYear =
    fitting.resource.operatingDaysPerYear / (fitting.resource.continuousRunDaysPerBatch + fitting.resource.maintenanceDaysPerBatch);
  const fittingHoursAvailable = (shifts: 1 | 2 | 3) =>
    fittingBatchesPerYear *
    fitting.resource.continuousRunDaysPerBatch *
    shifts *
    fitting.resource.hoursPerShift *
    fittingTotalMachines *
    fitting.resource.normalUtilizationFactor *
    periodFactor;
  const fittingShiftsNeeded = evaluateShiftsNeeded(fittingRequiredMachineHours, fittingHoursAvailable);

  // ── 3. Ràng buộc khuôn theo size (CHỈ Phụ kiện) ────────────────────────────
  const hoursPerMoldSet3Shift =
    fittingBatchesPerYear *
    fitting.resource.continuousRunDaysPerBatch *
    3 *
    fitting.resource.hoursPerShift *
    fitting.resource.normalUtilizationFactor *
    periodFactor;
  const moldConstraintWarnings: PlanResult['moldConstraintWarnings'] = [];
  for (const [sizeDN, requiredMachineHours] of machineHoursBySizeDN) {
    const moldSetCount = fitting.moldSetCountBySizeDN[sizeDN] ?? 0;
    const availableMachineHours = moldSetCount * hoursPerMoldSet3Shift;
    if (requiredMachineHours > availableMachineHours) {
      // "1 đơn vị" ở đây = công suất 3-ca của ĐÚNG 1 bộ khuôn (khác evaluateShiftsNeeded).
      const extraMoldSetsNeeded = ceilExtraUnitsNeeded(requiredMachineHours - availableMachineHours, hoursPerMoldSet3Shift);
      moldConstraintWarnings.push({ sizeDN, requiredMachineHours, availableMachineHours, extraMoldSetsNeeded });
    }
  }

  // ── 4. Nguyên liệu + ngoại tệ cần ───────────────────────────────────────────
  const pipeKgToBuy = pipeKgLoaded * (1 + input.materialSafetyStockFactor);
  const fittingKgToBuy = fittingKgLoaded * (1 + input.materialSafetyStockFactor);
  const materialRequirement: PlanResult['materialRequirement'] = {
    pipe: {
      kgToBuy: pipeKgToBuy,
      vndValue: pipeKgToBuy * pipe.cost.compoundLandedPerKg,
      usdValueAtRawReplacement: pipeKgToBuy * pipe.replacementUsdPerKgRaw,
    },
    fitting: {
      kgToBuy: fittingKgToBuy,
      vndValue: fittingKgToBuy * fitting.cost.compoundLandedPerKg,
      usdValueAtRawReplacement: fittingKgToBuy * fitting.replacementUsdPerKgRaw,
    },
  };

  // ── 5. Nhân công cần tuyển ──────────────────────────────────────────────────
  const laborToHire: PlanResult['laborToHire'] = {
    pipe: Math.max(0, resolvedShiftCount(pipeShiftsNeeded) * pipe.resource.peoplePerShift - input.currentLaborHeadcount.pipe),
    fitting: Math.max(
      0,
      resolvedShiftCount(fittingShiftsNeeded) * fitting.resource.peoplePerShift - input.currentLaborHeadcount.fitting,
    ),
  };

  // ── 6. Chi phí/kg thực tế tại sản lượng kế hoạch (CHỈ Ống) ─────────────────
  const pipeKgPlanned = pipeKgLoaded * pipe.resource.yieldRate; // quy lại kg thành phẩm kế hoạch (không phải kg nạp máy)
  const idleCapacityCostPipePerKg =
    pipeKgPlanned > 0
      ? pipe.cvp.variableCostPerKg + (pipe.cvp.fixedCostPerYear * periodFactor) / pipeKgPlanned - pipe.cost.fullCostPerKg
      : null;

  return {
    shiftsNeeded: { pipe: pipeShiftsNeeded, fitting: fittingShiftsNeeded },
    moldConstraintWarnings,
    materialRequirement,
    laborToHire,
    idleCapacityCostPipePerKg,
  };
}
