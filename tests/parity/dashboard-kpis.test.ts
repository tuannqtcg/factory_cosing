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
    expect(corzanKpis.investment).toEqual(kpis.investment);
  });
});
