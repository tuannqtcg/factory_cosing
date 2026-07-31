// ADR-060 — 2 logic tính bao bì Phụ kiện song song (fittingPackagingMethod):
//  1. 'flat_per_kg' = mặc định, khớp baseline Excel (parity — không đổi).
//  2. 'per_box' THIẾU piecesPerBox/packagingBoxCostVnd = tương đương
//     'flat_per_kg' (fallback per-SKU) → bật 'per_box' không phá gì khi chưa
//     nhập dữ liệu đóng gói.
//  3. 'per_box' CÓ đủ dữ liệu → chi phí bao bì/cái đổi theo đúng công thức
//     packagingBoxCostVnd ÷ piecesPerBox (thay vì unitWeightKg × packagingCostPerKg).
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';
import { calculateScenario } from '../../src/engine/scenario.js';

const base = ScenarioInputSchema.parse(buildBaselineScenarioInput());
const fittingChains = (out: ReturnType<typeof calculateScenario>) =>
  out.skuPriceChains.filter((s) => s.productKey.dn === undefined);

describe('ADR-060 — fittingPackagingMethod: flat_per_kg vs per_box', () => {
  it("mặc định = 'flat_per_kg' (doc không có field vẫn parse thành 'flat_per_kg')", () => {
    expect(base.fittingPackagingMethod).toBe('flat_per_kg');
  });

  it("'per_box' KHÔNG có piecesPerBox/packagingBoxCostVnd = 'flat_per_kg' (fallback tuyệt đối)", () => {
    const flat = calculateScenario({ ...base, fittingPackagingMethod: 'flat_per_kg' });
    const perBox = calculateScenario({ ...base, fittingPackagingMethod: 'per_box' });
    const a = fittingChains(flat);
    const b = fittingChains(perBox);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.chain.vfPricePerUnit).toBeCloseTo(a[i]!.chain.vfPricePerUnit, 6);
      expect(b[i]!.chain.listPriceBeforeVat).toBeCloseTo(a[i]!.chain.listPriceBeforeVat, 6);
    }
  });

  it("'per_box' resource THIẾU packagingBoxCostVnd (dù SKU có piecesPerBox) = 'flat_per_kg'", () => {
    const withPieces = {
      ...base,
      fittingPackagingMethod: 'per_box' as const,
      products: base.products.map((p) => (p.kind === 'fitting' ? { ...p, piecesPerBox: 100 } : p)),
    };
    const flat = calculateScenario({ ...base, fittingPackagingMethod: 'flat_per_kg' });
    const perBox = calculateScenario(withPieces);
    const a = fittingChains(flat);
    const b = fittingChains(perBox);
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.chain.vfPricePerUnit).toBeCloseTo(a[i]!.chain.vfPricePerUnit, 6);
    }
  });

  it("'per_box' CÓ đủ dữ liệu → packagingCostPerUnit = boxCost ÷ piecesPerBox, khác 'flat_per_kg'", () => {
    const boxCostVnd = 12000;
    const piecesPerBox = 100; // cố định cho mọi SKU để so sánh đơn giản
    const withBoxData = {
      ...base,
      fittingPackagingMethod: 'per_box' as const,
      resources: {
        ...base.resources,
        fitting: { ...base.resources.fitting, packagingBoxCostVnd: boxCostVnd },
      },
      products: base.products.map((p) => (p.kind === 'fitting' ? { ...p, piecesPerBox } : p)),
    };
    const flat = calculateScenario({ ...base, fittingPackagingMethod: 'flat_per_kg' });
    const perBox = calculateScenario(withBoxData);
    const a = fittingChains(flat);
    const b = fittingChains(perBox);
    expect(b.length).toBe(a.length);

    const fittingResource = base.resources.fitting as { packagingCostPerKg: number };
    const packagingCostPerUnitOverride = boxCostVnd / piecesPerBox; // = 120đ/cái cố định

    let anyChanged = false;
    for (let i = 0; i < a.length; i++) {
      const product = base.products.filter((p) => p.kind === 'fitting')[i] as { unitWeightKg: number };
      const oldPackagingPerUnit = product.unitWeightKg * fittingResource.packagingCostPerKg;
      const expectedDeltaPerUnit = packagingCostPerUnitOverride - oldPackagingPerUnit;
      if (Math.abs(expectedDeltaPerUnit) > 1e-9) anyChanged = true;
      // breakEvenPerUnit đổi đúng bằng delta bao bì (material/processing khác giữ nguyên).
      expect(b[i]!.chain.breakEvenPerUnit - a[i]!.chain.breakEvenPerUnit).toBeCloseTo(expectedDeltaPerUnit, 4);
    }
    expect(anyChanged).toBe(true);
  });
});
