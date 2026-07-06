// Parity test — ADR-008. Excel gốc CHƯA tích hợp ren kim loại vào công thức
// giá thành SKU chính thức, nhưng `tests/fixtures/fitting.json.skus` đã có sẵn
// `brassInsertCost` thật khớp đúng `metal-insert.json` cho 11 SKU họ ren (phát
// hiện khi viết M6 — sửa lại nhận định cũ trong BUSINESS_MODEL/ADR-008 rằng
// "brassInsertCost = 0 cho toàn bộ 91 SKU", chỉ đúng cho 80 SKU KHÔNG thuộc họ
// ren). Dùng chính 2 field có sẵn này làm "số vàng tự-đối-chiếu": materialCostPerUnit
// (fixture) + brassInsertCost (fixture) PHẢI khớp tuyệt đối
// materialCostPerUnitWithInsert() ở trạng thái mặc định (baseline=replacement).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  materialCostPerUnitWithInsert,
  metalInsertHoldingGainLossVnd,
  weightedAvgInsertPriceVnd,
} from '../../src/engine/metal-insert.js';
import { evaluatePriceLock } from '../../src/engine/price-lock.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const fittingFixture = loadFixture<any>('fitting.json');
const assumptions = loadFixture<any>('assumptions.json');
const metalInsert = loadFixture<any>('metal-insert.json');

const currency = {
  compoundImportTaxRate: assumptions.compoundImportTaxRate,
  customsLogisticsFeeRate: assumptions.customsLogisticsFeeRate,
  usdVndRate: assumptions.usdVndRate,
};

describe('materialCostPerUnitWithInsert — 11 SKU họ ren (khớp fitting.json.skus tự-đối-chiếu)', () => {
  for (const insertSku of metalInsert.metalInsertSkus) {
    it(`${insertSku.productName} ${insertSku.sizeLabel}`, () => {
      const goldenSku = fittingFixture.skus.find(
        (s: any) => s.productName === insertSku.productName && s.sizeLabel === insertSku.sizeLabel,
      );
      expect(goldenSku).toBeDefined();

      // Ngưỡng khóa giá ren = 5 (SỐ NGUYÊN %) trong fixture — PHẢI chuẩn hóa
      // /100 trước khi qua evaluatePriceLock() (cảnh báo đã ghi từ M1/M5).
      const catalogEntry = metalInsert.insertCatalog.find(
        (c: any) =>
          c.renType === metalInsert.skuToInsertMap.find(
            (m: any) => m.productName === insertSku.productName && m.sizeLabel === insertSku.sizeLabel,
          ).renType &&
          c.ptSize ===
            metalInsert.skuToInsertMap.find(
              (m: any) => m.productName === insertSku.productName && m.sizeLabel === insertSku.sizeLabel,
            ).ptSize,
      );
      const insertLock = evaluatePriceLock({
        baseline: catalogEntry.priceLock.baselinePriceVnd,
        thresholdPct: catalogEntry.priceLock.thresholdPct / 100,
        replacement: catalogEntry.priceLock.replacementPriceVnd,
      });

      const compoundLock = evaluatePriceLock({
        baseline: assumptions.priceLock.fitting.baselineUsd,
        thresholdPct: assumptions.priceLock.thresholdPct,
        replacement: assumptions.priceLock.fitting.replacementUsd,
      });

      const materialCost = materialCostPerUnitWithInsert({
        unitWeightKg: insertSku.unitWeightKg,
        compoundPricingPriceUsdPerKg: compoundLock.pricingPrice,
        yieldRate: fittingFixture.params.yieldRate,
        packagingCostPerKg: fittingFixture.params.packagingCostPerKg,
        insertQtyPerUnit: insertSku.insertQtyPerUnit,
        insertPricingPriceVnd: insertLock.pricingPrice,
        currency,
      });

      const expected = goldenSku.materialCostPerUnit + goldenSku.brassInsertCost;
      expect(materialCost).toBeCloseTo(expected, 3);
    });
  }
});

describe('Dual costing ren kim loại (ADR-008 mục 1, 4) — tồn kho ban đầu 29.000 cái', () => {
  it('weightedAvgInsertPriceVnd khớp weightedAvgPriceVnd đã ghi trong fixture (1 lô duy nhất)', () => {
    for (const entry of metalInsert.insertCatalog) {
      const avg = weightedAvgInsertPriceVnd([{ qtyOnHand: entry.inventoryQtyOnHand, unitPriceVnd: entry.unitPriceVnd }]);
      expect(avg).toBeCloseTo(entry.weightedAvgPriceVnd, 3);
    }
  });

  it('holdingGainLoss = 0 ở trạng thái hiện tại (replacement = weightedAvg, 1 lô duy nhất)', () => {
    const entry = metalInsert.insertCatalog[0];
    const gain = metalInsertHoldingGainLossVnd(
      entry.priceLock.replacementPriceVnd,
      entry.weightedAvgPriceVnd,
      entry.inventoryQtyOnHand,
    );
    expect(gain).toBe(0);
  });

  it('KHÔNG quy đổi ngoại tệ (mua VND trong nước, ADR-008 mục 3) — chênh 1.000đ × 100 cái = đúng 100.000đ, không nhân thêm hệ số nào', () => {
    const gain = metalInsertHoldingGainLossVnd(17_200, 16_200, 100);
    expect(gain).toBe(100_000);
  });
});
