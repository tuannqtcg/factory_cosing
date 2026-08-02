// ADR-063 — tốc độ hiệu dụng kg/giờ CÓ TRỌNG SỐ theo tỷ lệ đáy (ADR-055) khi
// ≥2 material dòng Ống chạy chung 1 máy đùn (VD BlazeMaster + Corzan, đơn
// trọng khác nhau vì SCH/độ dày khác nhau — user nêu phiên 2026-07-31).
// Property test bằng dữ liệu mock (chưa có số đo thật — user sẽ nhập tay sau
// qua cột "CS đùn (m/giờ)" đã có sẵn ở Danh Mục Sản Phẩm).
import { describe, expect, it } from 'vitest';
import { effectivePipeFinishedKgPerHour, effectivePipeCapacity } from '../../src/engine/pipe.js';
import type { ContinuousKgResource } from '../../src/schemas/resource.js';
import type { PipeProduct } from '../../src/schemas/product.js';

const resource: ContinuousKgResource = {
  driverType: 'continuous_kg',
  maxCapacityKgPerHour: 200,
  actualCapacityKgPerHour: 140,
  continuousRunDaysPerBatch: 5,
  maintenanceDaysPerBatch: 2,
  operatingDaysPerYear: 287,
  hoursPerShift: 8,
  normalShifts: 3,
  yieldRate: 0.9,
  packagingCostPerKg: 1500,
  extruderPriceEach: 3612904000,
  extruderCount: 3,
  moldPullerCutterCost: 3726500000,
  moldDepreciationYears: 3,
  depreciationYears: 10,
  annualMaintenance: 120000000,
  peoplePerShift: 2,
  avgSalaryMonthly: 13250000,
  monthsSalaryPerYear: 14,
  electricityKw: 120,
  electricityPricePerKwh: 2120,
  waterM3PerHour: 10,
  waterPricePerM3: 21200,
};

// DN20 BlazeMaster: đơn trọng thật 0.29 kg/m (fixture pipe.json). "Corzan" mock
// = ×1.1 (đúng CORZAN_PIPE_WEIGHT_FACTOR đã dùng khi mirror SKU, ProductsScreen.tsx).
const blazeMaster: PipeProduct = { kind: 'pipe', dn: '20', spec: 'SDR13.5', odMm: 26.7, minWallThicknessMm: 1.98, unitWeightKgPerM: 0.29, materialId: 'bm', capacityMetersPerHour: 400 };
const corzan: PipeProduct = { kind: 'pipe', dn: '20', spec: 'SDR13.5', odMm: 26.7, minWallThicknessMm: 2.18, unitWeightKgPerM: 0.319, materialId: 'corzan', capacityMetersPerHour: 400 };
const rateOf = (p: PipeProduct) => p.capacityMetersPerHour! * p.unitWeightKgPerM; // 400×0.29=116, 400×0.319=127.6

describe('ADR-063 — effectivePipeFinishedKgPerHour: mix có trọng số giữa 2 material chung máy', () => {
  it("method='kg' ⇒ luôn undefined dù có mix (không đổi hành vi ADR-047)", () => {
    const r = effectivePipeFinishedKgPerHour(resource, [blazeMaster, corzan], 'kg', { primaryMaterialId: 'bm', primaryFrac: 0.7 });
    expect(r).toBeUndefined();
  });

  it('chỉ 1 material trong danh sách ⇒ mix vô nghĩa, = bình quân đơn giản (parity-safe)', () => {
    const withMix = effectivePipeFinishedKgPerHour(resource, [blazeMaster], 'meters', { primaryMaterialId: 'bm', primaryFrac: 0.3 });
    const noMix = effectivePipeFinishedKgPerHour(resource, [blazeMaster], 'meters');
    expect(withMix).toBeCloseTo(noMix!, 9);
    expect(withMix).toBeCloseTo(rateOf(blazeMaster), 9);
  });

  it('primaryFrac=1 ⇒ đúng bằng tốc độ RIÊNG material chính (BlazeMaster), bỏ qua Corzan', () => {
    const r = effectivePipeFinishedKgPerHour(resource, [blazeMaster, corzan], 'meters', { primaryMaterialId: 'bm', primaryFrac: 1 });
    expect(r).toBeCloseTo(rateOf(blazeMaster), 9);
  });

  it('primaryFrac=0 ⇒ đúng bằng tốc độ RIÊNG material phụ (Corzan), bỏ qua BlazeMaster', () => {
    const r = effectivePipeFinishedKgPerHour(resource, [blazeMaster, corzan], 'meters', { primaryMaterialId: 'bm', primaryFrac: 0 });
    expect(r).toBeCloseTo(rateOf(corzan), 9);
  });

  it('primaryFrac=0.7 ⇒ bình quân CÓ TRỌNG SỐ đúng công thức 0.7×BM + 0.3×Corzan (119.48 kg/giờ)', () => {
    const r = effectivePipeFinishedKgPerHour(resource, [blazeMaster, corzan], 'meters', { primaryMaterialId: 'bm', primaryFrac: 0.7 });
    expect(r).toBeCloseTo(0.7 * rateOf(blazeMaster) + 0.3 * rateOf(corzan), 6);
    expect(r).toBeCloseTo(119.48, 6);
  });

  it('Corzan nặng hơn (đơn trọng cao hơn) ⇒ chạy Corzan nhiều hơn (primaryFrac giảm) LÀM TĂNG tốc độ kg/giờ hiệu dụng', () => {
    const mostlyBm = effectivePipeFinishedKgPerHour(resource, [blazeMaster, corzan], 'meters', { primaryMaterialId: 'bm', primaryFrac: 0.9 })!;
    const mostlyCorzan = effectivePipeFinishedKgPerHour(resource, [blazeMaster, corzan], 'meters', { primaryMaterialId: 'bm', primaryFrac: 0.1 })!;
    expect(mostlyCorzan).toBeGreaterThan(mostlyBm);
  });

  it('effectivePipeCapacity: normalCapacityKgYear đổi theo mix (không còn cố định 1 số bất kể tỷ lệ — khoảng trống trước ADR-063)', () => {
    const capMostlyBm = effectivePipeCapacity(resource, [blazeMaster, corzan], 'meters', { primaryMaterialId: 'bm', primaryFrac: 1 });
    const capMostlyCorzan = effectivePipeCapacity(resource, [blazeMaster, corzan], 'meters', { primaryMaterialId: 'bm', primaryFrac: 0 });
    expect(capMostlyCorzan.normalCapacityKgYear).toBeGreaterThan(capMostlyBm.normalCapacityKgYear);
    // sản lượng thiết kế (danh nghĩa, không phụ thuộc mix) giữ nguyên — chỉ sản lượng VẬN HÀNH đổi.
    expect(capMostlyCorzan.designCapacity3ShiftKgYear).toBeCloseTo(capMostlyBm.designCapacity3ShiftKgYear, 6);
  });
});
