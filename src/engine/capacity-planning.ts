// ADR-042 CHẾ ĐỘ 2 (2026-07-22) — "mục tiêu sản lượng → cần thêm máy". Câu hỏi
// ngược tầng NGUỒN LỰC: CEO nhập sản lượng mong muốn/năm cho Ống + Phụ kiện; nếu
// vượt trần 3 ca của số máy hiện có → tính số máy cần MUA THÊM + CAPEX + thời gian
// hồi vốn (ước tính). KHÔNG công thức mới về công suất: tái dùng ceiling 3 ca từ
// pipe.ts/fitting.ts (một nguồn logic — ADR-005), chỉ chia cho số máy để ra trần
// per-máy rồi lấy trần trên (ceil) số máy cần.
//
// Đặt ở engine (pure, không I/O) — màn Trợ Lý CEO gọi client-side như ceo-planner.
import type { ScenarioInput } from '../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import type { FittingProduct, PipeProduct } from '../schemas/product.js';
import { calculatePipeCapacity, effectivePipeFinishedKgPerHour } from './pipe.js';
import { calculateFittingCapacity, computeMixAvgProductivityKgPerMachineHour } from './fitting.js';
import { calculateScenario } from './scenario.js';

export interface CapacityLinePlan {
  line: 'pipe' | 'fitting';
  targetKgYear: number;
  /** Sản lượng vận hành hiện tại (tại số ca/huy động baseline) — mốc so sánh. */
  currentNormalKgYear: number;
  /** Trần 3 ca của MỘT máy (đùn/ép). */
  perMachineCeiling3ShiftKgYear: number;
  currentMachines: number;
  /** Số máy tối thiểu để trần 3 ca ≥ mục tiêu (ceil). */
  machinesNeeded: number;
  /** max(0, machinesNeeded − currentMachines). */
  extraMachines: number;
  /** extraMachines × đơn giá 1 máy (đùn: extruderPriceEach; ép: bình quân máyTypes). */
  capexVnd: number;
  /** Mục tiêu đã nằm trong trần 3 ca của số máy HIỆN CÓ? */
  withinCurrentMachines: boolean;
  /** Biên đóng góp/kg (giá VF − sàn biến phí) tại giá baseline — cho ước tính hồi vốn. */
  contributionMarginVndPerKg: number;
}

export interface CapacityPlanResult {
  pipe: CapacityLinePlan;
  fitting: CapacityLinePlan;
  totalCapexVnd: number;
  /** Lợi nhuận tăng thêm/năm = Σ (sản lượng vượt hiện tại × biên đóng góp/kg). */
  incrementalAnnualContributionVnd: number;
  /** totalCapex ÷ lợi nhuận tăng thêm; null nếu không có phần vượt (không cần thêm máy hoặc biên ≤0). */
  paybackYears: number | null;
}

export interface CapacityPlanRequest {
  pipeTargetKgYear: number;
  fittingTargetKgYear: number;
}

function planLine(
  line: 'pipe' | 'fitting',
  targetKgYear: number,
  currentNormalKgYear: number,
  perMachineCeiling3ShiftKgYear: number,
  currentMachines: number,
  unitPriceVnd: number,
  contributionMarginVndPerKg: number,
): CapacityLinePlan {
  const machinesNeeded =
    perMachineCeiling3ShiftKgYear > 0 ? Math.max(currentMachines, Math.ceil(targetKgYear / perMachineCeiling3ShiftKgYear)) : currentMachines;
  const extraMachines = Math.max(0, machinesNeeded - currentMachines);
  return {
    line,
    targetKgYear,
    currentNormalKgYear,
    perMachineCeiling3ShiftKgYear,
    currentMachines,
    machinesNeeded,
    extraMachines,
    capexVnd: extraMachines * unitPriceVnd,
    withinCurrentMachines: targetKgYear <= perMachineCeiling3ShiftKgYear * currentMachines,
    contributionMarginVndPerKg,
  };
}

