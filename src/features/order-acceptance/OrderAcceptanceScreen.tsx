// ADR-029 — màn "Quyết Định Nhận Đơn" (tab `order-acceptance`, nhóm Phân Tích &
// Quyết Định). CEO nhập đơn (dòng SP, sản lượng, giá chào) → verdict NHẬN/CÂN NHẮC/
// KHÔNG + biên đóng góp, so 2 sàn (giá thị trường vs giá vốn khóa) + panel khóa giá
// what-if (chỉnh ngưỡng TẠM, không lưu — đổi chính thức ở tab Tham Số). Đọc engine
// đã đóng băng qua `decideOrder`.
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import { decideOrder } from '../../engine/order-acceptance.js';
import { fmtVnd, fmtUsd, fmtPct } from '../../lib/format.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 1e9) + ' tỷ';

const VERDICT: Record<string, { label: string; color: string; bg: string; note: string }> = {
  accept: { label: '✅ NÊN NHẬN', color: '#16A34A', bg: '#f0fdf4', note: 'Giá chào bù đủ giá thành đầy đủ (cả định phí) — có lãi.' },
  consider: { label: '⚠ CÂN NHẮC', color: '#b45309', bg: '#fffbeb', note: 'Trên sàn tiền tươi nhưng dưới giá thành đầy đủ — CHỈ nhận nếu còn công suất trống (đóng góp bù định phí), đừng để lấn đơn giá tốt.' },
  reject: { label: '⛔ KHÔNG NÊN NHẬN', color: '#DC2626', bg: '#fef2f2', note: 'Giá chào dưới sàn tiền tươi tại giá thị trường — làm là lỗ ngay tiền mặt (mua NL mới còn không đủ).' },
};

function Num({ label, value, unit, color, strong }: { label: string; value: string; unit?: string; color?: string; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: strong ? 18 : 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}{unit && <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}> {unit}</span>}</div>
    </div>
  );
}

