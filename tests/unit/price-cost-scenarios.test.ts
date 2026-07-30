// ADR-057 — test engine 2 kịch bản giá vốn song song (Giá VF dự kiến/bình quân
// gia quyền, dual EBIT Dashboard). Xác nhận scenarioWithCostBasis ép ĐÚNG cơ sở
// giá mong muốn (bất kể trạng thái khóa/mở khóa thật), tái dùng calculateScenario
// + makeFixedPriceModel — không công thức mới.
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';
import { calculateScenario } from '../../src/engine/scenario.js';
import { weightedAvgUsdPerKg } from '../../src/engine/dual-costing.js';
import { scenarioWithCostBasis } from '../../src/engine/price-cost-scenarios.js';
import { makeFixedPriceModel } from '../../src/engine/scenario-drivers.js';
import { weightedAvgLandedCostPerKgVnd } from '../../src/engine/dual-costing.js';
import { landedCostPerKgVnd } from '../../src/engine/cost-pool.js';

const baseline = ScenarioInputSchema.parse(buildBaselineScenarioInput());

describe('scenarioWithCostBasis', () => {
  it('market-today — mọi material: baseline = replacement = giá mua mới hôm nay gốc', () => {
    const s = scenarioWithCostBasis(baseline, 'market-today');
    for (const mat of s.materials) {
      const original = baseline.materials.find((m) => m.id === mat.id)!;
      expect(mat.inventory.replacementPriceUsdPerKg).toBeCloseTo(original.inventory.replacementPriceUsdPerKg, 9);
      expect(mat.inventory.priceLock.baseline).toBeCloseTo(original.inventory.replacementPriceUsdPerKg, 9);
    }
  });

  it('weighted-avg — mọi material: baseline = replacement = bình quân gia quyền lô', () => {
    const s = scenarioWithCostBasis(baseline, 'weighted-avg');
    for (const mat of s.materials) {
      const original = baseline.materials.find((m) => m.id === mat.id)!;
      const expected = weightedAvgUsdPerKg(original.inventory.lots) ?? original.inventory.replacementPriceUsdPerKg;
      expect(mat.inventory.replacementPriceUsdPerKg).toBeCloseTo(expected, 9);
      expect(mat.inventory.priceLock.baseline).toBeCloseTo(expected, 9);
    }
  });

  it('sau khi ép, priceLock LUÔN khóa (deviation = 0) bất kể ngưỡng/trạng thái gốc', () => {
    const s = scenarioWithCostBasis(baseline, 'weighted-avg');
    const out = calculateScenario(s);
    for (const entry of out.priceLock.byMaterial) {
      expect(entry.evaluation.isLocked).toBe(true);
      expect(entry.evaluation.deviationPct).toBeCloseTo(0, 9);
    }
  });

  it('không đụng scenario gốc (không mutate baseline)', () => {
    const before = JSON.stringify(baseline);
    scenarioWithCostBasis(baseline, 'weighted-avg');
    expect(JSON.stringify(baseline)).toBe(before);
  });

  it('ADR-058 — lô có thuế/logistics RIÊNG: landed cost sau khi ép khớp weightedAvgLandedCostPerKgVnd (không phải bình quân giá thô × 1 rate chung)', () => {
    const mixed = structuredClone(baseline);
    const mat = mixed.materials[0]!;
    // 2 lô CÙNG giá mua nhưng 1 lô có C/O ưu đãi (thuế/logistics 0%) — nếu bình
    // quân giá thô rồi nhân 1 rate chung thì 2 kịch bản này sẽ RA CÙNG SỐ (sai).
    mat.inventory.lots = [
      { tons: 100, priceUsdPerKg: 3 },
      { tons: 100, priceUsdPerKg: 3, importTaxRate: 0, customsLogisticsFeeRate: 0 },
    ];
    const s = scenarioWithCostBasis(mixed, 'weighted-avg');
    const matAfter = s.materials.find((m) => m.id === mat.id)!;
    const rates = { importTaxRate: mat.importTaxRate, customsLogisticsFeeRate: mat.customsLogisticsFeeRate, usdVndRate: mixed.costPool.currency.usdVndRate };
    const expectedLanded = weightedAvgLandedCostPerKgVnd(mat.inventory.lots, rates, rates.usdVndRate)!;
    const actualLanded = landedCostPerKgVnd(matAfter.inventory.replacementPriceUsdPerKg, rates);
    expect(actualLanded).toBeCloseTo(expectedLanded, 3);
    // Landed cost đúng phải THẤP hơn cách tính cũ (bình quân giá thô 3 × rate material)
    // vì lô AIFTA rẻ hơn nhờ thuế 0% không được phản ánh trong cách cũ.
    const oldWrongLanded = landedCostPerKgVnd(3, rates);
    expect(actualLanded).toBeLessThan(oldWrongLanded);
  });
});

describe('Dual EBIT (Dashboard) — giữ nguyên giá bán, đổi cơ sở giá nguyên liệu', () => {
  it('EBIT theo kịch bản trung tính (giá mua mới hôm nay, không lô) khớp EBIT chính thức', () => {
    // Không có lô nào mua thêm/khác giá trong fixture gốc thì bình quân gia
    // quyền RÕ RÀNG có thể khác giá chính thức (baseline có thể lệch khỏi
    // replacement) — test số liệu ổn định duy nhất là: ép cơ sở = giá CHÍNH
    // THỨC hiện hành (baseline gốc) phải cho lại ĐÚNG EBIT chính thức.
    const model = makeFixedPriceModel(baseline);
    const officialBasisInput = structuredClone(baseline);
    for (const mat of officialBasisInput.materials) {
      mat.inventory.replacementPriceUsdPerKg = mat.inventory.priceLock.baseline;
    }
    const ebit = model.ebitAt(officialBasisInput, 1);
    expect(ebit).toBeCloseTo(model.baseEbitVnd, 0);
  });

  it('bình quân gia quyền RẺ hơn baseline ⇒ EBIT (giữ giá bán) CAO hơn EBIT chính thức', () => {
    const model = makeFixedPriceModel(baseline);
    const cheapInput = structuredClone(baseline);
    for (const mat of cheapInput.materials) {
      mat.inventory.replacementPriceUsdPerKg = mat.inventory.priceLock.baseline * 0.5; // giả lập giá vốn thực rẻ hơn hẳn
    }
    const ebit = model.ebitAt(cheapInput, 1);
    expect(ebit).toBeGreaterThan(model.baseEbitVnd);
  });
});
