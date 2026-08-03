// M12.5 — parity src/engine/dashboard-support.ts với 2 khối số vàng
// dashboard.json (sheet Dashboard Excel v3.7) TRƯỚC GIỜ chưa có test tham
// chiếu cho: `capacityLevels` (3 mức công suất Ống, mục II màn Dashboard) +
// `investment` (4 KPI đầu tư, mục IV). Công thức đã giải mã + khớp tuyệt đối
// bằng script Python độc lập trước khi code (session log 2026-07-08).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateDashboardKpis } from '../../src/engine/dashboard-support.js';
import { ScenarioInputSchema } from '../../src/schemas/scenario.js';
import { buildBaselineScenarioInput, buildCorzanScenarioInput } from '../helpers/scenario-fixture.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const dashboardGolden = JSON.parse(readFileSync(path.join(fixturesDir, 'dashboard.json'), 'utf-8'));

const baseline = ScenarioInputSchema.parse(buildBaselineScenarioInput());
const kpis = calculateDashboardKpis(baseline);

describe('Dashboard mục II — 3 mức công suất Ống (dashboard.json capacityLevels, v3.7)', () => {
  it.each([0, 1, 2] as const)('mức %d: sản lượng + giá thành/kg khớp tuyệt đối số vàng', (i) => {
    const golden = dashboardGolden.capacityLevels[i];
    const level = kpis.capacityLevels[i]!;
    expect(level.shifts).toBe(i + 1);
    expect(level.productionKgYear).toBeCloseTo(golden.pipeProductionKgYear, 6);
    expect(level.costPerKg).toBeCloseTo(golden.pipeCostPerKg, 6);
  });

  it('mức 3 ca = đúng giá thành đầy đủ tại CS bình thường (tự nhất quán với thang giá bậc 3)', () => {
    expect(kpis.capacityLevels[2]!.costPerKg).toBeCloseTo(
      dashboardGolden.priceLadder5Tier.tier3_breakEvenFullCost.pipe,
      6,
    );
  });
});

describe('Dashboard — tách phí gia công 3 tầng (tiền mặt trực tiếp + chung + khấu hao) trên scorecard', () => {
  it('Ống: mỗi mức ca, tiền mặt + chung + khấu hao = phí gia công/kg; khấu hao/kg giảm khi tăng ca', () => {
    for (const level of kpis.capacityLevels) {
      expect(level.directProcessingPerKg + level.sharedOverheadPerKg + level.depreciationPerKg).toBeCloseTo(level.processingCostPerKg, 6);
    }
    // Cùng cục khấu hao ÷ sản lượng lớn hơn ⇒ khấu hao/kg giảm dần theo số ca
    expect(kpis.capacityLevels[0]!.depreciationPerKg).toBeGreaterThan(kpis.capacityLevels[2]!.depreciationPerKg);
  });

  it('Phụ kiện: 3 tầng cộng lại = phí gia công/kg; khấu hao là tầng lớn nhất; tiền mặt trực tiếp KHÔNG gồm chung', () => {
    const f = kpis.fittingCapacity;
    expect(f.directProcessingPerKg + f.sharedOverheadPerKg + f.depreciationPerKg).toBeCloseTo(f.processingCostPerKg, 6);
    expect(f.depreciationPerKg).toBeGreaterThan(f.directProcessingPerKg);
    // Tiền mặt trực tiếp nhỏ hơn (tiền mặt + chung) vì đã tách riêng phần chung
    expect(f.directProcessingPerKg).toBeLessThan(f.directProcessingPerKg + f.sharedOverheadPerKg);
  });
});

