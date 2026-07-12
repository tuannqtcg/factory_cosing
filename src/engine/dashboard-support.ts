// M12.5 — KPI Dashboard (sheet "Dashboard" Excel v3.7): 2 khối số vàng trong
// tests/fixtures/dashboard.json TRƯỚC GIỜ chưa có hàm engine nào tính
// (`capacityLevels` mục II + `investment` mục IV của màn Dashboard prototype).
// Công thức GIẢI MÃ từ số vàng bằng script Python độc lập (khớp tuyệt đối cả
// 7 giá trị TRƯỚC khi viết code — xem session log 2026-07-08, đúng kỷ luật
// "tính tay đối chiếu trước" của M8) rồi mới dịch sang TypeScript.
//
// Pure function, cùng pattern plan-support/target-costing: UI (vai
// admin/pricing — được đọc trọn ScenarioInput) gọi trực tiếp; KHÔNG nằm trong
// ScenarioOutput (schema đóng băng, không thêm field — đây là view dẫn xuất
// hiển thị, không phải dữ liệu contract).
//
// ADR-012: các số "toàn DN" (EBIT, doanh thu hòa vốn) dùng thang giá tại
// material THAM CHIẾU từng line — cùng xấp xỉ CÓ CHỦ ĐÍCH với bậc 4 thang giá
// (xem ghi chú đầu scenario.ts); có mix sản lượng theo nguyên liệu thật thì
// đổi, cần ADR mới.
import type { ScenarioInput } from '../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import { calculateScenario, referenceMaterialOf, lastLotPriceOf } from './scenario.js';
import { calculatePipeCapacity, calculatePipeCostAtNormalCapacity } from './pipe.js';
import { calculateFittingCapacity, calculateFittingCostAtNormalCapacity } from './fitting.js';
import { evaluatePriceLock } from './price-lock.js';
import type { MaterialPricingInput } from './cost-pool.js';

export interface PipeCapacityLevel {
  shifts: 1 | 2 | 3;
  productionKgYear: number;
  /** Giá thành đầy đủ/kg nếu chỉ chạy `shifts` ca (Dashboard mục II). */
  costPerKg: number;
  /** Phí gia công/kg (không gồm NVL) */
  processingCostPerKg: number;
}

export interface InvestmentKpis {
  /** Thiết bị đùn + máy ép + 66 bộ khuôn + vốn đầu tư Lab/UL (nguyên giá, không khấu hao). */
  totalFixedCapitalInvested: number;
  /** (Định phí CVP 2 dòng + chi phí vận hành + lãi vay) ÷ tỷ lệ số dư đảm phí tại giá VF. */
  enterpriseBreakEvenRevenuePerYear: number;
  /** Doanh thu VF − giá thành đầy đủ − chi phí ngoài SX, tại CS bình thường. */
  ebitAtNormalCapacityVfPrice: number;
  /** totalFixedCapitalInvested ÷ (EBIT + tổng khấu hao năm) — khấu hao khuôn theo asOfYear (ADR-007). */
  paybackYears: number;
}

export interface FittingCapacityLevel {
  productionKgYear: number;
  costPerKg: number;
  processingCostPerKg: number;
}

export interface DashboardKpis {
  capacityLevels: PipeCapacityLevel[];
  fittingCapacity: FittingCapacityLevel;
  investment: InvestmentKpis;
}

