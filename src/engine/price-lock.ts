// Nguồn nghiệp vụ: docs/BUSINESS_MODEL.md §1a — ADR-004 (khóa bảng giá baseline
// + ngưỡng), mở rộng bởi ADR-008 (ren kim loại, cùng công thức, policy riêng).
// Verify: tests/fixtures/price-lock-scenarios.json (5 kịch bản nghiệm thu).
//
// Dùng CHUNG cho compound (USD, Ống/Phụ kiện) và ren kim loại (VND) — cả 2 chỉ
// khác đơn vị tiền, không khác công thức, nên KHÔNG cần 2 hàm riêng (khớp
// PriceLockPolicySchema/PriceLockEvaluationSchema trong src/schemas/pricing-chain.ts,
// vốn dùng chung 1 factory function cho cả 2 policy).
export interface EvaluatePriceLockInputs {
  baseline: number;
  thresholdPct: number; // dạng thập phân — 0.03 = 3% (xem cảnh báo đơn vị ở pricing-chain.ts)
  replacement: number;
  /** Giá đợt nhập gần nhất — dùng riêng cho cảnh báo staleness, ĐỘC LẬP với khóa/mở khóa. */
  lastLotPrice?: number | null;
}

export interface PriceLockEvaluation {
  replacement: number;
  deviationPct: number;
  isLocked: boolean;
  pricingPrice: number;
  stalenessWarning: string | null;
}

export function evaluatePriceLock(inputs: EvaluatePriceLockInputs): PriceLockEvaluation {
  const { baseline, thresholdPct, replacement, lastLotPrice } = inputs;

  const deviationPct = replacement / baseline - 1;
  const isLocked = Math.abs(deviationPct) <= thresholdPct;
  const pricingPrice = isLocked ? baseline : replacement;

  let stalenessWarning: string | null = null;
  if (lastLotPrice != null && lastLotPrice !== 0) {
    const stalenessDeviationPct = replacement / lastLotPrice - 1;
    if (Math.abs(stalenessDeviationPct) > thresholdPct) {
      stalenessWarning = 'GIÁ TÁI TẠO CÓ THỂ CŨ — lệch quá ngưỡng so với đợt nhập gần nhất';
    }
  }

  return { replacement, deviationPct, isLocked, pricingPrice, stalenessWarning };
}
