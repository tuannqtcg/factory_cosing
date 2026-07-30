// Parity test M12.1 — src/engine/scenario.ts: `calculateScenario()` nối TOÀN
// BỘ engine (M2-M9) qua 1 cửa ngõ duy nhất đúng contract ScenarioInput/Output
// (scenario.md §1-2). Test này KHÔNG lặp lại từng công thức con (đã có
// parity test riêng M2-M9) — chỉ xác nhận: (1) wiring đúng thứ tự phụ thuộc
// chéo 2 dòng SP tái tạo đúng số vàng đã biết, (2) output khớp
// ScenarioOutputSchema, (3) bookCostPerKg (ADR-002, chưa có số vàng Excel
// riêng cho trường hợp AVG≠pricingPrice) tự-đối-chiếu đúng fullCostPerKg khi
// weightedAvg trùng pricingPrice (kịch bản mặc định, chưa có biến động kho).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateScenario } from '../../src/engine/scenario.js';
import { ScenarioInputSchema, ScenarioOutputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

const pipeFixture = loadFixture<any>('pipe.json');
const fittingFixture = loadFixture<any>('fitting.json');
const moldAssetsFixture = loadFixture<any>('mold-assets.json');
const priceList = loadFixture<any[]>('price-list.json');

const skusWithoutMold = new Set(
  moldAssetsFixture.skusWithoutMold.map((s: any) => `${s.productName}|${s.sizeLabel}`),
);

const scenarioInput = ScenarioInputSchema.parse(buildBaselineScenarioInput());

const output = calculateScenario(scenarioInput);

// ADR-012 — helper tra output theo (line, materialId); baseline chỉ có 2 material BlazeMaster
const ladderOf = (line: 'pipe' | 'fitting', materialId: string) =>
  output.priceLadder.byLineMaterial.find((e) => e.line === line && e.materialId === materialId)!.ladder;
const cvpOf = (line: 'pipe' | 'fitting', materialId: string) =>
  output.cvp.byLineMaterial.find((e) => e.line === line && e.materialId === materialId)!;
const dualOf = (line: 'pipe' | 'fitting', materialId: string) =>
  output.dualCosting.byMaterial.find((e) => e.line === line && e.materialId === materialId)!;
const lockOf = (materialId: string) => output.priceLock.byMaterial.find((e) => e.materialId === materialId)!.evaluation;

describe('calculateScenario() — khớp ScenarioOutputSchema', () => {
  it('parse không lỗi', () => {
    expect(() => ScenarioOutputSchema.parse(output)).not.toThrow();
  });
});

describe('calculateScenario() — khớp tuyệt đối số vàng đã biết (M2-M9, đối chiếu qua 1 cửa ngõ)', () => {
  it('capacity + mhrPerMachineHour', () => {
    expect(output.capacity.pipe.normalCapacityKgYear).toBeCloseTo(pipeFixture.capacity.normalCapacityKgYear, 6);
    expect(output.capacity.fitting.estimatedProductionKgYear).toBeCloseTo(fittingFixture.capacity.estimatedProductionKgYear, 6);
    expect(output.mhrPerMachineHour).toBeCloseTo(1308217.9298677056, 3); // ADR-011 (v3.7)
  });

  it('thang giá 5 bậc — khớp dashboard.json', () => {
    const dashboard = loadFixture<any>('dashboard.json');
    const golden = dashboard.priceLadder5Tier;
    const pipeLadder = ladderOf('pipe', 'bm-orange-pipe');
    const fittingLadder = ladderOf('fitting', 'bm-fitting');
    expect(pipeLadder.variableCostFloor).toBeCloseTo(golden.tier1_variableCostFloor.pipe, 3);
    expect(pipeLadder.breakEvenFullCost).toBeCloseTo(golden.tier3_breakEvenFullCost.pipe, 3);
    expect(pipeLadder.targetPrice).toBeCloseTo(golden.tier5_targetPrice.pipe, 3);
    expect(fittingLadder.variableCostFloor).toBeCloseTo(golden.tier1_variableCostFloor.fitting, 3);
    expect(fittingLadder.breakEvenFullCost).toBeCloseTo(golden.tier3_breakEvenFullCost.fitting, 3);
    expect(fittingLadder.targetPrice).toBeCloseTo(golden.tier5_targetPrice.fitting, 3);
    // bậc 2/4 (tham chiếu chéo) cũng phải khớp — trước ADR-012 do cùng 1 đường tính, nay qua material tham chiếu
    expect(pipeLadder.cashBreakEven).toBeCloseTo(golden.tier2_cashBreakEven.pipe, 3);
    expect(pipeLadder.enterpriseBreakEven).toBeCloseTo(golden.tier4_enterpriseBreakEven.pipe, 3);
    expect(fittingLadder.cashBreakEven).toBeCloseTo(golden.tier2_cashBreakEven.fitting, 3);
    expect(fittingLadder.enterpriseBreakEven).toBeCloseTo(golden.tier4_enterpriseBreakEven.fitting, 3);
  });

  it('CVP — khớp pipe.json/fitting.json.cvp', () => {
    expect(cvpOf('pipe', 'bm-orange-pipe').breakEvenKgYear).toBeCloseTo(pipeFixture.cvp.breakEvenKgYear, 6);
    const fittingCvp = cvpOf('fitting', 'bm-fitting');
    expect(fittingCvp.line === 'fitting' && fittingCvp.breakEvenMachineHours).toBeCloseTo(fittingFixture.cvp.breakEvenMachineHours, 6);
  });

  it('8/8 SKU Ống — listPriceBeforeVat khớp price-list.json', () => {
    const pipeChains = output.skuPriceChains.filter((c) => 'dn' in c.productKey);
    expect(pipeChains).toHaveLength(8);
    pipeChains.forEach((c, i) => {
      expect(c.chain.listPriceBeforeVat).toBe(priceList[i].priceBeforeVat);
      expect(c.managementStatus).toBe('active');
    });
  });

  it('83/91 SKU Phụ kiện active — listPriceBeforeVat khớp price-list.json', () => {
    const fittingChains = output.skuPriceChains.filter((c) => 'productName' in c.productKey);
    expect(fittingChains).toHaveLength(91);
    let activeChecked = 0;
    let pendingMoldCount = 0;
    fittingChains.forEach((c, i) => {
      const key = `${c.productKey.productName}|${c.productKey.sizeLabel}`;
      if (skusWithoutMold.has(key)) {
        expect(c.managementStatus).toBe('pending_mold');
        pendingMoldCount += 1;
        return;
      }
      expect(c.managementStatus).toBe('active');
      expect(c.chain.listPriceBeforeVat).toBe(priceList[8 + i].priceBeforeVat);
      activeChecked += 1;
    });
    expect(activeChecked).toBe(83);
    expect(pendingMoldCount).toBe(8);
  });

  it('bookCostPerKg tự-đối-chiếu fullCostPerKg khi weightedAvg trùng pricingPrice (chưa có kịch bản kho lệch giá thật)', () => {
    expect(dualOf('pipe', 'bm-orange-pipe').bookCostPerKg).toBeCloseTo(pipeFixture.costAtNormalCapacity.fullCostPerKg, 3);
    // fitting.json chỉ có `bookFullCostPerKgRef` (không có field `fullCostPerKgRef`
    // riêng) — do kịch bản mặc định replacement=baseline=weightedAvg nên Excel
    // export ra 1 giá trị duy nhất, khác pipe.json (có cả 2 field, cùng giá trị).
    expect(dualOf('fitting', 'bm-fitting').bookCostPerKg).toBeCloseTo(fittingFixture.costAtNormalCapacity.bookFullCostPerKgRef, 3);
    expect(dualOf('pipe', 'bm-orange-pipe').holdingGainLossVnd).toBeCloseTo(0, 3);
    expect(dualOf('pipe', 'bm-orange-pipe').provisionWarning).toBe('Giá mua mới hôm nay ≥ bình quân kho — không cần dự phòng');
  });

  it('priceLock — Ống/Phụ kiện KHÓA (lệch 0%, đúng ADR-004 kịch bản mặc định)', () => {
    expect(lockOf('bm-orange-pipe').isLocked).toBe(true);
    expect(lockOf('bm-orange-pipe').pricingPrice).toBeCloseTo(3.03, 6);
    expect(lockOf('bm-fitting').isLocked).toBe(true);
    expect(output.priceLock.metalInsertByCatalogEntry).toHaveLength(10);
    expect(output.priceLock.metalInsertByCatalogEntry.every((e) => e.evaluation.isLocked)).toBe(true);
  });
});
