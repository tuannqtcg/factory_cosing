// ADR-059 — màn "Nguyên Liệu" (tab `materials`): thay thế Giá Vốn Theo Lô (đọc-only,
// ADR-024) + vai trò "chốt lại giá" trước đây nằm ở Thiết Lập Dữ Liệu mục ④ (ADR-057).
// Danh sách 1 dòng/nguyên liệu → bấm mở SlideOverPanel: baseline/giá mua mới hôm
// nay/bình quân gia quyền/trạng thái khóa + lô (bấm 1 lô → panel con lồng, cấp 2)
// + nút "Chốt baseline". Mọi số đọc thẳng từ `internal`/dual-costing đã đóng băng —
// KHÔNG công thức mới. Ghi (chốt baseline / sửa lô) theo ĐÚNG pattern các màn khác:
// validate `ScenarioInputSchema.safeParse` rồi `setDoc` toàn bộ scenario.
// Thao tác hiếm (thêm nguyên liệu mới, ren kim loại mua ngoài) VẪN ở màn cũ
// `InventoryScreen` — mở qua nút "Quản lý nâng cao →" cuối trang, không nhân bản.
import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { fmtVnd, fmtUsd, fmtPct } from '../../lib/format.js';
import { ScenarioInputSchema, type ScenarioInput, type ScenarioOutput } from '../../schemas/scenario.js';
import type { CompoundInventory } from '../../schemas/pricing-chain.js';
import { weightedAvgUsdPerKg, weightedAvgLandedCostPerKgVnd, totalInventoryKg } from '../../engine/dual-costing.js';
import SlideOverPanel, { PanelStat } from '../shell/SlideOverPanel.js';
import TermInfo from '../shell/TermInfo.js';

const KG_STEP = 100; // bước nhảy ô nhập kg (nhất quán PR#33 — lưu trữ vẫn ở field `tons`)

function lineLabelOf(scenario: ScenarioInput, materialId: string): string {
  const kinds = new Set(scenario.products.filter((p) => p.materialId === materialId).map((p) => p.kind));
  if (kinds.has('pipe') && kinds.has('fitting')) return 'Ống + Phụ kiện';
  if (kinds.has('pipe')) return 'Ống';
  if (kinds.has('fitting')) return 'Phụ kiện';
  return '—';
}

