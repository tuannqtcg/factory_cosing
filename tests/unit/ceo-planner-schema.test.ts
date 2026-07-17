// Pha 2 smoke test — hợp đồng CEO Planner (ADR-021/022) parse đúng hình dạng
// đóng băng. Không phải parity công thức (đó là Pha 4, chạy qua src/engine/
// ceo-planner.ts khi có). Chỉ khóa cấu trúc request/result để đổi schema là lộ.
import { describe, expect, it } from 'vitest';
import {
  CeoPlannerRequestSchema,
  CeoPlannerResultSchema,
  CeoAdviceRequestSchema,
  CeoAdviceResultSchema,
} from '../../src/schemas/ceo-planner.js';

const validRequest = {
  scenarioId: 'baseline-v3.4',
  marginMode: 'markup_on_cost' as const,
  fxRateUsdVnd: 26500,
  annualPremiseLeaseVnd: 800_000_000,
  pipe: { materialId: 'bm-orange-pipe', compoundPriceUsdPerKg: 3.03, desiredMargin: 0.25, normalShifts: 3 },
  fitting: {
    materialId: 'bm-fitting',
    compoundPriceUsdPerKg: 3.85,
    desiredMargin: 0.4,
    normalShifts: 1,
    machineHourUtilization: 0.6,
  },
};

const ladder = { variableCostFloor: 100663, cashBreakEven: 104783, fullCost: 106733, enterpriseBreakEven: 111485, targetVf: 133416 };
const lineResult = (line: 'pipe' | 'fitting') => ({
  line,
  materialId: line === 'pipe' ? 'bm-orange-pipe' : 'bm-fitting',
  materialName: 'BlazeMaster',
  sellingPriceVndPerKg: 133416,
  fullCostVndPerKg: 106733,
  materialCostVndPerKg: 95462,
  processingCostVndPerKg: 9771,
  packagingCostVndPerKg: 1500,
  marginOnPricePct: 20,
  ladder,
  annualProductionKg: 619920,
  annualMachineHours: 4920,
  breakEvenPctOfCapacity: 18.5,
  annualGrossProfitVnd: 16_500_000_000,
  compoundNeedKgPerYear: 688800,
});

describe('CeoPlannerRequestSchema', () => {
  it('parse request hợp lệ', () => {
    expect(CeoPlannerRequestSchema.parse(validRequest)).toMatchObject({ scenarioId: 'baseline-v3.4' });
  });
  it('từ chối margin ≥ 0,95', () => {
    expect(CeoPlannerRequestSchema.safeParse({ ...validRequest, pipe: { ...validRequest.pipe, desiredMargin: 0.95 } }).success).toBe(false);
  });
  it('từ chối số ca ngoài 1–3', () => {
    expect(CeoPlannerRequestSchema.safeParse({ ...validRequest, pipe: { ...validRequest.pipe, normalShifts: 4 } }).success).toBe(false);
  });
  it('từ chối huy động giờ máy phụ kiện = 0', () => {
    expect(CeoPlannerRequestSchema.safeParse({ ...validRequest, fitting: { ...validRequest.fitting, machineHourUtilization: 0 } }).success).toBe(false);
  });
});

describe('CeoPlannerResultSchema', () => {
  it('parse result đầy đủ, payback nullable', () => {
    const result = {
      request: validRequest,
      pipe: lineResult('pipe'),
      fitting: lineResult('fitting'),
      summary: {
        revenueVfVnd: 94_100_000_000,
        grossProfitVnd: 19_800_000_000,
        preTaxProfitVnd: 16_400_000_000,
        corporateIncomeTaxVnd: 3_280_000_000,
        netProfitVnd: 13_120_000_000,
        preTaxProfitMarginPct: 17.5,
        cashPerYearVnd: 19_593_000_000,
        paybackYears: 0.816,
        totalInvestedVnd: 15_966_254_000,
      },
      pipeDnPrices: [{ dn: 'DN20', unitWeightKgPerM: 0.29, fullCostVndPerM: 30952, sellingPriceVndPerM: 38690 }],
      fittingSkuPrices: [{ productName: 'Tê đều', sizeLabel: '20', schedule: 'SCH40', unitWeightKg: 0.055, metalInsertVndPerPiece: 0, fullCostVndPerPiece: 10000, sellingPriceVndPerPiece: 14000 }],
    };
    const parsed = CeoPlannerResultSchema.parse(result);
    expect(parsed.summary.paybackYears).toBe(0.816);
  });
  it('chấp nhận paybackYears = null (không hồi vốn)', () => {
    const base = CeoPlannerResultSchema.parse({
      request: validRequest, pipe: lineResult('pipe'), fitting: lineResult('fitting'),
      summary: { revenueVfVnd: 0, grossProfitVnd: 0, preTaxProfitVnd: -1, corporateIncomeTaxVnd: 0, netProfitVnd: -1, preTaxProfitMarginPct: 0, cashPerYearVnd: -1, paybackYears: null, totalInvestedVnd: 15_966_254_000 },
      pipeDnPrices: [], fittingSkuPrices: [],
    });
    expect(base.summary.paybackYears).toBeNull();
  });
});

describe('CeoAdvice schemas', () => {
  it('request chỉ nhận plannerResult (không ScenarioInput thô)', () => {
    const parsed = CeoAdviceRequestSchema.safeParse({ scenarioId: 'baseline-v3.4', plannerResult: undefined });
    expect(parsed.success).toBe(false);
  });
  it('result nhận items + model', () => {
    const parsed = CeoAdviceResultSchema.parse({ generatedByModel: 'mock', items: [{ topic: 'pricing_floor', message: 'x' }] });
    expect(parsed.items).toHaveLength(1);
  });
});