export function calculateDashboardKpis(scenario: ScenarioInput): DashboardKpis {
  const { asOfYear, resources, materials, products, costPool } = scenario;
  const pipeResource = resources.pipe as ContinuousKgResource;
  const fittingResource = resources.fitting as MachineHourResource;
  const fittingProducts = products.filter((p) => p.kind === 'fitting');

  const pipeRefMaterial = referenceMaterialOf(materials, products, 'pipe');
  const fittingRefMaterial = referenceMaterialOf(materials, products, 'fitting');
  if (!pipeRefMaterial || !fittingRefMaterial) {
    throw new Error('Mỗi dòng SX phải có ≥1 sản phẩm gắn material — thiếu material tham chiếu cho KPI Dashboard');
  }
  const pricingInputOf = (m: typeof pipeRefMaterial): MaterialPricingInput => ({
    materialId: m.id,
    pricingPriceUsdPerKg: evaluatePriceLock({
      baseline: m.inventory.priceLock.baseline,
      thresholdPct: m.inventory.priceLock.thresholdPct,
      replacement: m.inventory.replacementPriceUsdPerKg,
      lastLotPrice: lastLotPriceOf(m.inventory.lots),
    }).pricingPrice,
    importTaxRate: m.importTaxRate,
    customsLogisticsFeeRate: m.customsLogisticsFeeRate,
    markupVf: m.markupVf,
  });

  // Thang giá + CVP + capacity lấy từ orchestrator (một nguồn logic duy nhất);
  // 2 object cost nội bộ (sharedCostAllocated, khấu hao) gọi lại hàm pure
  // (đánh đổi "gọi 2 lần" đã chấp nhận ở ADR-010).
  const output = calculateScenario(scenario);
  const pipeCapacity = calculatePipeCapacity(pipeResource);
  const fittingCapacity = calculateFittingCapacity(fittingResource, fittingProducts);
  const pipeCost = calculatePipeCostAtNormalCapacity({
    resource: pipeResource,
    capacity: pipeCapacity,
    costPool,
    otherLineEstimatedProductionKgYear: fittingCapacity.estimatedProductionKgYear,
    material: pricingInputOf(pipeRefMaterial),
  });
  const fittingCost = calculateFittingCostAtNormalCapacity({
    resource: fittingResource,
    capacity: fittingCapacity,
    costPool,
    otherLineNormalCapacityKgYear: pipeCapacity.normalCapacityKgYear,
    material: pricingInputOf(fittingRefMaterial),
    asOfYear,
  });

  const ladderOf = (line: 'pipe' | 'fitting', materialId: string) => {
    const entry = output.priceLadder.byLineMaterial.find((e) => e.line === line && e.materialId === materialId);
    if (!entry) throw new Error(`Thiếu thang giá (${line}, ${materialId})`);
    return entry.ladder;
  };
  const cvpOf = (line: 'pipe' | 'fitting', materialId: string) => {
    const entry = output.cvp.byLineMaterial.find((e) => e.line === line && e.materialId === materialId);
    if (!entry) throw new Error(`Thiếu CVP (${line}, ${materialId})`);
    return entry;
  };
  const pipeLadder = ladderOf('pipe', pipeRefMaterial.id);
  const fittingLadder = ladderOf('fitting', fittingRefMaterial.id);
  const pipeCvp = cvpOf('pipe', pipeRefMaterial.id);
  const fittingCvp = cvpOf('fitting', fittingRefMaterial.id);

  // ── Mục II: 3 mức công suất Ống ────────────────────────────────────────────
  // Giải mã từ số vàng: chạy lại NGUYÊN mô hình chi phí tại normalShifts=ca
  // (nhân công theo ca, điện/nước theo giờ, khấu hao/bảo trì giữ nguyên) NHƯNG
  // phần chi phí chung phân bổ GIỮ MỨC TẠI CS BÌNH THƯỜNG — đúng nguyên tắc
  // normal capacity costing (chi phí chung phân bổ theo công suất bình thường,
  // phần dưới tải là chi phí CSNR, không đội vào giá thành đơn vị... nhưng
  // Dashboard Excel cố ý cộng NGUYÊN mức phân bổ bình thường vào mỗi mức ca để
  // trả lời "nếu chỉ chạy X ca thì giá thành thật là bao nhiêu").
  const capacityLevels: PipeCapacityLevel[] = ([1, 2, 3] as const).map((shifts) => {
    const resourceAtShifts = { ...pipeResource, normalShifts: shifts };
    const capacityAtShifts = calculatePipeCapacity(resourceAtShifts);
    const costAtShifts = calculatePipeCostAtNormalCapacity({
      resource: resourceAtShifts,
      capacity: capacityAtShifts,
      costPool,
      otherLineEstimatedProductionKgYear: fittingCapacity.estimatedProductionKgYear,
      material: pricingInputOf(pipeRefMaterial),
    });
    // Hiệu chỉnh DUY NHẤT so với hàm pure: thay phân bổ chi phí chung tính lại
    // theo ratio mới bằng mức phân bổ TẠI CS bình thường (số vàng xác nhận).
    const costPerKg =
      costAtShifts.fullCostPerKg +
      (pipeCost.sharedCostAllocated - costAtShifts.sharedCostAllocated) / capacityAtShifts.normalCapacityKgYear;
    const processingCostPerKg =
      costAtShifts.unitProcessingCostPerKg +
      (pipeCost.sharedCostAllocated - costAtShifts.sharedCostAllocated) / capacityAtShifts.normalCapacityKgYear;
    return { shifts, productionKgYear: capacityAtShifts.normalCapacityKgYear, costPerKg, processingCostPerKg };
  });

  // ── Mục IV: Đầu tư ─────────────────────────────────────────────────────────
  const { sharedFixedCosts, nonProductionCosts } = costPool;
  const labUlInvestment =
    sharedFixedCosts.labAnnualized + sharedFixedCosts.vnUlSetupAnnualized + sharedFixedCosts.ulSetupAnnualized;
  const totalFixedCapitalInvested =
    pipeResource.extruderPriceEach * pipeResource.extruderCount +
    pipeResource.moldPullerCutterCost +
    fittingResource.machineTypes.reduce((sum, m) => sum + m.priceVnd * m.count, 0) +
    fittingResource.moldAssets.reduce((sum, m) => sum + m.costVnd, 0) +
    labUlInvestment;

  const pipeKg = pipeCapacity.normalCapacityKgYear;
  const fittingKg = fittingCapacity.estimatedProductionKgYear;
  const nonProductionPerYear = nonProductionCosts.operatingCostPerYear + nonProductionCosts.financialCostPerYear;

  const ebitAtNormalCapacityVfPrice =
    pipeKg * (pipeLadder.targetPrice - pipeLadder.breakEvenFullCost) +
    fittingKg * (fittingLadder.targetPrice - fittingLadder.breakEvenFullCost) -
    nonProductionPerYear;

  const revenueVf = pipeKg * pipeLadder.targetPrice + fittingKg * fittingLadder.targetPrice;
  const variableCostTotal = pipeKg * pipeLadder.variableCostFloor + fittingKg * fittingLadder.variableCostFloor;
  const contributionMarginRatio = 1 - variableCostTotal / revenueVf;
  const enterpriseBreakEvenRevenuePerYear =
    (pipeCvp.fixedCostPerYear + fittingCvp.fixedCostPerYear + nonProductionPerYear) / contributionMarginRatio;

  // Tổng khấu hao năm: đùn + máy ép + khuôn theo asOfYear (ADR-007) + Lab/UL.
  const totalDepreciationPerYear =
    pipeCost.extruderDepreciationPerYear +
    fittingCost.machineDepreciationPerYear +
    fittingCost.moldDepreciationPerYear +
    labUlInvestment / sharedFixedCosts.depreciationYears;
  const paybackYears = totalFixedCapitalInvested / (ebitAtNormalCapacityVfPrice + totalDepreciationPerYear);

  return {
    capacityLevels,
    fittingCapacity: {
      productionKgYear: fittingKg,
      costPerKg: fittingCost.fullCostPerKgRef,
      processingCostPerKg: fittingCost.processingCostPerKgRef,
    },
    investment: {
      totalFixedCapitalInvested,
      enterpriseBreakEvenRevenuePerYear,
      ebitAtNormalCapacityVfPrice,
      paybackYears,
    },
  };
}
