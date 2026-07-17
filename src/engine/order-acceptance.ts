// ADR-029 — engine màn "Quyết Định Nhận Đơn". KHÔNG công thức chi phí mới: lấy sàn
// biến phí + giá thành đầy đủ theo dòng SP từ output `calculateScenario` tại HAI cơ
// sở giá vốn (giá thị trường/tái tạo VÀ giá vốn khóa/baseline), rồi so giá chào.
// CHÚ Ý (ADR-004): đơn MỚI phải mua NL mới ⇒ sàn CHUẨN là giá thị trường; giá vốn
// khóa chỉ đúng khi làm đơn bằng hàng tồn đã có.
import type { ScenarioInput, ScenarioOutput } from '../schemas/scenario.js';
import type { OrderDecisionRequest, OrderDecisionResult } from '../schemas/order-acceptance.js';
import { calculateScenario, referenceMaterialOf, lastLotPriceOf } from './scenario.js';
import { evaluatePriceLock } from './price-lock.js';

/** Chi phí/kg của 1 dòng SP khi ÉP giá vốn material về 1 cơ sở (replacement | baseline). */
function costsAtBasis(
  baseline: ScenarioInput,
  materialId: string,
  line: 'pipe' | 'fitting',
  basis: 'replacement' | 'baseline',
): { variableCostPerKg: number; fullCostPerKg: number } {
  const s = structuredClone(baseline);
  const m = s.materials.find((x) => x.id === materialId)!;
  // Ép pricingPrice (sau khóa) về đúng cơ sở bằng cách cho deviation = 0.
  if (basis === 'replacement') m.inventory.priceLock.baseline = m.inventory.replacementPriceUsdPerKg;
  else m.inventory.replacementPriceUsdPerKg = m.inventory.priceLock.baseline;

  const out: ScenarioOutput = calculateScenario(s);
  const cvp = out.cvp.byLineMaterial.find((e) => e.line === line && e.materialId === materialId);
  const ladder = out.priceLadder.byLineMaterial.find((e) => e.line === line && e.materialId === materialId);
  if (!cvp || !ladder) throw new Error(`Thiếu CVP/thang giá (${line}, ${materialId})`);
  return { variableCostPerKg: cvp.variableCostPerKg, fullCostPerKg: ladder.ladder.breakEvenFullCost };
}

export function decideOrder(baseline: ScenarioInput, request: OrderDecisionRequest): OrderDecisionResult {
  const mat = referenceMaterialOf(baseline.materials, baseline.products, request.line);
  if (!mat) throw new Error(`Thiếu nguyên liệu tham chiếu cho dòng ${request.line}`);

  const baselineUsd = mat.inventory.priceLock.baseline;
  const replacementUsd = mat.inventory.replacementPriceUsdPerKg;
  const thresholdPct = request.thresholdPctWhatIf ?? mat.inventory.priceLock.thresholdPct;
  const lockEval = evaluatePriceLock({
    baseline: baselineUsd,
    thresholdPct,
    replacement: replacementUsd,
    lastLotPrice: lastLotPriceOf(mat.inventory.lots),
  });

  const market = costsAtBasis(baseline, mat.id, request.line, 'replacement');
  const locked = costsAtBasis(baseline, mat.id, request.line, 'baseline');

  const quantityKg = request.quantityTons * 1000;
  const offered = request.offeredPriceVndPerKg;
  const contributionPerKgVnd = offered - market.variableCostPerKg;
  const profitVsFullCostPerKgVnd = offered - market.fullCostPerKg;

  // Verdict theo sàn THỊ TRƯỜNG (đơn mới): ≥ full cost → NHẬN; ≥ biến phí → CÂN NHẮC
  // (đóng góp dương, bù định phí nếu còn công suất trống); < biến phí → KHÔNG (lỗ tiền tươi).
  const verdict: OrderDecisionResult['verdict'] =
    profitVsFullCostPerKgVnd >= 0 ? 'accept' : contributionPerKgVnd >= 0 ? 'consider' : 'reject';

  return {
    line: request.line,
    materialId: mat.id,
    materialName: mat.name,
    lock: {
      baselineUsdPerKg: baselineUsd,
      replacementUsdPerKg: replacementUsd,
      deviationPct: lockEval.deviationPct,
      thresholdPct,
      isLocked: lockEval.isLocked,
      appliedPricingUsdPerKg: lockEval.pricingPrice,
    },
    quantityKg,
    offeredPriceVndPerKg: offered,
    marketVariableFloorVndPerKg: market.variableCostPerKg,
    marketFullCostVndPerKg: market.fullCostPerKg,
    lockedVariableFloorVndPerKg: locked.variableCostPerKg,
    contributionPerKgVnd,
    contributionTotalVnd: contributionPerKgVnd * quantityKg,
    profitVsFullCostPerKgVnd,
    profitVsFullCostTotalVnd: profitVsFullCostPerKgVnd * quantityKg,
    verdict,
  };
}
