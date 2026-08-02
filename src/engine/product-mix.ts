// ADR-030/031 — engine màn "Tối Ưu Product-mix". KHÔNG công thức mới: lấy giá VF,
// biến phí/kg, sản lượng, máy-giờ, VỐN CỐ ĐỊNH mỗi dòng từ config + `calculateScenario`
// → biên đóng góp theo NHIỀU mẫu số (kg · máy-giờ · đồng vốn). ADR-031: cho nhập GIÁ
// THỊ TRƯỜNG thật/dòng (mặc định = giá VF) — commodity ống bán mỏng hơn cost+markup,
// nhập giá thật mới ra kết luận sát thực tế. Mô phỏng mix giữ giá (thị trường/VF) cố định.
import type { ScenarioInput, ScenarioOutput } from '../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource } from '../schemas/resource.js';
import type { ProductMixProfile, LineMixMetrics, MixEbit, MarketPriceOverride } from '../schemas/product-mix.js';
import type { PipeProduct } from '../schemas/product.js';
import { calculateScenario, referenceMaterialOf } from './scenario.js';
import { effectivePipeCapacity } from './pipe.js';

interface LineBasis {
  materialName: string;
  vfPrice: number;
  variableCostPerKg: number;
  fixedCostPerYear: number;
  volumeKg: number;
  machineHours: number;
  fixedCapitalVnd: number;
}

function pipeFixedCapital(r: ContinuousKgResource): number {
  return r.extruderPriceEach * r.extruderCount + r.moldPullerCutterCost;
}
function fittingFixedCapital(r: MachineHourResource): number {
  return r.machineTypes.reduce((sum, m) => sum + m.priceVnd * m.count, 0) + r.moldAssets.reduce((sum, m) => sum + m.costVnd, 0);
}

function readLine(baseline: ScenarioInput, out: ScenarioOutput, line: 'pipe' | 'fitting'): LineBasis {
  const mat = referenceMaterialOf(baseline.materials, baseline.products, line);
  if (!mat) throw new Error(`Thiếu nguyên liệu tham chiếu ${line}`);
  const ladder = out.priceLadder.byLineMaterial.find((e) => e.line === line && e.materialId === mat.id);
  const cvp = out.cvp.byLineMaterial.find((e) => e.line === line && e.materialId === mat.id);
  if (!ladder || !cvp) throw new Error(`Thiếu thang giá/CVP (${line}, ${mat.id})`);
  const pipeR = baseline.resources.pipe as ContinuousKgResource;
  const fitR = baseline.resources.fitting as MachineHourResource;
  return {
    materialName: mat.name,
    vfPrice: ladder.ladder.targetPrice,
    variableCostPerKg: cvp.variableCostPerKg,
    fixedCostPerYear: cvp.fixedCostPerYear,
    volumeKg: line === 'pipe' ? out.capacity.pipe.normalCapacityKgYear : out.capacity.fitting.estimatedProductionKgYear,
    // ADR-063 — tốc độ hiệu dụng có trọng số theo tỷ lệ đáy khi ≥2 material dòng Ống chạy chung máy.
    machineHours:
      line === 'pipe'
        ? effectivePipeCapacity(
            pipeR,
            baseline.products.filter((p): p is PipeProduct => p.kind === 'pipe'),
            baseline.pipeCostMethod ?? 'kg',
            { primaryMaterialId: mat.id, primaryFrac: (baseline.productionMixPipePrimaryPct ?? 100) / 100 },
          ).normalOperatingHours
        : out.capacity.fitting.normalMachineHoursUtilized,
    fixedCapitalVnd: line === 'pipe' ? pipeFixedCapital(pipeR) : fittingFixedCapital(fitR),
  };
}

function metricsOf(line: 'pipe' | 'fitting', label: string, b: LineBasis, effectivePrice: number): LineMixMetrics {
  const marginPerKgVnd = effectivePrice - b.variableCostPerKg;
  const annualContributionVnd = marginPerKgVnd * b.volumeKg;
  return {
    line,
    label,
    materialName: b.materialName,
    vfPriceVndPerKg: b.vfPrice,
    effectivePriceVndPerKg: effectivePrice,
    variableCostVndPerKg: b.variableCostPerKg,
    marginPerKgVnd,
    marginPct: effectivePrice > 0 ? marginPerKgVnd / effectivePrice : 0,
    annualVolumeKg: b.volumeKg,
    annualMachineHours: b.machineHours,
    fixedCapitalVnd: b.fixedCapitalVnd,
    contributionPerMachineHourVnd: b.machineHours > 0 ? annualContributionVnd / b.machineHours : 0,
    contributionPerCapital: b.fixedCapitalVnd > 0 ? annualContributionVnd / b.fixedCapitalVnd : 0,
    annualContributionVnd,
  };
}

const priceFor = (line: 'pipe' | 'fitting', vf: number, override?: MarketPriceOverride): number =>
  override?.[line] ?? vf;

export function calculateProductMixProfile(baseline: ScenarioInput, marketPrice?: MarketPriceOverride): ProductMixProfile {
  const out = calculateScenario(baseline);
  const pipeB = readLine(baseline, out, 'pipe');
  const fitB = readLine(baseline, out, 'fitting');
  const pipe = metricsOf('pipe', 'Ống CPVC', pipeB, priceFor('pipe', pipeB.vfPrice, marketPrice));
  const fitting = metricsOf('fitting', 'Phụ kiện', fitB, priceFor('fitting', fitB.vfPrice, marketPrice));
  const win = (get: (m: LineMixMetrics) => number): 'pipe' | 'fitting' => (get(fitting) > get(pipe) ? 'fitting' : 'pipe');
  return {
    lines: [pipe, fitting],
    priorityByConstraint: {
      machineHour: win((m) => m.contributionPerMachineHourVnd),
      fixedCapital: win((m) => m.contributionPerCapital),
      volumeKg: win((m) => m.marginPerKgVnd),
    },
  };
}

/**
 * EBIT/doanh thu khi nhân sản lượng mỗi dòng ĐỘC LẬP (máy Ống ≠ máy Phụ kiện), giữ
 * giá (thị trường nếu nhập, mặc định VF) cố định. Định phí SX mỗi dòng không đổi theo
 * sản lượng (đòn bẩy vận hành). Không override + (1,1) ⇒ khớp ebitAtNormalCapacityVfPrice.
 */
export function calculateMixEbit(
  baseline: ScenarioInput,
  pipeVolFactor: number,
  fittingVolFactor: number,
  marketPrice?: MarketPriceOverride,
): MixEbit {
  const out = calculateScenario(baseline);
  const pipe = readLine(baseline, out, 'pipe');
  const fitting = readLine(baseline, out, 'fitting');
  const pPrice = priceFor('pipe', pipe.vfPrice, marketPrice);
  const fPrice = priceFor('fitting', fitting.vfPrice, marketPrice);
  const nonProd =
    baseline.costPool.nonProductionCosts.operatingCostPerYear + baseline.costPool.nonProductionCosts.financialCostPerYear;

  const volP = pipe.volumeKg * pipeVolFactor;
  const volF = fitting.volumeKg * fittingVolFactor;
  const revenueVnd = pPrice * volP + fPrice * volF;
  const contribution = (pPrice - pipe.variableCostPerKg) * volP + (fPrice - fitting.variableCostPerKg) * volF;
  const ebitVnd = contribution - pipe.fixedCostPerYear - fitting.fixedCostPerYear - nonProd;
  return { ebitVnd, revenueVnd };
}
