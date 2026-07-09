// M12.9d — màn hình Tham Số (tab `assumptions`, vai admin/pricing), theo
// mockup Pha 1 đã duyệt: giá tái tạo + khóa bảng giá (ADR-004) + markup VF +
// thuế NK/logistics (ADR-012) — TỪNG nguyên liệu độc lập (thay 2 field
// markupVFOng/markupVFPK cứng của prototype gốc). `thresholdPct` admin-only
// theo TỪNG phần tử mảng (ADR-015, rules đã vá M12.9d) — field khóa client
// khớp đúng enforcement server, không chỉ trang trí.
import { useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { fmtVnd, fmtPct } from '../../lib/format.js';
import { ScenarioInputSchema, type ScenarioInput, type ScenarioOutput } from '../../schemas/scenario.js';
import type { Material } from '../../schemas/material.js';
import type { MetalInsertCatalogEntry } from '../../schemas/pricing-chain.js';

function numField(
  label: string,
  value: number,
  onChange: (v: number) => void,
  opts: { unit?: string; locked?: boolean; step?: string; accent?: string } = {},
) {
  const disabled = !!opts.locked;
  const accent = opts.accent ?? '#d8d8d8';
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <span>{label}</span>
        {opts.locked && <span style={{ fontSize: 11, opacity: 0.75 }}>🔒</span>}
      </span>
      <input
        type="number"
        step={opts.step ?? '0.01'}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: '100%',
          padding: '7px 9px',
          borderRadius: 2,
          fontSize: 12.5,
          fontWeight: 600,
          textAlign: 'right',
          outline: 'none',
          fontVariantNumeric: 'tabular-nums',
          border: `1px solid ${disabled ? '#e5e5e5' : accent}`,
          background: disabled ? '#f9f9f9' : '#fff',
          opacity: disabled ? 0.65 : 1,
          cursor: disabled ? 'not-allowed' : 'auto',
        }}
      />
      {opts.unit && <div style={{ fontSize: 8.5, color: '#b3b3b3', marginTop: 3, textAlign: 'right' }}>{opts.unit}</div>}
    </label>
  );
}

