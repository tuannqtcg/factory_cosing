// Nguồn nghiệp vụ: ADR-008 — ren kim loại (đồng thau) là dòng NGUYÊN VẬT LIỆU
// THỨ 2 cho SKU họ "Nối ren trong/ngoài" (11/91, xem ADR-007 cho 7 SKU
// Cút/Tê ren trong còn `pending_mold` — CHƯA có giá ren xác nhận, không tính
// ở đây). Ren kim loại mua VND TRONG NƯỚC — KHÔNG có bước landed cost/thuế NK
// như compound (khác `pipe.ts`/`fitting.ts`), và granularity đúng là
// (renType, ptSize) — 10 loại, KHÔNG phải 11 loại theo SKU (2 SKU nhựa khác
// nhau có thể dùng chung 1 loại ren, xem `docs/contracts/product.md`).
//
// Còn treo (milestone sau — xem docs/PHASE3_PLAN.md):
// - `compoundPricingPriceUsdPerKg`/`insertPricingPriceVnd` nhận trực tiếp làm
//   input — ở tầng gọi thật (M-orchestration), 2 giá trị này đến từ
//   `evaluatePriceLock()` (M5, DÙNG LẠI NGUYÊN — không viết price-lock riêng
//   cho ren, chỉ khác policy/threshold, xem tests/parity/metal-insert.test.ts).
import { landedCostPerKgVnd, type LandedCostRates } from './cost-pool.js';

export interface FittingMaterialCostPerUnitInputs {
  unitWeightKg: number;
  compoundPricingPriceUsdPerKg: number;
  yieldRate: number;
  packagingCostPerKg: number;
  insertQtyPerUnit: number;
  insertPricingPriceVnd: number;
  /** ADR-012 — thuế NK/phí HQ theo NGUYÊN LIỆU của SKU (trước đây lấy từ CurrencyParams chung). */
  landedRates: LandedCostRates;
  /**
   * ADR-060 — chi phí bao bì/cái khi ScenarioInput.fittingPackagingMethod =
   * 'per_box' (= resource.packagingBoxCostVnd ÷ product.piecesPerBox), THAY
   * cho số hạng `unitWeightKg × packagingCostPerKg`. undefined (mặc định) =
   * giữ nguyên công thức cũ theo kg — khớp Excel v3.4 (parity).
   */
  packagingCostPerUnitOverride?: number;
}

/**
 * materialCostPerUnit CHO MỌI SKU phụ kiện (§3.4, dùng chung cả 91 SKU — không
 * riêng họ ren dù tên hàm cũ gợi ý vậy) = phần nhựa + bao bì + insertQtyPerUnit
 * × insertPricingPriceVnd (ADR-008 mục 3, = 0 với SKU không ren) — THAY cho
 * hằng số tĩnh `brassInsertCost` cộng riêng ở `breakEvenPerUnit`.
 */
export function calculateFittingMaterialCostPerUnit(inputs: FittingMaterialCostPerUnitInputs): number {
  const compoundLandedPerKg = landedCostPerKgVnd(inputs.compoundPricingPriceUsdPerKg, inputs.landedRates);
  const packagingCostPerUnit = inputs.packagingCostPerUnitOverride ?? inputs.unitWeightKg * inputs.packagingCostPerKg;
  const plasticCostPerUnit = inputs.unitWeightKg * (compoundLandedPerKg / inputs.yieldRate) + packagingCostPerUnit;
  return plasticCostPerUnit + inputs.insertQtyPerUnit * inputs.insertPricingPriceVnd;
}

export interface MetalInsertLot {
  qtyOnHand: number;
  unitPriceVnd: number;
}

/** Bình quân gia quyền ren kim loại — null nếu Σqty=0 (ADR-008 mục 1, đối xứng dual-costing.ts nhưng đơn vị "cái" thay vì "tấn"). */
export function weightedAvgInsertPriceVnd(lots: MetalInsertLot[]): number | null {
  const totalQty = lots.reduce((sum, lot) => sum + lot.qtyOnHand, 0);
  if (totalQty === 0) return null;
  const totalValueVnd = lots.reduce((sum, lot) => sum + lot.qtyOnHand * lot.unitPriceVnd, 0);
  return totalValueVnd / totalQty;
}

/**
 * Lãi/(lỗ) giữ kho ren kim loại — CÙNG Ý NGHĨA công thức compound (ADR-002),
 * nhưng KHÔNG nhân (1+importTax+logistics)×usdVndRate vì ren mua VND trong
 * nước, không có bước landed cost/thuế NK (ADR-008 mục 3) — viết hàm riêng
 * thay vì gọi `dual-costing.ts:holdingGainLossVnd()` để tránh phải truyền
 * tham số giả (rate=0/1) chỉ để vô hiệu hóa phần quy đổi ngoại tệ.
 */
export function metalInsertHoldingGainLossVnd(
  replacementPriceVnd: number,
  weightedAvgPriceVnd: number,
  qtyOnHand: number,
): number {
  return (replacementPriceVnd - weightedAvgPriceVnd) * qtyOnHand;
}