export default function MaterialsScreen({
  role,
  scenarioId,
  scenario,
  internal,
  onNavigate,
}: {
  role: AppRole;
  scenarioId: string;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
  onNavigate?: (tab: string) => void;
}) {
  const canEdit = role === 'admin' || role === 'pricing';
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null);
  const [openLotIdx, setOpenLotIdx] = useState<number | null>(null);
  const [draftLots, setDraftLots] = useState<CompoundInventory['lots'] | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const openMaterial = scenario?.materials.find((m) => m.id === openMaterialId) ?? null;

  useEffect(() => {
    if (!openMaterial) { setDraftLots(null); return; }
    setDraftLots(openMaterial.inventory.lots);
    setSaveState('idle');
    setSaveError(null);
  }, [openMaterialId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc đóng cấp lồng sâu nhất trước (panel con trước, panel nguyên liệu sau).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (openLotIdx !== null) setOpenLotIdx(null);
      else if (openMaterialId !== null) setOpenMaterialId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openLotIdx, openMaterialId]);

  if (!canEdit) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Nguyên Liệu</h1>
        <p style={{ fontSize: 12, color: '#737373' }}>Màn hình này chỉ dành cho vai Toàn Quyền / Định Giá.</p>
      </div>
    );
  }
  if (!scenario || !internal) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản + kết quả tính…</div>;
  }

  const lockOf = (materialId: string) => internal.priceLock.byMaterial.find((e) => e.materialId === materialId) ?? null;

  const persist = async (materialId: string, newInventory: CompoundInventory) => {
    setSaveState('saving');
    setSaveError(null);
    const materials = scenario.materials.map((m) => (m.id === materialId ? { ...m, inventory: newInventory } : m));
    const parsed = ScenarioInputSchema.safeParse({ ...scenario, materials });
    if (!parsed.success) {
      setSaveState('error');
      setSaveError(`Dữ liệu không hợp lệ: ${parsed.error.issues[0]?.message ?? 'lỗi không rõ'}`);
      return;
    }
    try {
      await setDoc(doc(db, `scenarios/${scenarioId}`), parsed.data);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const chotBaseline = (materialId: string) => {
    const mat = scenario.materials.find((m) => m.id === materialId);
    if (!mat) return;
    void persist(materialId, { ...mat.inventory, priceLock: { ...mat.inventory.priceLock, baseline: mat.inventory.replacementPriceUsdPerKg } });
  };

  const saveLots = () => {
    if (!openMaterial || !draftLots) return;
    void persist(openMaterial.id, { ...openMaterial.inventory, lots: draftLots });
  };

  const updateLotField = (idx: number, key: 'tons' | 'priceUsdPerKg', value: number) =>
    setDraftLots((lots) => (lots ? lots.map((l, i) => (i === idx ? { ...l, [key]: value } : l)) : lots));
  const updateLotRate = (idx: number, key: 'importTaxRate' | 'customsLogisticsFeeRate', value: number | undefined) =>
    setDraftLots((lots) => (lots ? lots.map((l, i) => (i === idx ? { ...l, [key]: value } : l)) : lots));
  const addLot = () => setDraftLots((lots) => (lots && lots.length < 5 ? [{ tons: 0, priceUsdPerKg: openMaterial?.inventory.replacementPriceUsdPerKg ?? 0 }, ...lots] : lots));
  const removeLot = (idx: number) => setDraftLots((lots) => (lots && lots.length > 1 ? lots.filter((_, i) => i !== idx) : lots));

  const openLot = openLotIdx !== null ? draftLots?.[openLotIdx] ?? null : null;

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Nguyên Liệu</div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Giá vốn nguyên liệu</h1>
        <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>
          Bấm 1 dòng để xem baseline, giá mua mới hôm nay, bình quân gia quyền, lô đã nhập — và chốt lại giá khi cần.
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
        <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 120px 150px 120px 110px', padding: '9px 16px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', gap: 8, minWidth: 760 }}>
          {['Tên', 'Dòng', 'Baseline', 'Giá mua mới hôm nay', 'Bình quân gia quyền', 'Trạng thái'].map((h, i) => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#737373', textTransform: 'uppercase', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
          ))}
        </div>
        {scenario.materials.map((m) => {
          const lock = lockOf(m.id);
          const wAvg = weightedAvgUsdPerKg(m.inventory.lots);
          const isLocked = lock?.evaluation.isLocked ?? true;
          return (
            <div
              key={m.id}
              onClick={() => setOpenMaterialId(m.id)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setOpenMaterialId(m.id); }}
              style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 120px 150px 120px 110px', padding: '10px 16px', borderBottom: '1px solid #f5f5f5', gap: 8, alignItems: 'center', cursor: 'pointer', minWidth: 760 }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: '#737373' }}>{lineLabelOf(scenario, m.id)}</div>
              <div style={{ fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(m.inventory.priceLock.baseline)}</div>
              <div style={{ fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: isLocked ? '#1a1a1a' : '#DC2626' }}>{fmtUsd(m.inventory.replacementPriceUsdPerKg)}</div>
              <div style={{ fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{wAvg !== null ? fmtUsd(wAvg) : '— (chưa có lô)'}</div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: isLocked ? '#f0fdf4' : '#fef2f2', color: isLocked ? '#16A34A' : '#DC2626', border: `1px solid ${isLocked ? '#bfe8cf' : '#f3c6c6'}` }}>
                  {isLocked ? '✓ KHÓA' : '⚠ MỞ KHÓA'}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {onNavigate && (
        <button
          onClick={() => onNavigate('materials:advanced')}
          style={{ marginTop: 14, padding: '8px 16px', background: '#fff', color: '#737373', border: '1px solid #d8d8d8', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >
          Quản lý nâng cao (thêm nguyên liệu, ren kim loại mua ngoài) →
        </button>
      )}

      {/* ── Panel cấp 1 — chi tiết 1 nguyên liệu ───────────────────────────── */}
      <SlideOverPanel open={!!openMaterial} onClose={() => setOpenMaterialId(null)} title={openMaterial?.name ?? ''} level={1}>
        {openMaterial && draftLots && (() => {
          const lock = lockOf(openMaterial.id);
          const isLocked = lock?.evaluation.isLocked ?? true;
          const wAvg = weightedAvgUsdPerKg(draftLots);
          const wAvgLanded = weightedAvgLandedCostPerKgVnd(
            draftLots,
            { importTaxRate: openMaterial.importTaxRate, customsLogisticsFeeRate: openMaterial.customsLogisticsFeeRate },
            scenario.costPool.currency.usdVndRate,
          );
          const totalKg = totalInventoryKg(draftLots);
          const dirty = JSON.stringify(draftLots) !== JSON.stringify(openMaterial.inventory.lots);
          return (
            <>
              <div style={{ fontSize: 11, color: '#737373', marginBottom: 14 }}>{openMaterial.code ?? '—'} · {openMaterial.originLabel ?? '—'} · {lineLabelOf(scenario, openMaterial.id)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <PanelStat label="Baseline (đã chốt)" value={`${fmtUsd(openMaterial.inventory.priceLock.baseline)} USD/kg`} />
                <PanelStat label="Giá mua mới hôm nay" value={`${fmtUsd(openMaterial.inventory.replacementPriceUsdPerKg)} USD/kg`} color={isLocked ? undefined : '#DC2626'} />
                <PanelStat label={<>Lệch so với chốt <TermInfo term="baseline-mechanism" /></>} value={lock ? fmtPct(lock.evaluation.deviationPct) : '—'} color={isLocked ? undefined : '#DC2626'} />
                <PanelStat label="Bình quân gia quyền" value={wAvg !== null ? `${fmtUsd(wAvg)} USD/kg` : '— (chưa có lô)'} />
              </div>
              {wAvgLanded !== null && (
                <div style={{ fontSize: 11, color: '#565b64', marginBottom: 14 }}>≈ {fmtVnd(wAvgLanded)} đ/kg đã gồm thuế/phí (landed cost, từng lô) · tồn kho {fmtVnd(totalKg)} kg</div>
              )}
              <div style={{ padding: '9px 12px', borderRadius: 6, marginBottom: 16, fontSize: 11.5, fontWeight: 600, background: isLocked ? '#f0fdf4' : '#fef2f2', color: isLocked ? '#16A34A' : '#DC2626', border: `1px solid ${isLocked ? '#bfe8cf' : '#f3c6c6'}` }}>
                {isLocked ? '✓ KHÓA — giá bán đang giữ nguyên theo baseline' : '⚠ MỞ KHÓA — giá mua mới lệch quá ngưỡng, cân nhắc chốt lại giá'}
              </div>
              {!isLocked && (
                <button
                  onClick={() => chotBaseline(openMaterial.id)}
                  disabled={saveState === 'saving'}
                  style={{ width: '100%', marginBottom: 18, padding: 10, background: '#a8003b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  Chốt baseline = giá hôm nay ({fmtUsd(openMaterial.inventory.replacementPriceUsdPerKg)} USD/kg)
                </button>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em' }}>Lô đã nhập ({draftLots.length})</div>
                <button onClick={addLot} disabled={draftLots.length >= 5} style={{ fontSize: 10.5, fontWeight: 600, color: draftLots.length >= 5 ? '#c9c9c9' : '#16A34A', background: 'none', border: `1px dashed ${draftLots.length >= 5 ? '#e5e5e5' : '#16A34A'}`, borderRadius: 12, padding: '4px 10px', cursor: draftLots.length >= 5 ? 'not-allowed' : 'pointer' }}>+ Thêm lô</button>
              </div>
              {draftLots.map((lot, i) => (
                <div
                  key={i}
                  onClick={() => setOpenLotIdx(i)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f0ece0', cursor: 'pointer' }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{i === 0 ? 'Lô gần nhất' : `Lô #${i + 1}`}</div>
                    <div style={{ fontSize: 11, color: '#737373' }}>{fmtVnd(lot.tons * 1000)} kg · {fmtUsd(lot.priceUsdPerKg)} USD/kg</div>
                  </div>
                  <span style={{ color: '#b3b3b3', fontSize: 13 }}>›</span>
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: '#a3a3a3', marginTop: 10 }}>Bấm 1 lô để xem/sửa chi tiết (số lượng, giá, thuế/phí riêng).</div>

              <button
                onClick={saveLots}
                disabled={!dirty || saveState === 'saving'}
                style={{ width: '100%', marginTop: 18, padding: 10, background: dirty ? '#0a0a0a' : '#e5e5e5', color: dirty ? '#fff' : '#a3a3a3', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 700, cursor: dirty ? 'pointer' : 'not-allowed' }}
              >
                {saveState === 'saving' ? 'Đang lưu…' : 'Lưu thay đổi lô'}
              </button>
              {saveState === 'saved' && <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, marginTop: 8 }}>✓ Đã lưu</div>}
              {saveState === 'error' && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 8 }}>{saveError}</div>}
            </>
          );
        })()}
      </SlideOverPanel>

      {/* ── Panel cấp 2 (lồng) — sửa 1 lô ───────────────────────────────────── */}
      <SlideOverPanel
        open={openLotIdx !== null}
        onClose={() => setOpenLotIdx(null)}
        onBack={() => setOpenLotIdx(null)}
        title={openLotIdx !== null ? (openLotIdx === 0 ? 'Lô gần nhất' : `Lô #${openLotIdx + 1}`) : ''}
        level={2}
      >
        {openLot && openLotIdx !== null && openMaterial && (
          <>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 10.5, color: '#737373', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>Số lượng (kg)</span>
              <input
                type="number" step={KG_STEP} value={openLot.tons * 1000}
                onChange={(e) => updateLotField(openLotIdx, 'tons', (parseFloat(e.target.value) || 0) / 1000)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #2563eb', borderRadius: 4, fontSize: 13, outline: 'none', background: '#eff6ff' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 10.5, color: '#737373', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>Giá mua (USD/kg)</span>
              <input
                type="number" step="0.01" value={openLot.priceUsdPerKg}
                onChange={(e) => updateLotField(openLotIdx, 'priceUsdPerKg', parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #2563eb', borderRadius: 4, fontSize: 13, outline: 'none', background: '#eff6ff' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 10.5, color: '#737373', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>Thuế NK riêng (để trống = theo nguyên liệu, {fmtPct(openMaterial.importTaxRate)})</span>
              <input
                type="number" step="0.01" value={openLot.importTaxRate ?? ''}
                onChange={(e) => updateLotRate(openLotIdx, 'importTaxRate', e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d8d8d8', borderRadius: 4, fontSize: 13, outline: 'none' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 18 }}>
              <span style={{ fontSize: 10.5, color: '#737373', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>Phí HQ+logistics riêng (để trống = theo nguyên liệu, {fmtPct(openMaterial.customsLogisticsFeeRate)})</span>
              <input
                type="number" step="0.01" value={openLot.customsLogisticsFeeRate ?? ''}
                onChange={(e) => updateLotRate(openLotIdx, 'customsLogisticsFeeRate', e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d8d8d8', borderRadius: 4, fontSize: 13, outline: 'none' }}
              />
            </label>
            <button
              onClick={() => { removeLot(openLotIdx); setOpenLotIdx(null); }}
              disabled={draftLots ? draftLots.length <= 1 : true}
              style={{ width: '100%', padding: 9, background: '#fff', color: '#DC2626', border: '1px solid #DC2626', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: draftLots && draftLots.length > 1 ? 'pointer' : 'not-allowed', opacity: draftLots && draftLots.length > 1 ? 1 : 0.4 }}
            >
              Xóa lô này
            </button>
            <div style={{ fontSize: 10.5, color: '#a3a3a3', marginTop: 12 }}>Bấm ← Quay lại rồi bấm "Lưu thay đổi lô" ở panel nguyên liệu để ghi thật.</div>
          </>
        )}
      </SlideOverPanel>
    </div>
  );
}
