// ADR-028 — engine màn "So Sánh Kịch Bản". Mỗi kịch bản = bộ hệ số driver; tính
// EBIT/doanh thu/biên tại GIÁ BÁN GIỮ CỐ ĐỊNH (đúng bản chất rủi ro, đồng bộ Độ
// Nhạy ADR-027). Tái dùng nền chung scenario-drivers.ts — không công thức mới.
import type { ScenarioInput } from '../schemas/scenario.js';
import type { ScenarioCompareResult, ScenarioDefinition, ScenarioOutcome } from '../schemas/scenario-compare.js';
import { NEUTRAL, applyDriverMultipliers, makeFixedPriceModel, type DriverMultipliers } from './scenario-drivers.js';

export function calculateScenarioCompare(
  baseline: ScenarioInput,
  scenarios: ScenarioDefinition[],
): ScenarioCompareResult {
  const model = makeFixedPriceModel(baseline);
  const baseEbit = model.baseEbitVnd;

  const outcomeOf = (name: string, multipliers: DriverMultipliers): ScenarioOutcome => {
    const { input, volumeFactor } = applyDriverMultipliers(baseline, multipliers);
    const ebitVnd = model.ebitAt(input, volumeFactor);
    const revenueVnd = model.revenueAt(input, volumeFactor);
    return {
      name,
      multipliers,
      ebitVnd,
      revenueVnd,
      ebitMarginPct: revenueVnd > 0 ? (ebitVnd / revenueVnd) * 100 : 0,
      deltaVsBaseVnd: ebitVnd - baseEbit,
      deltaVsBasePct: baseEbit !== 0 ? ((ebitVnd - baseEbit) / Math.abs(baseEbit)) * 100 : 0,
    };
  };

  return {
    base: outcomeOf('Cơ sở', NEUTRAL),
    scenarios: scenarios.map((s) => outcomeOf(s.name, s.multipliers)),
  };
}
