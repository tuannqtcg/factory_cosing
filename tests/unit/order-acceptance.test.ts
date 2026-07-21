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

// ADR-037 — chỉ định nguyên liệu theo dòng đơn (đơn nhiều dòng BlazeMaster/Corzan).
describe('decideOrder — materialId chỉ định (ADR-037)', () => {
  it('materialId trùng nguyên liệu tham chiếu ⇒ kết quả giống hệt khi bỏ trống (tương thích cũ)', () => {
    const refMat = referenceMaterialOf(baseline.materials, baseline.products, 'pipe')!;
    const implicit = decideOrder(baseline, { line: 'pipe', quantityTons: 10, offeredPriceVndPerKg: 140000 });
    const explicit = decideOrder(baseline, { line: 'pipe', materialId: refMat.id, quantityTons: 10, offeredPriceVndPerKg: 140000 });
    expect(explicit).toEqual(implicit);
  });

  it('materialId khác (nếu dòng có ≥2 nguyên liệu) ⇒ sàn tính theo đúng nguyên liệu đó', () => {
    const pipeMatIds = [...new Set(baseline.products.filter((p) => p.kind === 'pipe').map((p) => p.materialId))];
    if (pipeMatIds.length < 2) return; // fixture chỉ có 1 nguyên liệu ống — không có gì để so
    const [a, b] = pipeMatIds as [string, string];
    const ra = decideOrder(baseline, { line: 'pipe', materialId: a, quantityTons: 10, offeredPriceVndPerKg: 140000 });
    const rb = decideOrder(baseline, { line: 'pipe', materialId: b, quantityTons: 10, offeredPriceVndPerKg: 140000 });
    expect(ra.materialId).toBe(a);
    expect(rb.materialId).toBe(b);
    expect(ra.marketVariableFloorVndPerKg).not.toBe(rb.marketVariableFloorVndPerKg);
  });

  it('materialId không tồn tại ⇒ báo lỗi rõ ràng', () => {
    expect(() => decideOrder(baseline, { line: 'pipe', materialId: 'khong-ton-tai', quantityTons: 1, offeredPriceVndPerKg: 100000 })).toThrow();
  });
});

describe('decideOrder — ADR-051 chi phí setup (đơn nhỏ bị phạt)', () => {
  it('setup=0 ⇒ verdict + tổng đóng góp trùng khít biên tế/kg (parity ADR-029)', () => {
    const noSetup = decideOrder(baseline, { line: 'fitting', quantityTons: 10, offeredPriceVndPerKg: 130000 });
    const zero = decideOrder(baseline, { line: 'fitting', quantityTons: 10, offeredPriceVndPerKg: 130000, setupCostVnd: 0 });
    expect(zero.verdict).toBe(noSetup.verdict);
    expect(zero.contributionTotalVnd).toBeCloseTo(zero.contributionPerKgVnd * zero.quantityKg, 0);
    expect(zero.setupCostPerKgVnd).toBe(0);
  });

  it('giá chào > full cost nhưng đơn TÍ (1 kg) + setup lớn ⇒ không còn accept', () => {
    const big = decideOrder(baseline, { line: 'fitting', quantityTons: 10, offeredPriceVndPerKg: 200000 });
    expect(big.verdict).toBe('accept'); // đơn lớn, giá tốt → nhận
    const tiny = decideOrder(baseline, { line: 'fitting', quantityTons: 0.001, offeredPriceVndPerKg: 200000, setupCostVnd: 1_000_000 });
    expect(tiny.verdict).not.toBe('accept'); // 1 kg gánh 1 triệu setup → verdict xuống
    expect(tiny.setupCostPerKgVnd).toBeGreaterThan(0);
  });
});
