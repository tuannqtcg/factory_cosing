// ADR-061 — 2 kịch bản giá vốn nguyên liệu SONG SONG để so sánh với giá bán
// đang niêm yết (baseline/khóa giá hiện hành): "Giá mua mới hôm nay" (thị
// trường hiện hành, không qua khóa) và "Bình quân gia quyền" (giá thực đã
// nhập kho, sổ sách — ADR-002). Tái dùng NGUYÊN `calculateScenario` — không
// công thức mới: chỉ ép priceLock (baseline = replacement = giá mong muốn)
// để `pricingPrice` sau khóa CHẮC CHẮN ra đúng giá này, bất kể ngưỡng khóa/
// trạng thái khóa thật của scenario gốc.
import type { ScenarioInput } from '../schemas/scenario.js';
import { weightedAvgLandedCostPerKgVnd } from './dual-costing.js';
import { landedCostPerKgVnd, usdPerKgForLandedCostVnd, type LandedCostRates } from './cost-pool.js';

export type CostBasis = 'market-today' | 'weighted-avg';

/** Nhãn hiển thị dùng chung mọi màn — sửa 1 chỗ, cả app nói cùng một thứ tiếng. */
export const COST_BASIS_LABEL: Record<CostBasis, string> = {
  'market-today': 'Giá mua mới hôm nay',
  'weighted-avg': 'Bình quân gia quyền (sổ sách)',
};

/**
 * Trả về ScenarioInput đã ép MỌI nguyên liệu định giá theo MỘT cơ sở giá vốn
 * duy nhất (bỏ qua trạng thái khóa/mở khóa hiện tại của scenario gốc) — dùng
 * để tính lại giá bán/giá thành/EBIT "nếu toàn bộ nguyên liệu định giá theo
 * cơ sở X", so sánh song song với số liệu chính thức (đang tính theo baseline
 * thật của scenario gốc).
 *
 * ADR-058 — 'weighted-avg' tính LANDED COST đúng theo thuế/phí TỪNG LÔ
 * (`weightedAvgLandedCostPerKgVnd`, mỗi lô có thể xuất xứ khác nhau) rồi mới
 * quy ngược ra "giá USD/kg tương đương" (`usdPerKgForLandedCostVnd`) theo mức
 * thuế/phí HIỆN HÀNH của material — để giá trị này chảy đúng qua
 * `calculateScenario` (vốn chỉ nhận 1 mức thuế/phí/material, ADR-012), không
 * cần sửa pipeline tính giá.
 */
export function scenarioWithCostBasis(scenario: ScenarioInput, basis: CostBasis): ScenarioInput {
  const s = structuredClone(scenario);
  const usdVndRate = s.costPool.currency.usdVndRate;
  for (const mat of s.materials) {
    let price: number;
    if (basis === 'market-today') {
      price = mat.inventory.replacementPriceUsdPerKg;
    } else {
      const rates: LandedCostRates = { importTaxRate: mat.importTaxRate, customsLogisticsFeeRate: mat.customsLogisticsFeeRate, usdVndRate };
      const bookLandedVnd =
        weightedAvgLandedCostPerKgVnd(mat.inventory.lots, rates, usdVndRate) ??
        landedCostPerKgVnd(mat.inventory.replacementPriceUsdPerKg, rates);
      price = usdPerKgForLandedCostVnd(bookLandedVnd, rates);
    }
    mat.inventory.replacementPriceUsdPerKg = price;
    mat.inventory.priceLock.baseline = price;
  }
  return s;
}
