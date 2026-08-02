// Pha 3 (ADR-021) — engine màn "Trợ Lý CEO". KHÔNG chép công thức từ prototype:
// áp override của CEO (giá compound, số ca, huy động giờ máy, thuê mặt bằng, tỷ
// giá) lên ScenarioInput rồi gọi LẠI orchestrator `calculateScenario` +
// `calculateDashboardKpis` — tại preset "Chuẩn Excel v3.4" mọi override là no-op
// nên khớp tuyệt đối số vàng baseline (parity Pha 4).
//
// Giá bán = markup của CEO trên giá thành (markup_on_cost) HOẶC giá thành ÷
// (1−margin) (margin_on_price). Bảng DN/SKU lấy giá thành/đơn vị bằng cách
// BACK-OUT từ out.skuPriceChains: fullCost = vfPricePerUnit ÷ (1+markupVf) —
// tái dùng nguyên chuỗi engine (gồm ren kim loại + đơn trọng), không tính lại.
import type { ScenarioInput, ScenarioOutput } from '../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import type { FittingProduct, PipeProduct } from '../schemas/product.js';
import type {
  CeoPlannerRequest,
  CeoPlannerResult,
  CeoLineResult,
  CeoLadder,
  MarginMode,
} from '../schemas/ceo-planner.js';
import { calculateScenario } from './scenario.js';
import { calculateDashboardKpis } from './dashboard-support.js';
import { effectivePipeCapacity } from './pipe.js';
import { landedCostPerKgVnd } from './cost-pool.js';

/** ADR-021 §6 — thuế TNDN 20% (user xác nhận 2026-07-16). Đổi 1 nơi duy nhất. */
export const CIT_RATE = 0.2;

/** Giá bán từ giá thành theo cách hiểu margin của CEO (brief mục 1). */
export function applySellingPrice(fullCost: number, margin: number, mode: MarginMode): number {
  return mode === 'markup_on_cost' ? fullCost * (1 + margin) : fullCost / (1 - margin);
}

/**
 * Dựng ScenarioInput đã áp override của CEO. Giá compound: đặt CẢ
 * replacementPrice LẪN priceLock.baseline = giá CEO nhập ⇒ pricingPrice sau khóa
 * = đúng giá đó (bỏ kẹp khóa giá — đúng bản chất what-if "nếu mua giá X"). Baseline
 * scenario KHÔNG bị sửa (nhận bản clone).
 */
function applyOverrides(baseline: ScenarioInput, request: CeoPlannerRequest): ScenarioInput {
  const s = structuredClone(baseline);
  s.costPool.currency.usdVndRate = request.fxRateUsdVnd;
  s.costPool.sharedFixedCosts.annualLandRent = request.annualPremiseLeaseVnd;

  const setCompound = (materialId: string, usd: number) => {
    const m = s.materials.find((x) => x.id === materialId);
    if (!m) throw new Error(`Không tìm thấy nguyên liệu ${materialId} trong scenario`);
    m.inventory.replacementPriceUsdPerKg = usd;
    m.inventory.priceLock.baseline = usd; // deviation = 0 → pricingPrice = giá CEO
  };
  setCompound(request.pipe.materialId, request.pipe.compoundPriceUsdPerKg);
  setCompound(request.fitting.materialId, request.fitting.compoundPriceUsdPerKg);
  // ADR-042 — thương hiệu thứ hai (nếu chạy 2 loại) cũng áp giá CEO để thang giá
  // (fullCost) của nó phản ánh đúng kịch bản mua hàng.
  if (request.pipeSecond) setCompound(request.pipeSecond.materialId, request.pipeSecond.compoundPriceUsdPerKg);
  if (request.fittingSecond) setCompound(request.fittingSecond.materialId, request.fittingSecond.compoundPriceUsdPerKg);

  (s.resources.pipe as ContinuousKgResource).normalShifts = request.pipe.normalShifts;
  (s.resources.fitting as MachineHourResource).normalShifts = request.fitting.normalShifts;
  (s.resources.fitting as MachineHourResource).normalUtilizationFactor = request.fitting.machineHourUtilization;
  return s;
}

function ladderOf(out: ScenarioOutput, line: 'pipe' | 'fitting', materialId: string): CeoLadder {
  const entry = out.priceLadder.byLineMaterial.find((e) => e.line === line && e.materialId === materialId);
  if (!entry) throw new Error(`Thiếu thang giá (${line}, ${materialId})`);
  const l = entry.ladder;
  return {
    variableCostFloor: l.variableCostFloor,
    cashBreakEven: l.cashBreakEven,
    fullCost: l.breakEvenFullCost,
    enterpriseBreakEven: l.enterpriseBreakEven,
    targetVf: l.targetPrice,
  };
}

