// Nguồn nghiệp vụ: docs/BUSINESS_MODEL.md §1, §5 — ADR-002 (giá vốn kép: bình
// quân gia quyền sổ sách vs giá tái tạo định giá), mở rộng bởi ADR-008 (ren
// kim loại — cùng công thức, tồn kho/policy riêng).
export interface InventoryLot {
  tons: number;
  priceUsdPerKg: number;
}

/** Bình quân gia quyền — null nếu không có lô nào (Σtons=0), gọi phải tự fallback về replacementPriceUsd (BUSINESS_MODEL §1). */
export function weightedAvgUsdPerKg(lots: InventoryLot[]): number | null {
  const totalTons = lots.reduce((sum, lot) => sum + lot.tons, 0);
  if (totalTons === 0) return null;
  const totalValueUsd = lots.reduce((sum, lot) => sum + lot.tons * lot.priceUsdPerKg, 0);
  return totalValueUsd / totalTons;
}

export function totalInventoryKg(lots: InventoryLot[]): number {
  return lots.reduce((sum, lot) => sum + lot.tons, 0) * 1000;
}

export interface HoldingGainLossInputs {
  replacementPriceUsdPerKg: number;
  weightedAvgUsdPerKg: number;
  inventoryKg: number;
  compoundImportTaxRate: number;
  customsLogisticsFeeRate: number;
  usdVndRate: number;
}

/** holdingGainLoss = (tái tạo − bình quân) × tồn kho, quy đổi landed cost. Dương = lãi giữ kho, âm = cần dự phòng VAS 02. */
export function holdingGainLossVnd(inputs: HoldingGainLossInputs): number {
  const deltaUsd = (inputs.replacementPriceUsdPerKg - inputs.weightedAvgUsdPerKg) * inputs.inventoryKg;
  return deltaUsd * (1 + inputs.compoundImportTaxRate + inputs.customsLogisticsFeeRate) * inputs.usdVndRate;
}

export function provisionWarning(holdingGainLoss: number): string {
  if (holdingGainLoss < 0) {
    return 'CẢNH BÁO: giá tái tạo dưới bình quân gia quyền — cân nhắc trích dự phòng giảm giá hàng tồn kho (VAS 02) và reprice bảng giá';
  }
  return 'Giá tái tạo ≥ bình quân kho — không cần dự phòng';
}
