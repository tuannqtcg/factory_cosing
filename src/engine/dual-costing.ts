// Nguồn nghiệp vụ: docs/BUSINESS_MODEL.md §1, §5 — ADR-002 (giá vốn kép: bình
// quân gia quyền sổ sách vs giá mua mới hôm nay định giá), mở rộng bởi ADR-008
// (ren kim loại — cùng công thức, tồn kho/policy riêng) và ADR-058 (thuế NK/
// phí logistics RIÊNG từng lô — mỗi lô có thể xuất xứ khác nhau).
import { landedCostPerKgVnd, type LandedCostRates } from './cost-pool.js';

export interface InventoryLot {
  tons: number;
  priceUsdPerKg: number;
  // ADR-058 — optional: bỏ trống thì dùng rate fallback (thường là của material).
  importTaxRate?: number;
  customsLogisticsFeeRate?: number;
}

/** Bình quân gia quyền GIÁ MUA (USD/kg, chưa gồm thuế/phí) — null nếu không có lô nào (Σtons=0), gọi phải tự fallback về replacementPriceUsd (BUSINESS_MODEL §1). */
export function weightedAvgUsdPerKg(lots: InventoryLot[]): number | null {
  const totalTons = lots.reduce((sum, lot) => sum + lot.tons, 0);
  if (totalTons === 0) return null;
  const totalValueUsd = lots.reduce((sum, lot) => sum + lot.tons * lot.priceUsdPerKg, 0);
  return totalValueUsd / totalTons;
}

/**
 * Bình quân gia quyền LANDED COST (đ/kg, ĐÃ gồm thuế/phí) — ADR-058. Khác
 * `landedCostPerKgVnd(weightedAvgUsdPerKg(lots), rate)`: hàm đó bình quân giá
 * mua thô rồi mới nhân 1 mức thuế/phí CHUNG — SAI khi các lô có xuất xứ khác
 * nhau (thuế/phí khác nhau). Hàm này tính landed cost TỪNG lô (rate riêng của
 * lô, thiếu thì lấy `fallbackRates` — thường là rate của material, ADR-012)
 * rồi mới bình quân theo tấn — đúng bản chất kế toán dù thuế lô có khác nhau.
 * null nếu không có lô nào (Σtons=0).
 */
export function weightedAvgLandedCostPerKgVnd(
  lots: InventoryLot[],
  fallbackRates: Pick<LandedCostRates, 'importTaxRate' | 'customsLogisticsFeeRate'>,
  usdVndRate: number,
): number | null {
  const totalTons = lots.reduce((sum, lot) => sum + lot.tons, 0);
  if (totalTons === 0) return null;
  const totalLandedVnd = lots.reduce((sum, lot) => {
    const rates: LandedCostRates = {
      importTaxRate: lot.importTaxRate ?? fallbackRates.importTaxRate,
      customsLogisticsFeeRate: lot.customsLogisticsFeeRate ?? fallbackRates.customsLogisticsFeeRate,
      usdVndRate,
    };
    return sum + lot.tons * landedCostPerKgVnd(lot.priceUsdPerKg, rates);
  }, 0);
  return totalLandedVnd / totalTons;
}

export function totalInventoryKg(lots: InventoryLot[]): number {
  return lots.reduce((sum, lot) => sum + lot.tons, 0) * 1000;
}

export interface HoldingGainLossInputs {
  /** landed cost đ/kg NẾU mua mới hôm nay (rate hiện hành của material — không phải per-lot, đây là mua GIẢ ĐỊNH tương lai). */
  replacementLandedCostPerKgVnd: number;
  /** landed cost đ/kg bình quân gia quyền TỪNG lô đã thực mua (`weightedAvgLandedCostPerKgVnd`). */
  bookLandedCostPerKgVnd: number;
  inventoryKg: number;
}

/** holdingGainLoss = (mua mới hôm nay − bình quân gia quyền) × tồn kho, cả 2 đã là landed cost đ/kg (ADR-058 — mỗi vế tính đúng thuế/phí của nó, không giả định 1 rate chung). Dương = lãi giữ kho, âm = cần dự phòng VAS 02. */
export function holdingGainLossVnd(inputs: HoldingGainLossInputs): number {
  return (inputs.replacementLandedCostPerKgVnd - inputs.bookLandedCostPerKgVnd) * inputs.inventoryKg;
}

export function provisionWarning(holdingGainLoss: number): string {
  if (holdingGainLoss < 0) {
    return 'CẢNH BÁO: giá mua mới hôm nay dưới bình quân gia quyền — cân nhắc trích dự phòng giảm giá hàng tồn kho (VAS 02) và reprice bảng giá';
  }
  return 'Giá mua mới hôm nay ≥ bình quân kho — không cần dự phòng';
}
