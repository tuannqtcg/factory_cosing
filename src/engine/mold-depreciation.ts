// Nguồn nghiệp vụ: ADR-007 — khấu hao khuôn phụ kiện THEO THỜI ĐIỂM MUA (time-phased),
// KHÔNG gộp 1 số tĩnh (`moldSetCostTotal66` cũ). Mỗi khuôn khấu hao riêng theo
// (purchaseYear, usefulLifeYears) — MHR (fitting.ts) tự đổi theo `asOfYear` mà
// KHÔNG cần sửa công thức mỗi lần mua khuôn mới hay khuôn cũ hết khấu hao.
import type { MoldAsset } from '../schemas/resource.js';

/**
 * Khuôn còn TRONG thời gian khấu hao tại mốc `asOfYear`.
 * - Chưa tới năm mua (`asOfYear < purchaseYear`) → false (chưa tồn tại, tránh
 *   trường hợp vô lý đánh giá quá khứ cho tài sản mua sau).
 * - Đã hết `usefulLifeYears` kể từ năm mua → false — nhưng asset KHÔNG bị loại
 *   khỏi danh sách (vẫn đang dùng sản xuất), chỉ đóng góp 0 vào khấu hao.
 */
export function isMoldAssetStillDepreciating(asset: MoldAsset, asOfYear: number): boolean {
  const yearsSincePurchase = asOfYear - asset.purchaseYear;
  return yearsSincePurchase >= 0 && yearsSincePurchase < asset.usefulLifeYears;
}

/** Σ (asset.costVnd / asset.usefulLifeYears) — chỉ cho asset còn khấu hao tại asOfYear. */
export function moldDepreciationPerYear(moldAssets: MoldAsset[], asOfYear: number): number {
  return moldAssets.reduce((sum, asset) => {
    if (!isMoldAssetStillDepreciating(asset, asOfYear)) return sum;
    return sum + asset.costVnd / asset.usefulLifeYears;
  }, 0);
}
