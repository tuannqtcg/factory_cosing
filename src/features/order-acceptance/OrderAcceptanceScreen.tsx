// ADR-029 + ADR-036 + ADR-037 — màn "Quyết Định Nhận Đơn". Một ĐƠN HÀNG NHIỀU
// DÒNG đúng thực tế: mỗi dòng một sản phẩm (ống BlazeMaster/Corzan, phụ kiện…),
// số lượng theo đơn vị thương mại (mét/cái), giá chào đ/mét|đ/cái. UI quy về kg
// bằng đơn trọng danh mục rồi gọi engine `decideOrder` TỪNG DÒNG (kèm materialId
// — ADR-037 để dòng Corzan tính sàn theo Corzan), tổng hợp cả đơn từ tổng các
// dòng. Panel khóa giá what-if (ngưỡng tạm, không lưu — đổi chính thức ở Tham Số).
import { useMemo, useState } from 'react';
import type { PriceListDoc, ScenarioInput } from '../../schemas/scenario.js';
import { managementStatusOf } from '../../schemas/product.js';
import { decideOrder } from '../../engine/order-acceptance.js';
import type { OrderDecisionResult } from '../../schemas/order-acceptance.js';
import { fmtVnd, fmtUsd, fmtPct } from '../../lib/format.js';
import TermInfo from '../shell/TermInfo.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 1e9) + ' tỷ';
const fmtNum = (v: number, digits = 1) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(v);

const VERDICT: Record<string, { label: string; short: string; color: string; bg: string; note: string }> = {
  accept: { label: '✅ NÊN NHẬN', short: '✅ Nhận', color: '#16A34A', bg: '#f0fdf4', note: 'Giá chào bù đủ giá thành đầy đủ (cả định phí) — có lãi.' },
  consider: { label: '⚠ CÂN NHẮC', short: '⚠ Cân nhắc', color: '#b45309', bg: '#fffbeb', note: 'Trên sàn tiền tươi nhưng dưới giá thành đầy đủ — CHỈ nhận nếu còn công suất trống (đóng góp bù định phí), đừng để lấn đơn giá tốt.' },
  reject: { label: '⛔ KHÔNG NÊN NHẬN', short: '⛔ Không', color: '#DC2626', bg: '#fef2f2', note: 'Giá chào dưới sàn tiền tươi tại giá thị trường — làm là lỗ ngay tiền mặt (mua NL mới còn không đủ).' },
};

function Num({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}{unit && <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}> {unit}</span>}</div>
    </div>
  );
}

interface SkuOption {
  key: string;
  line: 'pipe' | 'fitting';
  group: string;
  sizeLabel: string;
  weightKgPerUnit: number;
  unitLabel: string; // 'mét' | 'cái'
  materialId: string;
  dn?: string;
  productName?: string;
  fittingSize?: string;
}

interface OrderItem {
  id: number;
  group: string | null;
  skuKey: string | null;
  qtyUnits: number;
  /** null = chưa gõ tay → tự lấy giá VF đang niêm yết của SKU. */
  offeredPerUnit: number | null;
}