export default function AssumptionsScreen({
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
  const canEdit = role === 'admin' || role === 'pricing';
  const isAdmin = role === 'admin';
  const [form, setForm] = useState<ScenarioInput | null>(null);
  const loadedRef = useRef(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  if (scenario && !loadedRef.current) {
    loadedRef.current = true;
    setForm(scenario);
  }

  if (!canEdit) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Tham Số</h1>
        <p style={{ fontSize: 12, color: '#737373' }}>Màn hình này chỉ dành cho vai Toàn Quyền / Định Giá.</p>
      </div>
    );
  }
  if (!form || !internal) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản + kết quả tính…</div>;
  }

  const setMaterials = (updater: (materials: Material[]) => Material[]) =>
    setForm((f) => (f ? { ...f, materials: updater(f.materials) } : f));
  const updateMaterialField = (matId: string, key: 'markupVf' | 'importTaxRate' | 'customsLogisticsFeeRate', value: number) =>
    setMaterials((mats) => mats.map((m) => (m.id !== matId ? m : { ...m, [key]: value })));
  const updateReplacement = (matId: string, value: number) =>
    setMaterials((mats) => mats.map((m) => (m.id !== matId ? m : { ...m, inventory: { ...m.inventory, replacementPriceUsdPerKg: value } })));
  const updateBaseline = (matId: string, value: number) =>
    setMaterials((mats) => mats.map((m) => (m.id !== matId ? m : { ...m, inventory: { ...m.inventory, priceLock: { ...m.inventory.priceLock, baseline: value } } })));
  const updateThreshold = (matId: string, value: number) =>
    setMaterials((mats) => mats.map((m) => (m.id !== matId ? m : { ...m, inventory: { ...m.inventory, priceLock: { ...m.inventory.priceLock, thresholdPct: value } } })));
  const chotBaseline = (matId: string) =>
    setMaterials((mats) =>
      mats.map((m) => (m.id !== matId ? m : { ...m, inventory: { ...m.inventory, priceLock: { ...m.inventory.priceLock, baseline: m.inventory.replacementPriceUsdPerKg } } })),
    );

  const setInsert = (updater: (entries: MetalInsertCatalogEntry[]) => MetalInsertCatalogEntry[]) =>
    setForm((f) => (f ? { ...f, inventory: { ...f.inventory, metalInsert: updater(f.inventory.metalInsert) } } : f));
  const updateInsertThreshold = (key: string, value: number) =>
    setInsert((entries) => entries.map((e) => (`${e.renType}|${e.ptSize}` !== key ? e : { ...e, priceLock: { ...e.priceLock, thresholdPct: value } })));

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError(null);
    const parsed = ScenarioInputSchema.safeParse(form);
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

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Quản Trị Dữ Liệu Gốc</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Tham Số</h1>
            <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>Giá tái tạo · khóa bảng giá (ADR-004) · markup VF · thuế NK/logistics — TỪNG nguyên liệu</div>
          </div>
          <button
            onClick={() => void handleSave()}
            disabled={saveState === 'saving'}
            style={{ padding: '10px 22px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}
          >
            {saveState === 'saving' ? 'Đang lưu…' : 'Lưu & Cập Nhật'}
          </button>
        </div>
        {saveState === 'saved' && <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, marginTop: 6 }}>✓ Đã lưu — Cloud Function sẽ tự tính lại toàn bộ giá thành</div>}
        {saveState === 'error' && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 6 }}>{saveError}</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <div style={{ width: 3, height: 14, background: '#a8003b', borderRadius: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color: '#a8003b' }}>Tham số theo từng nguyên liệu</div>
      </div>

      {form.materials.map((m) => {
        const lockEntry = internal.priceLock.byMaterial.find((e) => e.materialId === m.id);
        const isLocked = lockEntry?.evaluation.isLocked ?? true;
        return (
          <div key={m.id} style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,.04)', overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '12px 16px', background: '#f5f5f3', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
                <div style={{ fontSize: 9.5, color: '#737373', marginTop: 2 }}>{m.code} · {m.originLabel}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: isLocked ? '#16A34A' : '#DC2626' }}>{isLocked ? 'KHÓA' : 'MỞ KHÓA'}</span>
                {!isLocked && (
                  <button
                    onClick={() => chotBaseline(m.id)}
                    style={{ padding: '7px 14px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 2, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    Chốt Baseline Mới
                  </button>
                )}
              </div>
            </div>
            <div style={{ padding: 16 }}>
              {lockEntry && (
                <div style={{ fontSize: 10, color: '#737373', marginBottom: 12 }}>
                  Lệch vs baseline: <b style={{ color: isLocked ? '#16A34A' : '#DC2626' }}>{fmtPct(lockEntry.evaluation.deviationPct)}</b>
                  {lockEntry.evaluation.stalenessWarning && <span> · ⚠ {lockEntry.evaluation.stalenessWarning}</span>}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {numField('Giá tái tạo (thị trường)', m.inventory.replacementPriceUsdPerKg, (v) => updateReplacement(m.id, v), { unit: 'USD/kg', accent: '#16A34A' })}
                {numField('Baseline khóa giá', m.inventory.priceLock.baseline, (v) => updateBaseline(m.id, v), { unit: 'USD/kg', accent: '#2563eb' })}
                {numField('Ngưỡng khóa', m.inventory.priceLock.thresholdPct, (v) => updateThreshold(m.id, v), { unit: 'tỷ lệ (0,03=3%)', locked: !isAdmin })}
                {numField('Markup VF', m.markupVf, (v) => updateMaterialField(m.id, 'markupVf', v), { unit: 'tỷ lệ' })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 10 }}>
                {numField('Thuế nhập khẩu', m.importTaxRate, (v) => updateMaterialField(m.id, 'importTaxRate', v), { unit: 'tỷ lệ' })}
                {numField('Phí logistics/hải quan', m.customsLogisticsFeeRate, (v) => updateMaterialField(m.id, 'customsLogisticsFeeRate', v), { unit: 'tỷ lệ' })}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11, marginTop: 24 }}>
        <div style={{ width: 3, height: 14, background: '#2563eb', borderRadius: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color: '#2563eb' }}>Ngưỡng khóa giá ren kim loại</div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f3' }}>
              {['Loại ren', 'Size PT', 'Baseline', 'Ngưỡng (%)'].map((h, i) => (
                <th key={h} style={{ fontSize: 8.5, fontWeight: 700, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: i < 2 ? 'left' : 'right', padding: 8, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.inventory.metalInsert.map((entry) => {
              const key = `${entry.renType}|${entry.ptSize}`;
              return (
                <tr key={key}>
                  <td style={{ padding: '7px 8px', fontSize: 11.5, borderBottom: '1px solid #f8f8f6' }}>Ren {entry.renType}</td>
                  <td style={{ padding: '7px 8px', fontSize: 11.5, borderBottom: '1px solid #f8f8f6' }}>PT {entry.ptSize}</td>
                  <td style={{ padding: '7px 8px', fontSize: 11.5, textAlign: 'right', borderBottom: '1px solid #f8f8f6', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(entry.priceLock.baseline)} đ</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #f8f8f6' }}>
                    <input
                      type="number"
                      step="0.01"
                      value={entry.priceLock.thresholdPct}
                      disabled={!isAdmin}
                      onChange={(e) => updateInsertThreshold(key, parseFloat(e.target.value) || 0)}
                      style={{
                        width: 70,
                        padding: '4px 6px',
                        borderRadius: 2,
                        fontSize: 11,
                        textAlign: 'right',
                        outline: 'none',
                        fontVariantNumeric: 'tabular-nums',
                        border: `1px solid ${!isAdmin ? '#e5e5e5' : '#d8d8d8'}`,
                        background: !isAdmin ? '#f9f9f9' : '#fff',
                        opacity: !isAdmin ? 0.65 : 1,
                        cursor: !isAdmin ? 'not-allowed' : 'auto',
                      }}
                    />{' '}
                    {!isAdmin && <span style={{ fontSize: 10, opacity: 0.75 }}>🔒</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, fontSize: 9.5, color: '#737373', lineHeight: 1.5, padding: '8px 10px', background: '#f5f5f3', border: '1px solid #f0f0f0', borderRadius: 2 }}>
        Đánh giá khóa bảng giá (KHÓA/MỞ KHÓA, % lệch, cảnh báo staleness) lấy THẲNG từ <code>outputs/internal.priceLock</code> — không tính lại ở client
        (ADR-004, luật "client không lắp lại công thức engine"). Trường thuế/phí/markup có thể khác giữa các nguyên liệu (BlazeMaster EU 6% vs Corzan AIFTA 0%).
      </div>
    </div>
  );
}
