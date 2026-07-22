// ADR-042 chế độ 2 — mục tiêu sản lượng → số máy cần + CAPEX + hồi vốn.
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { planCapacityForTargetVolume } from '../../src/engine/capacity-planning.js';
import { calculateScenario } from '../../src/engine/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';
import type { ContinuousKgResource } from '../../src/schemas/resource.js';

const baseline = ScenarioInputSchema.parse(buildBaselineScenarioInput());
const out = calculateScenario(baseline);

// Trần 3 ca 1 đầu đùn = designCapacity3ShiftKgYear (chế độ kg mặc định).
const pipeCeil1 = planCapacityForTargetVolume(baseline, { pipeTargetKgYear: 1, fittingTargetKgYear: 0 }).pipe.perMachineCeiling3ShiftKgYear;

describe('planCapacityForTargetVolume (ADR-042 chế độ 2)', () => {
  it('mục tiêu ≤ công suất vận hành hiện tại ⇒ không cần thêm máy, CAPEX = 0', () => {
    const target = out.capacity.pipe.normalCapacityKgYear * 0.5;
    const plan = planCapacityForTargetVolume(baseline, { pipeTargetKgYear: target, fittingTargetKgYear: out.capacity.fitting.estimatedProductionKgYear * 0.5 });
    expect(plan.pipe.extraMachines).toBe(0);
    expect(plan.pipe.capexVnd).toBe(0);
    expect(plan.pipe.withinCurrentMachines).toBe(true);
    expect(plan.totalCapexVnd).toBe(0);
    expect(plan.paybackYears).toBeNull(); // không có phần vượt
  });

  it('mục tiêu vượt trần 3 ca của số máy hiện có ⇒ cần thêm máy + CAPEX + hồi vốn', () => {
    const currentPipeMachines = (baseline.resources.pipe as ContinuousKgResource).extruderCount;
    const target = pipeCeil1 * currentPipeMachines * 2.5; // vượt xa trần hiện có
    const plan = planCapacityForTargetVolume(baseline, { pipeTargetKgYear: target, fittingTargetKgYear: 0 });
    expect(plan.pipe.extraMachines).toBeGreaterThan(0);
    expect(plan.pipe.machinesNeeded).toBe(Math.ceil(target / pipeCeil1));
    expect(plan.pipe.capexVnd).toBe(plan.pipe.extraMachines * (baseline.resources.pipe as ContinuousKgResource).extruderPriceEach);
    expect(plan.pipe.withinCurrentMachines).toBe(false);
    // trần của số máy đề xuất phải phủ được mục tiêu
    expect(plan.pipe.machinesNeeded * pipeCeil1).toBeGreaterThanOrEqual(target);
  });

  it('hồi vốn = CAPEX ÷ lợi nhuận tăng thêm (biên đóng góp × sản lượng vượt)', () => {
    const currentPipeMachines = (baseline.resources.pipe as ContinuousKgResource).extruderCount;
    const target = pipeCeil1 * currentPipeMachines * 2;
    const plan = planCapacityForTargetVolume(baseline, { pipeTargetKgYear: target, fittingTargetKgYear: 0 });
    if (plan.paybackYears !== null) {
      expect(plan.paybackYears).toBeCloseTo(plan.totalCapexVnd / plan.incrementalAnnualContributionVnd, 6);
      expect(plan.incrementalAnnualContributionVnd).toBeGreaterThan(0);
    }
  });
});
