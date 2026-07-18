// ADR-029 + ADR-036 — màn "Quyết Định Nhận Đơn". CEO nhập đơn theo SẢN PHẨM CỤ
// THỂ và ĐƠN VỊ THƯƠNG MẠI (ống: mét, phụ kiện: cái) đúng cách khách đặt hàng —
// màn tự quy về kg bằng đơn trọng trong danh mục rồi gọi engine `decideOrder`
// (engine đóng băng, vẫn tính sàn đ/kg theo dòng SP). Verdict NHẬN/CÂN NHẮC/
// KHÔNG + biên đóng góp, so 2 sàn (giá thị trường vs giá vốn khóa) + panel khóa
// giá what-if (chỉnh ngưỡng TẠM, không lưu — đổi chính thức ở tab Tham Số).
import { useEffect, useMemo, useState } from 'react';
import type { PriceListDoc, ScenarioInput } from '../../schemas/scenario.js';
import { managementStatusOf } from '../../schemas/product.js';
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

interface SkuOption {
  key: string;
  line: 'pipe' | 'fitting';
  group: string; // 'Ống CPVC' hoặc tên phụ kiện
  sizeLabel: string; // nhãn size (kèm tên nguyên liệu khi trùng size khác compound)
  weightKgPerUnit: number; // đơn trọng: kg/mét (ống) hoặc kg/cái (phụ kiện)
  unitLabel: string; // 'mét' | 'cái'
  materialId: string;
  dn?: string;
  productName?: string;
  fittingSize?: string;
}

