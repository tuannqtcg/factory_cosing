// ADR-028 — test engine So Sánh Kịch Bản. Parity: kịch bản Cơ sở (hệ số trung tính)
// khớp EBIT giá-bán-cố-định = KPI Dashboard. Hành vi: kịch bản trung tính ≡ base;
// suy thoái (chi phí↑ + sản lượng↓) ⇒ EBIT giảm; sản lượng↓ ⇒ doanh thu giảm.
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';
import { calculateDashboardKpis } from '../../src/engine/dashboard-support.js';
import { calculateScenarioCompare } from '../../src/engine/scenario-compare.js';
import { ScenarioCompareResultSchema } from '../../src/schemas/scenario-compare.js';
import { NEUTRAL } from '../../src/engine/scenario-drivers.js';

const baseline = ScenarioInputSchema.parse(buildBaselineScenarioInput());

describe('calculateScenarioCompare — parity & schema', () => {
  it('EBIT Cơ sở khớp ebitAtNormalCapacityVfPrice (Dashboard KPI)', () => {
    const kpiEbit = calculateDashboardKpis(baseline).investment.ebitAtNormalCapacityVfPrice;
    const { base } = calculateScenarioCompare(baseline, []);
    expect(base.ebitVnd).toBeCloseTo(kpiEbit, 0);
    expect(base.deltaVsBaseVnd).toBe(0);
  });

  it('kết quả hợp lệ theo ScenarioCompareResultSchema', () => {
    const res = calculateScenarioCompare(baseline, [{ name: 'X', multipliers: { ...NEUTRAL, compound: 1.1 } }]);
    expect(() => ScenarioCompareResultSchema.parse(res)).not.toThrow();
  });
});

describe('calculateScenarioCompare — hành vi kịch bản', () => {
  it('kịch bản trung tính ≡ Cơ sở (delta ~ 0)', () => {
    const { base, scenarios } = calculateScenarioCompare(baseline, [{ name: 'Y hệt', multipliers: NEUTRAL }]);
    expect(scenarios[0]!.ebitVnd).toBeCloseTo(base.ebitVnd, 0);
    expect(scenarios[0]!.deltaVsBaseVnd).toBeCloseTo(0, 0);
  });

  it('suy thoái (compound +15%, USD +10%, sản lượng −20%) ⇒ EBIT giảm mạnh', () => {
    const { base, scenarios } = calculateScenarioCompare(baseline, [
      { name: 'Suy thoái', multipliers: { ...NEUTRAL, compound: 1.15, fx: 1.1, volume: 0.8 } },
    ]);
    expect(scenarios[0]!.ebitVnd).toBeLessThan(base.ebitVnd);
    expect(scenarios[0]!.deltaVsBaseVnd).toBeLessThan(0);
    expect(scenarios[0]!.deltaVsBasePct).toBeLessThan(0);
  });

  it('sản lượng −20% ⇒ doanh thu giảm ~20% (giá bán giữ cố định)', () => {
    const { base, scenarios } = calculateScenarioCompare(baseline, [
      { name: 'Ít đơn', multipliers: { ...NEUTRAL, volume: 0.8 } },
    ]);
    expect(scenarios[0]!.revenueVnd).toBeCloseTo(base.revenueVnd * 0.8, -6);
  });

  it('nhiều kịch bản trả về đúng thứ tự đầu vào', () => {
    const { scenarios } = calculateScenarioCompare(baseline, [
      { name: 'A', multipliers: NEUTRAL },
      { name: 'B', multipliers: { ...NEUTRAL, volume: 1.1 } },
    ]);
    expect(scenarios.map((s) => s.name)).toEqual(['A', 'B']);
  });
});
