// ADR-047 — 2 logic tính giá thành Ống song song (pipeCostMethod). Kiểm chứng:
//  1. 'kg' = mặc định, khớp baseline Excel (parity — không đổi).
//  2. 'meters' KHÔNG có m/giờ đo = tương đương 'kg' (fallback suy từ tốc độ chung
//     → giá vốn/kg trùng khít) → bật 'meters' không phá gì khi chưa nhập số đo.
//  3. 'meters' CÓ m/giờ đo → phân bổ lại theo giờ máy per-size (giá SKU đổi).
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput, buildCorzanScenarioInput } from '../helpers/scenario-fixture.js';
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

  // ADR-048 — 'meters' CÓ m/giờ: size chạy chậm KÉO tổng công suất dòng xuống
  // (máy nghẽn) → tổng sản lượng/năm KHÁC 'kg'. 'meters' CHƯA đo thì giữ y hệt.
  it("'meters' CÓ m/giờ đo → tổng công suất dòng đổi (nghẽn); chưa đo thì giữ nguyên", () => {
    const kg = calculateScenario({ ...base, pipeCostMethod: 'kg' });
    const metersNoRate = calculateScenario({ ...base, pipeCostMethod: 'meters' });
    // Chưa nhập m/giờ ⇒ công suất trùng khít 'kg'.
    expect(metersNoRate.capacity.pipe.normalCapacityKgYear).toBeCloseTo(kg.capacity.pipe.normalCapacityKgYear, 4);

    const withRates = {
      ...base,
      pipeCostMethod: 'meters' as const,
      products: base.products.map((p) => (p.kind === 'pipe' ? { ...p, capacityMetersPerHour: Number(p.dn) <= 25 ? 420 : 60 } : p)),
    };
    const meters = calculateScenario(withRates);
    // Size lớn (60 m/h) nhiều hơn size nhỏ nhanh ⇒ tổng công suất GIẢM rõ rệt.
    expect(meters.capacity.pipe.normalCapacityKgYear).toBeLessThan(kg.capacity.pipe.normalCapacityKgYear * 0.95);
    expect(meters.capacity.pipe.normalCapacityKgYear).toBeGreaterThan(0);
  });
});

// ADR-063 — end-to-end: cùng máy đùn chạy CHUNG ≥2 material (BlazeMaster +
// Corzan, đơn trọng khác nhau — user nêu 2026-07-31) ⇒ tốc độ hiệu dụng phải
// LÀ BÌNH QUÂN CÓ TRỌNG SỐ theo tỷ lệ đáy (ADR-055 productionMixPipePrimaryPct),
// không phải bình quân đơn giản mọi SKU của cả 2 material cộng lại. Test này đi
// qua NGUYÊN VẸN calculateScenario() (không gọi thẳng effectivePipeCapacity như
// tests/unit/pipe-material-mix.test.ts) để chứng minh việc wiring vào orchestrator
// có tác dụng thật, không chỉ đúng ở hàm pipe.ts cô lập.
describe('ADR-063 — calculateScenario(): công suất Ống có trọng số theo tỷ lệ đáy khi ≥2 material chung máy', () => {
  // Dữ liệu mock (chưa có số đo thật — user sẽ nhập tay sau qua cột "CS đùn
  // (m/giờ)"): cùng 400 m/giờ cho mọi size cả 2 material ⇒ khác biệt kg/giờ
  // hiệu dụng THUẦN TUÝ do đơn trọng Corzan nặng hơn 10% (corzan.json._meta).
  const corzanBase = ScenarioInputSchema.parse(buildCorzanScenarioInput());
  const withMeterRates = {
    ...corzanBase,
    pipeCostMethod: 'meters' as const,
    products: corzanBase.products.map((p) => (p.kind === 'pipe' ? { ...p, capacityMetersPerHour: 400 } : p)),
  };
  const scenarioAt = (pipePrimaryPct: number) => calculateScenario({ ...withMeterRates, productionMixPipePrimaryPct: pipePrimaryPct });

  it('chạy 100% BlazeMaster (material chính) ⇒ công suất Ống thấp hơn chạy 100% Corzan (nặng hơn/mét)', () => {
    const mostlyBm = scenarioAt(100);
    const mostlyCorzan = scenarioAt(0);
    expect(mostlyCorzan.capacity.pipe.normalCapacityKgYear).toBeGreaterThan(mostlyBm.capacity.pipe.normalCapacityKgYear);
  });

  it('tỷ lệ đáy 50/50 nằm GIỮA 2 thái cực 100%/0% (đơn điệu theo tỷ lệ, không nhảy bậc)', () => {
    const mostlyBm = scenarioAt(100);
    const mostlyCorzan = scenarioAt(0);
    const half = scenarioAt(50);
    expect(half.capacity.pipe.normalCapacityKgYear).toBeGreaterThan(mostlyBm.capacity.pipe.normalCapacityKgYear);
    expect(half.capacity.pipe.normalCapacityKgYear).toBeLessThan(mostlyCorzan.capacity.pipe.normalCapacityKgYear);
  });

  it("KHÔNG truyền productionMixPipePrimaryPct (mặc định 100 — parity ADR-055) ⇒ khớp truyền tường minh 100", () => {
    const implicit = calculateScenario(withMeterRates);
    const explicit100 = scenarioAt(100);
    expect(implicit.capacity.pipe.normalCapacityKgYear).toBeCloseTo(explicit100.capacity.pipe.normalCapacityKgYear, 6);
  });

  it("pipeCostMethod='kg' ⇒ tỷ lệ đáy KHÔNG ảnh hưởng công suất Ống (nhánh mix chỉ áp dụng ở 'meters')", () => {
    const kgAt100 = calculateScenario({ ...corzanBase, pipeCostMethod: 'kg', productionMixPipePrimaryPct: 100 });
    const kgAt0 = calculateScenario({ ...corzanBase, pipeCostMethod: 'kg', productionMixPipePrimaryPct: 0 });
    expect(kgAt0.capacity.pipe.normalCapacityKgYear).toBeCloseTo(kgAt100.capacity.pipe.normalCapacityKgYear, 6);
  });
});