export function calculateCeoPlanner(request: CeoPlannerRequest, baseline: ScenarioInput): CeoPlannerResult {
  const s = applyOverrides(baseline, request);
  const out = calculateScenario(s);
  const kpis = calculateDashboardKpis(s);

  const pipeResource = s.resources.pipe as ContinuousKgResource;
  const fittingResource = s.resources.fitting as MachineHourResource;
  const { currency } = s.costPool;

  const pipeMat = s.materials.find((m) => m.id === request.pipe.materialId)!;
  const fitMat = s.materials.find((m) => m.id === request.fitting.materialId)!;

  // ADR-042/055 — CHIA công suất DÒNG cho 2 thương hiệu (dùng chung máy). Vắng
  // *Second ⇒ thương hiệu chính giữ 100% (chạy 1 loại) ⇒ parity giữ nguyên.
  // Thiếu allocation trong request ⇒ dùng TỶ LỆ ĐÁY đã thiết lập ở baseline
  // (Thiết Lập ⑦); request chỉ GHI ĐÈ tạm khi what-if. Tính SỚM hơn (trước đây
  // ở dưới) để dùng luôn cho ADR-063 (tốc độ hiệu dụng theo mix).
  const allocPipe = request.pipeSecond ? (request.allocationPipePrimaryPct ?? baseline.productionMixPipePrimaryPct ?? 100) / 100 : 1;

  // Sản lượng / giờ máy cả năm (tái dùng output orchestrator).
  // ADR-063 — tốc độ hiệu dụng có trọng số theo mix khi đang chạy 2 material chung máy đùn.
  const pipeCapKg = out.capacity.pipe.normalCapacityKgYear;
  const pipeHours = effectivePipeCapacity(
    pipeResource,
    s.products.filter((p): p is PipeProduct => p.kind === 'pipe'),
    s.pipeCostMethod ?? 'kg',
    { primaryMaterialId: pipeMat.id, primaryFrac: allocPipe },
  ).normalOperatingHours;
  const fitProdKg = out.capacity.fitting.estimatedProductionKgYear;
  const fitHours = out.capacity.fitting.normalMachineHoursUtilized;

  const pipeLadder = ladderOf(out, 'pipe', pipeMat.id);
  const fitLadder = ladderOf(out, 'fitting', fitMat.id);

  const cvpOf = (line: 'pipe' | 'fitting', materialId: string) => {
    const e = out.cvp.byLineMaterial.find((x) => x.line === line && x.materialId === materialId);
    if (!e) throw new Error(`Thiếu CVP (${line}, ${materialId})`);
    return e;
  };
  const pipeCvp = cvpOf('pipe', pipeMat.id);
  const fitCvp = cvpOf('fitting', fitMat.id);

  // Phân rã giá thành/kg: nguyên liệu (landed ÷ yield, đúng engine) + bao bì + gia
  // công (phần còn lại). pricingPrice = giá CEO (đã set baseline=replacement).
  const materialCostOf = (usd: number, importTaxRate: number, feeRate: number, yieldRate: number) =>
    landedCostPerKgVnd(usd, { importTaxRate, customsLogisticsFeeRate: feeRate, usdVndRate: currency.usdVndRate }) / yieldRate;
  const pipeMaterialPerKg = materialCostOf(request.pipe.compoundPriceUsdPerKg, pipeMat.importTaxRate, pipeMat.customsLogisticsFeeRate, pipeResource.yieldRate);
  const fitMaterialPerKg = materialCostOf(request.fitting.compoundPriceUsdPerKg, fitMat.importTaxRate, fitMat.customsLogisticsFeeRate, fittingResource.yieldRate);

  const buildLine = (
    line: 'pipe' | 'fitting',
    mat: { id: string; name: string },
    ladder: CeoLadder,
    cvp: { variableCostPerKg: number; fixedCostPerYear: number },
    margin: number,
    materialPerKg: number,
    packagingPerKg: number,
    capKg: number,
    hours: number,
    yieldRate: number,
    machineHourCostVnd?: number,
  ): CeoLineResult => {
    const fullCost = ladder.fullCost;
    const price = applySellingPrice(fullCost, margin, request.marginMode);
    const cm = price - cvp.variableCostPerKg;
    const breakEvenKg = cm > 0 ? cvp.fixedCostPerYear / cm : Infinity;
    return {
      line,
      materialId: mat.id,
      materialName: mat.name,
      sellingPriceVndPerKg: price,
      fullCostVndPerKg: fullCost,
      materialCostVndPerKg: materialPerKg,
      processingCostVndPerKg: fullCost - materialPerKg - packagingPerKg,
      packagingCostVndPerKg: packagingPerKg,
      marginOnPricePct: ((price - fullCost) / price) * 100,
      ...(machineHourCostVnd !== undefined ? { machineHourCostVnd } : {}),
      ladder,
      annualProductionKg: capKg,
      annualMachineHours: hours,
      breakEvenPctOfCapacity: Number.isFinite(breakEvenKg) ? (breakEvenKg / capKg) * 100 : Infinity,
      annualGrossProfitVnd: (price - fullCost) * capKg,
      compoundNeedKgPerYear: capKg / yieldRate,
    };
  };

  // ADR-042 — CHIA công suất DÒNG cho 2 thương hiệu (dùng chung máy). Tổng phần
  // chia = 100% công suất dòng (KHÔNG cộng dồn vượt trần vật lý). `allocPipe`
  // tính ở trên (dùng chung cho tốc độ hiệu dụng ADR-063); `allocFit` tính ở đây.
  const allocFit = request.fittingSecond ? (request.allocationFittingPrimaryPct ?? baseline.productionMixFittingPrimaryPct ?? 100) / 100 : 1;

  const pipe = buildLine('pipe', pipeMat, pipeLadder, pipeCvp, request.pipe.desiredMargin, pipeMaterialPerKg, pipeResource.packagingCostPerKg, pipeCapKg * allocPipe, pipeHours * allocPipe, pipeResource.yieldRate);
  const fitting = buildLine('fitting', fitMat, fitLadder, fitCvp, request.fitting.desiredMargin, fitMaterialPerKg, fittingResource.packagingCostPerKg, fitProdKg * allocFit, fitHours * allocFit, fittingResource.yieldRate, out.mhrPerMachineHour);

  // Thương hiệu thứ hai (nếu chạy 2 loại) — cùng công thức, phần công suất còn lại.
  const buildSecond = (
    line: 'pipe' | 'fitting',
    second: { materialId: string; compoundPriceUsdPerKg: number; desiredMargin: number },
    capKgTotal: number,
    hoursTotal: number,
    allocPrimary: number,
    yieldRate: number,
    packagingPerKg: number,
    mhr?: number,
  ): CeoLineResult => {
    const m2 = s.materials.find((x) => x.id === second.materialId)!;
    const matPerKg2 = materialCostOf(second.compoundPriceUsdPerKg, m2.importTaxRate, m2.customsLogisticsFeeRate, yieldRate);
    return buildLine(line, m2, ladderOf(out, line, m2.id), cvpOf(line, m2.id), second.desiredMargin, matPerKg2, packagingPerKg, capKgTotal * (1 - allocPrimary), hoursTotal * (1 - allocPrimary), yieldRate, mhr);
  };
  const pipeSecond = request.pipeSecond
    ? buildSecond('pipe', request.pipeSecond, pipeCapKg, pipeHours, allocPipe, pipeResource.yieldRate, pipeResource.packagingCostPerKg)
    : undefined;
  const fittingSecond = request.fittingSecond
    ? buildSecond('fitting', request.fittingSecond, fitProdKg, fitHours, allocFit, fittingResource.yieldRate, fittingResource.packagingCostPerKg, out.mhrPerMachineHour)
    : undefined;

  // ── Hiệu quả toàn nhà máy ────────────────────────────────────────────────
  // Cộng MỌI thương hiệu đang chạy. Vì định phí đã nằm trong giá thành/kg và tổng
  // sản lượng 2 thương hiệu = đúng công suất dòng, phép cộng này TỰ ĐÚNG định phí
  // (không nhân đôi, không bỏ sót) — xem chứng minh ADR-042.
  const activeLines = [pipe, fitting, pipeSecond, fittingSecond].filter((l): l is CeoLineResult => l !== undefined);
  const revenueVfVnd = activeLines.reduce((sum, l) => sum + l.sellingPriceVndPerKg * l.annualProductionKg, 0);
  const grossProfitVnd = activeLines.reduce((sum, l) => sum + l.annualGrossProfitVnd, 0);
  const nonProd = s.costPool.nonProductionCosts.operatingCostPerYear + s.costPool.nonProductionCosts.financialCostPerYear;
  const preTaxProfitVnd = grossProfitVnd - nonProd;
  const corporateIncomeTaxVnd = preTaxProfitVnd > 0 ? preTaxProfitVnd * CIT_RATE : 0;
  const netProfitVnd = preTaxProfitVnd - corporateIncomeTaxVnd;

  // Tổng khấu hao năm = back-out từ KPI Dashboard (payback = invested ÷ (ebitVf +
  // totalDep)) — tránh chép lại công thức khấu hao; giá trị material-independent.
  const inv = kpis.investment;
  const totalDepreciation = inv.totalFixedCapitalInvested / inv.paybackYears - inv.ebitAtNormalCapacityVfPrice;
  const cashPerYearVnd = preTaxProfitVnd + totalDepreciation;
  const paybackYears = cashPerYearVnd > 0 ? inv.totalFixedCapitalInvested / cashPerYearVnd : null;

  const summary = {
    revenueVfVnd,
    grossProfitVnd,
    preTaxProfitVnd,
    corporateIncomeTaxVnd,
    netProfitVnd,
    preTaxProfitMarginPct: revenueVfVnd > 0 ? (preTaxProfitVnd / revenueVfVnd) * 100 : 0,
    cashPerYearVnd,
    paybackYears,
    totalInvestedVnd: inv.totalFixedCapitalInvested,
  };

  // ── Bảng giá DN (ống) + 83 SKU (phụ kiện) — back-out fullCost/đơn vị từ engine ──
  const backoutFullCost = (vfPricePerUnit: number, markupVf: number) => vfPricePerUnit / (1 + markupVf);
  const pipeProducts = s.products.filter((p): p is PipeProduct => p.kind === 'pipe' && p.materialId === pipeMat.id);
  const fittingProducts = s.products.filter((p): p is FittingProduct => p.kind === 'fitting' && p.materialId === fitMat.id);

  const pipeDnPrices = out.skuPriceChains
    .filter((sku) => sku.productKey.dn !== undefined && sku.productKey.materialId === pipeMat.id && sku.managementStatus === 'active')
    .map((sku) => {
      const product = pipeProducts.find((p) => p.dn === sku.productKey.dn);
      const fullCostVndPerM = backoutFullCost(sku.chain.vfPricePerUnit, pipeMat.markupVf);
      return {
        dn: sku.productKey.dn!,
        unitWeightKgPerM: product?.unitWeightKgPerM ?? 0,
        fullCostVndPerM,
        sellingPriceVndPerM: applySellingPrice(fullCostVndPerM, request.pipe.desiredMargin, request.marginMode),
      };
    });

  // Giá ren kim loại đã KHÓA theo (renType, ptSize) — tái dùng từ output engine
  // (ADR-008); ren/cái = insertQtyPerUnit × pricingPrice của loại ren SKU dùng.
  const insertPriceByKey = new Map<string, number>();
  for (const e of out.priceLock.metalInsertByCatalogEntry) {
    insertPriceByKey.set(`${e.renType}|${e.ptSize}`, e.evaluation.pricingPrice);
  }
  const fittingSkuPrices = out.skuPriceChains
    .filter((sku) => sku.productKey.productName !== undefined && sku.productKey.materialId === fitMat.id && sku.managementStatus === 'active')
    .map((sku) => {
      const product = fittingProducts.find((p) => p.productName === sku.productKey.productName && p.sizeLabel === sku.productKey.sizeLabel);
      const fullCostVndPerPiece = backoutFullCost(sku.chain.vfPricePerUnit, fitMat.markupVf);
      const insert = product?.metalInsert;
      const metalInsertVndPerPiece = insert ? insert.insertQtyPerUnit * (insertPriceByKey.get(`${insert.renType}|${insert.ptSize}`) ?? 0) : 0;
      return {
        productName: sku.productKey.productName!,
        sizeLabel: sku.productKey.sizeLabel ?? '',
        schedule: product?.schedule ?? '',
        unitWeightKg: product?.unitWeightKg ?? 0,
        metalInsertVndPerPiece, // ADR-008 — ren tách riêng (đã gồm trong fullCost)
        fullCostVndPerPiece,
        sellingPriceVndPerPiece: applySellingPrice(fullCostVndPerPiece, request.fitting.desiredMargin, request.marginMode),
      };
    });

  return { request, pipe, fitting, ...(pipeSecond ? { pipeSecond } : {}), ...(fittingSecond ? { fittingSecond } : {}), summary, pipeDnPrices, fittingSkuPrices };
}