describe('Dashboard mục IV — KPI đầu tư (dashboard.json investment, v3.7)', () => {
  const golden = dashboardGolden.investment;

  it('tổng vốn cố định = thiết bị đùn + máy ép + 66 bộ khuôn + vốn Lab/UL (15,97 tỷ)', () => {
    expect(kpis.investment.totalFixedCapitalInvested).toBe(golden.totalFixedCapitalInvested);
  });

  it('EBIT tại CS bình thường + giá VF khớp tuyệt đối (16,37 tỷ)', () => {
    expect(kpis.investment.ebitAtNormalCapacityVfPrice).toBeCloseTo(golden.ebitAtNormalCapacityVfPrice, 6);
  });

  it('doanh thu hòa vốn toàn DN = (định phí CVP 2 dòng + ngoài SX) ÷ tỷ lệ số dư đảm phí (33,78 tỷ)', () => {
    // sai số float do thứ tự phép nhân/chia khác Excel — 1e-3 trên 33,78 tỷ ≈ 3e-14 tương đối
    expect(kpis.investment.enterpriseBreakEvenRevenuePerYear).toBeCloseTo(golden.enterpriseBreakEvenRevenuePerYear, 3);
  });

  it('thu hồi vốn = vốn ÷ (EBIT + tổng khấu hao, khuôn theo asOfYear ADR-007) — 0,816 năm', () => {
    expect(kpis.investment.paybackYears).toBeCloseTo(golden.paybackYears, 10);
  });
});

describe('Dashboard KPI — multi-material (ADR-012): thêm Corzan không đổi KPI tham chiếu BlazeMaster', () => {
  it('kịch bản Corzan (BlazeMaster đứng đầu materials[]) giữ nguyên capacityLevels + investment', () => {
    const corzanKpis = calculateDashboardKpis(ScenarioInputSchema.parse(buildCorzanScenarioInput()));
    expect(corzanKpis.capacityLevels).toEqual(kpis.capacityLevels);
    // ADR-055 — tỷ lệ đáy mặc định 100% cho compound CHÍNH ⇒ thêm Corzan (material
    // phụ dòng) KHÔNG đổi KPI tham chiếu. Doanh thu per-line đi qua splitBy (chính +
    // phụ×0) nên lệch tối đa 1 ULP so với đường nhân 1-material cũ — so gần đúng.
    const inv = corzanKpis.investment;
    expect(inv.totalFixedCapitalInvested).toBe(kpis.investment.totalFixedCapitalInvested);
    expect(inv.ebitAtNormalCapacityVfPrice).toBeCloseTo(kpis.investment.ebitAtNormalCapacityVfPrice, 4);
    expect(inv.expectedRevenueVf).toBeCloseTo(kpis.investment.expectedRevenueVf, 4);
    expect(inv.expectedRevenuePipeVf).toBeCloseTo(kpis.investment.expectedRevenuePipeVf, 4);
    expect(inv.expectedRevenueFittingVf).toBeCloseTo(kpis.investment.expectedRevenueFittingVf, 4);
    expect(inv.enterpriseBreakEvenRevenuePerYear).toBeCloseTo(kpis.investment.enterpriseBreakEvenRevenuePerYear, 2);
    expect(inv.paybackYears).toBeCloseTo(kpis.investment.paybackYears, 8);
  });
});

describe('ADR-062 — hoà vốn doanh thu TÁCH RIÊNG từng dòng (khác enterpriseBreakEvenRevenuePerYear vốn gộp)', () => {
  const inv = kpis.investment;

  it('cả 2 ngưỡng đều dương, hữu hạn', () => {
    expect(inv.pipeBreakEvenRevenuePerYear).toBeGreaterThan(0);
    expect(Number.isFinite(inv.pipeBreakEvenRevenuePerYear)).toBe(true);
    expect(inv.fittingBreakEvenRevenuePerYear).toBeGreaterThan(0);
    expect(Number.isFinite(inv.fittingBreakEvenRevenuePerYear)).toBe(true);
  });

  it('tỷ lệ số dư đảm phí riêng từng dòng nằm trong (0,1)', () => {
    expect(inv.pipeContributionMarginRatio).toBeGreaterThan(0);
    expect(inv.pipeContributionMarginRatio).toBeLessThan(1);
    expect(inv.fittingContributionMarginRatio).toBeGreaterThan(0);
    expect(inv.fittingContributionMarginRatio).toBeLessThan(1);
  });

  it('baseline có lãi ở CS bình thường ⇒ doanh thu THẬT mỗi dòng phải vượt hoà vốn RIÊNG của chính dòng đó', () => {
    expect(inv.expectedRevenuePipeVf).toBeGreaterThan(inv.pipeBreakEvenRevenuePerYear);
    expect(inv.expectedRevenueFittingVf).toBeGreaterThan(inv.fittingBreakEvenRevenuePerYear);
  });

  it('2 ngưỡng tách riêng KHÔNG bằng ngưỡng gộp chia đôi (tỷ lệ đảm phí 2 dòng khác nhau, không phải trung bình đơn giản)', () => {
    expect(inv.pipeBreakEvenRevenuePerYear + inv.fittingBreakEvenRevenuePerYear).not.toBeCloseTo(
      inv.enterpriseBreakEvenRevenuePerYear,
      0,
    );
  });
});

