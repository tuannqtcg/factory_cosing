// ADR-027/028 — nền dùng chung cho các công cụ if–then của CEO (Độ Nhạy tornado +
// So Sánh Kịch Bản). Định nghĩa MỘT bộ "driver" (yếu tố CEO quan tâm) dưới dạng HỆ
// SỐ NHÂN (1 = giữ nguyên) và MỘT hàm EBIT "giá-bán-cố-định" (giữ giá bán VF ở
// baseline → đo rủi ro nén biên, KHÁC EBIT cost-plus của engine vốn tăng khi chi
// phí tăng). Mọi thứ tái dùng orchestrator `calculateScenario` — không công thức mới.
import type { ScenarioInput } from '../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import { calculateScenario, referenceMaterialOf } from './scenario.js';

/** Hệ số nhân cho từng driver (1 = giữ nguyên). */
export interface DriverMultipliers {
  compound: number; // giá compound (mọi nguyên liệu, USD/kg)
  fx: number; // tỷ giá USD/VND
  wage: number; // lương nhân công
  electricity: number; // giá điện
  overhead: number; // chi phí ngoài SX (vận hành + tài chính)
  volume: number; // sản lượng bán ra
}

export const NEUTRAL: DriverMultipliers = {
  compound: 1,
  fx: 1,
  wage: 1,
  electricity: 1,
  overhead: 1,
  volume: 1,
};

/** Nhãn tiếng Việt cho từng driver (dùng chung UI). */
export const DRIVER_LABELS: Record<keyof DriverMultipliers, string> = {
  compound: 'Giá compound (USD/kg)',
  fx: 'Tỷ giá USD/VND',
  wage: 'Lương nhân công',
  electricity: 'Giá điện',
  overhead: 'Chi phí ngoài SX (vận hành + tài chính)',
  volume: 'Sản lượng bán ra',
};

/**
 * Áp hệ số driver lên baseline → ScenarioInput đã nhiễu + hệ số sản lượng. Giá
 * compound nhân CẢ replacement LẪN baseline khoá ⇒ pricingPrice (sau khoá) scale
 * đúng, giữ nguyên trạng thái khoá. `volume` không sửa input — trả về hệ số nhân
 * sản lượng cho roll-up (đòn bẩy vận hành: định phí không đổi).
 */
export function applyDriverMultipliers(
  baseline: ScenarioInput,
  m: DriverMultipliers,
): { input: ScenarioInput; volumeFactor: number } {
  const s = structuredClone(baseline);
  for (const mat of s.materials) {
    mat.inventory.replacementPriceUsdPerKg *= m.compound;
    mat.inventory.priceLock.baseline *= m.compound;
  }
  s.costPool.currency.usdVndRate *= m.fx;
  (s.resources.pipe as ContinuousKgResource).avgSalaryMonthly *= m.wage;
  (s.resources.fitting as MachineHourResource).avgSalaryMonthly *= m.wage;
  (s.resources.pipe as ContinuousKgResource).electricityPricePerKwh *= m.electricity;
  (s.resources.fitting as MachineHourResource).electricityPricePerKwh *= m.electricity;
  s.costPool.nonProductionCosts.operatingCostPerYear *= m.overhead;
  s.costPool.nonProductionCosts.financialCostPerYear *= m.overhead;
  return { input: s, volumeFactor: m.volume };
}

export interface FixedPriceModel {
  /** EBIT baseline (giá bán = giá thành thực tế) — khớp KPI Dashboard. */
  baseEbitVnd: number;
  baseRevenueVnd: number;
  /** EBIT khi giữ giá bán baseline, áp input đã nhiễu + hệ số sản lượng. */
  ebitAt: (input: ScenarioInput, volumeFactor: number) => number;
  /** Doanh thu tại GIÁ BÁN baseline × sản lượng (đã nhân hệ số). */
  revenueAt: (input: ScenarioInput, volumeFactor: number) => number;
}

/**
 * Dựng mô hình "giá-bán-cố-định": chốt giá bán VF baseline (bậc 5 thang giá), sau
 * đó EBIT = Σ(giá_baseline − biến phí/kg)·sản lượng − định phí SX − chi phí ngoài
 * SX (biến/định phí LẤY TỪ output đã nhiễu). base EBIT khớp
 * `calculateDashboardKpis().investment.ebitAtNormalCapacityVfPrice`.
 */
export function makeFixedPriceModel(baseline: ScenarioInput): FixedPriceModel {
  const pipeMat = referenceMaterialOf(baseline.materials, baseline.products, 'pipe');
  const fitMat = referenceMaterialOf(baseline.materials, baseline.products, 'fitting');
  if (!pipeMat || !fitMat) throw new Error('Thiếu nguyên liệu tham chiếu pipe/fitting');

  const baseOut = calculateScenario(baseline);
  const ladderPrice = (line: 'pipe' | 'fitting', materialId: string) => {
    const e = baseOut.priceLadder.byLineMaterial.find((x) => x.line === line && x.materialId === materialId);
    if (!e) throw new Error(`Thiếu thang giá (${line}, ${materialId})`);
    return e.ladder.targetPrice;
  };
  const basePriceP = ladderPrice('pipe', pipeMat.id);
  const basePriceF = ladderPrice('fitting', fitMat.id);

  const split = (input: ScenarioInput, volumeFactor: number) => {
    const out = calculateScenario(input);
    const cvpOf = (line: 'pipe' | 'fitting', materialId: string) => {
      const e = out.cvp.byLineMaterial.find((x) => x.line === line && x.materialId === materialId);
      if (!e) throw new Error(`Thiếu CVP (${line}, ${materialId})`);
      return e;
    };
    const pipeCvp = cvpOf('pipe', pipeMat.id);
    const fitCvp = cvpOf('fitting', fitMat.id);
    const volP = out.capacity.pipe.normalCapacityKgYear * volumeFactor;
    const volF = out.capacity.fitting.estimatedProductionKgYear * volumeFactor;
    const nonProd =
      input.costPool.nonProductionCosts.operatingCostPerYear +
      input.costPool.nonProductionCosts.financialCostPerYear;
    const revenue = basePriceP * volP + basePriceF * volF;
    const contribution = (basePriceP - pipeCvp.variableCostPerKg) * volP + (basePriceF - fitCvp.variableCostPerKg) * volF;
    const fixed = pipeCvp.fixedCostPerYear + fitCvp.fixedCostPerYear + nonProd;
    return { revenue, ebit: contribution - fixed };
  };

  const base = split(baseline, 1);
  return {
    baseEbitVnd: base.ebit,
    baseRevenueVnd: base.revenue,
    ebitAt: (input, volumeFactor) => split(input, volumeFactor).ebit,
    revenueAt: (input, volumeFactor) => split(input, volumeFactor).revenue,
  };
}
