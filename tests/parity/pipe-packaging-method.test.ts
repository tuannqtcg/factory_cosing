// ADR-069 — 2 logic tính bao bì Ống song song (pipePackagingMethod), ĐỐI XỨNG
// ADR-060/065 (Phụ kiện, fitting-packaging-method.test.ts):
//  1. 'flat_per_kg' = mặc định, khớp baseline Excel (parity — không đổi).
//  2. 'per_bag' THIẾU dữ liệu cuộn/piecesPerBag = tương đương 'flat_per_kg'
//     (fallback per-DN) → bật 'per_bag' không phá gì khi chưa nhập dữ liệu.
//  3. 'per_bag' CÓ đủ dữ liệu → chi phí bao bì/kg đổi theo đúng công thức
//     (giá 1 túi ÷ piecesPerBag) ÷ (đơn trọng × chiều dài túi).
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';
import { calculateScenario } from '../../src/engine/scenario.js';

const base = ScenarioInputSchema.parse(buildBaselineScenarioInput());
const pipeChains = (out: ReturnType<typeof calculateScenario>) =>
  out.skuPriceChains.filter((s) => s.productKey.dn !== undefined);

const rollData = {
  packagingBagMaterialPricePerKgVnd: 74000,
  packagingRollWeightKg: 35,
  packagingRollLengthM: 630,
  packagingBagLengthM: 4.2,
};
// giá 1 túi = 74.000 × 35 ÷ 630 × 4.2 = 17.266,67đ
const bagCostVnd = (rollData.packagingBagMaterialPricePerKgVnd * rollData.packagingRollWeightKg / rollData.packagingRollLengthM) * rollData.packagingBagLengthM;

describe('ADR-069 — pipePackagingMethod: flat_per_kg vs per_bag', () => {
  it("mặc định = 'per_bag' (ADR-070 — user đã nhập đủ dữ liệu cuộn/cây-túi, chốt method cố định, doc không có field parse thành 'per_bag')", () => {
    expect(base.pipePackagingMethod).toBe('per_bag');
  });

  it("'per_bag' KHÔNG có dữ liệu cuộn/piecesPerBag = 'flat_per_kg' (fallback tuyệt đối)", () => {
    const flat = calculateScenario({ ...base, pipePackagingMethod: 'flat_per_kg' });
    const perBag = calculateScenario({ ...base, pipePackagingMethod: 'per_bag' });
    const a = pipeChains(flat);
    const b = pipeChains(perBag);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.chain.vfPricePerUnit).toBeCloseTo(a[i]!.chain.vfPricePerUnit, 6);
    }
  });

  it("'per_bag' resource THIẾU dữ liệu cuộn (dù DN có piecesPerBag) = 'flat_per_kg'", () => {
    const withPieces = {
      ...base,
      pipePackagingMethod: 'per_bag' as const,
      products: base.products.map((p) => (p.kind === 'pipe' ? { ...p, piecesPerBag: 10 } : p)),
    };
    const flat = calculateScenario({ ...base, pipePackagingMethod: 'flat_per_kg' });
    const perBag = calculateScenario(withPieces);
    const a = pipeChains(flat);
    const b = pipeChains(perBag);
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.chain.vfPricePerUnit).toBeCloseTo(a[i]!.chain.vfPricePerUnit, 6);
    }
  });

  it("'per_bag' CÓ đủ dữ liệu → packagingCostPerKg = (giá túi ÷ piecesPerBag) ÷ (đơn trọng × chiều dài túi), khác 'flat_per_kg'", () => {
    const piecesPerBag = 10; // cố định cho mọi DN để so sánh đơn giản
    const withBagData = {
      ...base,
      pipePackagingMethod: 'per_bag' as const,
      resources: { ...base.resources, pipe: { ...base.resources.pipe, ...rollData } },
      products: base.products.map((p) => (p.kind === 'pipe' ? { ...p, piecesPerBag } : p)),
    };
    const flat = calculateScenario({ ...base, pipePackagingMethod: 'flat_per_kg' });
    const perBag = calculateScenario(withBagData);
    const a = pipeChains(flat);
    const b = pipeChains(perBag);
    expect(b.length).toBe(a.length);

    const pipeResource = base.resources.pipe as { packagingCostPerKg: number };
    const pipeProducts = base.products.filter((p) => p.kind === 'pipe') as { unitWeightKgPerM: number }[];

    let anyChanged = false;
    for (let i = 0; i < a.length; i++) {
      const product = pipeProducts[i]!;
      const newPackagingPerKg = bagCostVnd / piecesPerBag / (product.unitWeightKgPerM * rollData.packagingBagLengthM);
      const expectedDeltaPerKg = newPackagingPerKg - pipeResource.packagingCostPerKg;
      if (Math.abs(expectedDeltaPerKg) > 1e-9) anyChanged = true;
      const expectedDeltaPerUnit = expectedDeltaPerKg * product.unitWeightKgPerM; // breakEvenPerUnit = fullCostPerKg × unitWeightKgPerM
      expect(b[i]!.chain.breakEvenPerUnit - a[i]!.chain.breakEvenPerUnit).toBeCloseTo(expectedDeltaPerUnit, 4);
    }
    expect(anyChanged).toBe(true);
  });
});

