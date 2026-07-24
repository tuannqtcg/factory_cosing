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
import type { PipeProduct } from '../schemas/product.js';
import { calculateScenario, referenceMaterialOf, lastLotPriceOf } from './scenario.js';
import { effectivePipeCapacity, calculatePipeCostAtNormalCapacity } from './pipe.js';
import { calculateFittingCapacity, calculateFittingCostAtNormalCapacity } from './fitting.js';
import { evaluatePriceLock } from './price-lock.js';
import type { MaterialPricingInput } from './cost-pool.js';
import { pipeCostLayersPerKg, fittingCostLayersPerKg, type CostLayersPerKg } from './cost-breakdown.js';

export interface PipeCapacityLevel {
  shifts: 1 | 2 | 3;
  productionKgYear: number;
  /** Giá thành đầy đủ/kg nếu chỉ chạy `shifts` ca (Dashboard mục II). */
  costPerKg: number;
  /** Phí gia công/kg (không gồm NVL) = directProcessingPerKg + sharedOverheadPerKg + depreciationPerKg */
  processingCostPerKg: number;
  /** Tầng GIA CÔNG TRỰC TIẾP: nhân công·điện·nước·bảo trì (phần quản đốc "cảm" được — KHÔNG gồm chung/khấu hao). */
  directProcessingPerKg: number;
  /** Tầng chi phí chung phân bổ (kiểm định·thuê đất·khấu hao tài sản chung). */
  sharedOverheadPerKg: number;
  /** Tầng khấu hao máy/khuôn của phí gia công (giảm khi tăng ca). */
  depreciationPerKg: number;
}

export interface InvestmentKpis {
  /** Thiết bị đùn + máy ép + 66 bộ khuôn + vốn đầu tư Lab/UL (nguyên giá, không khấu hao). */
  totalFixedCapitalInvested: number;
  /** (Định phí CVP 2 dòng + chi phí vận hành + lãi vay) ÷ tỷ lệ số dư đảm phí tại giá VF. */
  enterpriseBreakEvenRevenuePerYear: number;
  /** Doanh thu VF dự kiến (tại năng suất bình thường). */
  expectedRevenueVf: number;
  /** Doanh thu VF dòng Ống (ADR-055 — đã gộp phần chính + phụ theo tỷ lệ đáy). */
  expectedRevenuePipeVf: number;
  /** Doanh thu VF dòng Phụ kiện (ADR-055 — đã gộp phần chính + phụ theo tỷ lệ đáy). */
  expectedRevenueFittingVf: number;
  /** Doanh thu VF − giá thành đầy đủ − chi phí ngoài SX, tại CS bình thường. */
  ebitAtNormalCapacityVfPrice: number;
  /** totalFixedCapitalInvested ÷ (EBIT + tổng khấu hao năm) — khấu hao khuôn theo asOfYear (ADR-007). */
  paybackYears: number;
}

export interface FittingCapacityLevel {
  productionKgYear: number;
  costPerKg: number;
  processingCostPerKg: number;
  /** Tầng GIA CÔNG TRỰC TIẾP (nhân công·điện·nước·bảo trì — phần quản đốc "cảm" được). */
  directProcessingPerKg: number;
  /** Tầng chi phí chung phân bổ. */
  sharedOverheadPerKg: number;
  /** Tầng khấu hao máy/khuôn — rất cao khi công suất chưa lấp đầy. */
  depreciationPerKg: number;
}

export interface DashboardKpis {
  capacityLevels: PipeCapacityLevel[];
  fittingCapacity: FittingCapacityLevel;
  investment: InvestmentKpis;
  /** Thác chi phí đ/kg dòng Ống (tại CS bình thường) — tách tiền mặt · chung · khấu hao · nguyên liệu. */
  pipeCostLayers: CostLayersPerKg;
  /** Thác chi phí đ/kg dòng Phụ kiện — cùng 4 tầng. */
  fittingCostLayers: CostLayersPerKg;
}

