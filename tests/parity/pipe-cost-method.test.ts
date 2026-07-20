// ADR-047 — 2 logic tính giá thành Ống song song (pipeCostMethod). Kiểm chứng:
//  1. 'kg' = mặc định, khớp baseline Excel (parity — không đổi).
//  2. 'meters' KHÔNG có m/giờ đo = tương đương 'kg' (fallback suy từ tốc độ chung
//     → giá vốn/kg trùng khít) → bật 'meters' không phá gì khi chưa nhập số đo.
//  3. 'meters' CÓ m/giờ đo → phân bổ lại theo giờ máy per-size (giá SKU đổi).
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';
import { calculateScenario } from '../../src/engine/scenario.js';

const base = ScenarioInputSchema.parse(buildBaselineScenarioInput());
const pipeChains = (out: ReturnType<typeof calculateScenario>) =>
  out.skuPriceChains.filter((s) => s.productKey.dn !== undefined);

describe('ADR-047 — pipeCostMethod: kg vs meters', () => {
  it("mặc định = 'kg' (doc không có field vẫn parse thành 'kg')", () => {
    expect(base.pipeCostMethod).toBe('kg');
  });

  it("'meters' KHÔNG có m/giờ đo = 'kg' (fallback tương đương tuyệt đối)", () => {
    const kg = calculateScenario({ ...base, pipeCostMethod: 'kg' });
    const meters = calculateScenario({ ...base, pipeCostMethod: 'meters' });
    const a = pipeChains(kg);
    const b = pipeChains(meters);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.chain.vfPricePerUnit).toBeCloseTo(a[i]!.chain.vfPricePerUnit, 4);
      expect(b[i]!.chain.listPriceBeforeVat).toBeCloseTo(a[i]!.chain.listPriceBeforeVat, 4);
    }
  });

  it("'meters' CÓ m/giờ đo → giá SKU phân bổ lại theo giờ máy (khác 'kg')", () => {
    const withRates = {
      ...base,
      pipeCostMethod: 'meters' as const,
      // Ví dụ 2-ngưỡng: size nhỏ nhanh (420 m/h), size lớn chậm (60 m/h).
      products: base.products.map((p) => (p.kind === 'pipe' ? { ...p, capacityMetersPerHour: Number(p.dn) <= 25 ? 420 : 60 } : p)),
    };
    const kg = calculateScenario({ ...base, pipeCostMethod: 'kg' });
    const m = calculateScenario(withRates);
    const kgByDn = new Map(pipeChains(kg).map((s) => [s.productKey.dn, s.chain.vfPricePerUnit]));
    const mByDn = new Map(pipeChains(m).map((s) => [s.productKey.dn, s.chain.vfPricePerUnit]));
    // Ít nhất 1 size đổi giá so với 'kg' → nhánh meters có tác dụng.
    const anyChanged = [...kgByDn.keys()].some((dn) => Math.abs((mByDn.get(dn) ?? 0) - (kgByDn.get(dn) ?? 0)) > 1);
    expect(anyChanged).toBe(true);
    // Size CHẠY CHẬM hơn (kg/giờ per-size thấp hơn) phải đắt hơn size chạy nhanh,
    // xét phần giá vốn/kg (bỏ nguyên liệu — giống nhau). So DN100 (60m/h·nặng) vs
    // DN20 (420m/h·nhẹ): kg/giờ = 60×4.304=258 vs 420×0.29=122 → DN20 CHẬM hơn/kg.
    // Kiểm: nhánh meters làm giá phân hoá theo size (không còn phẳng như kg).
    const spread = (byDn: Map<unknown, number>) => {
      const vals = [...byDn.values()];
      return Math.max(...vals) / Math.min(...vals);
    };
    expect(spread(mByDn)).not.toBeCloseTo(spread(kgByDn), 3); // phân bố giá đổi
  });
});
