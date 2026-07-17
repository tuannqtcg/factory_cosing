// ADR-029 — test engine Quyết Định Nhận Đơn. Verdict theo sàn thị trường; sàn thị
// trường (giá tái tạo) tách khỏi sàn khóa (baseline) khi giá lệch; panel khóa giá
// đổi theo ngưỡng what-if. Số/kg lấy từ engine (không chép công thức).
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema, type ScenarioInput } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';
import { decideOrder } from '../../src/engine/order-acceptance.js';
import { OrderDecisionResultSchema } from '../../src/schemas/order-acceptance.js';
import { referenceMaterialOf } from '../../src/engine/scenario.js';

const baseline = ScenarioInputSchema.parse(buildBaselineScenarioInput());

/** Bản sao baseline với giá tái tạo Ống tăng +20% so baseline (tạo độ lệch để test). */
function deviatedBaseline(): ScenarioInput {
  const s = structuredClone(baseline);
  const pipeMat = referenceMaterialOf(s.materials, s.products, 'pipe')!;
  const m = s.materials.find((x) => x.id === pipeMat.id)!;
  m.inventory.replacementPriceUsdPerKg = m.inventory.priceLock.baseline * 1.2; // +20%
  return s;
}

describe('decideOrder — verdict theo sàn thị trường', () => {
  const r = decideOrder(baseline, { line: 'fitting', quantityTons: 50, offeredPriceVndPerKg: 130000 });

  it('kết quả hợp lệ theo schema; quantityKg = tấn×1000', () => {
    expect(() => OrderDecisionResultSchema.parse(r)).not.toThrow();
    expect(r.quantityKg).toBe(50_000);
  });

  it('giá chào ≥ giá thành đầy đủ ⇒ accept', () => {
    const hi = decideOrder(baseline, { line: 'fitting', quantityTons: 10, offeredPriceVndPerKg: r.marketFullCostVndPerKg + 5000 });
    expect(hi.verdict).toBe('accept');
    expect(hi.profitVsFullCostPerKgVnd).toBeGreaterThan(0);
  });

  it('giá chào giữa biến phí và full cost ⇒ consider (đóng góp dương)', () => {
    const mid = Math.round((r.marketVariableFloorVndPerKg + r.marketFullCostVndPerKg) / 2);
    const c = decideOrder(baseline, { line: 'fitting', quantityTons: 10, offeredPriceVndPerKg: mid });
    expect(c.verdict).toBe('consider');
    expect(c.contributionPerKgVnd).toBeGreaterThan(0);
    expect(c.profitVsFullCostPerKgVnd).toBeLessThan(0);
  });

  it('giá chào < sàn biến phí thị trường ⇒ reject (lỗ tiền tươi)', () => {
    const lo = decideOrder(baseline, { line: 'fitting', quantityTons: 10, offeredPriceVndPerKg: r.marketVariableFloorVndPerKg - 5000 });
    expect(lo.verdict).toBe('reject');
    expect(lo.contributionPerKgVnd).toBeLessThan(0);
  });

  it('tổng đóng góp = đóng góp/kg × quantityKg', () => {
    expect(r.contributionTotalVnd).toBeCloseTo(r.contributionPerKgVnd * r.quantityKg, 0);
  });
});

describe('decideOrder — sàn thị trường tách sàn khóa khi giá lệch', () => {
  const dev = deviatedBaseline();

  it('giá tái tạo cao hơn baseline ⇒ sàn thị trường > sàn khóa (đơn mới đắt hơn)', () => {
    const r = decideOrder(dev, { line: 'pipe', quantityTons: 20, offeredPriceVndPerKg: 150000 });
    expect(r.marketVariableFloorVndPerKg).toBeGreaterThan(r.lockedVariableFloorVndPerKg);
    expect(r.lock.deviationPct).toBeCloseTo(0.2, 3);
  });

  it('panel khóa giá đổi theo ngưỡng what-if', () => {
    // lệch +20%: ngưỡng 3% → MỞ (dùng giá tái tạo); ngưỡng 25% → KHÓA (giá baseline)
    const open = decideOrder(dev, { line: 'pipe', quantityTons: 20, offeredPriceVndPerKg: 150000, thresholdPctWhatIf: 0.03 });
    expect(open.lock.isLocked).toBe(false);
    expect(open.lock.appliedPricingUsdPerKg).toBeCloseTo(open.lock.replacementUsdPerKg, 6);

    const stayLocked = decideOrder(dev, { line: 'pipe', quantityTons: 20, offeredPriceVndPerKg: 150000, thresholdPctWhatIf: 0.25 });
    expect(stayLocked.lock.isLocked).toBe(true);
    expect(stayLocked.lock.appliedPricingUsdPerKg).toBeCloseTo(stayLocked.lock.baselineUsdPerKg, 6);
  });
});
