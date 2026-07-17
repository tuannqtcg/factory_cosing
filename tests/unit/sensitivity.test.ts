// ADR-027 — test engine Độ Nhạy (tornado). Nguyên tắc parity: base EBIT (mọi driver
// = gốc) PHẢI khớp `calculateDashboardKpis().investment.ebitAtNormalCapacityVfPrice`
// (chứng minh tái dùng engine, không trôi số). Cộng test hành vi: chi phí tăng ⇒
// EBIT giá-bán-cố-định GIẢM; driver xếp giảm dần theo swing; δ nhỏ → swing nhỏ.
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';
import { calculateDashboardKpis } from '../../src/engine/dashboard-support.js';
import { calculateSensitivity } from '../../src/engine/sensitivity.js';
import { SensitivityResultSchema } from '../../src/schemas/sensitivity.js';

const baseline = ScenarioInputSchema.parse(buildBaselineScenarioInput());

describe('calculateSensitivity — parity base EBIT khớp Dashboard KPI', () => {
  it('baseEbitVnd == ebitAtNormalCapacityVfPrice (giá bán = giá thành thực tế)', () => {
    const kpiEbit = calculateDashboardKpis(baseline).investment.ebitAtNormalCapacityVfPrice;
    const { baseEbitVnd } = calculateSensitivity(baseline, 0.1);
    expect(baseEbitVnd).toBeCloseTo(kpiEbit, 0);
  });

  it('kết quả hợp lệ theo SensitivityResultSchema', () => {
    expect(() => SensitivityResultSchema.parse(calculateSensitivity(baseline, 0.1))).not.toThrow();
  });
});

describe('calculateSensitivity — hành vi rủi ro', () => {
  const res = calculateSensitivity(baseline, 0.1);
  const byKey = (k: string) => res.drivers.find((d) => d.key === k)!;

  it('có đủ 6 driver', () => {
    expect(res.drivers.map((d) => d.key).sort()).toEqual(
      ['compound', 'electricity', 'fx', 'overhead', 'volume', 'wage'].sort(),
    );
  });

  it('chi phí tăng (+δ) ⇒ EBIT giá-bán-cố-định GIẢM (downside âm) cho mọi driver chi phí', () => {
    for (const k of ['compound', 'fx', 'wage', 'electricity', 'overhead']) {
      const d = byKey(k);
      // +δ là kịch bản xấu (chi phí cao hơn) ⇒ EBIT thấp hơn base
      expect(d.highEbitVnd).toBeLessThan(res.baseEbitVnd);
      expect(d.downsideVnd).toBeLessThan(0);
    }
  });

  it('sản lượng: bán ít hơn (−δ) ⇒ EBIT giảm (đòn bẩy vận hành)', () => {
    const v = byKey('volume');
    expect(v.lowEbitVnd).toBeLessThan(res.baseEbitVnd);
    expect(v.highEbitVnd).toBeGreaterThan(res.baseEbitVnd);
  });

  it('driver xếp giảm dần theo maxAbsSwingVnd (rủi ro lớn nhất trước)', () => {
    for (let i = 1; i < res.drivers.length; i++) {
      expect(res.drivers[i - 1]!.maxAbsSwingVnd).toBeGreaterThanOrEqual(res.drivers[i]!.maxAbsSwingVnd);
    }
  });

  it('δ nhỏ hơn ⇒ swing nhỏ hơn (đơn điệu theo biên độ)', () => {
    const small = calculateSensitivity(baseline, 0.02);
    const big = calculateSensitivity(baseline, 0.2);
    const swingOf = (r: typeof small, k: string) => r.drivers.find((d) => d.key === k)!.maxAbsSwingVnd;
    for (const k of ['compound', 'fx', 'wage', 'volume']) {
      expect(swingOf(small, k)).toBeLessThan(swingOf(big, k));
    }
  });
});