describe('ADR-069 — CVP/hoà vốn Ống đọc ĐÚNG bao bì đang cấu hình (không còn luôn phẳng)', () => {
  const pipeCvpOf = (out: ReturnType<typeof calculateScenario>) => out.cvp.byLineMaterial.find((e) => e.line === 'pipe')!;

  it("'flat_per_kg' (mặc định) ⇒ PipeCvp.packagingCostPerKg = đúng resource.packagingCostPerKg (parity)", () => {
    const flat = calculateScenario({ ...base, pipePackagingMethod: 'flat_per_kg' });
    const pipeResource = base.resources.pipe as { packagingCostPerKg: number };
    expect(pipeCvpOf(flat).packagingCostPerKg).toBe(pipeResource.packagingCostPerKg);
  });

  it("'per_bag' THIẾU dữ liệu cuộn ⇒ hoà vốn KHÔNG đổi so với 'flat_per_kg' (fallback đúng)", () => {
    const flat = calculateScenario({ ...base, pipePackagingMethod: 'flat_per_kg' });
    const perBagNoData = calculateScenario({ ...base, pipePackagingMethod: 'per_bag' });
    expect(pipeCvpOf(perBagNoData).packagingCostPerKg).toBeCloseTo(pipeCvpOf(flat).packagingCostPerKg, 9);
    expect(pipeCvpOf(perBagNoData).breakEvenKgYear).toBeCloseTo(pipeCvpOf(flat).breakEvenKgYear, 6);
  });

  it("'per_bag' CÓ đủ dữ liệu ⇒ packagingCostPerKg + breakEvenKgYear ĐỔI so với 'flat_per_kg'", () => {
    const withBagData = {
      ...base,
      pipePackagingMethod: 'per_bag' as const,
      resources: { ...base.resources, pipe: { ...base.resources.pipe, ...rollData } },
      products: base.products.map((p) => (p.kind === 'pipe' ? { ...p, piecesPerBag: 10 } : p)),
    };
    const flat = calculateScenario({ ...base, pipePackagingMethod: 'flat_per_kg' });
    const perBag = calculateScenario(withBagData);
    expect(pipeCvpOf(perBag).packagingCostPerKg).not.toBeCloseTo(pipeCvpOf(flat).packagingCostPerKg, 2);
    expect(pipeCvpOf(perBag).breakEvenKgYear).not.toBeCloseTo(pipeCvpOf(flat).breakEvenKgYear, 2);
  });

  it("'per_bag' ĐỔI hoà vốn Ống nhưng KHÔNG đụng CVP dòng Phụ kiện (2 dòng độc lập)", () => {
    const withBagData = {
      ...base,
      pipePackagingMethod: 'per_bag' as const,
      resources: { ...base.resources, pipe: { ...base.resources.pipe, ...rollData } },
      products: base.products.map((p) => (p.kind === 'pipe' ? { ...p, piecesPerBag: 10 } : p)),
    };
    const flat = calculateScenario({ ...base, pipePackagingMethod: 'flat_per_kg' });
    const perBag = calculateScenario(withBagData);
    const fittingCvpOf = (out: ReturnType<typeof calculateScenario>) => out.cvp.byLineMaterial.find((e) => e.line === 'fitting')!;
    expect(fittingCvpOf(perBag).breakEvenKgYear).toBeCloseTo(fittingCvpOf(flat).breakEvenKgYear, 6);
  });
});

// ADR-066 (đối xứng, xem fitting-packaging-method.test.ts) — CVP (bậc 1) và
// fullCostPerKg (bậc 2) PHẢI cộng khớp nhau dưới cả per_bag.
describe('ADR-069 — CVP và fullCostPerKg (thang giá bậc 1↔2) vẫn CỘNG KHỚP dưới per_bag', () => {
  it('breakEvenFullCost (bậc 2) = variableCostPerKg + fixedCostPerYear/kg (bậc 1 + định phí/kg) — đúng cả per_bag', () => {
    const withBagData = {
      ...base,
      pipePackagingMethod: 'per_bag' as const,
      resources: { ...base.resources, pipe: { ...base.resources.pipe, ...rollData } },
      products: base.products.map((p) => (p.kind === 'pipe' ? { ...p, piecesPerBag: 10 } : p)),
    };
    const out = calculateScenario(withBagData);
    const pipeCvp = out.cvp.byLineMaterial.find((e) => e.line === 'pipe')!;
    const pipeLadder = out.priceLadder.byLineMaterial.find((e) => e.line === 'pipe')!.ladder;
    const kg = out.capacity.pipe.normalCapacityKgYear;
    const impliedFullCost = pipeCvp.variableCostPerKg + pipeCvp.fixedCostPerYear / kg;
    expect(pipeLadder.breakEvenFullCost).toBeCloseTo(impliedFullCost, 4);
  });
});
