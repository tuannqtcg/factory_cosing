// ADR-042 — Chế độ 2 thương hiệu chạy đồng thời trên CÙNG dây chuyền (BM + Corzan
// dùng chung máy đùn/máy ép). Kiểm chứng 3 tính chất TOÁN của mô hình phân bổ:
//  1. Bảo toàn công suất: sản lượng 2 thương hiệu cộng lại = ĐÚNG công suất dòng
//     (không nhân đôi vượt trần vật lý).
//  2. Alloc 100% = chạy 1 loại: khớp tuyệt đối kết quả đơn-thương-hiệu.
//  3. Tuyến tính theo phân bổ: lãi gộp(a) = a·lãi(BM full) + (1−a)·lãi(Corzan full)
//     — hệ quả của việc định phí đã nằm trong giá thành/kg + tổng kg cố định.
import { describe, expect, it } from 'vitest';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildCorzanScenarioInput } from '../helpers/scenario-fixture.js';
import { calculateCeoPlanner } from '../../src/engine/ceo-planner.js';
import type { CeoPlannerRequest } from '../../src/schemas/ceo-planner.js';

const s = ScenarioInputSchema.parse(buildCorzanScenarioInput());
const mat = (id: string) => s.materials.find((m) => m.id === id)!;
const pipeRes = s.resources.pipe as any;
const fitRes = s.resources.fitting as any;

// Request cơ sở — giá compound = giá tái tạo hiện hành, margin = markupVf.
function base(pipeId: string, fitId: string): CeoPlannerRequest {
  return {
    scenarioId: s.id,
    marginMode: 'markup_on_cost',
    fxRateUsdVnd: s.costPool.currency.usdVndRate,
    annualPremiseLeaseVnd: s.costPool.sharedFixedCosts.annualLandRent,
    pipe: { materialId: pipeId, compoundPriceUsdPerKg: mat(pipeId).inventory.replacementPriceUsdPerKg, desiredMargin: mat(pipeId).markupVf, normalShifts: pipeRes.normalShifts },
    fitting: { materialId: fitId, compoundPriceUsdPerKg: mat(fitId).inventory.replacementPriceUsdPerKg, desiredMargin: mat(fitId).markupVf, normalShifts: fitRes.normalShifts, machineHourUtilization: fitRes.normalUtilizationFactor },
  };
}

// Chạy 1 loại (không có thương hiệu thứ hai).
const onlyBM = calculateCeoPlanner(base('bm-orange-pipe', 'bm-fitting'), s);
const onlyCZ = calculateCeoPlanner(base('corzan-pipe', 'corzan-fitting'), s);

// Chạy 2 loại: BM chính + Corzan thứ hai, phân bổ p% cho BM.
function twoBrand(pipePct: number, fitPct: number): CeoPlannerRequest {
  const r = base('bm-orange-pipe', 'bm-fitting');
  return {
    ...r,
    pipeSecond: { materialId: 'corzan-pipe', compoundPriceUsdPerKg: mat('corzan-pipe').inventory.replacementPriceUsdPerKg, desiredMargin: mat('corzan-pipe').markupVf },
    fittingSecond: { materialId: 'corzan-fitting', compoundPriceUsdPerKg: mat('corzan-fitting').inventory.replacementPriceUsdPerKg, desiredMargin: mat('corzan-fitting').markupVf },
    allocationPipePrimaryPct: pipePct,
    allocationFittingPrimaryPct: fitPct,
  };
}

describe('CEO Planner — phân bổ 2 thương hiệu chung dây chuyền (ADR-042)', () => {
  it('1. Bảo toàn công suất: BM + Corzan cộng lại = đúng công suất dòng (không nhân đôi)', () => {
    const p = calculateCeoPlanner(twoBrand(60, 40), s);
    expect(p.pipe.annualProductionKg + p.pipeSecond!.annualProductionKg).toBeCloseTo(onlyBM.pipe.annualProductionKg, 2);
    expect(p.fitting.annualProductionKg + p.fittingSecond!.annualProductionKg).toBeCloseTo(onlyBM.fitting.annualProductionKg, 2);
  });

  it('2. Alloc 100% primary = chạy 1 loại BM (khớp tuyệt đối)', () => {
    const p = calculateCeoPlanner(twoBrand(100, 100), s);
    expect(p.pipe.annualProductionKg).toBeCloseTo(onlyBM.pipe.annualProductionKg, 2);
    expect(p.pipeSecond!.annualProductionKg).toBeCloseTo(0, 6);
    expect(p.summary.revenueVfVnd).toBeCloseTo(onlyBM.summary.revenueVfVnd, 2);
    expect(p.summary.preTaxProfitVnd).toBeCloseTo(onlyBM.summary.preTaxProfitVnd, 2);
  });

  it('3. Tuyến tính: lãi gộp dòng ở 50/50 = trung bình lãi(BM full) và lãi(Corzan full)', () => {
    const p = calculateCeoPlanner(twoBrand(50, 50), s);
    // Ống
    const pipeMix = p.pipe.annualGrossProfitVnd + p.pipeSecond!.annualGrossProfitVnd;
    expect(pipeMix).toBeCloseTo(0.5 * onlyBM.pipe.annualGrossProfitVnd + 0.5 * onlyCZ.pipe.annualGrossProfitVnd, 2);
    // Phụ kiện
    const fitMix = p.fitting.annualGrossProfitVnd + p.fittingSecond!.annualGrossProfitVnd;
    expect(fitMix).toBeCloseTo(0.5 * onlyBM.fitting.annualGrossProfitVnd + 0.5 * onlyCZ.fitting.annualGrossProfitVnd, 2);
  });
});
