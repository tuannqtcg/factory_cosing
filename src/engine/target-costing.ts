// M12.4c (ADR-010 mục 3, ADR-013) — tầng orchestration cho Target Costing
// (T2/T3, tầng CHIẾN LƯỢC, ADR-005/006): nối ScenarioInput + request →
// solver (M10). Đặt ở engine (pure, không I/O) cùng pattern plan-support.ts —
// Cloud Function `computeTargetCosting` chỉ làm auth + I/O + parse Zod;
// M12.8 (màn Target Costing) tái dùng nguyên.
//
// Luật skill `inverse-solver` áp nguyên: KHÔNG công thức ngược tay — T2 dạng
// đóng qua solveTargetProfit() (chính là forward CVP), T3 bisection qua
// solve() trên calculateScenario() (forward function DUY NHẤT của app).
import type {
  ScenarioInput,
  ScenarioOutput,
  TargetProfitRequest,
  TargetProfitResult,
  TargetPriceRequest,
  TargetPriceResult,
} from '../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import { calculateScenario, referenceMaterialOf } from './scenario.js';
import { solve, solveTargetProfit } from './solver.js';

/**
 * Allowlist biến dò cho T3 (ADR-013 mục 3) — bounds/tol KHÔNG do client cấp.
 * Danh sách = "biến giải ngược hợp lệ v1" của skill inverse-solver mục 5,
 * phần biến LIÊN TỤC, dịch sang path trên `ScenarioInput`. Biến nguyên
 * `shifts` HOÃN (cần solveDiscrete, M12.8 quyết — xem ADR-013).
 */
export const TARGET_PRICE_FREE_VARS: ReadonlyArray<{ pattern: RegExp; bounds: [number, number] }> = [
  { pattern: /^resources\.fitting\.normalUtilizationFactor$/, bounds: [0.05, 1] },
  // Đi QUA khóa giá ADR-004 khi forward — f là hàm bậc thang ĐƠN ĐIỆU (phẳng
  // trong ngưỡng quanh baseline), bisection vẫn đúng; nghiệm trong dải khóa
  // không duy nhất → forwardOutput là chân lý để duyệt (luật #4 skill).
  { pattern: /^materials\.\d+\.inventory\.replacementPriceUsdPerKg$/, bounds: [0, 20] },
  { pattern: /^materials\.\d+\.markupVf$/, bounds: [0, 2] },
  { pattern: /^costPool\.markup\.markupTcg$/, bounds: [0, 2] },
  { pattern: /^costPool\.markup\.listPriceMargin$/, bounds: [0, 0.9] }, // công thức chia (1 − margin) — chặn dưới 1
];

/** tol trên MỤC TIÊU (đ) — dưới bước làm tròn 100 đ của listPriceBeforeVat (ADR-013 mục 3). */
export const TARGET_PRICE_TOL_VND = 0.5;

/**
 * T2 — lợi nhuận mục tiêu → sản lượng + số ca. CVP theo (line, material) sau
 * ADR-012: `request.materialId` bỏ trống = material tham chiếu của line
 * (ADR-013 mục 2). Tái dùng CVP/capacity từ calculateScenario() — không tính lại.
 */
export function computeTargetProfitForScenario(
  scenario: ScenarioInput,
  request: TargetProfitRequest,
): TargetProfitResult {
  const line = request.productLine;
  const materialId = request.materialId ?? referenceMaterialOf(scenario.materials, scenario.products, line)?.id;
  if (materialId === undefined) {
    throw new Error(`Dòng ${line} không có sản phẩm nào gắn material — không xác định được material tham chiếu (ADR-012)`);
  }

  const output = calculateScenario(scenario);
  const cvpEntry = output.cvp.byLineMaterial.find((e) => e.line === line && e.materialId === materialId);
  if (!cvpEntry) {
    throw new Error(`Không có CVP cho (line=${line}, materialId=${materialId}) — material không được SP nào của line dùng`);
  }

  const normalCapacityKgYearAtNormalShifts =
    line === 'pipe' ? output.capacity.pipe.normalCapacityKgYear : output.capacity.fitting.estimatedProductionKgYear;
  const resource = line === 'pipe' ? (scenario.resources.pipe as ContinuousKgResource) : (scenario.resources.fitting as MachineHourResource);

  return solveTargetProfit({
    targetProfitVnd: request.targetProfitVnd,
    fixedCostPerYear: cvpEntry.fixedCostPerYear,
    contributionMarginPerKg: cvpEntry.contributionMarginPerKg,
    normalCapacityKgYearAtNormalShifts,
    normalShifts: resource.normalShifts,
  });
}

