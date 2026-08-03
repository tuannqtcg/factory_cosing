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

// ADR-065 — TRƯỚC ADR này, CVP/hoà vốn Phụ kiện LUÔN dùng packagingCostPerKg
// phẳng dù đã bật 'per_box' (chỉ giá SKU đổi, hoà vốn thì không — user phát
// hiện 2026-08-02: "chưa có phần cấu hình bao bì để xác định đúng điểm hòa
// vốn theo cách này, cách cũ đang để phẳng"). Test dưới verify hoà vốn nay
// ĐÃ đổi theo đúng phương thức cấu hình.
describe('ADR-065 — CVP/hoà vốn Phụ kiện đọc ĐÚNG bao bì đang cấu hình (không còn luôn phẳng)', () => {
  const fittingCvpOf = (out: ReturnType<typeof calculateScenario>) =>
    out.cvp.byLineMaterial.find((e) => e.line === 'fitting')!;

  it("'flat_per_kg' (mặc định) ⇒ FittingCvp.packagingCostPerKg = đúng resource.packagingCostPerKg (parity)", () => {
    const flat = calculateScenario({ ...base, fittingPackagingMethod: 'flat_per_kg' });
    const fittingResource = base.resources.fitting as { packagingCostPerKg: number };
    expect(fittingCvpOf(flat).packagingCostPerKg).toBe(fittingResource.packagingCostPerKg);
  });

  it("'per_box' THIẾU packagingBoxCostVnd ⇒ hoà vốn KHÔNG đổi so với 'flat_per_kg' (fallback đúng)", () => {
    const flat = calculateScenario({ ...base, fittingPackagingMethod: 'flat_per_kg' });
    const perBoxNoData = calculateScenario({ ...base, fittingPackagingMethod: 'per_box' });
    expect(fittingCvpOf(perBoxNoData).packagingCostPerKg).toBeCloseTo(fittingCvpOf(flat).packagingCostPerKg, 9);
    expect(fittingCvpOf(perBoxNoData).breakEvenKgYear).toBeCloseTo(fittingCvpOf(flat).breakEvenKgYear, 6);
  });

  it("'per_box' CÓ đủ dữ liệu ⇒ packagingCostPerKg + breakEvenKgYear ĐỔI so với 'flat_per_kg'", () => {
    const boxCostVnd = 12000;
    const piecesPerBox = 100;
    const withBoxData = {
      ...base,
      fittingPackagingMethod: 'per_box' as const,
      resources: { ...base.resources, fitting: { ...base.resources.fitting, packagingBoxCostVnd: boxCostVnd } },
      products: base.products.map((p) => (p.kind === 'fitting' ? { ...p, piecesPerBox } : p)),
    };
    const flat = calculateScenario({ ...base, fittingPackagingMethod: 'flat_per_kg' });
    const perBox = calculateScenario(withBoxData);
    expect(fittingCvpOf(perBox).packagingCostPerKg).not.toBeCloseTo(fittingCvpOf(flat).packagingCostPerKg, 2);
    expect(fittingCvpOf(perBox).breakEvenKgYear).not.toBeCloseTo(fittingCvpOf(flat).breakEvenKgYear, 2);
  });

  it("'per_box' ĐỔI hoà vốn Phụ kiện nhưng KHÔNG đụng CVP dòng Ống (2 dòng độc lập)", () => {
    const boxCostVnd = 12000;
    const withBoxData = {
      ...base,
      fittingPackagingMethod: 'per_box' as const,
      resources: { ...base.resources, fitting: { ...base.resources.fitting, packagingBoxCostVnd: boxCostVnd } },
      products: base.products.map((p) => (p.kind === 'fitting' ? { ...p, piecesPerBox: 100 } : p)),
    };
    const flat = calculateScenario({ ...base, fittingPackagingMethod: 'flat_per_kg' });
    const perBox = calculateScenario(withBoxData);
    const pipeCvpOf = (out: ReturnType<typeof calculateScenario>) => out.cvp.byLineMaterial.find((e) => e.line === 'pipe')!;
    expect(pipeCvpOf(perBox).breakEvenKgYear).toBeCloseTo(pipeCvpOf(flat).breakEvenKgYear, 6);
  });
});