/**
 * ScenarioInput + mục tiêu sản lượng 2 dòng → kế hoạch máy + CAPEX + hồi vốn.
 * Trần 3 ca per-máy:
 * - Ống: `designCapacity3ShiftKgYear` (pipe.ts) — công thức KHÔNG nhân số máy nên
 *   ĐÃ là trần 1 đầu đùn (ADR-054 áp hiệu suất m/giờ nếu bật chế độ meters).
 * - Phụ kiện: (giờ máy 3 ca ÷ tổng máy) × huy động × năng suất mix kg/giờ-máy.
 * Biên đóng góp/kg lấy từ CVP baseline (calculateScenario) cho ước tính hồi vốn.
 */
export function planCapacityForTargetVolume(scenario: ScenarioInput, request: CapacityPlanRequest): CapacityPlanResult {
  const pipeResource = scenario.resources.pipe as ContinuousKgResource;
  const fittingResource = scenario.resources.fitting as MachineHourResource;
  const pipeProducts = scenario.products.filter((p): p is PipeProduct => p.kind === 'pipe');
  const fittingProducts = scenario.products.filter((p): p is FittingProduct => p.kind === 'fitting');

  const out = calculateScenario(scenario);
  const cmOf = (line: 'pipe' | 'fitting') => {
    const e = out.cvp.byLineMaterial.find((x) => x.line === line);
    return e?.contributionMarginPerKg ?? 0;
  };

  // ── Ống — trần 3 ca của 1 đầu đùn (ADR-054: hiệu suất m/giờ nếu bật meters) ──
  const eff = effectivePipeFinishedKgPerHour(pipeResource, pipeProducts, scenario.pipeCostMethod ?? 'kg');
  const pipeCap = calculatePipeCapacity(pipeResource, eff !== undefined ? { effectiveFinishedKgPerHour: eff } : undefined);
  const pipePlan = planLine(
    'pipe',
    request.pipeTargetKgYear,
    out.capacity.pipe.normalCapacityKgYear,
    pipeCap.designCapacity3ShiftKgYear, // = trần 1 đầu đùn
    pipeResource.extruderCount,
    pipeResource.extruderPriceEach,
    cmOf('pipe'),
  );

  // ── Phụ kiện — trần 3 ca của 1 máy ép (giờ máy 3 ca ÷ tổng máy × huy động × năng suất) ──
  const fitCap = calculateFittingCapacity(fittingResource, fittingProducts);
  const totalMachines = fitCap.totalMachines;
  const avgProductivity =
    fittingResource.avgProductivityKgPerMachineHour ?? computeMixAvgProductivityKgPerMachineHour(fittingProducts);
  const perMachine3ShiftHours = totalMachines > 0 ? fitCap.designMachineHours3Shift / totalMachines : 0;
  const perMachineCeilingFit = perMachine3ShiftHours * fittingResource.normalUtilizationFactor * avgProductivity;
  const avgMachinePriceVnd =
    totalMachines > 0 ? fittingResource.machineTypes.reduce((s, m) => s + m.priceVnd * m.count, 0) / totalMachines : 0;
  const fitPlan = planLine(
    'fitting',
    request.fittingTargetKgYear,
    out.capacity.fitting.estimatedProductionKgYear,
    perMachineCeilingFit,
    totalMachines,
    avgMachinePriceVnd,
    cmOf('fitting'),
  );

  const totalCapexVnd = pipePlan.capexVnd + fitPlan.capexVnd;
  const incrementalAnnualContributionVnd =
    Math.max(0, pipePlan.targetKgYear - pipePlan.currentNormalKgYear) * pipePlan.contributionMarginVndPerKg +
    Math.max(0, fitPlan.targetKgYear - fitPlan.currentNormalKgYear) * fitPlan.contributionMarginVndPerKg;
  const paybackYears =
    totalCapexVnd > 0 && incrementalAnnualContributionVnd > 0 ? totalCapexVnd / incrementalAnnualContributionVnd : null;

  return { pipe: pipePlan, fitting: fitPlan, totalCapexVnd, incrementalAnnualContributionVnd, paybackYears };
}
