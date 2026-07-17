// ADR-030 — engine màn "Tối Ưu Product-mix". KHÔNG công thức mới: lấy giá VF, biến
// phí/kg, sản lượng, máy-giờ mỗi dòng từ `calculateScenario` (+ calculatePipeCapacity
// cho giờ Ống) → biên đóng góp/kg và /MÁY-GIỜ. Máy-giờ là nguồn lực ràng buộc thật
// trong mỗi dòng → đóng góp/máy-giờ mới là thước đo "dồn lực vào đâu lãi hơn" (biên
// % cao CHƯA chắc lãi hơn/giờ máy). Mô phỏng mix giữ GIÁ BÁN cố định (đồng bộ ADR-027).
import type { ScenarioInput, ScenarioOutput } from '../schemas/scenario.js';
import type { ContinuousKgResource } from '../schemas/resource.js';
import type { ProductMixProfile, LineMixMetrics, MixEbit } from '../schemas/product-mix.js';
import { calculateScenario, referenceMaterialOf } from './scenario.js';
import { calculatePipeCapacity } from './pipe.js';

interface LineBasis {
  materialId: string;
  materialName: string;
  vfPrice: number;
  variableCostPerKg: number;
  fixedCostPerYear: number;
  volumeKg: number;
  machineHours: number;
}

function readLine(baseline: ScenarioInput, out: ScenarioOutput, line: 'pipe' | 'fitting'): LineBasis {
  const mat = referenceMaterialOf(baseline.materials, baseline.products, line);
  if (!mat) throw new Error(`Thiếu nguyên liệu tham chiếu ${line}`);
  const ladder = out.priceLadder.byLineMaterial.find((e) => e.line === line && e.materialId === mat.id);
  const cvp = out.cvp.byLineMaterial.find((e) => e.line === line && e.materialId === mat.id);
  if (!ladder || !cvp) throw new Error(`Thiếu thang giá/CVP (${line}, ${mat.id})`);
  const volumeKg =
    line === 'pipe' ? out.capacity.pipe.normalCapacityKgYear : out.capacity.fitting.estimatedProductionKgYear;
  const machineHours =
    line === 'pipe'
      ? calculatePipeCapacity(baseline.resources.pipe as ContinuousKgResource).normalOperatingHours
      : out.capacity.fitting.normalMachineHoursUtilized;
  return {
    materialId: mat.id,
    materialName: mat.name,
    vfPrice: ladder.ladder.targetPrice,
    variableCostPerKg: cvp.variableCostPerKg,
    fixedCostPerYear: cvp.fixedCostPerYear,
    volumeKg,
    machineHours,
  };
}

function metricsOf(line: 'pipe' | 'fitting', label: string, b: LineBasis): LineMixMetrics {
  const marginPerKgVnd = b.vfPrice - b.variableCostPerKg;
  const annualContributionVnd = marginPerKgVnd * b.volumeKg;
  return {
    line,
    label,
    materialName: b.materialName,
    vfPriceVndPerKg: b.vfPrice,
    variableCostVndPerKg: b.variableCostPerKg,
    marginPerKgVnd,
    marginPct: b.vfPrice > 0 ? marginPerKgVnd / b.vfPrice : 0,
    annualVolumeKg: b.volumeKg,
    annualMachineHours: b.machineHours,
    contributionPerMachineHourVnd: b.machineHours > 0 ? annualContributionVnd / b.machineHours : 0,
    annualContributionVnd,
  };
}

export function calculateProductMixProfile(baseline: ScenarioInput): ProductMixProfile {
  const out = calculateScenario(baseline);
  const pipe = readLine(baseline, out, 'pipe');
  const fitting = readLine(baseline, out, 'fitting');
  const pipeM = metricsOf('pipe', 'Ống CPVC', pipe);
  const fittingM = metricsOf('fitting', 'Phụ kiện', fitting);
  return {
    lines: [pipeM, fittingM],
    priorityLine:
      fittingM.contributionPerMachineHourVnd >= pipeM.contributionPerMachineHourVnd ? 'fitting' : 'pipe',
  };
}

/**
 * EBIT/doanh thu khi nhân sản lượng mỗi dòng ĐỘC LẬP (máy Ống ≠ máy Phụ kiện — không
 * chuyển đổi được), GIỮ GIÁ BÁN baseline. Định phí SX mỗi dòng KHÔNG đổi theo sản
 * lượng (máy chạy ít vẫn khấu hao/lương) → đòn bẩy vận hành. base (1,1) khớp
 * ebitAtNormalCapacityVfPrice.
 */
export function calculateMixEbit(baseline: ScenarioInput, pipeVolFactor: number, fittingVolFactor: number): MixEbit {
  const out = calculateScenario(baseline);
  const pipe = readLine(baseline, out, 'pipe');
  const fitting = readLine(baseline, out, 'fitting');
  const nonProd =
    baseline.costPool.nonProductionCosts.operatingCostPerYear +
    baseline.costPool.nonProductionCosts.financialCostPerYear;

  const volP = pipe.volumeKg * pipeVolFactor;
  const volF = fitting.volumeKg * fittingVolFactor;
  const revenueVnd = pipe.vfPrice * volP + fitting.vfPrice * volF;
  const contribution =
    (pipe.vfPrice - pipe.variableCostPerKg) * volP + (fitting.vfPrice - fitting.variableCostPerKg) * volF;
  const ebitVnd = contribution - pipe.fixedCostPerYear - fitting.fixedCostPerYear - nonProd;
  return { ebitVnd, revenueVnd };
}
