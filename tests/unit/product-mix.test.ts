// ADR-030 — test engine Product-mix. Parity: mix EBIT (1,1) khớp KPI Dashboard.
// Logic khoá: priorityLine = dòng có đóng góp/MÁY-GIỜ cao nhất (KHÔNG phải biên %
// cao nhất — đây là điểm cốt lõi chống bẫy "dồn sang dòng biên cao"). Đòn bẩy: tăng
// sản lượng 1 dòng ⇒ EBIT tăng.
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

  it('đóng góp/kg = giá VF − biến phí/kg; đóng góp/máy-giờ = đóng góp năm / giờ máy', () => {
    for (const l of profile.lines) {
      expect(l.marginPerKgVnd).toBeCloseTo(l.vfPriceVndPerKg - l.variableCostVndPerKg, 0);
      expect(l.contributionPerMachineHourVnd).toBeCloseTo(l.annualContributionVnd / l.annualMachineHours, 0);
    }
  });

  it('priorityLine = dòng có đóng góp/máy-giờ cao nhất (không phải biên % cao nhất)', () => {
    const winnerByHour = pipe.contributionPerMachineHourVnd >= fitting.contributionPerMachineHourVnd ? 'pipe' : 'fitting';
    expect(profile.priorityLine).toBe(winnerByHour);
  });
});

describe('calculateMixEbit', () => {
  it('mix (1,1) khớp ebitAtNormalCapacityVfPrice (parity)', () => {
    const kpi = calculateDashboardKpis(baseline).investment.ebitAtNormalCapacityVfPrice;
    expect(calculateMixEbit(baseline, 1, 1).ebitVnd).toBeCloseTo(kpi, 0);
  });

  it('tăng sản lượng Ống ⇒ EBIT tăng (đóng góp dương)', () => {
    const base = calculateMixEbit(baseline, 1, 1).ebitVnd;
    expect(calculateMixEbit(baseline, 1.2, 1).ebitVnd).toBeGreaterThan(base);
  });

  it('tăng sản lượng Phụ kiện ⇒ EBIT tăng', () => {
    const base = calculateMixEbit(baseline, 1, 1).ebitVnd;
    expect(calculateMixEbit(baseline, 1, 1.2).ebitVnd).toBeGreaterThan(base);
  });

  it('doanh thu mix (1,1) > 0 và tỉ lệ thuận sản lượng', () => {
    const r1 = calculateMixEbit(baseline, 1, 1).revenueVnd;
    const r2 = calculateMixEbit(baseline, 2, 2).revenueVnd;
    expect(r1).toBeGreaterThan(0);
    expect(r2).toBeCloseTo(r1 * 2, -6);
  });
});