/** Khớp SKU trong skuPriceChains theo productKey (ADR-013 mục 1) — lấy match ĐẦU TIÊN theo thứ tự products[]. */
function findSkuChain(output: ScenarioOutput, request: TargetPriceRequest) {
  const key = request.productKey;
  return output.skuPriceChains.find((sku) => {
    if (key.materialId !== undefined && sku.productKey.materialId !== key.materialId) return false;
    if (request.productLine === 'pipe') return sku.productKey.dn === key.dn;
    return sku.productKey.productName === key.productName && sku.productKey.sizeLabel === key.sizeLabel;
  });
}

/**
 * T3 — giá niêm yết mục tiêu cho 1 SKU → giá trị biến dò (bisection trên
 * calculateScenario, luật #1 skill inverse-solver). Mục tiêu đối chiếu
 * `chain.listPriceBeforeVat` (case chuẩn "DN50 260.000đ/m"). Ném lỗi cho
 * request không hợp lệ (freeVarPath ngoài allowlist, productKey sai/không có
 * SKU) — caller (Cloud Function) map sang HttpsError `invalid-argument`.
 */
export function computeTargetPriceForScenario(
  scenario: ScenarioInput,
  request: TargetPriceRequest,
): TargetPriceResult {
  const spec = TARGET_PRICE_FREE_VARS.find((s) => s.pattern.test(request.freeVarPath));
  if (!spec) {
    throw new Error(
      `freeVarPath "${request.freeVarPath}" không nằm trong allowlist biến dò (ADR-013 mục 3): ` +
        TARGET_PRICE_FREE_VARS.map((s) => s.pattern.source).join(' | '),
    );
  }
  if (request.productLine === 'pipe' && request.productKey.dn === undefined) {
    throw new Error('productLine=pipe cần productKey.dn (ADR-013 mục 1)');
  }
  if (request.productLine === 'fitting' && (request.productKey.productName === undefined || request.productKey.sizeLabel === undefined)) {
    throw new Error('productLine=fitting cần productKey.productName + sizeLabel (ADR-013 mục 1)');
  }

  // Kiểm tra SKU tồn tại TRƯỚC khi bisection — lỗi chọn SKU là lỗi request
  // (invalid-argument), không phải "không hội tụ".
  if (!findSkuChain(calculateScenario(scenario), request)) {
    throw new Error(
      `Không tìm thấy SKU khớp productKey ${JSON.stringify(request.productKey)} trong skuPriceChains (productLine=${request.productLine})`,
    );
  }

  const result = solve({
    baseInput: scenario,
    forwardFn: calculateScenario,
    freeVarPath: request.freeVarPath,
    targetSelector: (output) => {
      const sku = findSkuChain(output, request);
      if (!sku) throw new Error('SKU biến mất giữa các lần forward — không thể xảy ra (freeVarPath không đổi danh mục SP)');
      return sku.chain.listPriceBeforeVat;
    },
    target: request.targetListPriceVnd,
    bounds: spec.bounds,
    tol: TARGET_PRICE_TOL_VND,
  });

  // Map về đúng TargetPriceResultSchema (contract §4) — không lộ residual/iterations nội bộ.
  if (!result.feasible) {
    return { feasible: false, reason: result.reason, achievableRange: result.achievableRange };
  }
  return { feasible: true, value: result.value, forwardOutput: result.forwardOutput };
}
