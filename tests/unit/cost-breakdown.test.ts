import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pipeCostLayersPerKg, fittingCostLayersPerKg } from '../../src/engine/cost-breakdown.js';
import type { PipeCostAtNormalCapacity } from '../../src/engine/pipe.js';
import type { FittingCostAtNormalCapacity } from '../../src/engine/fitting.js';

const dir = dirname(fileURLToPath(import.meta.url));
const load = (f: string) => JSON.parse(readFileSync(join(dir, '../fixtures', f), 'utf-8'));

describe('cost-breakdown — thác chi phí đ/kg (parity fixture Excel v3.4)', () => {
  it('Ống: 4 tầng cộng lại = fullCostPerKg; tầng khớp số vàng', () => {
    const fx = load('pipe.json');
    const cost = fx.costAtNormalCapacity as PipeCostAtNormalCapacity;
    const kg = fx.capacity.normalCapacityKgYear as number;
    const layers = pipeCostLayersPerKg(cost, { packagingCostPerKg: fx.params.packagingCostPerKg }, kg);

    // Tổng 4 tầng = giá thành đầy đủ engine (không lệch)
    expect(layers.cashDirect + layers.sharedOverhead + layers.depreciation + layers.material).toBeCloseTo(
      cost.fullCostPerKg,
      6,
    );
    expect(layers.total).toBeCloseTo(cost.fullCostPerKg, 6);
    // Nguyên liệu chiếm phần lớn nhất
    expect(layers.material).toBeCloseTo(95461.83, 1);
    // Gia công tiền mặt trực tiếp (nhân công+điện+nước+bảo trì+bao bì) — cỡ cảm nhận vận hành ~7,6k
    expect(layers.cashDirect).toBeCloseTo(7612.5, 0);
    expect(layers.depreciation).toBeCloseTo(3752.14, 1);
  });

  it('Phụ kiện: 4 tầng cộng lại = fullCostPerKgRef; khấu hao/kg rất cao do sản lượng bé', () => {
    const fx = load('fitting.json');
    const c = fx.costAtNormalCapacity;
    // Fixture Excel v3.4 dùng field gộp cũ (machineMoldDepreciationPerYear, bookFullCostPerKgRef)
    // — map về đúng shape engine ADR-007 (helper cộng machine+mold nên tổng khấu hao bảo toàn).
    const cost: FittingCostAtNormalCapacity = {
      ...c,
      machineDepreciationPerYear: c.machineMoldDepreciationPerYear,
      moldDepreciationPerYear: 0,
      materialPerKgFinishedRef: c.compoundLandedPerKg / fx.params.yieldRate,
      fullCostPerKgRef: c.bookFullCostPerKgRef,
    };
    const kg = fx.capacity.estimatedProductionKgYear as number;
    const layers = fittingCostLayersPerKg(cost, { packagingCostPerKg: fx.params.packagingCostPerKg }, kg);

    expect(layers.cashDirect + layers.sharedOverhead + layers.depreciation + layers.material).toBeCloseTo(
      cost.fullCostPerKgRef,
      6,
    );
    expect(layers.total).toBeCloseTo(cost.fullCostPerKgRef, 6);
    // Gia công tiền mặt trực tiếp ~14k (khớp cảm nhận giám đốc nhà máy)
    expect(layers.cashDirect).toBeCloseTo(13968.74, 1);
    // Khấu hao máy+khuôn khổng lồ vì phụ kiện chạy 1 ca × 60% → sản lượng bé
    expect(layers.depreciation).toBeCloseTo(43453.59, 1);
  });
});
