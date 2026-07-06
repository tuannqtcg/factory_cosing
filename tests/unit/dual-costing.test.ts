// Test src/engine/dual-costing.ts (ADR-002) — kịch bản "kho 2 đợt" trong skill
// excel-parity-testing (100t@3,03 + 50t@3,5; tái tạo 3,5 → AVG=3,1867,
// BE định giá=121.012, lãi giữ kho=1.332.685.000), cộng test biên (không lô nào,
// tái tạo < bình quân → cảnh báo dự phòng VAS 02).
import { describe, expect, it } from 'vitest';
import {
  holdingGainLossVnd,
  provisionWarning,
  totalInventoryKg,
  weightedAvgUsdPerKg,
} from '../../src/engine/dual-costing.js';

const currency = { compoundImportTaxRate: 0.06, customsLogisticsFeeRate: 0.01, usdVndRate: 26500 };

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

  it('lãi giữ kho khớp tuyệt đối 1.332.685.000đ (tái tạo 3,5 > bình quân)', () => {
    const avg = weightedAvgUsdPerKg(lots)!;
    const gain = holdingGainLossVnd({
      replacementPriceUsdPerKg: 3.5,
      weightedAvgUsdPerKg: avg,
      inventoryKg: totalInventoryKg(lots),
      ...currency,
    });
    expect(gain).toBeCloseTo(1_332_685_000, 0);
    expect(provisionWarning(gain)).toBe('Giá tái tạo ≥ bình quân kho — không cần dự phòng');
  });
});

describe('Biên: tái tạo < bình quân → cảnh báo dự phòng VAS 02', () => {
  it('holdingGainLoss âm → provisionWarning cảnh báo', () => {
    const gain = holdingGainLossVnd({
      replacementPriceUsdPerKg: 2.5,
      weightedAvgUsdPerKg: 3.03,
      inventoryKg: 10_000,
      ...currency,
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
