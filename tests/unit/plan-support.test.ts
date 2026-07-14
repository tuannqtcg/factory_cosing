// M12.4b — test src/engine/plan-support.ts. Giống plan.ts (xem cảnh báo đầu
// file đó): KHÔNG có số vàng Excel cho phần này — `deriveMoldSetCountBySizeDN`
// verify bằng dữ liệu THẬT mold-assets.json (66 khuôn, ADR-007) + fitting.json,
// số kỳ vọng đếm tay độc lập (script Python, xem session log 2026-07-08);
// `calculatePlanForScenario` đối chiếu với các số đã tính tay ở
// tests/parity/plan.test.ts kịch bản A (baseline có khóa giá "KHÓA" với
// pricingPrice = replacement nên 2 đường tính phải ra cùng số).
import { describe, expect, it } from 'vitest';
import { deriveMoldSetCountBySizeDN, calculatePlanForScenario } from '../../src/engine/plan-support.js';
import { ScenarioInputSchema, PlanInputSchema, type PlanInput } from '../../src/schemas/scenario.js';
import type { FittingProduct } from '../../src/schemas/product.js';
import type { MoldAsset } from '../../src/schemas/resource.js';
import { buildBaselineScenarioInput, buildCorzanScenarioInput } from '../helpers/scenario-fixture.js';

const baseline = ScenarioInputSchema.parse(buildBaselineScenarioInput());
const fittingProducts = baseline.products.filter((p): p is FittingProduct => p.kind === 'fitting');
const moldAssets = (baseline.resources.fitting as { moldAssets: MoldAsset[] }).moldAssets;

function makePlanInput(overrides: Partial<PlanInput>): PlanInput {
  return PlanInputSchema.parse({
    scenarioId: 'baseline-v3.4',
    period: '2026-Q3',
    periodMonths: 3,
    currentLaborHeadcount: { pipe: 4, fitting: 1 },
    pipePlan: [],
    fittingPlan: [],
    materialSafetyStockFactor: 0.05,
    ...overrides,
  });
}

describe('deriveMoldSetCountBySizeDN — dữ liệu thật mold-assets.json (66 khuôn) + fitting.json (91 SKU)', () => {
  const counts = deriveMoldSetCountBySizeDN(moldAssets, fittingProducts);

  it('phân bổ đúng 66 bộ khuôn theo size DN (đếm tay độc lập từ hợp đồng khuôn ADR-007)', () => {
    expect(counts).toEqual({ 20: 4, 25: 9, 32: 8, 40: 10, 50: 11, 65: 9, 80: 7, 100: 8 });
  });

  it('tổng số bộ đếm được = đúng 66 asset (không khuôn nào bị bỏ sót hay đếm trùng)', () => {
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(66);
  });
});

describe('deriveMoldSetCountBySizeDN — quy tắc đếm (dữ liệu tổng hợp)', () => {
  const productOf = (productName: string, sizeLabel: string, moldSizeDN: number): FittingProduct => ({
    kind: 'fitting',
    productName,
    sizeLabel,
    unit: 'Cái',
    moldSizeDN,
    cycleTimeSec: 30,
    cavity: 4,
    unitWeightKg: 0.05,
    materialId: 'bm-fitting',
  });
  const assetOf = (id: string, producesSkus: MoldAsset['producesSkus']): MoldAsset => ({
    id,
    label: id,
    producesSkus,
    cavity: 4,
    costUsd: 1000,
    costVnd: 26_500_000,
    purchaseYear: 2026,
    usefulLifeYears: 5,
  });

  it('1 khuôn ra NHIỀU SKU cùng size DN → chỉ đếm 1 bộ (không cộng trùng)', () => {
    const products = [productOf('Tê đều', '20', 20), productOf('Cút 90º', '20', 20)];
    const assets = [
      assetOf('m1', [
        { productName: 'Tê đều', sizeLabel: '20' },
        { productName: 'Cút 90º', sizeLabel: '20' },
      ]),
    ];
    expect(deriveMoldSetCountBySizeDN(assets, products)).toEqual({ 20: 1 });
  });

  it('1 khuôn map tới SKU ở 2 size DN khác nhau → cộng 1 vào TỪNG size', () => {
    const products = [productOf('Tê đều', '20', 20), productOf('Tê đều', '25', 25)];
    const assets = [
      assetOf('m1', [
        { productName: 'Tê đều', sizeLabel: '20' },
        { productName: 'Tê đều', sizeLabel: '25' },
      ]),
    ];
    expect(deriveMoldSetCountBySizeDN(assets, products)).toEqual({ 20: 1, 25: 1 });
  });

  it('SKU trong producesSkus không có trong danh mục → bỏ qua (không suy ra được size DN)', () => {
    const products = [productOf('Tê đều', '20', 20)];
    const assets = [assetOf('m1', [{ productName: 'SKU không tồn tại', sizeLabel: '999' }])];
    expect(deriveMoldSetCountBySizeDN(assets, products)).toEqual({});
  });
});

