// Test src/engine/dual-costing.ts (ADR-002/058) — kịch bản "kho 2 đợt" trong
// skill excel-parity-testing (100t@3,03 + 50t@3,5; giá mua mới hôm nay 3,5 →
// AVG=3,1867, lãi giữ kho=1.332.685.000), cộng test biên (không lô nào, giá
// mua mới hôm nay < bình quân → cảnh báo dự phòng VAS 02) + test mới ADR-058
// (mỗi lô thuế/logistics RIÊNG — landed cost phải tính TỪNG lô rồi mới bình
// quân, không bình quân giá thô rồi nhân 1 rate chung).
import { describe, expect, it } from 'vitest';
import {
  holdingGainLossVnd,
  provisionWarning,
  totalInventoryKg,
  weightedAvgUsdPerKg,
  weightedAvgLandedCostPerKgVnd,
} from '../../src/engine/dual-costing.js';
import { landedCostPerKgVnd } from '../../src/engine/cost-pool.js';

const currency = { importTaxRate: 0.06, customsLogisticsFeeRate: 0.01, usdVndRate: 26500 };

describe('weightedAvgUsdPerKg + holdingGainLossVnd — kịch bản kho 2 đợt (skill excel-parity-testing)', () => {
  const lots = [
    { tons: 100, priceUsdPerKg: 3.03 },
    { tons: 50, priceUsdPerKg: 3.5 },
  ];

  it('bình quân gia quyền khớp 3,1867', () => {
    expect(weightedAvgUsdPerKg(lots)).toBeCloseTo(3.186666666666667, 6);
  });

  it('tổng tồn kho = 150.000 kg', () => {
    expect(totalInventoryKg(lots)).toBe(150_000);
  });

  it('lãi giữ kho khớp tuyệt đối 1.332.685.000đ (giá mua mới hôm nay 3,5 > bình quân)', () => {
    // Không lô nào có rate riêng ⇒ weightedAvgLandedCostPerKgVnd phải khớp
    // TUYỆT ĐỐI landedCostPerKgVnd(weightedAvgUsdPerKg) — cùng 1 rate cho mọi lô.
    const bookLanded = weightedAvgLandedCostPerKgVnd(lots, currency, currency.usdVndRate)!;
    const replacementLanded = landedCostPerKgVnd(3.5, currency);
    const gain = holdingGainLossVnd({
      replacementLandedCostPerKgVnd: replacementLanded,
      bookLandedCostPerKgVnd: bookLanded,
      inventoryKg: totalInventoryKg(lots),
    });
    expect(gain).toBeCloseTo(1_332_685_000, 0);
    expect(provisionWarning(gain)).toBe('Giá mua mới hôm nay ≥ bình quân kho — không cần dự phòng');
  });
});

describe('Biên: giá mua mới hôm nay < bình quân → cảnh báo dự phòng VAS 02', () => {
  it('holdingGainLoss âm → provisionWarning cảnh báo', () => {
    const gain = holdingGainLossVnd({
      replacementLandedCostPerKgVnd: landedCostPerKgVnd(2.5, currency),
      bookLandedCostPerKgVnd: landedCostPerKgVnd(3.03, currency),
      inventoryKg: 10_000,
    });
    expect(gain).toBeLessThan(0);
    expect(provisionWarning(gain)).toContain('CẢNH BÁO');
    expect(provisionWarning(gain)).toContain('VAS 02');
  });
});

describe('weightedAvgUsdPerKg — không có lô nào', () => {
  it('Σtons=0 → null (caller phải fallback về replacementPriceUsd)', () => {
    expect(weightedAvgUsdPerKg([])).toBeNull();
    expect(weightedAvgUsdPerKg([{ tons: 0, priceUsdPerKg: 0 }])).toBeNull();
  });
});

describe('weightedAvgLandedCostPerKgVnd — ADR-058 (thuế/logistics RIÊNG từng lô)', () => {
  it('null khi Σtons=0', () => {
    expect(weightedAvgLandedCostPerKgVnd([], currency, 26500)).toBeNull();
  });

  it('không lô nào override ⇒ khớp TUYỆT ĐỐI landedCostPerKgVnd(weightedAvgUsdPerKg) (1 rate chung)', () => {
    const lots = [
      { tons: 100, priceUsdPerKg: 3.03 },
      { tons: 50, priceUsdPerKg: 3.5 },
    ];
    const viaWeightedAvg = landedCostPerKgVnd(weightedAvgUsdPerKg(lots)!, currency);
    const viaPerLot = weightedAvgLandedCostPerKgVnd(lots, currency, currency.usdVndRate)!;
    expect(viaPerLot).toBeCloseTo(viaWeightedAvg, 6);
  });

  it('lô có rate RIÊNG (xuất xứ khác — vd AIFTA 0%) ⇒ landed cost KHÁC bình quân giá thô × 1 rate chung', () => {
    // Lô A: 100 tấn, EU 6% thuế (dùng fallback material). Lô B: 100 tấn, cùng
    // giá mua nhưng có C/O AIFTA ⇒ 0% thuế riêng cho lô này.
    const lots = [
      { tons: 100, priceUsdPerKg: 3 }, // dùng fallback (material 6%/1%)
      { tons: 100, priceUsdPerKg: 3, importTaxRate: 0, customsLogisticsFeeRate: 0 }, // AIFTA 0%
    ];
    const perLot = weightedAvgLandedCostPerKgVnd(lots, currency, currency.usdVndRate)!;
    // Landed lô A = 3×1.07×26500 = 85.065; landed lô B = 3×1×26500 = 79.500.
    // Bình quân TRỌNG SỐ tấn = (85.065+79.500)/2 = 82.282,5.
    expect(perLot).toBeCloseTo((85_065 + 79_500) / 2, 3);
    // Công thức CŨ (bình quân giá thô rồi nhân 1 rate chung) sẽ SAI — luôn ra
    // landedCostPerKgVnd(3, currency) = 85.065 vì giá thô 2 lô bằng nhau, che
    // mất khoản lô AIFTA rẻ hơn nhờ thuế 0%.
    const oldWrongWay = landedCostPerKgVnd(weightedAvgUsdPerKg(lots)!, currency);
    expect(oldWrongWay).toBeCloseTo(85_065, 3);
    expect(perLot).toBeLessThan(oldWrongWay);
  });

  it('lô thiếu rate ⇒ fallback đúng rate material (không phải 0)', () => {
    const lots = [{ tons: 10, priceUsdPerKg: 2 }]; // không set importTaxRate/customsLogisticsFeeRate
    const withFallback = weightedAvgLandedCostPerKgVnd(lots, currency, currency.usdVndRate)!;
    expect(withFallback).toBeCloseTo(landedCostPerKgVnd(2, currency), 6);
  });
});
