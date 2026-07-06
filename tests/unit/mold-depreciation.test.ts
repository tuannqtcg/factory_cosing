// Test hành vi ĐỘNG của khấu hao khuôn theo asOfYear (ADR-007) — dữ liệu thật
// hiện tại (66 khuôn, purchaseYear=2026 toàn bộ) KHÔNG đủ để phân biệt logic
// lọc có đúng hay không (mọi khuôn cùng lịch khấu hao) — cần asset TỔNG HỢP
// với purchaseYear/usefulLifeYears khác nhau để chứng minh lọc CHỌN LỌC đúng.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isMoldAssetStillDepreciating,
  moldDepreciationPerYear,
} from '../../src/engine/mold-depreciation.js';
import type { MoldAsset } from '../../src/schemas/resource.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf-8')) as T;
}

function mold(overrides: Partial<MoldAsset>): MoldAsset {
  return {
    id: 'mold-test',
    label: 'test',
    producesSkus: [{ productName: 'X', sizeLabel: '20' }],
    cavity: 1,
    costUsd: 0,
    costVnd: 100_000_000,
    purchaseYear: 2026,
    usefulLifeYears: 5,
    ...overrides,
  };
}

describe('isMoldAssetStillDepreciating (ADR-007)', () => {
  it('năm đầu tiên (asOfYear === purchaseYear) → còn khấu hao', () => {
    expect(isMoldAssetStillDepreciating(mold({ purchaseYear: 2026, usefulLifeYears: 5 }), 2026)).toBe(true);
  });

  it('năm cuối trong vòng đời (asOfYear − purchaseYear = usefulLifeYears − 1) → còn khấu hao', () => {
    expect(isMoldAssetStillDepreciating(mold({ purchaseYear: 2026, usefulLifeYears: 5 }), 2030)).toBe(true);
  });

  it('đúng mốc hết vòng đời (asOfYear − purchaseYear = usefulLifeYears) → hết khấu hao', () => {
    expect(isMoldAssetStillDepreciating(mold({ purchaseYear: 2026, usefulLifeYears: 5 }), 2031)).toBe(false);
  });

  it('quá hạn nhiều năm → vẫn hết khấu hao (không âm)', () => {
    expect(isMoldAssetStillDepreciating(mold({ purchaseYear: 2026, usefulLifeYears: 5 }), 2040)).toBe(false);
  });

  it('trước năm mua (asOfYear < purchaseYear) → chưa tồn tại, không tính', () => {
    expect(isMoldAssetStillDepreciating(mold({ purchaseYear: 2028, usefulLifeYears: 5 }), 2027)).toBe(false);
  });
});

describe('moldDepreciationPerYear — lọc CHỌN LỌC theo từng asset (không phải tất-cả-hoặc-không)', () => {
  it('3 khuôn mua 3 năm khác nhau, đời sống khác nhau — chỉ cộng đúng 2 khuôn còn hạn tại asOfYear=2029', () => {
    const assets: MoldAsset[] = [
      mold({ id: 'a', costVnd: 100_000_000, purchaseYear: 2020, usefulLifeYears: 5 }), // hết hạn 2025 → loại tại 2029
      mold({ id: 'b', costVnd: 200_000_000, purchaseYear: 2026, usefulLifeYears: 5 }), // hết hạn 2031 → còn tại 2029
      mold({ id: 'c', costVnd: 300_000_000, purchaseYear: 2029, usefulLifeYears: 3 }), // mua đúng năm 2029 → còn
    ];
    const total = moldDepreciationPerYear(assets, 2029);
    // Chỉ b (200tr/5=40tr) và c (300tr/3=100tr) — a bị loại vì hết hạn.
    expect(total).toBeCloseTo(200_000_000 / 5 + 300_000_000 / 3, 6);
  });

  it('mọi asset hết hạn → tổng = 0, KHÔNG throw (asset không bị loại khỏi mảng, chỉ đóng góp 0)', () => {
    const assets: MoldAsset[] = [
      mold({ purchaseYear: 2010, usefulLifeYears: 5 }),
      mold({ purchaseYear: 2015, usefulLifeYears: 3 }),
    ];
    expect(moldDepreciationPerYear(assets, 2026)).toBe(0);
  });
});

describe('moldDepreciationPerYear trên dữ liệu thật (mold-assets.json, ADR-007)', () => {
  const moldAssets = loadFixture<any>('mold-assets.json').moldAssets as MoldAsset[];

  it('asOfYear=2026 (năm mua gốc) — khớp tuyệt đối Σ costVnd/5 = moldSetCostTotal66/5', () => {
    const total = moldDepreciationPerYear(moldAssets, 2026);
    expect(total).toBeCloseTo(6_542_850_000 / 5, 3); // 1.308.570.000 — xem session log Phiên 5 (verify machineMoldDepreciationPerYear)
  });

  it('asOfYear=2030 (năm cuối vòng đời 5 năm, purchaseYear=2026) — vẫn còn khấu hao, khớp năm gốc', () => {
    expect(moldDepreciationPerYear(moldAssets, 2030)).toBeCloseTo(6_542_850_000 / 5, 3);
  });

  it('asOfYear=2031 (hết vòng đời 5 năm) — TOÀN BỘ 66 khuôn hết khấu hao, tổng về 0', () => {
    expect(moldDepreciationPerYear(moldAssets, 2031)).toBe(0);
  });
});
