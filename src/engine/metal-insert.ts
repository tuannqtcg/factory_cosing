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
import type { CurrencyParams } from '../schemas/cost-pool.js';
import { landedCostPerKgVnd } from './cost-pool.js';

export interface MaterialCostPerUnitWithInsertInputs {
  unitWeightKg: number;
  compoundPricingPriceUsdPerKg: number;
  yieldRate: number;
  packagingCostPerKg: number;
  insertQtyPerUnit: number;
  insertPricingPriceVnd: number;
  currency: Pick<CurrencyParams, 'compoundImportTaxRate' | 'customsLogisticsFeeRate' | 'usdVndRate'>;
}

/**
 * materialCostPerUnit (họ ren) = phần nhựa (CÙNG công thức mọi SKU phụ kiện,
 * §3.4) + insertQtyPerUnit × insertPricingPriceVnd (ADR-008 mục 3) — THAY cho
 * hằng số tĩnh `brassInsertCost` cộng riêng ở `breakEvenPerUnit`.
 */
export function materialCostPerUnitWithInsert(inputs: MaterialCostPerUnitWithInsertInputs): number {
  const compoundLandedPerKg = landedCostPerKgVnd(inputs.compoundPricingPriceUsdPerKg, inputs.currency);
  const plasticCostPerUnit = inputs.unitWeightKg * (compoundLandedPerKg / inputs.yieldRate + inputs.packagingCostPerKg);
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