export default function OrderAcceptanceScreen({
  scenario,
  priceList = null,
  onNavigate,
}: {
  scenario: ScenarioInput | null;
  priceList?: PriceListDoc | null;
  onNavigate?: (tab: string) => void;
}) {
  // Danh mục chọn SKU (chỉ phụ kiện đã có khuôn; ống mọi nguyên liệu).
  const options = useMemo<SkuOption[]>(() => {
    if (!scenario) return [];
    const moldAssets = scenario.resources.fitting.driverType === 'machine_hour' ? scenario.resources.fitting.moldAssets : [];
    const matName = (id: string) => scenario.materials.find((m) => m.id === id)?.name ?? id;
    const opts: SkuOption[] = [];
    for (const p of scenario.products) {
      if (p.kind === 'pipe') {
        opts.push({
          key: `pipe|${p.materialId}|${p.dn}`,
          line: 'pipe',
          group: 'Ống CPVC',
          // Luôn hiện đủ tiêu chuẩn + nguyên liệu — DN20 SDR 13.5 BlazeMaster
          // và DN20 SCH40 Corzan là 2 sản phẩm khác hẳn nhau.
          sizeLabel: `DN${p.dn.replace(/^DN/i, '')} · ${p.spec} · ${matName(p.materialId)}`,
          weightKgPerUnit: p.unitWeightKgPerM,
          unitLabel: 'mét',
          materialId: p.materialId,
          dn: p.dn,
        });
      } else {
        if (managementStatusOf(p, moldAssets) !== 'active') continue;
        opts.push({
          key: `fit|${p.materialId}|${p.productName}|${p.sizeLabel}`,
          line: 'fitting',
          group: p.productName,
          sizeLabel: `${p.sizeLabel}${p.schedule ? ` · ${p.schedule}` : ''} · ${matName(p.materialId)}`,
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

  const [items, setItems] = useState<OrderItem[]>([{ id: 1, group: null, skuKey: null, qtyUnits: 1000, offeredPerUnit: null }]);
  const [nextId, setNextId] = useState(2);
  const [thresholdOverride, setThresholdOverride] = useState<number | null>(null);
  // ADR-051 — chi phí setup một lần / dòng (đổi khuôn, khởi động máy). Rải trên
  // tổng sản lượng từng dòng → đơn nhỏ bị phạt. 0 = như cũ (biên tế thuần).
  const [setupCostVnd, setSetupCostVnd] = useState(0);

  const listedVfOf = (sku: SkuOption): number | null => {
    if (!priceList) return null;
    const entry = priceList.skuPriceChains.find((s) =>
      s.productKey.materialId === sku.materialId &&
      (sku.line === 'pipe' ? s.productKey.dn === sku.dn : s.productKey.productName === sku.productName && s.productKey.sizeLabel === sku.fittingSize),
    );
    return entry ? entry.chain.vfPricePerUnit : null;
  };

  // Tính từng dòng: SKU đã chọn → quy kg → engine (materialId theo dòng, ADR-037).
  const rows = useMemo(() => {
    if (!scenario) return [];
    return items.map((item) => {
      const group = item.group && groups.includes(item.group) ? item.group : groups[0] ?? '';
      const groupOpts = options.filter((o) => o.group === group);
      const sku = groupOpts.find((o) => o.key === item.skuKey) ?? groupOpts[0] ?? null;
      if (!sku) return null;
      const offered = item.offeredPerUnit ?? listedVfOf(sku) ?? 0;
      const tons = (item.qtyUnits * sku.weightKgPerUnit) / 1000;
      const offeredPerKg = sku.weightKgPerUnit > 0 ? offered / sku.weightKgPerUnit : 0;
      let result: OrderDecisionResult | null = null;
      if (offeredPerKg > 0 && tons > 0) {
        result = decideOrder(scenario, {
          line: sku.line,
          materialId: sku.materialId,
          quantityTons: tons,
          offeredPriceVndPerKg: offeredPerKg,
          setupCostVnd,
          ...(thresholdOverride != null ? { thresholdPctWhatIf: thresholdOverride } : {}),
        });
      }
      return { item, group, groupOpts, sku, offered, tons, offeredPerKg, result };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, [scenario, items, options, groups, thresholdOverride, setupCostVnd, priceList]);

  if (!scenario || rows.length === 0) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản…</div>;
  }

  // Tổng hợp cả đơn từ tổng các dòng (cùng logic sàn của engine, áp ở mức tổng).
  const withResult = rows.filter((r) => r.result);
  const totalTons = withResult.reduce((s, r) => s + r.tons, 0);
  const totalRevenue = withResult.reduce((s, r) => s + r.offered * r.item.qtyUnits, 0);
  const totalContribution = withResult.reduce((s, r) => s + r.result!.contributionTotalVnd, 0);
  const totalProfitVsFull = withResult.reduce((s, r) => s + r.result!.profitVsFullCostTotalVnd, 0);
  const overall = totalProfitVsFull >= 0 ? 'accept' : totalContribution >= 0 ? 'consider' : 'reject';
  const v = VERDICT[overall]!;
  const thr = thresholdOverride ?? withResult[0]?.result?.lock.thresholdPct ?? 0;

  // Khóa giá theo từng nguyên liệu có mặt trong đơn (không lặp).
  const lockRows = [...new Map(withResult.map((r) => [r.result!.materialId, r.result!])).values()];

  const update = (id: number, patch: Partial<OrderItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373' }}>Quyết Định Nhận Đơn</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 700 }}>Đơn này có nên nhận không?</h1>
      <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>
        Nhập đơn đúng như khách đặt — nhiều dòng sản phẩm, số mét (ống) / số cái (phụ kiện), giá chào theo mét/cái.
        {' '}<b>Đơn mới phải mua nguyên liệu mới</b> → sàn tính theo <b>giá thị trường</b> của đúng nguyên liệu từng dòng.
        {onNavigate && (
          <>
            {' '}Kho đang lãi/lỗ giữ bao nhiêu —{' '}
            <span onClick={() => onNavigate('lot-costing')} style={{ color: '#a8003b', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
              xem Giá Vốn Theo Lô →
            </span>
          </>
        )}
      </p>

      {/* Các dòng đơn */}
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 90px 120px 110px 110px 96px 30px', gap: 8, padding: '9px 14px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5' }}>
          {(['Sản phẩm', 'Kích cỡ', 'Số lượng', 'Giá chào (đ/đv)', 'Sàn tiền tươi', 'Giá thành đủ', 'Kết luận', ''] as const).map((h, i) => (
            <div key={i} style={{ fontSize: 9, fontWeight: 700, color: '#737373', textTransform: 'uppercase', textAlign: i >= 2 && i <= 5 ? 'right' : 'left', display: 'flex', justifyContent: i >= 2 && i <= 5 ? 'flex-end' : 'flex-start', gap: 4, alignItems: 'center' }}>
              {h}
              {h === 'Sàn tiền tươi' && <TermInfo term="cash-floor" />}
              {h === 'Giá thành đủ' && <TermInfo term="full-cost" />}
            </div>
          ))}
        </div>
        {rows.map(({ item, group, groupOpts, sku, offered, result }) => {
          const perUnit = (vndPerKg: number) => Math.round(vndPerKg * sku.weightKgPerUnit);
          const rv = result ? VERDICT[result.verdict]! : null;
          const sel: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 12, fontWeight: 600, border: '1px solid #d8d8d8', borderRadius: 2, outline: 'none', background: '#fff' };
          const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 13, fontWeight: 700, border: '1px solid #d8d8d8', borderRadius: 2, outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
          return (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 90px 120px 110px 110px 96px 30px', gap: 8, padding: '8px 14px', borderBottom: '1px solid #f5f5f5', alignItems: 'center' }}>
              <select value={group} onChange={(e) => update(item.id, { group: e.target.value, skuKey: null, offeredPerUnit: null })} style={sel}>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={sku.key} onChange={(e) => update(item.id, { skuKey: e.target.value, offeredPerUnit: null })} style={sel}>
                {groupOpts.map((o) => <option key={o.key} value={o.key}>{o.sizeLabel}</option>)}
              </select>
              <div style={{ position: 'relative' }}>
                <input type="number" value={item.qtyUnits} onChange={(e) => update(item.id, { qtyUnits: Number(e.target.value) || 0 })} style={inp} />
                <div style={{ fontSize: 8.5, color: '#b3b3b3', textAlign: 'right', marginTop: 1 }}>{sku.unitLabel}</div>
              </div>
              <div>
                <input type="number" value={offered} onChange={(e) => update(item.id, { offeredPerUnit: Number(e.target.value) || 0 })} style={inp} />
                <div style={{ fontSize: 8.5, color: '#b3b3b3', textAlign: 'right', marginTop: 1 }}>
                  {item.offeredPerUnit === null ? 'giá VF niêm yết' : `niêm yết ${listedVfOf(sku) !== null ? fmtVnd(listedVfOf(sku)!) : '—'}`}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#404040' }}>
                {result ? <>{fmtVnd(perUnit(result.marketVariableFloorVndPerKg))}<span style={{ fontSize: 9, color: '#b3b3b3' }}> đ/{sku.unitLabel}</span></> : '—'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#404040' }}>
                {result ? <>{fmtVnd(perUnit(result.marketFullCostVndPerKg))}<span style={{ fontSize: 9, color: '#b3b3b3' }}> đ/{sku.unitLabel}</span></> : '—'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: rv?.color ?? '#999' }}>{rv?.short ?? '—'}</div>
              <button
                onClick={() => setItems((xs) => (xs.length > 1 ? xs.filter((x) => x.id !== item.id) : xs))}
                title="Xóa dòng"
                style={{ background: 'none', border: 'none', color: '#b3b3b3', fontSize: 14, cursor: items.length > 1 ? 'pointer' : 'default', opacity: items.length > 1 ? 1 : 0.3 }}
              >✕</button>
            </div>
          );
        })}
        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setItems((xs) => [...xs, { id: nextId, group: null, skuKey: null, qtyUnits: 100, offeredPerUnit: null }]); setNextId((n) => n + 1); }}
            style={{ padding: '7px 14px', background: '#fff', color: '#0a0a0a', border: '1px dashed #b3b3b3', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            + Thêm dòng sản phẩm
          </button>
          <label style={{ fontSize: 11, color: '#737373', display: 'flex', alignItems: 'center', gap: 6 }} title="Chi phí một lần để chạy mỗi dòng (đổi khuôn/khởi động máy). Rải trên tổng sản lượng dòng → đơn nhỏ gánh setup/kg lớn, verdict xuống.">
            Chi phí setup / dòng
            <input type="number" value={setupCostVnd} onChange={(e) => setSetupCostVnd(Number(e.target.value) || 0)}
              style={{ width: 110, padding: '5px 8px', fontSize: 12, fontWeight: 700, textAlign: 'right', border: '1px solid #d8d8d8', borderRadius: 4, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
            <span style={{ color: '#b3b3b3' }}>đ</span>
          </label>
          <div style={{ fontSize: 11, color: '#737373', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Cả đơn: <b>{fmtNum(totalTons)} tấn</b> · trị giá chào <b>{fmtVnd(Math.round(totalRevenue))} đ</b></span>
            <TermInfo term="market-ceiling" label="Giá trần nằm ở đâu?" />
          </div>
        </div>
      </div>

      {/* Kết luận cả đơn */}
      {withResult.length > 0 && (
        <div style={{ marginTop: 16, padding: '16px 18px', borderRadius: 8, border: `1px solid ${v.color}`, background: v.bg }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: v.color }}>{v.label}</div>
            <div style={{ fontSize: 13, color: v.color, fontWeight: 600 }}>
              Cả đơn góp {fmtTy(totalContribution)} đ tiền tươi · so giá thành đầy đủ {fmtTy(totalProfitVsFull)} đ
            </div>
          </div>
          <div style={{ fontSize: 11, color: v.color, marginTop: 6 }}>
            {v.note} {rows.some((r) => r.result && r.result.verdict !== overall) && 'Kết luận từng dòng khác nhau — xem cột "Kết luận" để mặc cả đúng dòng đang kéo cả đơn xuống.'}
            {setupCostVnd > 0 && ` · Đã tính chi phí setup ${fmtVnd(setupCostVnd)} đ/dòng — đơn càng nhỏ, setup/kg càng nặng.`}
          </div>
        </div>
      )}

      {/* Khóa giá what-if — theo từng nguyên liệu có trong đơn */}
      {lockRows.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e0d0', borderRadius: 8, padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#737373', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            Khóa giá theo nguyên liệu trong đơn <span style={{ fontWeight: 400, textTransform: 'none' }}>(thử ngưỡng, không lưu cấu hình)</span>
            <TermInfo term="locked-floor" />
          </div>
          {lockRows.map((r) => (
            <div key={r.materialId} style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(4, 1fr)', gap: 14, marginBottom: 10, alignItems: 'end' }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{r.materialName}</div>
              <Num label="Giá vốn khóa" value={fmtUsd(r.lock.baselineUsdPerKg)} unit="USD/kg" />
              <Num label="Giá thị trường" value={fmtUsd(r.lock.replacementUsdPerKg)} unit="USD/kg" />
              <Num label="Độ lệch" value={fmtPct(r.lock.deviationPct)} color={Math.abs(r.lock.deviationPct) > thr ? '#DC2626' : '#16A34A'} />
              <Num label={`Tại ngưỡng ${fmtPct(thr)}`} value={r.lock.isLocked ? 'ĐANG KHÓA' : 'MỞ KHÓA'} color={r.lock.isLocked ? '#16A34A' : '#DC2626'} />
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
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
                onClick={() => onNavigate('data-setup')}
                style={{ flexShrink: 0, padding: '6px 12px', background: '#b45309', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                → Chốt ở Thiết Lập Dữ Liệu
              </button>
            </div>
          )}
          <div style={{ fontSize: 10.5, color: '#737373', marginTop: 10, lineHeight: 1.5 }}>
            <b>Dù bảng giá niêm yết còn khóa hay không, đơn MỚI vẫn phải mua nguyên liệu ở giá thị trường</b> — nên kết luận trên đây luôn tính theo sàn thị trường của đúng nguyên liệu từng dòng.
            Sàn của mỗi dòng quy về đ/mét hoặc đ/cái theo đơn trọng của chính sản phẩm đó.
          </div>
        </div>
      )}
    </div>
  );
}