export default function OrderAcceptanceScreen({ scenario }: { scenario: ScenarioInput | null }) {
  const [line, setLine] = useState<'pipe' | 'fitting'>('pipe');
  const [quantityTons, setQuantityTons] = useState(50);
  const [offeredPrice, setOfferedPrice] = useState(130000);
  const [thresholdOverride, setThresholdOverride] = useState<number | null>(null);

  const result = useMemo(
    () =>
      scenario
        ? decideOrder(scenario, {
            line,
            quantityTons,
            offeredPriceVndPerKg: offeredPrice,
            ...(thresholdOverride != null ? { thresholdPctWhatIf: thresholdOverride } : {}),
          })
        : null,
    [scenario, line, quantityTons, offeredPrice, thresholdOverride],
  );

  if (!scenario || !result) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản…</div>;
  }

  const v = VERDICT[result.verdict]!;
  const thr = result.lock.thresholdPct;
  const setLineReset = (l: 'pipe' | 'fitting') => { setLine(l); setThresholdOverride(null); };

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373' }}>Quyết Định Nhận Đơn</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 700 }}>Đơn này có nên nhận không?</h1>
      <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>
        So giá chào với sàn tiền tươi + giá thành đầy đủ. <b>Đơn mới phải mua nguyên liệu mới</b> → sàn chuẩn tính theo <b>giá thị trường (tái tạo)</b>, không phải giá vốn cũ đã khóa.
      </p>

      {/* Nhập đơn */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 16, background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, padding: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', marginBottom: 4 }}>Dòng sản phẩm</div>
          <div style={{ display: 'flex', border: '1px solid #b3b3b3', borderRadius: 2, overflow: 'hidden' }}>
            {([['pipe', 'Ống CPVC'], ['fitting', 'Phụ kiện']] as const).map(([id, lbl]) => (
              <div key={id} onClick={() => setLineReset(id)} style={{ padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: line === id ? '#a8003b' : '#fff', color: line === id ? '#fff' : '#1a1a1a', borderRight: '1px solid #d8d8d8' }}>{lbl}</div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', marginBottom: 4 }}>Sản lượng đơn (tấn)</div>
          <input type="number" value={quantityTons} onChange={(e) => setQuantityTons(Number(e.target.value) || 0)} style={{ width: 110, padding: '7px 10px', fontSize: 14, fontWeight: 700, border: '1px solid #b3b3b3', borderRadius: 2, outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', marginBottom: 4 }}>Giá chào (đ/kg)</div>
          <input type="number" value={offeredPrice} onChange={(e) => setOfferedPrice(Number(e.target.value) || 0)} style={{ width: 130, padding: '7px 10px', fontSize: 14, fontWeight: 700, border: '1px solid #b3b3b3', borderRadius: 2, outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
        </div>
      </div>

      {/* Verdict */}
      <div style={{ marginTop: 16, padding: '16px 18px', borderRadius: 8, border: `1px solid ${v.color}`, background: v.bg }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: v.color }}>{v.label}</div>
          <div style={{ fontSize: 13, color: v.color, fontWeight: 600 }}>
            Đóng góp {fmtVnd(result.contributionPerKgVnd)} đ/kg · cả đơn {fmtTy(result.contributionTotalVnd)} đ
            {result.verdict === 'accept' && ` · lãi so giá thành đầy đủ ${fmtTy(result.profitVsFullCostTotalVnd)} đ`}
          </div>
        </div>
        <div style={{ fontSize: 11, color: v.color, marginTop: 6 }}>{v.note}</div>
      </div>

      {/* So sánh sàn */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 16 }}>
        <div style={{ background: '#1a1a1a', color: '#fff', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 9, color: '#ff9db8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Sàn tiền tươi — giá THỊ TRƯỜNG</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(result.marketVariableFloorVndPerKg)} <span style={{ fontSize: 10, color: '#999' }}>đ/kg</span></div>
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>Biến phí khi mua NL mới. Bán dưới mức này = lỗ tiền tươi. <b>Sàn chuẩn cho đơn mới.</b></div>
        </div>
        <div style={{ background: '#faf8f2', border: '1px solid #e5e0d0', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em' }}>Giá thành đầy đủ — thị trường</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(result.marketFullCostVndPerKg)} <span style={{ fontSize: 10, color: '#999' }}>đ/kg</span></div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>Bù cả định phí. Trên mức này là lãi thực sự.</div>
        </div>
        <div style={{ background: '#faf8f2', border: '1px solid #e5e0d0', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em' }}>Sàn tiền tươi — giá vốn KHÓA</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(result.lockedVariableFloorVndPerKg)} <span style={{ fontSize: 10, color: '#999' }}>đ/kg</span></div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>Chỉ đúng nếu làm đơn bằng <b>hàng tồn đã có</b> (không mua bù).</div>
        </div>
      </div>

      {/* Panel khóa giá what-if */}
      <div style={{ background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#737373', textTransform: 'uppercase', marginBottom: 12 }}>
          Khóa giá — {result.materialName} <span style={{ fontWeight: 400, textTransform: 'none' }}>(thử ngưỡng, không lưu cấu hình)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
          <Num label="Giá vốn khóa (baseline)" value={fmtUsd(result.lock.baselineUsdPerKg)} unit="USD/kg" />
          <Num label="Giá thị trường (tái tạo)" value={fmtUsd(result.lock.replacementUsdPerKg)} unit="USD/kg" />
          <Num label="Độ lệch" value={fmtPct(result.lock.deviationPct)} color={Math.abs(result.lock.deviationPct) > thr ? '#DC2626' : '#16A34A'} />
          <Num label={`Trạng thái tại ngưỡng ${fmtPct(thr)}`} value={result.lock.isLocked ? 'ĐANG KHÓA' : 'MỞ KHÓA'} color={result.lock.isLocked ? '#16A34A' : '#DC2626'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#737373', minWidth: 130 }}>Ngưỡng khóa giá (thử):</span>
          <input type="range" min={0} max={30} step={1} value={Math.round(thr * 100)} onChange={(e) => setThresholdOverride(Number(e.target.value) / 100)} style={{ flex: 1, minWidth: 180, accentColor: '#a8003b' }} />
          <span style={{ fontSize: 13, fontWeight: 700, width: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtPct(thr)}</span>
          {thresholdOverride != null && (
            <button onClick={() => setThresholdOverride(null)} style={{ fontSize: 10, padding: '4px 8px', border: '1px solid #d8d8d8', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#555' }}>Về ngưỡng cấu hình</button>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#404040', marginTop: 10, padding: '9px 12px', background: '#faf8f2', borderRadius: 6 }}>
          Ở ngưỡng {fmtPct(thr)}: giá niêm yết áp dụng ={' '}
          <b>{fmtUsd(result.lock.appliedPricingUsdPerKg)} USD/kg</b>{' '}
          ({result.lock.isLocked ? 'giữ giá vốn khóa cũ' : 'chuyển sang giá thị trường'}).{' '}
          <b>Dù bảng giá niêm yết còn khóa hay không, đơn MỚI vẫn phải mua NL ở giá thị trường</b> — nên verdict trên đây luôn tính theo sàn thị trường. Đổi ngưỡng chính thức (ảnh hưởng toàn bảng giá): vào tab <b>Tham Số</b>.
        </div>
      </div>
    </div>
  );
}
