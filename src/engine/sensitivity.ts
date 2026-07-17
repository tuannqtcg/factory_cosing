// ADR-027 — engine màn "Độ Nhạy" (tornado). KHÔNG công thức chi phí mới: cho từng
// driver lệch ±δ, gọi LẠI orchestrator `calculateScenario` rồi tính EBIT theo
// phân rã CVP (đóng góp − định phí) tại GIÁ BÁN GIỮ CỐ ĐỊNH ở baseline — đúng bản
// chất rủi ro "chi phí tăng mà giá bán không đổi thì lãi hụt bao nhiêu". Base EBIT
// (mọi driver = gốc) khớp `calculateDashboardKpis().investment.ebitAtNormalCapacityVfPrice`
// (kiểm chứng ở tests/unit/sensitivity.test.ts).
import type { ScenarioInput, ScenarioOutput } from '../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import type { SensitivityResult, SensitivityDriverResult } from '../schemas/sensitivity.js';
import { calculateScenario, referenceMaterialOf } from './scenario.js';

/** Mỗi driver = một phép nhiễu input + (tuỳ chọn) hệ số sản lượng. */
interface Driver {
  key: string;
  label: string;
  /** f = 1±δ. Trả về input đã nhiễu + hệ số nhân sản lượng (mặc định 1). */
  perturb: (base: ScenarioInput, f: number) => { input: ScenarioInput; volumeFactor: number };
}

/** Nhiễu driver dạng thay đổi INPUT (sản lượng giữ nguyên). */
function inputDriver(key: string, label: string, mutate: (s: ScenarioInput, f: number) => void): Driver {
  return {
    key,
    label,
    perturb: (base, f) => {
      const s = structuredClone(base);
      mutate(s, f);
      return { input: s, volumeFactor: 1 };
    },
  };
}

const DRIVERS: Driver[] = [
  // Giá compound (mọi nguyên liệu): nhân CẢ replacement LẪN baseline khoá giá ⇒
  // pricingPrice (sau khoá) scale đúng f, giữ nguyên trạng thái khoá.
  inputDriver('compound', 'Giá compound (USD/kg)', (s, f) => {
    for (const m of s.materials) {
      m.inventory.replacementPriceUsdPerKg *= f;
      m.inventory.priceLock.baseline *= f;
    }
  }),
  inputDriver('fx', 'Tỷ giá USD/VND', (s, f) => {
    s.costPool.currency.usdVndRate *= f;
  }),
  inputDriver('wage', 'Lương nhân công', (s, f) => {
    (s.resources.pipe as ContinuousKgResource).avgSalaryMonthly *= f;
    (s.resources.fitting as MachineHourResource).avgSalaryMonthly *= f;
  }),
  inputDriver('electricity', 'Giá điện', (s, f) => {
    (s.resources.pipe as ContinuousKgResource).electricityPricePerKwh *= f;
    (s.resources.fitting as MachineHourResource).electricityPricePerKwh *= f;
  }),
  inputDriver('overhead', 'Chi phí ngoài SX (vận hành + tài chính)', (s, f) => {
    s.costPool.nonProductionCosts.operatingCostPerYear *= f;
    s.costPool.nonProductionCosts.financialCostPerYear *= f;
  }),
  // Sản lượng: input giữ nguyên, chỉ nhân hệ số sản lượng trong roll-up CVP
  // (đòn bẩy vận hành — định phí không đổi nên EBIT lệch mạnh hơn tỉ lệ sản lượng).
  {
    key: 'volume',
    label: 'Sản lượng bán ra',
    perturb: (base, f) => ({ input: base, volumeFactor: f }),
  },
];

export function calculateSensitivity(baseline: ScenarioInput, deltaPct = 0.1): SensitivityResult {
  const pipeMat = referenceMaterialOf(baseline.materials, baseline.products, 'pipe');
  const fitMat = referenceMaterialOf(baseline.materials, baseline.products, 'fitting');
  if (!pipeMat || !fitMat) throw new Error('Thiếu nguyên liệu tham chiếu pipe/fitting cho phân tích độ nhạy');

  const baseOut = calculateScenario(baseline);
  const ladderOf = (out: ScenarioOutput, line: 'pipe' | 'fitting', materialId: string) => {
    const e = out.priceLadder.byLineMaterial.find((x) => x.line === line && x.materialId === materialId);
    if (!e) throw new Error(`Thiếu thang giá (${line}, ${materialId})`);
    return e.ladder;
  };
  // Giá bán GIỮ CỐ ĐỊNH = giá VF baseline (bậc 5 thang giá).
  const basePriceP = ladderOf(baseOut, 'pipe', pipeMat.id).targetPrice;
  const basePriceF = ladderOf(baseOut, 'fitting', fitMat.id).targetPrice;

  // EBIT giá-bán-cố-định = Σ (giá baseline − biến phí/kg)·sản lượng − Σ định phí SX
  //   − chi phí ngoài SX. Biến phí/định phí LẤY TỪ output đã nhiễu (CVP).
  const ebitAtBasePrices = (input: ScenarioInput, volumeFactor: number): number => {
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
    const contribution =
      (basePriceP - pipeCvp.variableCostPerKg) * volP + (basePriceF - fitCvp.variableCostPerKg) * volF;
    const fixed = pipeCvp.fixedCostPerYear + fitCvp.fixedCostPerYear + nonProd;
    return contribution - fixed;
  };

  const baseEbitVnd = ebitAtBasePrices(baseline, 1);

  const drivers: SensitivityDriverResult[] = DRIVERS.map((d) => {
    const lo = d.perturb(baseline, 1 - deltaPct);
    const hi = d.perturb(baseline, 1 + deltaPct);
    const lowEbitVnd = ebitAtBasePrices(lo.input, lo.volumeFactor);
    const highEbitVnd = ebitAtBasePrices(hi.input, hi.volumeFactor);
    const downsideVnd = Math.min(lowEbitVnd, highEbitVnd) - baseEbitVnd;
    const upsideVnd = Math.max(lowEbitVnd, highEbitVnd) - baseEbitVnd;
    return {
      key: d.key,
      label: d.label,
      lowEbitVnd,
      highEbitVnd,
      downsideVnd,
      upsideVnd,
      maxAbsSwingVnd: Math.abs(highEbitVnd - lowEbitVnd),
    };
  }).sort((a, b) => b.maxAbsSwingVnd - a.maxAbsSwingVnd);

  return { deltaPct, baseEbitVnd, drivers };
}
