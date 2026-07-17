// Pha 3 (ADR-022 §5) — AI tư vấn MOCK rule-based (pure, không network). Dùng
// làm (a) fallback khi callable adviseScenario lỗi/chưa cấu hình Claude API,
// (b) test được bằng npm test. Bản thật (Cloud Function) bọc quanh, ưu tiên
// Claude API khi có secret. Port từ prototype ceo-planner.html::adviceFor.
import type { CeoPlannerResult, CeoLineResult, CeoAdviceResult, CeoAdviceItem } from '../schemas/ceo-planner.js';

const fmtVnd = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v) + ' đ/kg';
const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v / 1e9) + ' tỷ đ';
const fmtPct = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v) + '%';

function lineAdvice(line: CeoLineResult): CeoAdviceItem[] {
  const items: CeoAdviceItem[] = [];
  const { variableCostFloor: t1, cashBreakEven: t2, fullCost: t3, enterpriseBreakEven: t4 } = line.ladder;
  const price = line.sellingPriceVndPerKg;
  const name = line.line === 'pipe' ? 'Ống CPVC' : 'Phụ kiện';
  if (price < t1)
    items.push({ topic: 'pricing_floor', message: `${name}: giá ${fmtVnd(price)} đang DƯỚI sàn biến phí ${fmtVnd(t1)} — từ chối mức này; mỗi kg ký là mất tiền mặt thật.` });
  else if (price < t4)
    items.push({
      topic: 'pricing_floor',
      message: `${name}: giá ${fmtVnd(price)} nằm giữa bậc ${price < t2 ? '1–2' : price < t3 ? '2–3' : '3–4'} thang giá. Khi bị ép: lùi tối đa về ${fmtVnd(t4)} (hòa vốn toàn DN) cho đơn thường, ${fmtVnd(t2)} (hòa vốn tiền mặt) chỉ cho đơn chiến lược có thời hạn.`,
    });
  else
    items.push({ topic: 'pricing_floor', message: `${name}: giá ${fmtVnd(price)} trên hòa vốn toàn DN (${fmtVnd(t4)}) — dư địa nhượng bộ ${fmtVnd(price - t4)}/kg trước khi chạm vùng nguy hiểm.` });

  if (Number.isFinite(line.breakEvenPctOfCapacity)) {
    const be = line.breakEvenPctOfCapacity;
    const tail = be < 30 ? ' — biên an toàn rất dày, phần công suất còn lại toàn bộ là lãi biên' : be > 70 ? ' — biên an toàn MỎNG, một hợp đồng lớn rớt là lỗ; cân nhắc markup cao hơn' : '';
    items.push({ topic: 'capacity_safety', message: `${name} — an toàn công suất: chỉ cần chạy ${fmtPct(be)} công suất kịch bản là hòa vốn${tail}.` });
  }
  return items;
}

/** Sinh nhận định từ kết quả planner (không cần scenario thô). */
export function generateCeoAdviceMock(result: CeoPlannerResult): CeoAdviceResult {
  const items: CeoAdviceItem[] = [...lineAdvice(result.pipe), ...lineAdvice(result.fitting)];

  items.push({
    topic: 'material_risk',
    message:
      'Rủi ro giá nguyên liệu: compound tăng thì giá thành tăng theo tỷ lệ ~1/hiệu suất thu hồi. Cơ chế khóa bảng giá đặt ngưỡng ±3% (ADR-004) — hợp đồng bán dài hạn nên chốt song song hợp đồng mua compound hoặc cài điều khoản trượt giá.',
  });

  const s = result.summary;
  items.push({
    topic: 'payback',
    message:
      s.paybackYears === null
        ? 'Thu hồi vốn: dòng tiền năm ≤ 0 nên KHÔNG hồi vốn ở giá/kịch bản này — nâng markup hoặc sản lượng cam kết trước khi ký.'
        : `Độ tin cậy thu hồi vốn ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(s.paybackYears)} năm: mô hình đi thuê mặt bằng (đã tính vào chi phí) nên vốn đầu tư không gồm nhà xưởng — hợp lý; nhưng vốn lưu động tạm = 0, đây là cận dưới lạc quan. Tiền thuê tăng theo năm ăn thẳng vào lợi nhuận — nên khóa giá thuê nhiều năm khi đàm phán.`,
  });

  items.push({
    topic: 'yearly_picture',
    message:
      s.preTaxProfitVnd >= 0
        ? `Bức tranh năm: lợi nhuận trước thuế ${fmtTy(s.preTaxProfitVnd)} (${fmtPct(s.preTaxProfitMarginPct)} doanh thu), sau thuế TNDN 20% còn ~${fmtTy(s.netProfitVnd)} — ${s.paybackYears !== null && s.paybackYears < 1.5 ? 'dòng tiền đủ hấp dẫn để cân nhắc tăng ca/thêm khuôn' : 'ở mức chấp nhận được; ưu tiên đơn markup cao hơn trước khi thêm công suất'}.`
        : `Bức tranh năm: LỖ trước thuế ${fmtTy(s.preTaxProfitVnd)} — mức markup này không nuôi nổi bộ máy; nâng markup hoặc tăng sản lượng cam kết trước khi ký.`,
  });

  return {
    generatedByModel: 'mock',
    items,
    disclaimer: 'Nhận định sinh bằng luật cứng (mock). Thuế TNDN 20% là ước tính. Bản đầy đủ dùng Claude API phía server (ADR-022).',
  };
}