export function calculateDashboardKpis(scenario: ScenarioInput): DashboardKpis {
  const { asOfYear, resources, materials, products, costPool } = scenario;
  const pipeResource = resources.pipe as ContinuousKgResource;
  const fittingResource = resources.fitting as MachineHourResource;
  const fittingProducts = products.filter((p) => p.kind === 'fitting');
  const pipeProducts = products.filter((p) => p.kind === 'pipe');
  const pipeCostMethod = scenario.pipeCostMethod ?? 'kg'; // ADR-047/054 — công suất nhất quán m/giờ

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
  const pipeCapacity = effectivePipeCapacity(pipeResource, pipeProducts as PipeProduct[], pipeCostMethod);
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
    const capacityAtShifts = effectivePipeCapacity(resourceAtShifts, pipeProducts as PipeProduct[], pipeCostMethod);
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
    // Tách 3 tầng: khấu hao (cùng cục ÷ sản lượng khác nhau theo ca) + chung phân bổ
    // (giữ mức CS bình thường, xem trên) + gia công trực tiếp (phần còn lại — khớp cảm nhận quản đốc).
    const depreciationPerKg = costAtShifts.extruderDepreciationPerYear / capacityAtShifts.normalCapacityKgYear;
    const sharedOverheadPerKg = pipeCost.sharedCostAllocated / capacityAtShifts.normalCapacityKgYear;
    const directProcessingPerKg = processingCostPerKg - sharedOverheadPerKg - depreciationPerKg;
    return { shifts, productionKgYear: capacityAtShifts.normalCapacityKgYear, costPerKg, processingCostPerKg, directProcessingPerKg, sharedOverheadPerKg, depreciationPerKg };
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
    labUlInvestment +
    (sharedFixedCosts.factoryConstructionCost || 0) +
    (sharedFixedCosts.workingCapital || 0);

  const pipeKg = pipeCapacity.normalCapacityKgYear;
  const fittingKg = fittingCapacity.estimatedProductionKgYear;
  const nonProductionPerYear = nonProductionCosts.operatingCostPerYear + nonProductionCosts.financialCostPerYear;

  // ── ADR-055 — TỶ LỆ ĐÁY: doanh thu/EBIT/biến phí gộp từ 2 material chung dòng.
  // material phụ = material thứ 2 (khác tham chiếu) có ≥1 SP của dòng dùng. Vắng
  // material phụ ⇒ frac chính = 1 ⇒ phần phụ 0kg ⇒ trùng khít mô hình 1-material.
  // Mặc định pct=100 ⇒ frac=1 ⇒ parity tuyệt đối dù có material phụ hay không.
  const pipeSecondaryMat = materials.find(
    (m) => m.id !== pipeRefMaterial.id && products.some((p) => p.kind === 'pipe' && p.materialId === m.id),
  );
  const fittingSecondaryMat = materials.find(
    (m) => m.id !== fittingRefMaterial.id && products.some((p) => p.kind === 'fitting' && p.materialId === m.id),
  );
  const pipePrimaryFrac = pipeSecondaryMat ? (scenario.productionMixPipePrimaryPct ?? 100) / 100 : 1;
  const fittingPrimaryFrac = fittingSecondaryMat ? (scenario.productionMixFittingPrimaryPct ?? 100) / 100 : 1;
  const pipeSecondaryLadder = pipeSecondaryMat ? ladderOf('pipe', pipeSecondaryMat.id) : undefined;
  const fittingSecondaryLadder = fittingSecondaryMat ? ladderOf('fitting', fittingSecondaryMat.id) : undefined;
  // Σ (phần kg × chỉ số thang giá của loại đó) — chính + phụ.
  const splitBy = (
    totalKg: number,
    primaryFrac: number,
    primary: typeof pipeLadder,
    secondary: typeof pipeLadder | undefined,
    pick: (l: typeof pipeLadder) => number,
  ): number =>
    totalKg * primaryFrac * pick(primary) + (secondary ? totalKg * (1 - primaryFrac) * pick(secondary) : 0);

  const pipeRevenueVf = splitBy(pipeKg, pipePrimaryFrac, pipeLadder, pipeSecondaryLadder, (l) => l.targetPrice);
  const fittingRevenueVf = splitBy(fittingKg, fittingPrimaryFrac, fittingLadder, fittingSecondaryLadder, (l) => l.targetPrice);
  const ebitAtNormalCapacityVfPrice =
    splitBy(pipeKg, pipePrimaryFrac, pipeLadder, pipeSecondaryLadder, (l) => l.targetPrice - l.breakEvenFullCost) +
    splitBy(fittingKg, fittingPrimaryFrac, fittingLadder, fittingSecondaryLadder, (l) => l.targetPrice - l.breakEvenFullCost) -
    nonProductionPerYear;

  const revenueVf = pipeRevenueVf + fittingRevenueVf;
  const variableCostTotal =
    splitBy(pipeKg, pipePrimaryFrac, pipeLadder, pipeSecondaryLadder, (l) => l.variableCostFloor) +
    splitBy(fittingKg, fittingPrimaryFrac, fittingLadder, fittingSecondaryLadder, (l) => l.variableCostFloor);
  const contributionMarginRatio = 1 - variableCostTotal / revenueVf;
  const enterpriseBreakEvenRevenuePerYear =
    (pipeCvp.fixedCostPerYear + fittingCvp.fixedCostPerYear + nonProductionPerYear) / contributionMarginRatio;

  // Tổng khấu hao năm: đùn + máy ép + khuôn theo asOfYear (ADR-007) + Lab/UL + Nhà xưởng.
  const totalDepreciationPerYear =
    pipeCost.extruderDepreciationPerYear +
    fittingCost.machineDepreciationPerYear +
    fittingCost.moldDepreciationPerYear +
    labUlInvestment / sharedFixedCosts.depreciationYears +
    (sharedFixedCosts.factoryConstructionCost || 0) / (sharedFixedCosts.factoryDepreciationYears || 10);
  const paybackYears = totalFixedCapitalInvested / (ebitAtNormalCapacityVfPrice + totalDepreciationPerYear);

  return {
    capacityLevels,
    fittingCapacity: {
      productionKgYear: fittingKg,
      costPerKg: fittingCost.fullCostPerKgRef,
      processingCostPerKg: fittingCost.processingCostPerKgRef,
      depreciationPerKg: (fittingCost.machineDepreciationPerYear + fittingCost.moldDepreciationPerYear) / fittingKg,
      sharedOverheadPerKg: fittingCost.sharedCostAllocated / fittingKg,
      directProcessingPerKg:
        fittingCost.processingCostPerKgRef -
        (fittingCost.machineDepreciationPerYear + fittingCost.moldDepreciationPerYear) / fittingKg -
        fittingCost.sharedCostAllocated / fittingKg,
    },
    investment: {
      totalFixedCapitalInvested,
      enterpriseBreakEvenRevenuePerYear,
      expectedRevenueVf: revenueVf,
      expectedRevenuePipeVf: pipeRevenueVf,
      expectedRevenueFittingVf: fittingRevenueVf,
      ebitAtNormalCapacityVfPrice,
      paybackYears,
    },
    pipeCostLayers: pipeCostLayersPerKg(pipeCost, pipeResource, pipeCapacity.normalCapacityKgYear),
    fittingCostLayers: fittingCostLayersPerKg(fittingCost, fittingResource, fittingCapacity.estimatedProductionKgYear),
  };
}
