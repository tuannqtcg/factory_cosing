// Parity test M13.2 (ADR-012) — danh mục Corzan: KHÔNG có Excel làm nguồn chân
// lý (Corzan không có trong v3.7) — verify bằng SỐ TÍNH TAY ĐỘC LẬP (script
// Python chạy ngoài engine, cùng pattern M9/plan.test.ts) + test CÁCH LY:
// thêm Corzan vào scenario KHÔNG được làm xê dịch bất kỳ số BlazeMaster nào
// (cùng khuôn/line, phụ kiện giống hệt → năng suất mix ADR-011 và phân bổ chi
// phí chung không đổi — chứng minh bằng so sánh output).
//
// Nguồn dữ liệu Corzan: tests/fixtures/corzan.json (user 2026-07-07) — giá
// 3,47/3,97 USD/kg, thuế NK 0% (AIFTA), markup 25%/40%, ống nặng hơn 10%/size,
// phụ kiện giống hệt.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateScenario } from '../../src/engine/scenario.js';
import { ScenarioInputSchema, ScenarioOutputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput, buildCorzanScenarioInput } from '../helpers/scenario-fixture.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const priceList = loadFixture<any[]>('price-list.json');
const moldAssetsFixture = loadFixture<any>('mold-assets.json');
const skusWithoutMold = new Set(
  moldAssetsFixture.skusWithoutMold.map((s: any) => `${s.productName}|${s.sizeLabel}`),
);

const baselineOutput = calculateScenario(ScenarioInputSchema.parse(buildBaselineScenarioInput()));
const output = calculateScenario(ScenarioInputSchema.parse(buildCorzanScenarioInput()));

const chainOf = (materialId: string, key: { dn?: string; productName?: string; sizeLabel?: string }) =>
  output.skuPriceChains.find(
    (c) =>
      c.productKey.materialId === materialId &&
      (key.dn ? c.productKey.dn === key.dn : c.productKey.productName === key.productName && c.productKey.sizeLabel === key.sizeLabel),
  )!;

describe('Corzan M13.2 — schema + đếm danh mục', () => {
  it('output parse đúng ScenarioOutputSchema (4 material, 198 SKU)', () => {
    expect(() => ScenarioOutputSchema.parse(output)).not.toThrow();
    expect(output.skuPriceChains).toHaveLength(198); // 99 BM + 99 Corzan
    expect(output.priceLock.byMaterial).toHaveLength(4);
    expect(output.priceLadder.byLineMaterial).toHaveLength(4); // (pipe|fitting) × (BM|Corzan)
  });

  it('managementStatus Corzan khớp BlazeMaster (cùng khuôn vật lý): 83 active + 8 pending_mold', () => {
    const corzanFittings = output.skuPriceChains.filter((c) => c.productKey.materialId === 'corzan-fitting');
    expect(corzanFittings).toHaveLength(91);
    const pending = corzanFittings.filter((c) => c.managementStatus === 'pending_mold');
    expect(pending).toHaveLength(8);
    pending.forEach((c) => {
      expect(skusWithoutMold.has(`${c.productKey.productName}|${c.productKey.sizeLabel}`)).toBe(true);
    });
  });
});

describe('Corzan M13.2 — CÁCH LY: thêm Corzan không xê dịch số BlazeMaster nào', () => {
  it('99 chuỗi giá BM giống hệt baseline (so từng listPriceBeforeVat + breakEven)', () => {
    const bmChains = output.skuPriceChains.filter(
      (c) => c.productKey.materialId === 'bm-orange-pipe' || c.productKey.materialId === 'bm-fitting',
    );
    expect(bmChains).toHaveLength(99);
    bmChains.forEach((c, i) => {
      const baseChain = baselineOutput.skuPriceChains[i]!;
      expect(c.chain.listPriceBeforeVat).toBe(baseChain.chain.listPriceBeforeVat);
      expect(c.chain.breakEvenPerUnit).toBeCloseTo(baseChain.chain.breakEvenPerUnit, 9);
    });
  });

  it('MHR + capacity + thang giá/CVP/kho BM giống hệt baseline', () => {
    expect(output.mhrPerMachineHour).toBeCloseTo(baselineOutput.mhrPerMachineHour, 9);
    expect(output.capacity.fitting.estimatedProductionKgYear).toBeCloseTo(
      baselineOutput.capacity.fitting.estimatedProductionKgYear,
      9,
    );
    for (const line of ['pipe', 'fitting'] as const) {
      const materialId = line === 'pipe' ? 'bm-orange-pipe' : 'bm-fitting';
      const ladder = output.priceLadder.byLineMaterial.find((e) => e.line === line && e.materialId === materialId)!.ladder;
      const baseLadder = baselineOutput.priceLadder.byLineMaterial.find(
        (e) => e.line === line && e.materialId === materialId,
      )!.ladder;
      expect(ladder).toEqual(baseLadder);
      const dual = output.dualCosting.byMaterial.find((e) => e.line === line && e.materialId === materialId)!;
      const baseDual = baselineOutput.dualCosting.byMaterial.find((e) => e.line === line && e.materialId === materialId)!;
      expect(dual).toEqual(baseDual);
    }
  });

  it('8 giá ống + SKU đại diện BM vẫn khớp price-list.json (số vàng v3.7 nguyên vẹn)', () => {
    priceList.slice(0, 8).forEach((row, i) => {
      const chain = chainOf('bm-orange-pipe', { dn: row.sizeDN });
      expect(chain.chain.listPriceBeforeVat).toBe(row.priceBeforeVat);
    });
  });
});