describe('calculatePlanForScenario — baseline v3.7, đối chiếu số tính tay plan.test.ts kịch bản A', () => {
  // Khóa giá baseline: lệch 0% trong ngưỡng 3% → pricingPrice = baseline =
  // replacement (3,03 Ống / 3,85 Phụ kiện) — landed sau khóa TRÙNG landed thô.
  const input = makePlanInput({
    pipePlan: [{ dn: 'DN50', meters: 50_000 }],
    fittingPlan: [{ productName: 'Tê đều', sizeLabel: '20', qty: 20_000 }],
  });
  const result = calculatePlanForScenario(baseline, input);

  it('đánh giá ca: Ống 2 ca, Phụ kiện 1 ca (giống hệt wiring tay ở plan.test.ts)', () => {
    expect(result.shiftsNeeded).toEqual({ pipe: 2, fitting: 1 });
  });

  it('không cảnh báo khuôn — size DN20 có 4 bộ THẬT từ mold-assets.json (54 giờ « 4×738 giờ)', () => {
    expect(result.moldConstraintWarnings).toHaveLength(0);
  });

  it('NVL Ống (bm-orange-pipe): kgToBuy=73.500; VNĐ tại landed ĐÃ KHÓA 3,03×1,07×26.500; USD thô 222.705', () => {
    const pipeReq = result.materialRequirement.find((r) => r.materialId === 'bm-orange-pipe')!;
    expect(pipeReq.kgToBuy).toBeCloseTo(73_500, 6);
    expect(pipeReq.vndValue).toBeCloseTo(73_500 * (3.03 * 1.07 * 26_500), 3);
    expect(pipeReq.usdValueAtRawReplacement).toBeCloseTo(222_705, 3);
  });

  it('NVL Phụ kiện (bm-fitting): kgToBuy = 20.000×0,055/0,9×1,05; landed ĐÃ KHÓA 3,85×1,07×26.500', () => {
    const fittingReq = result.materialRequirement.find((r) => r.materialId === 'bm-fitting')!;
    const expectedKgToBuy = ((20_000 * 0.055) / 0.9) * 1.05;
    expect(fittingReq.kgToBuy).toBeCloseTo(expectedKgToBuy, 6);
    expect(fittingReq.vndValue).toBeCloseTo(expectedKgToBuy * (3.85 * 1.07 * 26_500), 3);
    expect(fittingReq.usdValueAtRawReplacement).toBeCloseTo(expectedKgToBuy * 3.85, 6);
  });

  it('nhân công + chi phí nhàn rỗi Ống khớp plan.test.ts (laborToHire.pipe=0; 11.750,73 đ/kg — v3.8, ADR-019)', () => {
    expect(result.laborToHire.pipe).toBe(0);
    expect(result.idleCapacityCostPipePerKg).toBeCloseTo(11750.726064335814, 3);
  });
});

describe('calculatePlanForScenario — multi-material (ADR-012, kịch bản Corzan)', () => {
  const corzanScenario = ScenarioInputSchema.parse(buildCorzanScenarioInput());

  it('fittingPlan chỉ định materialId=corzan-fitting → NVL cần mua tách đúng theo material Corzan', () => {
    const input = makePlanInput({
      scenarioId: 'baseline-v3.4-corzan',
      fittingPlan: [{ productName: 'Tê đều', sizeLabel: '20', qty: 20_000, materialId: 'corzan-fitting' }],
    });
    const result = calculatePlanForScenario(corzanScenario, input);
    const req = result.materialRequirement;
    expect(req).toHaveLength(1);
    expect(req[0]!.materialId).toBe('corzan-fitting');
    // Phụ kiện Corzan giống hệt SKU BlazeMaster (cùng khuôn, cùng đơn trọng —
    // rule corzan.json) → kg cần mua trùng bản BlazeMaster, chỉ khác giá.
    expect(req[0]!.kgToBuy).toBeCloseTo(((20_000 * 0.055) / 0.9) * 1.05, 6);
  });

  it('fittingPlan bỏ trống materialId → khớp SP ĐẦU TIÊN trùng khóa = BlazeMaster (tương thích plan cũ)', () => {
    const input = makePlanInput({
      scenarioId: 'baseline-v3.4-corzan',
      fittingPlan: [{ productName: 'Tê đều', sizeLabel: '20', qty: 20_000 }],
    });
    const result = calculatePlanForScenario(corzanScenario, input);
    expect(result.materialRequirement.map((r) => r.materialId)).toEqual(['bm-fitting']);
  });
});
