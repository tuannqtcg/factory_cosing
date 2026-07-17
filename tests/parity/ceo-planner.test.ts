// Parity Pha 4 — màn Trợ Lý CEO (ADR-021). Nguyên tắc: tại preset "Chuẩn Excel
// v3.4" (dùng đúng tham số baseline), engine planner PHẢI trùng khớp chính output
// của orchestrator `calculateScenario`/`calculateDashboardKpis` — chứng minh nó
// TÁI DÙNG engine, không trôi số (cấm chép công thức tay). Đây là parity bền hơn
// so số cứng của prototype: khi fixture v3.x đổi (vd ADR-019), 2 vế vẫn khớp.
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput } from '../helpers/scenario-fixture.js';
import { calculateScenario, lastLotPriceOf } from '../../src/engine/scenario.js';
import { calculateDashboardKpis } from '../../src/engine/dashboard-support.js';
import { evaluatePriceLock } from '../../src/engine/price-lock.js';
import { calculateCeoPlanner, applySellingPrice } from '../../src/engine/ceo-planner.js';
import type { CeoPlannerRequest } from '../../src/schemas/ceo-planner.js';

const baseline = ScenarioInputSchema.parse(buildBaselineScenarioInput());

/** pricingPrice sau khóa giá của 1 material (đúng quy ước dashboard-support). */
function pricingPriceOf(materialId: string): number {
  const m = baseline.materials.find((x) => x.id === materialId)!;
  return evaluatePriceLock({
    baseline: m.inventory.priceLock.baseline,
    thresholdPct: m.inventory.priceLock.thresholdPct,
    replacement: m.inventory.replacementPriceUsdPerKg,
    lastLotPrice: lastLotPriceOf(m.inventory.lots),
  }).pricingPrice;
}

// Preset "Chuẩn Excel v3.4" = đúng tham số baseline (mọi override là no-op).
const pipeMat = baseline.materials.find((m) => m.id === 'bm-orange-pipe')!;
const fitMat = baseline.materials.find((m) => m.id === 'bm-fitting')!;
const pipeRes = baseline.resources.pipe as any;
const fitRes = baseline.resources.fitting as any;

const presetRequest: CeoPlannerRequest = {
  scenarioId: 'baseline-v3.4',
  marginMode: 'markup_on_cost',
  fxRateUsdVnd: baseline.costPool.currency.usdVndRate,
  annualPremiseLeaseVnd: baseline.costPool.sharedFixedCosts.annualLandRent,
  pipe: {
    materialId: 'bm-orange-pipe',
    compoundPriceUsdPerKg: pricingPriceOf('bm-orange-pipe'),
    desiredMargin: pipeMat.markupVf,
    normalShifts: pipeRes.normalShifts,
  },
  fitting: {
    materialId: 'bm-fitting',
    compoundPriceUsdPerKg: pricingPriceOf('bm-fitting'),
    desiredMargin: fitMat.markupVf,
    normalShifts: fitRes.normalShifts,
    machineHourUtilization: fitRes.normalUtilizationFactor,
  },
};

const out = calculateScenario(baseline);
const kpis = calculateDashboardKpis(baseline);
const planner = calculateCeoPlanner(presetRequest, baseline);

const ladderOf = (line: 'pipe' | 'fitting', materialId: string) =>
  out.priceLadder.byLineMaterial.find((e) => e.line === line && e.materialId === materialId)!.ladder;

