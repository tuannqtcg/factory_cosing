// M12.8 — màn hình Định Giá Ngược (Target Costing, vai pricing/admin), dựng
// đúng mockup Pha 1 đã duyệt (2026-07-09): 2 chế độ T2 (lợi nhuận mục tiêu,
// dạng đóng) / T3 (giá bán mục tiêu, bisection theo SKU). Khác mockup (số
// tuyến tính minh họa trên client) — MỌI kết quả ở đây là số THẬT từ HTTPS
// Callable `computeTargetCosting` (M12.4c, ADR-013) chạy `solve()`/
// `solveTargetProfit()` trên `calculateScenario()` thật; client KHÔNG lắp lại
// công thức engine (đúng ranh giới đã giữ ở Plan/PriceList).
import { useMemo, useState } from 'react';
import { fmtVnd, fmtUsd, fmtPct } from '../../lib/format.js';
import type { AppRole } from '../../lib/firebase.js';
import type { ScenarioInput, ScenarioOutput, TargetProfitResult, TargetPriceResult } from '../../schemas/scenario.js';
import { referenceMaterialOf } from '../../engine/scenario.js';
import { useTargetCosting } from './useTargetCosting.js';

type Line = 'pipe' | 'fitting';

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
      <div style={{ width: 3, height: 14, background: '#a8003b', borderRadius: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color: '#a8003b' }}>{title}</div>
      {note && <div style={{ fontSize: 9, color: '#737373', marginLeft: 4 }}>{note}</div>}
    </div>
  );
}

const segBtn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  minWidth: 70,
  padding: '7px 8px',
  border: `1px solid ${active ? '#a8003b' : '#d8d8d8'}`,
  background: active ? '#a8003b' : '#fff',
  borderRadius: 2,
  fontSize: 10,
  fontWeight: 600,
  color: active ? '#fff' : '#555',
  cursor: 'pointer',
});

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px',
  borderRadius: 12,
  border: `1px solid ${active ? '#a8003b' : '#d8d8d8'}`,
  background: active ? '#a8003b' : '#fff',
  fontSize: 10,
  fontWeight: 600,
  color: active ? '#fff' : '#555',
  cursor: 'pointer',
});

// ── Allowlist biến dò T3 hiển thị (ADR-013 mục 3) — path build khớp
//    TARGET_PRICE_FREE_VARS trong src/engine/target-costing.ts ─────────────
type FreeVarKind = 'compound' | 'utilization' | 'markupVf' | 'markupTcg' | 'listPriceMargin';
const FREE_VAR_DEFS: Array<{ id: FreeVarKind; label: string; lineFilter?: Line; needsMaterialIndex?: boolean }> = [
  { id: 'utilization', label: 'Mức huy động công suất PK', lineFilter: 'fitting' },
  { id: 'compound', label: 'Giá compound (USD/kg)', needsMaterialIndex: true },
  { id: 'markupVf', label: 'Markup VF theo nguyên liệu', needsMaterialIndex: true },
  { id: 'markupTcg', label: 'Markup TCG' },
  { id: 'listPriceMargin', label: 'Biên giá niêm yết' },
];
function buildFreeVarPath(kind: FreeVarKind, materialIndex: number): string {
  switch (kind) {
    case 'utilization':
      return 'resources.fitting.normalUtilizationFactor';
    case 'compound':
      return `materials.${materialIndex}.inventory.replacementPriceUsdPerKg`;
    case 'markupVf':
      return `materials.${materialIndex}.markupVf`;
    case 'markupTcg':
      return 'costPool.markup.markupTcg';
    case 'listPriceMargin':
      return 'costPool.markup.listPriceMargin';
  }
}
function fmtFreeVarValue(kind: FreeVarKind, v: number): string {
  return kind === 'compound' ? `${fmtUsd(v)} USD/kg` : fmtPct(v);
}