describe('ADR-062/069 — chi phí bao bì hiện hành, tách riêng cơ chế Ống (theo kg hoặc theo túi) vs Phụ kiện (theo kg hoặc theo thùng)', () => {
  it("Ống: mặc định 'flat_per_kg' (doc cũ không có pipePackagingMethod) — đọc thẳng packagingCostPerKg của resource (1.500đ/kg trong fixture)", () => {
    expect(kpis.packaging.pipe).toEqual({ method: 'flat_per_kg', packagingCostPerKgVnd: 1500 });
  });

  it("Phụ kiện: mặc định 'flat_per_kg' (doc cũ không có fittingPackagingMethod) — đọc packagingCostPerKg (2.000đ/kg trong fixture)", () => {
    expect(kpis.packaging.fitting).toEqual({ method: 'flat_per_kg', packagingCostPerKgVnd: 2000 });
  });

  it("scenario bật 'per_box' + có packagingBoxCostVnd ⇒ packaging.fitting đổi sang {method:'per_box', packagingBoxCostVnd}", () => {
    const withBox = ScenarioInputSchema.parse({
      ...(buildBaselineScenarioInput() as object),
      fittingPackagingMethod: 'per_box',
      resources: {
        ...(buildBaselineScenarioInput() as any).resources,
        fitting: { ...(buildBaselineScenarioInput() as any).resources.fitting, packagingBoxCostVnd: 12000 },
      },
    });
    const boxKpis = calculateDashboardKpis(withBox);
    expect(boxKpis.packaging.fitting).toEqual({ method: 'per_box', packagingBoxCostVnd: 12000 });
  });

  it("'per_box' bật nhưng THIẾU packagingBoxCostVnd ⇒ fallback 'flat_per_kg' (parity-safe, giống ADR-060)", () => {
    const boxNoData = ScenarioInputSchema.parse({
      ...(buildBaselineScenarioInput() as object),
      fittingPackagingMethod: 'per_box',
    });
    const kpisNoData = calculateDashboardKpis(boxNoData);
    expect(kpisNoData.packaging.fitting).toEqual({ method: 'flat_per_kg', packagingCostPerKgVnd: 2000 });
  });
});

describe('ADR-055 — tỷ lệ đáy chia doanh thu giữa 2 compound chung dòng', () => {
  const withPipeMix = (pipePct: number) =>
    calculateDashboardKpis(
      ScenarioInputSchema.parse({ ...(buildCorzanScenarioInput() as object), productionMixPipePrimaryPct: pipePct }),
    );
  const at100 = withPipeMix(100);
  const at0 = withPipeMix(0);
  const at50 = withPipeMix(50);

  it('doanh thu Ống 50/50 = trung bình cộng của 100% chính và 0% chính (tuyến tính theo kg)', () => {
    expect(at50.investment.expectedRevenuePipeVf).toBeCloseTo(
      (at100.investment.expectedRevenuePipeVf + at0.investment.expectedRevenuePipeVf) / 2,
      2,
    );
  });

  it('đổi tỷ lệ đáy ⇒ doanh thu Ống đổi (Corzan giá khác BlazeMaster)', () => {
    expect(at0.investment.expectedRevenuePipeVf).not.toBeCloseTo(at100.investment.expectedRevenuePipeVf, 0);
  });

  it('chỉnh tỷ lệ đáy dòng Ống KHÔNG đụng doanh thu Phụ kiện', () => {
    expect(at0.investment.expectedRevenueFittingVf).toBeCloseTo(at100.investment.expectedRevenueFittingVf, 6);
  });

  it('tổng doanh thu = Ống + Phụ kiện (mọi tỷ lệ)', () => {
    expect(at50.investment.expectedRevenueVf).toBeCloseTo(
      at50.investment.expectedRevenuePipeVf + at50.investment.expectedRevenueFittingVf,
      4,
    );
  });
});
