// ADR-027 — engine màn "Độ Nhạy" (tornado). Cho từng driver lệch ±δ (một-lần-một-
// biến), đo EBIT "giá-bán-cố-định" (giữ giá bán VF baseline → đúng bản chất rủi ro
// "chi phí tăng mà giá không đổi thì lãi hụt bao nhiêu"). Tái dùng nền chung
// scenario-drivers.ts (không công thức mới); base EBIT khớp KPI Dashboard.
import type { ScenarioInput } from '../schemas/scenario.js';
import type { SensitivityResult, SensitivityDriverResult } from '../schemas/sensitivity.js';
import {
  NEUTRAL,
  DRIVER_LABELS,
  applyDriverMultipliers,
  makeFixedPriceModel,
  type DriverMultipliers,
} from './scenario-drivers.js';

const DRIVER_KEYS: (keyof DriverMultipliers)[] = ['compound', 'fx', 'wage', 'electricity', 'overhead', 'volume'];

export function calculateSensitivity(baseline: ScenarioInput, deltaPct = 0.1): SensitivityResult {
  const model = makeFixedPriceModel(baseline);
  const baseEbitVnd = model.baseEbitVnd;

  const ebitAtMultiplier = (m: DriverMultipliers) => {
    const { input, volumeFactor } = applyDriverMultipliers(baseline, m);
    return model.ebitAt(input, volumeFactor);
  };

  const drivers: SensitivityDriverResult[] = DRIVER_KEYS.map((key) => {
    const lowEbitVnd = ebitAtMultiplier({ ...NEUTRAL, [key]: 1 - deltaPct });
    const highEbitVnd = ebitAtMultiplier({ ...NEUTRAL, [key]: 1 + deltaPct });
    const downsideVnd = Math.min(lowEbitVnd, highEbitVnd) - baseEbitVnd;
    const upsideVnd = Math.max(lowEbitVnd, highEbitVnd) - baseEbitVnd;
    return {
      key,
      label: DRIVER_LABELS[key],
      lowEbitVnd,
      highEbitVnd,
      downsideVnd,
      upsideVnd,
      maxAbsSwingVnd: Math.abs(highEbitVnd - lowEbitVnd),
    };
  }).sort((a, b) => b.maxAbsSwingVnd - a.maxAbsSwingVnd);

  return { deltaPct, baseEbitVnd, drivers };
}