export default function OrderAcceptanceScreen({
  scenario,
  priceList = null,
  onNavigate,
}: {
  scenario: ScenarioInput | null;
  /** ADR-036 — để gợi ý sẵn giá chào = giá VF đang niêm yết của SKU đã chọn. */
  priceList?: PriceListDoc | null;
  /** ADR-034 — link chéo theo mạch làm việc (đơn dính lô giá lệch → xem Giá Vốn Theo Lô). */
  onNavigate?: (tab: string) => void;
}) {
  // ADR-036 — danh mục chọn SKU theo đơn vị thương mại. Chỉ phụ kiện đã có khuôn.
  const options = useMemo<SkuOption[]>(() => {
    if (!scenario) return [];
    const moldAssets = scenario.resources.fitting.driverType === 'machine_hour' ? scenario.resources.fitting.moldAssets : [];
    const matName = (id: string) => scenario.materials.find((m) => m.id === id)?.name ?? id;
    const opts: SkuOption[] = [];
    for (const p of scenario.products) {
      if (p.kind === 'pipe') {
        const dupDn = scenario.products.some((q) => q.kind === 'pipe' && q.dn === p.dn && q.materialId !== p.materialId);
        opts.push({
          key: `pipe|${p.materialId}|${p.dn}`,
          line: 'pipe',
          group: 'Ống CPVC',
          sizeLabel: dupDn ? `${p.dn} · ${matName(p.materialId)}` : p.dn,
          weightKgPerUnit: p.unitWeightKgPerM,
          unitLabel: 'mét',
          materialId: p.materialId,
          dn: p.dn,
        });
      } else {
        if (managementStatusOf(p, moldAssets) !== 'active') continue; // chưa có khuôn — chưa bán được
        const dup = scenario.products.some(
          (q) => q.kind === 'fitting' && q.productName === p.productName && q.sizeLabel === p.sizeLabel && q.materialId !== p.materialId,
        );
        opts.push({
          key: `fit|${p.materialId}|${p.productName}|${p.sizeLabel}`,
          line: 'fitting',
          group: p.productName,
          sizeLabel: dup ? `${p.sizeLabel} · ${matName(p.materialId)}` : p.sizeLabel,
          weightKgPerUnit: p.unitWeightKg,
          unitLabel: 'cái',
          materialId: p.materialId,
          productName: p.productName,
          fittingSize: p.sizeLabel,
        });
      }
    }
    return opts;
  }, [scenario]);
  const groups = useMemo(() => [...new Set(options.map((o) => o.group))], [options]);

  const [group, setGroup] = useState<string | null>(null);
  const [skuKey, setSkuKey] = useState<string | null>(null);
  const activeGroup = group ?? groups[0] ?? '';
  const groupOptions = options.filter((o) => o.group === activeGroup);
  const sku = groupOptions.find((o) => o.key === skuKey) ?? groupOptions[0] ?? null;

  const [qtyUnits, setQtyUnits] = useState(1000);
  const [offeredPerUnit, setOfferedPerUnit] = useState(0);
  const [thresholdOverride, setThresholdOverride] = useState<number | null>(null);

  // Giá VF đang niêm yết của SKU đã chọn — gợi ý sẵn làm giá chào ban đầu.
  const listedVf = useMemo(() => {
    if (!sku || !priceList) return null;
    const entry = priceList.skuPriceChains.find((s) =>
      s.productKey.materialId === sku.materialId &&
      (sku.line === 'pipe' ? s.productKey.dn === sku.dn : s.productKey.productName === sku.productName && s.productKey.sizeLabel === sku.fittingSize),
    );
    return entry ? entry.chain.vfPricePerUnit : null;
  }, [sku, priceList]);
  useEffect(() => {
    if (listedVf !== null) setOfferedPerUnit(listedVf);
  }, [listedVf]);

  // Quy đổi thương mại → kg cho engine (đơn trọng từ danh mục sản phẩm).
  const weight = sku?.weightKgPerUnit ?? 0;
  const quantityTons = (qtyUnits * weight) / 1000;
  const offeredPerKg = weight > 0 ? offeredPerUnit / weight : 0;

  const result = useMemo(
    () =>
      scenario && sku && offeredPerKg > 0
        ? decideOrder(scenario, {
            line: sku.line,
            quantityTons,
            offeredPriceVndPerKg: offeredPerKg,
            ...(thresholdOverride != null ? { thresholdPctWhatIf: thresholdOverride } : {}),
          })
        : null,
    [scenario, sku, quantityTons, offeredPerKg, thresholdOverride],
  );

  if (!scenario || !sku) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản…</div>;
  }

  const v = result ? VERDICT[result.verdict]! : null;
  const thr = result?.lock.thresholdPct ?? 0;
  const perUnit = (vndPerKg: number) => vndPerKg * weight; // sàn đ/kg → đ/mét|đ/cái của SKU này

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373' }}>Quyết Định Nhận Đơn</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 700 }}>Đơn này có nên nhận không?</h1>
      <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>
        So giá chào với sàn tiền tươi + giá thành đầy đủ. <b>Đơn mới phải mua nguyên liệu mới</b> → sàn chuẩn tính theo <b>giá thị trường (tái tạo)</b>, không phải giá vốn cũ đã khóa.
        {onNavigate && (
          <>
            {' '}Kho đang lãi/lỗ giữ bao nhiêu so với giá thị trường —{' '}
            <span onClick={() => onNavigate('lot-costing')} style={{ color: '#a8003b', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
              xem Giá Vốn Theo Lô →
            </span>
          </>
        )}
      </p>

      {/* Nhập đơn — theo sản phẩm cụ thể + đơn vị thương mại (ADR-036) */}
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', marginBottom: 4 }}>Sản phẩm</div>
            <select
              value={activeGroup}
              onChange={(e) => { setGroup(e.target.value); setSkuKey(null); }}
              style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, border: '1px solid #b3b3b3', borderRadius: 2, outline: 'none', background: '#fff', minWidth: 160 }}
            >
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', marginBottom: 4 }}>Kích cỡ</div>
            <select
              value={sku.key}
              onChange={(e) => setSkuKey(e.target.value)}
              style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, border: '1px solid #b3b3b3', borderRadius: 2, outline: 'none', background: '#fff', minWidth: 120 }}
            >
              {groupOptions.map((o) => <option key={o.key} value={o.key}>{o.sizeLabel}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', marginBottom: 4 }}>Số lượng ({sku.unitLabel})</div>
            <input type="number" value={qtyUnits} onChange={(e) => setQtyUnits(Number(e.target.value) || 0)} style={{ width: 110, padding: '7px 10px', fontSize: 14, fontWeight: 700, border: '1px solid #b3b3b3', borderRadius: 2, outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', marginBottom: 4 }}>Giá khách chào (đ/{sku.unitLabel})</div>
            <input type="number" value={offeredPerUnit} onChange={(e) => setOfferedPerUnit(Number(e.target.value) || 0)} style={{ width: 130, padding: '7px 10px', fontSize: 14, fontWeight: 700, border: '1px solid #b3b3b3', borderRadius: 2, outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#737373', marginTop: 10, padding: '8px 12px', background: '#faf8f2', borderRadius: 6 }}>
          Quy đổi: {new Intl.NumberFormat('vi-VN').format(qtyUnits)} {sku.unitLabel} × {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(weight)} kg/{sku.unitLabel} ={' '}
          <b>{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(quantityTons)} tấn</b> · giá chào tương đương <b>{fmtVnd(Math.round(offeredPerKg))} đ/kg</b>
          {listedVf !== null && <> · giá VF đang niêm yết: <b>{fmtVnd(listedVf)} đ/{sku.unitLabel}</b></>}
        </div>
      </div>

      {result && v && (<>
      {/* Verdict */}
      <div style={{ marginTop: 16, padding: '16px 18px', borderRadius: 8, border: `1px solid ${v.color}`, background: v.bg }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: v.color }}>{v.label}</div>
          <div style={{ fontSize: 13, color: v.color, fontWeight: 600 }}>
            Mỗi {sku.unitLabel} góp {fmtVnd(Math.round(perUnit(result.contributionPerKgVnd)))} đ · cả đơn {fmtTy(result.contributionTotalVnd)} đ
            {result.verdict === 'accept' && ` · lãi so giá thành đầy đủ ${fmtTy(result.profitVsFullCostTotalVnd)} đ`}
          </div>
        </div>
        <div style={{ fontSize: 11, color: v.color, marginTop: 6 }}>{v.note}</div>
      </div>

      {/* So sánh sàn — đ/kg là gốc engine; kèm quy đổi đ/mét|đ/cái của SKU đang chọn */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 16 }}>
        <div style={{ background: '#1a1a1a', color: '#fff', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 9, color: '#ff9db8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Sàn tiền tươi — giá THỊ TRƯỜNG</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(Math.round(perUnit(result.marketVariableFloorVndPerKg)))} <span style={{ fontSize: 10, color: '#999' }}>đ/{sku.unitLabel}</span></div>
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>({fmtVnd(result.marketVariableFloorVndPerKg)} đ/kg) Biến phí khi mua NL mới. Bán dưới mức này = lỗ tiền tươi. <b>Sàn chuẩn cho đơn mới.</b></div>
        </div>
        <div style={{ background: '#faf8f2', border: '1px solid #e5e0d0', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em' }}>Giá thành đầy đủ — thị trường</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(Math.round(perUnit(result.marketFullCostVndPerKg)))} <span style={{ fontSize: 10, color: '#999' }}>đ/{sku.unitLabel}</span></div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>({fmtVnd(result.marketFullCostVndPerKg)} đ/kg) Bù cả định phí. Trên mức này là lãi thực sự.</div>
        </div>
        <div style={{ background: '#faf8f2', border: '1px solid #e5e0d0', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em' }}>Sàn tiền tươi — giá vốn KHÓA</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(Math.round(perUnit(result.lockedVariableFloorVndPerKg)))} <span style={{ fontSize: 10, color: '#999' }}>đ/{sku.unitLabel}</span></div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>({fmtVnd(result.lockedVariableFloorVndPerKg)} đ/kg) Chỉ đúng nếu làm đơn bằng <b>hàng tồn đã có</b> (không mua bù).</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#999', marginTop: 6 }}>
        Sàn tính theo dòng sản phẩm ({sku.line === 'pipe' ? 'Ống CPVC' : 'Phụ kiện'}, nguyên liệu {result.materialName}); quy về đ/{sku.unitLabel} theo đơn trọng {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(weight)} kg/{sku.unitLabel} của {sku.group} {sku.sizeLabel}.
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
        {thresholdOverride != null && onNavigate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8, padding: '8px 12px', background: '#fffbeb', border: '1px solid #b45309', borderRadius: 6 }}>
            <span style={{ flex: 1, minWidth: 260, fontSize: 11, color: '#92400e', fontWeight: 600 }}>
              Đây mới là con số THỬ — chưa có hiệu lực. Thấy ngưỡng {fmtPct(thr)} là đúng và muốn áp dụng chính thức?
            </span>
            <button
              onClick={() => onNavigate('assumptions')}
              style={{ flexShrink: 0, padding: '6px 12px', background: '#b45309', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              → Chốt ở màn Tham Số
            </button>
          </div>
        )}
        <div style={{ fontSize: 11, color: '#404040', marginTop: 10, padding: '9px 12px', background: '#faf8f2', borderRadius: 6 }}>
          Ở ngưỡng {fmtPct(thr)}: giá niêm yết áp dụng ={' '}
          <b>{fmtUsd(result.lock.appliedPricingUsdPerKg)} USD/kg</b>{' '}
          ({result.lock.isLocked ? 'giữ giá vốn khóa cũ' : 'chuyển sang giá thị trường'}).{' '}
          <b>Dù bảng giá niêm yết còn khóa hay không, đơn MỚI vẫn phải mua NL ở giá thị trường</b> — nên verdict trên đây luôn tính theo sàn thị trường. Đổi ngưỡng chính thức (ảnh hưởng toàn bảng giá): vào tab <b>Tham Số</b>.
        </div>
      </div>
      </>)}
    </div>
  );
}
