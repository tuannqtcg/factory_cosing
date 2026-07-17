// ADR-030/031 — test engine Product-mix. Parity: mix EBIT (1,1) khớp KPI Dashboard.
// Nhiều mẫu số (kg/máy-giờ/vốn). ADR-031: nhập GIÁ THỊ TRƯỜNG thật hạ giá ⇒ đóng góp
// dòng đó giảm ⇒ có thể lật ưu tiên (điểm cốt lõi — commodity ống mỏng biên hơn).
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';
import { calculateDashboardKpis } from '../../src/engine/dashboard-support.js';
import { calculateProductMixProfile, calculateMixEbit } from '../../src/engine/product-mix.js';
import { ProductMixProfileSchema } from '../../src/schemas/product-mix.js';

const baseline = ScenarioInputSchema.parse(buildBaselineScenarioInput());

describe('calculateProductMixProfile', () => {
  const profile = calculateProductMixProfile(baseline);
  const pipe = profile.lines.find((l) => l.line === 'pipe')!;
  const fitting = profile.lines.find((l) => l.line === 'fitting')!;

  it('hợp lệ theo schema, có đủ 2 dòng', () => {
    expect(() => ProductMixProfileSchema.parse(profile)).not.toThrow();
    expect(profile.lines.map((l) => l.line).sort()).toEqual(['fitting', 'pipe']);
  });

  it('mẫu số tính đúng: /kg, /máy-giờ, /đồng vốn (ROIC)', () => {
    for (const l of profile.lines) {
      expect(l.marginPerKgVnd).toBeCloseTo(l.effectivePriceVndPerKg - l.variableCostVndPerKg, 0);
      expect(l.contributionPerMachineHourVnd).toBeCloseTo(l.annualContributionVnd / l.annualMachineHours, 0);
      expect(l.contributionPerCapital).toBeCloseTo(l.annualContributionVnd / l.fixedCapitalVnd, 6);
      expect(l.fixedCapitalVnd).toBeGreaterThan(0);
    }
  });

  it('mặc định (không nhập giá) effectivePrice = giá VF', () => {
    expect(pipe.effectivePriceVndPerKg).toBe(pipe.vfPriceVndPerKg);
    expect(fitting.effectivePriceVndPerKg).toBe(fitting.vfPriceVndPerKg);
  });

  it('priorityByConstraint khớp dòng thắng theo từng mẫu số', () => {
    const winBy = (get: (m: typeof pipe) => number) => (get(fitting) > get(pipe) ? 'fitting' : 'pipe');
    expect(profile.priorityByConstraint.machineHour).toBe(winBy((m) => m.contributionPerMachineHourVnd));
    expect(profile.priorityByConstraint.fixedCapital).toBe(winBy((m) => m.contributionPerCapital));
    expect(profile.priorityByConstraint.volumeKg).toBe(winBy((m) => m.marginPerKgVnd));
  });
});

describe('calculateProductMixProfile — giá thị trường override (ADR-031)', () => {
  it('nhập giá Ống thấp hơn VF ⇒ đóng góp/kg + ROIC Ống giảm', () => {
    const base = calculateProductMixProfile(baseline);
    const pipeBase = base.lines.find((l) => l.line === 'pipe')!;
    const lowered = calculateProductMixProfile(baseline, { pipe: pipeBase.vfPriceVndPerKg * 0.85 });
    const pipeLow = lowered.lines.find((l) => l.line === 'pipe')!;
    expect(pipeLow.effectivePriceVndPerKg).toBeLessThan(pipeBase.effectivePriceVndPerKg);
    expect(pipeLow.marginPerKgVnd).toBeLessThan(pipeBase.marginPerKgVnd);
    expect(pipeLow.contributionPerCapital).toBeLessThan(pipeBase.contributionPerCapital);
  });
});

describe('calculateMixEbit', () => {
  it('mix (1,1) không override khớp ebitAtNormalCapacityVfPrice (parity)', () => {
    const kpi = calculateDashboardKpis(baseline).investment.ebitAtNormalCapacityVfPrice;
    expect(calculateMixEbit(baseline, 1, 1).ebitVnd).toBeCloseTo(kpi, 0);
  });

  it('tăng sản lượng Ống ⇒ EBIT tăng; giá Ống thấp hơn ⇒ EBIT thấp hơn', () => {
    const base = calculateMixEbit(baseline, 1, 1).ebitVnd;
    expect(calculateMixEbit(baseline, 1.2, 1).ebitVnd).toBeGreaterThan(base);
    const pipeVf = calculateProductMixProfile(baseline).lines.find((l) => l.line === 'pipe')!.vfPriceVndPerKg;
    expect(calculateMixEbit(baseline, 1, 1, { pipe: pipeVf * 0.85 }).ebitVnd).toBeLessThan(base);
  });
});