export default function TargetCosting({
  role,
  scenarioId,
  scenario,
  internal,
}: {
  role: AppRole;
  scenarioId: string;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
}) {
  const canUse = role === 'pricing' || role === 'admin';
  const { lastDoc, runTargetProfit, runTargetPrice } = useTargetCosting(scenarioId, canUse ? role : null);

  const [mode, setMode] = useState<'t2' | 't3'>('t2');

  // ── T2 state ───────────────────────────────────────────────────────────
  const [t2Line, setT2Line] = useState<Line>('pipe');
  const [t2MaterialId, setT2MaterialId] = useState<string | null>(null); // null = tham chiếu
  const [t2ProfitVnd, setT2ProfitVnd] = useState(0);
  const [t2Result, setT2Result] = useState<TargetProfitResult | null>(null);
  const [t2Loading, setT2Loading] = useState(false);
  const [t2Error, setT2Error] = useState<string | null>(null);

  // ── T3 state ───────────────────────────────────────────────────────────
  const [t3Line, setT3Line] = useState<Line>('pipe');
  const [t3SkuKey, setT3SkuKey] = useState<string | null>(null); // key = index trong danh sách filter bên dưới
  const [t3FreeVar, setT3FreeVar] = useState<FreeVarKind>('compound');
  const [t3Penetration, setT3Penetration] = useState(false);
  const [t3TargetVnd, setT3TargetVnd] = useState(260000);
  const [t3Result, setT3Result] = useState<TargetPriceResult | null>(null);
  const [t3Loading, setT3Loading] = useState(false);
  const [t3Error, setT3Error] = useState<string | null>(null);

  const t2Materials = useMemo(
    () => (scenario ? scenario.materials.filter((m) => scenario.products.some((p) => p.kind === t2Line && p.materialId === m.id)) : []),
    [scenario, t2Line],
  );

  const t3Skus = useMemo(() => {
    if (!internal) return [];
    const activeChains = internal.skuPriceChains.filter((s) => s.managementStatus === 'active');
    return activeChains.filter((s) => (t3Line === 'pipe' ? s.productKey.dn !== undefined : s.productKey.productName !== undefined));
  }, [internal, t3Line]);
  const t3ShowMaterial = useMemo(() => new Set(t3Skus.map((s) => s.productKey.materialId)).size > 1, [t3Skus]);
  const t3SelectedSku = t3Skus.find((s, i) => (t3SkuKey ?? '0') === String(i)) ?? t3Skus[0] ?? null;
  const t3MaterialIndex = scenario && t3SelectedSku ? scenario.materials.findIndex((m) => m.id === t3SelectedSku.productKey.materialId) : -1;
  const t3AvailableFreeVars = FREE_VAR_DEFS.filter((f) => !f.lineFilter || f.lineFilter === t3Line);

  if (!canUse) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Định Giá Ngược</h1>
        <p style={{ fontSize: 12, color: '#737373' }}>Màn hình này chỉ dành cho vai Định Giá / Toàn Quyền (ADR-006).</p>
      </div>
    );
  }
  if (!scenario || !internal) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản + kết quả tính…</div>;
  }

  const handleT2Submit = async () => {
    setT2Loading(true);
    setT2Error(null);
    try {
      const result = await runTargetProfit({
        scenarioId,
        productLine: t2Line,
        targetProfitVnd: t2ProfitVnd,
        // Callable JSON-encode biến `undefined` thành `null` — chỉ đưa field
        // vào object khi CÓ chọn (bỏ trống thật sự = không có key, đúng ngữ
        // nghĩa "materialId optional" của TargetProfitRequestSchema).
        ...(t2MaterialId ? { materialId: t2MaterialId } : {}),
      });
      setT2Result(result);
    } catch (err) {
      setT2Error(err instanceof Error ? err.message : String(err));
      setT2Result(null);
    } finally {
      setT2Loading(false);
    }
  };

  const handleT3Submit = async () => {
    if (!t3SelectedSku || t3MaterialIndex < 0) return;
    setT3Loading(true);
    setT3Error(null);
    try {
      const productKey =
        t3Line === 'pipe'
          ? { dn: t3SelectedSku.productKey.dn, materialId: t3SelectedSku.productKey.materialId }
          : { productName: t3SelectedSku.productKey.productName, sizeLabel: t3SelectedSku.productKey.sizeLabel, materialId: t3SelectedSku.productKey.materialId };
      const result = await runTargetPrice({
        scenarioId,
        productLine: t3Line,
        targetListPriceVnd: t3TargetVnd,
        freeVarPath: buildFreeVarPath(t3FreeVar, t3MaterialIndex),
        isPenetrationPrice: t3Penetration,
        productKey,
      });
      setT3Result(result);
    } catch (err) {
      setT3Error(err instanceof Error ? err.message : String(err));
      setT3Result(null);
    } finally {
      setT3Loading(false);
    }
  };

  const t2ResolvedMaterialName =
    (t2MaterialId ? t2Materials.find((m) => m.id === t2MaterialId) : referenceMaterialOf(scenario.materials, scenario.products, t2Line))
      ?.name ?? '—';
  const t2UnitLabel = t2Line === 'pipe' ? 'kg/năm' : 'giờ máy/năm';
  const t2Capacity = t2Line === 'pipe' ? internal.capacity.pipe.normalCapacityKgYear : internal.capacity.fitting.normalMachineHoursUtilized;
  const t2Cvp = internal.cvp.byLineMaterial.find(
    (e) => e.line === t2Line && e.materialId === (t2MaterialId ?? referenceMaterialOf(scenario.materials, scenario.products, t2Line)?.id),
  );

  const t3SkuLabel = (s: (typeof t3Skus)[number]) =>
    t3Line === 'pipe' ? s.productKey.dn! : `${s.productKey.productName} ${s.productKey.sizeLabel}`;

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>
          Hoạch Định Chiến Lược · Tầng Top-Down
        </div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Định Giá Ngược — Target Costing</h1>
        <div style={{ fontSize: 11, color: '#737373', marginTop: 4, maxWidth: 720, lineHeight: 1.5 }}>
          Nhập MỤC TIÊU (lợi nhuận kỳ vọng hoặc giá bán bị ép từ thị trường) → hệ thống giải ngược biến vận hành cần đạt
          bằng inverse solver (ADR-005) chạy XUÔI trên engine thật — mọi nghiệm đều được xác nhận lại bằng forward-verify.
        </div>
      </div>

      {lastDoc && (
        <div style={{ marginTop: 14, marginBottom: 4, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2, fontSize: 10, color: '#1d4ed8' }}>
          Lần chạy gần nhất: {lastDoc.kind === 'targetProfit' ? 'T2 · Lợi nhuận mục tiêu' : 'T3 · Giá bán mục tiêu'} —{' '}
          {lastDoc.kind === 'targetProfit'
            ? `dòng ${lastDoc.request.productLine === 'pipe' ? 'Ống' : 'Phụ kiện'}, mục tiêu ${fmtVnd(lastDoc.request.targetProfitVnd)} đ`
            : lastDoc.result.feasible
              ? `mục tiêu ${fmtVnd(lastDoc.request.targetListPriceVnd)} đ, khả thi`
              : `mục tiêu ${fmtVnd(lastDoc.request.targetListPriceVnd)} đ, không khả thi`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, margin: '18px 0 18px', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', width: 'fit-content', background: '#fff' }}>
        {(
          [
            ['t2', 'T2 · Lợi Nhuận Mục Tiêu'],
            ['t3', 'T3 · Giá Bán Mục Tiêu'],
          ] as const
        ).map(([id, label], i) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            style={{
              border: 'none',
              borderRight: i === 0 ? '1px solid #d8d8d8' : 'none',
              background: mode === id ? '#a8003b' : 'transparent',
              color: mode === id ? '#fff' : '#737373',
              padding: '11px 22px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 't2' && (
        <div>
          <SectionHeader title="Lợi nhuận mục tiêu → sản lượng cần đạt" note="Dạng đóng — CVP (M8), không cần bisection" />
          <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,.04)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '280px 1fr' }}>
            <div style={{ padding: 20, borderRight: '1px solid #f0f0f0', background: '#f5f5f3' }}>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Dòng sản phẩm</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={segBtn(t2Line === 'pipe')} onClick={() => { setT2Line('pipe'); setT2MaterialId(null); }}>Ống CPVC</button>
                  <button style={segBtn(t2Line === 'fitting')} onClick={() => { setT2Line('fitting'); setT2MaterialId(null); }}>Phụ Kiện</button>
                </div>
              </label>
              {t2Materials.length > 1 && (
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Nguyên liệu (bỏ trống = tham chiếu)</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {t2Materials.map((m) => (
                      <button key={m.id} style={pillBtn(t2MaterialId === m.id)} onClick={() => setT2MaterialId(m.id)}>{m.name}</button>
                    ))}
                  </div>
                </label>
              )}
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Lợi nhuận mục tiêu (đ/năm)</span>
                <input
                  type="number"
                  value={t2ProfitVnd}
                  step={100000000}
                  onChange={(e) => setT2ProfitVnd(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, outline: 'none' }}
                />
                <div style={{ fontSize: 9, color: '#737373', marginTop: 4 }}>0 = tìm đúng sản lượng hòa vốn.</div>
              </label>
              <button
                onClick={() => void handleT2Submit()}
                disabled={t2Loading}
                style={{ width: '100%', padding: '10px 14px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 2, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                {t2Loading ? 'Đang tính…' : 'Tính'}
              </button>
              {t2Error && <div style={{ marginTop: 10, fontSize: 10, color: '#DC2626' }}>{t2Error}</div>}
            </div>
            <div>
              {!t2Result && !t2Loading && (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: '#b3b3b3', fontSize: 11 }}>Nhập lợi nhuận mục tiêu rồi bấm "Tính".</div>
              )}
              {t2Loading && <div style={{ padding: '60px 24px', textAlign: 'center', color: '#737373', fontSize: 11 }}>Đang tính CVP…</div>}
              {t2Result && !t2Loading && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
                    <div style={{ padding: 16, borderRight: '1px solid #f5f5f5' }}>
                      <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Sản lượng cần đạt</div>
                      <div style={{ fontSize: 21, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(t2Result.requiredQtyKgOrMachineHours)}</div>
                      <div style={{ fontSize: 9, color: '#737373', marginTop: 4 }}>{t2UnitLabel} · nguyên liệu {t2ResolvedMaterialName}</div>
                    </div>
                    <div style={{ padding: 16, borderRight: '1px solid #f5f5f5' }}>
                      <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Số ca cần</div>
                      <div style={{ fontSize: 21, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {t2Result.requiredShifts.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ca
                      </div>
                      <div style={{ fontSize: 9, color: '#737373', marginTop: 4 }}>CS bình thường {fmtVnd(t2Capacity)} {t2UnitLabel} tại 3 ca</div>
                    </div>
                    <div style={{ padding: 16 }}>
                      <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Q hòa vốn (lợi nhuận=0)</div>
                      <div style={{ fontSize: 21, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t2Cvp ? fmtVnd(t2Cvp.breakEvenKgYear) : '—'}</div>
                      <div style={{ fontSize: 9, color: '#737373', marginTop: 4 }}>kg/năm · số vàng CVP (M8)</div>
                    </div>
                  </div>
                  <div
                    style={{
                      margin: 16,
                      padding: '10px 14px',
                      borderRadius: 2,
                      border: `1px solid ${t2Result.feasibleWithinNormalCapacity ? '#16A34A' : '#DC2626'}`,
                      background: t2Result.feasibleWithinNormalCapacity ? '#f0fdf4' : '#fef2f2',
                      color: t2Result.feasibleWithinNormalCapacity ? '#16A34A' : '#DC2626',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {t2Result.feasibleWithinNormalCapacity
                      ? 'KHẢ THI trong công suất bình thường'
                      : 'VƯỢT công suất bình thường — cần tăng ca / đầu tư thêm (đối chiếu Kế Hoạch SX)'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 't3' && (
        <div>
          <SectionHeader title="Giá bán mục tiêu → biến vận hành cần đạt" note="Bisection trên forward function — nghiệm luôn forward-verify" />
          <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,.04)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '280px 1fr' }}>
            <div style={{ padding: 20, borderRight: '1px solid #f0f0f0', background: '#f5f5f3' }}>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Dòng sản phẩm</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={segBtn(t3Line === 'pipe')} onClick={() => { setT3Line('pipe'); setT3SkuKey(null); setT3FreeVar('compound'); }}>Ống CPVC</button>
                  <button style={segBtn(t3Line === 'fitting')} onClick={() => { setT3Line('fitting'); setT3SkuKey(null); setT3FreeVar('compound'); }}>Phụ Kiện</button>
                </div>
              </label>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Chọn SKU</span>
                <select
                  value={t3SkuKey ?? '0'}
                  onChange={(e) => {
                    setT3SkuKey(e.target.value);
                    const sku = t3Skus[parseInt(e.target.value, 10)];
                    if (sku) setT3TargetVnd(sku.chain.listPriceBeforeVat);
                  }}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 12, outline: 'none', background: '#fff' }}
                >
                  {t3Skus.map((s, i) => (
                    <option key={`${t3SkuLabel(s)}|${s.productKey.materialId}`} value={i}>
                      {t3SkuLabel(s)}
                      {t3ShowMaterial ? ` · ${s.productKey.materialId}` : ''} — hiện tại {fmtVnd(s.chain.listPriceBeforeVat)} đ
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Biến dò (allowlist ADR-013)</span>
                <select
                  value={t3FreeVar}
                  onChange={(e) => setT3FreeVar(e.target.value as FreeVarKind)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 12, outline: 'none', background: '#fff' }}
                >
                  {t3AvailableFreeVars.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 10px', background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, marginBottom: 14 }}>
                <input type="checkbox" checked={t3Penetration} onChange={(e) => setT3Penetration(e.target.checked)} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 600 }}>Giá bị ép từ thị trường / đấu thầu</div>
                  <div style={{ fontSize: 9, color: '#737373', marginTop: 2, lineHeight: 1.4 }}>Chỉ khác nguồn gốc mục tiêu — dùng chung 1 cơ chế giải ngược (ADR-013 mục 5).</div>
                </div>
              </label>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Giá niêm yết mục tiêu (đ, trước VAT)</span>
                <input
                  type="number"
                  value={t3TargetVnd}
                  step={1000}
                  onChange={(e) => setT3TargetVnd(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, outline: 'none' }}
                />
              </label>
              <button
                onClick={() => void handleT3Submit()}
                disabled={t3Loading || !t3SelectedSku}
                style={{ width: '100%', padding: '10px 14px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 2, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                {t3Loading ? 'Đang giải ngược…' : 'Giải ngược'}
              </button>
              {t3Error && <div style={{ marginTop: 10, fontSize: 10, color: '#DC2626' }}>{t3Error}</div>}
            </div>
            <div>
              {!t3Result && !t3Loading && (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: '#b3b3b3', fontSize: 11 }}>Chọn SKU + biến dò rồi bấm "Giải ngược".</div>
              )}
              {t3Loading && <div style={{ padding: '60px 24px', textAlign: 'center', color: '#737373', fontSize: 11 }}>Đang giải ngược (bisection trên engine thật)…</div>}
              {t3Result && !t3Loading && t3SelectedSku && (
                t3Result.feasible ? (
                  <>
                    <div style={{ margin: 16, padding: '10px 14px', borderRadius: 2, border: '1px solid #16A34A', background: '#f0fdf4', color: '#16A34A', fontSize: 11, fontWeight: 700 }}>
                      KHẢ THI — nghiệm hội tụ trong dải cho phép
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)' }}>
                      <div style={{ padding: '0 16px 16px', borderRight: '1px solid #f5f5f5' }}>
                        <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{FREE_VAR_DEFS.find((f) => f.id === t3FreeVar)?.label}</div>
                        <div style={{ fontSize: 21, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtFreeVarValue(t3FreeVar, t3Result.value)}</div>
                      </div>
                      <div style={{ padding: '0 16px 16px' }}>
                        <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Giá niêm yết mục tiêu</div>
                        <div style={{ fontSize: 21, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(t3TargetVnd)} đ</div>
                      </div>
                    </div>
                    <div style={{ margin: '0 16px 16px', border: '1px dashed #d8d8d8', borderRadius: 2, padding: 14, background: '#fafaf8' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#737373', marginBottom: 10 }}>
                        ✓ Forward-verify — chạy XUÔI lại calculateScenario() với nghiệm vừa tìm
                      </div>
                      {(() => {
                        const verifySku = t3Result.forwardOutput.skuPriceChains.find(
                          (s) =>
                            s.productKey.materialId === t3SelectedSku.productKey.materialId &&
                            (t3Line === 'pipe' ? s.productKey.dn === t3SelectedSku.productKey.dn : s.productKey.productName === t3SelectedSku.productKey.productName && s.productKey.sizeLabel === t3SelectedSku.productKey.sizeLabel),
                        );
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                            <div style={{ padding: '6px 10px', border: '1px solid #d8d8d8', borderRadius: 2, background: '#fff' }}>
                              <div style={{ fontSize: 8.5, color: '#737373', textTransform: 'uppercase' }}>Biến đã set</div>
                              <div style={{ fontWeight: 700, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{fmtFreeVarValue(t3FreeVar, t3Result.value)}</div>
                            </div>
                            <span style={{ color: '#b3b3b3' }}>→</span>
                            <div style={{ padding: '6px 10px', border: '1px solid #16A34A', background: '#f0fdf4', borderRadius: 2 }}>
                              <div style={{ fontSize: 8.5, color: '#737373', textTransform: 'uppercase' }}>listPriceBeforeVat ({t3SkuLabel(t3SelectedSku)})</div>
                              <div style={{ fontWeight: 700, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{verifySku ? fmtVnd(verifySku.chain.listPriceBeforeVat) : '—'} đ</div>
                            </div>
                            <span style={{ color: '#b3b3b3' }}>=?</span>
                            <div style={{ padding: '6px 10px', border: '1px solid #d8d8d8', borderRadius: 2, background: '#fff' }}>
                              <div style={{ fontSize: 8.5, color: '#737373', textTransform: 'uppercase' }}>Mục tiêu</div>
                              <div style={{ fontWeight: 700, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(t3TargetVnd)} đ</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ margin: 16, padding: '10px 14px', borderRadius: 2, border: '1px solid #DC2626', background: '#fef2f2', color: '#DC2626', fontSize: 11, fontWeight: 700 }}>
                      KHÔNG KHẢ THI — mục tiêu ngoài dải đạt được của biến này
                    </div>
                    <div style={{ margin: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #DC2626', borderRadius: 2, fontSize: 10.5, color: '#7f1d1d' }}>
                      <b>Khoảng đạt được:</b> {fmtVnd(Math.min(...t3Result.achievableRange))} đ → {fmtVnd(Math.max(...t3Result.achievableRange))} đ.{' '}
                      {t3Result.reason}
                    </div>
                  </>
                )
              )}
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 9.5, color: '#737373', lineHeight: 1.5, padding: '8px 10px', background: '#f5f5f3', border: '1px solid #f0f0f0', borderRadius: 2 }}>
            Biến nguyên "số ca" (<code>shifts</code>) chưa vào allowlist v1 — hoãn tới khi có màn hình cần
            <code> solveDiscrete()</code> (ADR-013 cuối mục).
          </div>
        </div>
      )}
    </div>
  );
}