describe('CEO Planner parity — preset "Chuẩn Excel v3.4" khớp engine baseline', () => {
  it('Ống: giá thành + thang giá 5 bậc khớp calculateScenario', () => {
    const l = ladderOf('pipe', 'bm-orange-pipe');
    expect(planner.pipe.fullCostVndPerKg).toBeCloseTo(l.breakEvenFullCost, 4);
    expect(planner.pipe.sellingPriceVndPerKg).toBeCloseTo(l.targetPrice, 4); // margin=markupVf → giá VF
    expect(planner.pipe.ladder.variableCostFloor).toBeCloseTo(l.variableCostFloor, 4);
    expect(planner.pipe.ladder.cashBreakEven).toBeCloseTo(l.cashBreakEven, 4);
    expect(planner.pipe.ladder.enterpriseBreakEven).toBeCloseTo(l.enterpriseBreakEven, 4);
    expect(planner.pipe.ladder.targetVf).toBeCloseTo(l.targetPrice, 4);
  });

  it('Phụ kiện: giá thành + giá VF khớp calculateScenario', () => {
    const l = ladderOf('fitting', 'bm-fitting');
    expect(planner.fitting.fullCostVndPerKg).toBeCloseTo(l.breakEvenFullCost, 4);
    expect(planner.fitting.sellingPriceVndPerKg).toBeCloseTo(l.targetPrice, 4);
    expect(planner.fitting.machineHourCostVnd).toBeCloseTo(out.mhrPerMachineHour, 4);
  });

  it('Sản lượng + giờ máy khớp capacity output', () => {
    expect(planner.pipe.annualProductionKg).toBeCloseTo(out.capacity.pipe.normalCapacityKgYear, 4);
    expect(planner.fitting.annualProductionKg).toBeCloseTo(out.capacity.fitting.estimatedProductionKgYear, 4);
    expect(planner.fitting.annualMachineHours).toBeCloseTo(out.capacity.fitting.normalMachineHoursUtilized, 4);
  });

  it('Hiệu quả năm: LN trước thuế + payback + vốn đầu tư khớp Dashboard KPI', () => {
    // Tại preset margin=markupVf → LN trước thuế planner = EBIT VF của Dashboard.
    expect(planner.summary.preTaxProfitVnd).toBeCloseTo(kpis.investment.ebitAtNormalCapacityVfPrice, 2);
    expect(planner.summary.totalInvestedVnd).toBeCloseTo(kpis.investment.totalFixedCapitalInvested, 2);
    expect(planner.summary.paybackYears!).toBeCloseTo(kpis.investment.paybackYears, 6);
    // Thuế TNDN 20% + LN sau thuế nhất quán.
    expect(planner.summary.corporateIncomeTaxVnd).toBeCloseTo(Math.max(0, planner.summary.preTaxProfitVnd) * 0.2, 2);
    expect(planner.summary.netProfitVnd).toBeCloseTo(planner.summary.preTaxProfitVnd - planner.summary.corporateIncomeTaxVnd, 2);
  });

  it('Bảng giá DN ống: giá bán VF khớp chuỗi giá engine (back-out fullCost)', () => {
    expect(planner.pipeDnPrices.length).toBeGreaterThan(0);
    for (const row of planner.pipeDnPrices) {
      const sku = out.skuPriceChains.find((s) => s.productKey.dn === row.dn && s.productKey.materialId === 'bm-orange-pipe')!;
      // margin=markupVf → giá bán VF planner = vfPricePerUnit engine.
      expect(row.sellingPriceVndPerM).toBeCloseTo(sku.chain.vfPricePerUnit, 4);
    }
  });

  it('Bảng giá 83 SKU phụ kiện: giá bán VF khớp chuỗi giá engine', () => {
    expect(planner.fittingSkuPrices.length).toBeGreaterThan(0);
    for (const row of planner.fittingSkuPrices.slice(0, 20)) {
      const sku = out.skuPriceChains.find(
        (s) => s.productKey.productName === row.productName && s.productKey.sizeLabel === row.sizeLabel && s.productKey.materialId === 'bm-fitting',
      )!;
      expect(row.sellingPriceVndPerPiece).toBeCloseTo(sku.chain.vfPricePerUnit, 4);
    }
  });

  it('Cách hiểu margin: markup_on_cost vs margin_on_price', () => {
    expect(applySellingPrice(1000, 0.25, 'markup_on_cost')).toBeCloseTo(1250, 6);
    expect(applySellingPrice(1000, 0.2, 'margin_on_price')).toBeCloseTo(1250, 6);
  });
});