describe('Corzan M13.2 — số tính tay độc lập (Python, thuế 0% + phí HQ 1%, tỷ giá 26.500)', () => {
  // landed ống = 3,47 × 1,01 × 26.500 = 92.874,55 đ/kg
  // fullCost = 92.874,55/0,9 + 1.500 + 11.750,029811 (chi phí gia công line v3.7, ADR-019) = 116.443,97425585079
  it('Ống Corzan: fullCostPerKg = 116.443,97 — thang giá bậc 3 (pipe, corzan-pipe)', () => {
    const ladder = output.priceLadder.byLineMaterial.find(
      (e) => e.line === 'pipe' && e.materialId === 'corzan-pipe',
    )!.ladder;
    expect(ladder.breakEvenFullCost).toBeCloseTo(116443.97425585079, 3);
    expect(ladder.targetPrice).toBeCloseTo(116443.97425585079 * 1.25, 3);
  });

  // DN50 Corzan: đơn trọng 1,26 × 1,1 = 1,386 kg/m → BE/m 116.443,974×1,386 = 161.391,35 → niêm yết 374.700 (ROUNDUP -2 sau /0,7)
  it('Ống Corzan DN50: BE/m = 161.391,35, niêm yết 374.700 trước VAT / 404.676 có VAT', () => {
    const chain = chainOf('corzan-pipe', { dn: 'DN50' });
    expect(chain.chain.breakEvenPerUnit).toBeCloseTo(161391.35, 2);
    expect(chain.chain.listPriceBeforeVat).toBe(374700);
    expect(chain.chain.listPriceWithVat).toBe(404676);
  });

  it('Ống Corzan DN20/DN100: niêm yết 86.300 / 1.279.800 trước VAT', () => {
    expect(chainOf('corzan-pipe', { dn: 'DN20' }).chain.listPriceBeforeVat).toBe(86300);
    expect(chainOf('corzan-pipe', { dn: 'DN100' }).chain.listPriceBeforeVat).toBe(1279800);
  });

  // landed phụ kiện = 3,97 × 1,01 × 26.500 = 106.257,05 đ/kg
  // Tê đều 20 (0,055 kg; 35s; cavity 4): mat = 0,055×(106.257,05/0,9+2.000) = 6.603,4864;
  // proc = (35/(3600×4×0,9)) × 1.308.217,93 = 3.532,996 → BE 10.136,4823 → niêm yết 26.400
  it('Phụ kiện Corzan Tê đều 20: BE = 10.136,48, niêm yết 26.400 trước VAT / 28.512 có VAT', () => {
    const chain = chainOf('corzan-fitting', { productName: 'Tê đều', sizeLabel: '20' });
    expect(chain.chain.materialCostPerUnit).toBeCloseTo(6603.4864, 3);
    expect(chain.chain.processingCostPerUnit).toBeCloseTo(3532.996, 3);
    expect(chain.chain.breakEvenPerUnit).toBeCloseTo(10136.4823, 3);
    expect(chain.chain.listPriceBeforeVat).toBe(26400);
    expect(chain.chain.listPriceWithVat).toBe(28512);
  });

  // Nối ren trong 20xPT15 (0,045 kg + ren 16.200đ — ADR-008 dùng chung insertCatalog):
  // mat = 0,045×(106.257,05/0,9+2.000) + 16.200 = 21.602,8525 → BE 25.135,8485 → niêm yết 65.400
  it('Phụ kiện Corzan Nối ren trong 20xPT15 (có ren kim loại): BE = 25.135,85, niêm yết 65.400', () => {
    const chain = chainOf('corzan-fitting', { productName: 'Nối ren trong', sizeLabel: '20xPT15' });
    expect(chain.chain.materialCostPerUnit).toBeCloseTo(21602.8525, 3);
    expect(chain.chain.breakEvenPerUnit).toBeCloseTo(25135.8485, 3);
    expect(chain.chain.listPriceBeforeVat).toBe(65400);
  });

  it('Khóa giá Corzan: KHÓA (baseline = replacement, lệch 0%) + kho rỗng → lãi giữ kho 0', () => {
    for (const id of ['corzan-pipe', 'corzan-fitting']) {
      const lock = output.priceLock.byMaterial.find((e) => e.materialId === id)!.evaluation;
      expect(lock.isLocked).toBe(true);
      expect(lock.deviationPct).toBeCloseTo(0, 9);
      const dual = output.dualCosting.byMaterial.find((e) => e.materialId === id)!;
      expect(dual.holdingGainLossVnd).toBeCloseTo(0, 6);
    }
  });
});
