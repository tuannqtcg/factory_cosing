// M12.9d — màn hình Tồn Kho Compound (tab `inventory`, vai admin/pricing),
// theo mockup Pha 1 đã duyệt (2026-07-09): dựng LẠI theo `materials[]` thật
// (ADR-012) thay bucket Ống/Phụ Kiện cứng của prototype gốc (prototype vẽ
// TRƯỚC ADR-012). Quản lý đợt nhập compound theo TỪNG nguyên liệu
// (`materials[].inventory.lots`) + nguyên liệu ren kim loại mua ngoài
// (`inventory.metalInsert[]`, ADR-008).
//
// Ranh giới engine: bình quân gia quyền hiển thị = gọi THẲNG
// `weightedAvgUsdPerKg()`/`totalInventoryKg()` (dual-costing.ts) trên lots
// đang chỉnh sửa (bản nháp CHƯA lưu, cho người dùng xem trước) — đây là hàm
// pure ĐÃ xuất, không phải công thức bịa; lãi/lỗ giữ kho + cảnh báo VAS-02 +
// đánh giá khóa giá lấy THẲNG từ `outputs/internal` (đã tính sẵn theo dữ liệu
// ĐÃ LƯU) — không tính lại 2 số đó ở client (client không lắp lại công thức
// engine, PROJECT_SPEC §3).
//
// Khóa vai: `thresholdPct` admin-only theo TỪNG phần tử mảng (ADR-015) — form
// disable cho pricing khớp đúng rules đã vá; mọi field khác (lots, replacement,
// thêm nguyên liệu mới) mở cho cả pricing/admin (material.md).
import { Fragment, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { fmtVnd, fmtUsd } from '../../lib/format.js';
import { ScenarioInputSchema, type ScenarioInput, type ScenarioOutput } from '../../schemas/scenario.js';
import type { Material } from '../../schemas/material.js';
import type { MetalInsertCatalogEntry } from '../../schemas/pricing-chain.js';
import { weightedAvgUsdPerKg, totalInventoryKg } from '../../engine/dual-costing.js';
import { weightedAvgInsertPriceVnd } from '../../engine/metal-insert.js';

const USD_VND_FALLBACK = 25000; // chỉ dùng để ước lượng ≈tỷ đ hiển thị nhanh khi gõ — KHÔNG dùng cho tính giá thành

function SectionHeader({ title, color = '#a8003b', right }: { title: string; color?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 14, background: color, borderRadius: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

export default function InventoryScreen({
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
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [expandedInsert, setExpandedInsert] = useState<string | null>(null);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [newMat, setNewMat] = useState({ id: '', name: '', code: '', originLabel: '' });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  if (scenario && !loadedRef.current) {
    loadedRef.current = true;
    setForm(scenario);
  }

  if (!canEdit) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Tồn Kho Compound</h1>
        <p style={{ fontSize: 12, color: '#737373' }}>Màn hình này chỉ dành cho vai Toàn Quyền / Định Giá.</p>
      </div>
    );
  }
  if (!form || !internal) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản + kết quả tính…</div>;
  }

  const activeMaterialId = materialId ?? form.materials[0]?.id ?? null;
  const material = form.materials.find((m) => m.id === activeMaterialId) ?? null;

  const setMaterials = (updater: (materials: Material[]) => Material[]) =>
    setForm((f) => (f ? { ...f, materials: updater(f.materials) } : f));

  const updateLot = (matId: string, idx: number, key: 'tons' | 'priceUsdPerKg', value: number) =>
    setMaterials((mats) =>
      mats.map((m) => (m.id !== matId ? m : { ...m, inventory: { ...m.inventory, lots: m.inventory.lots.map((l, i) => (i === idx ? { ...l, [key]: value } : l)) } })),
    );
  const addLot = (matId: string) =>
    setMaterials((mats) =>
      mats.map((m) => {
        if (m.id !== matId) return m;
        if (m.inventory.lots.length >= 5) return m;
        return { ...m, inventory: { ...m.inventory, lots: [{ tons: 0, priceUsdPerKg: m.inventory.replacementPriceUsdPerKg }, ...m.inventory.lots] } };
      }),
    );
  const removeLot = (matId: string, idx: number) =>
    setMaterials((mats) =>
      mats.map((m) => {
        if (m.id !== matId || m.inventory.lots.length <= 1) return m;
        return { ...m, inventory: { ...m.inventory, lots: m.inventory.lots.filter((_, i) => i !== idx) } };
      }),
    );

  const setInsert = (updater: (entries: MetalInsertCatalogEntry[]) => MetalInsertCatalogEntry[]) =>
    setForm((f) => (f ? { ...f, inventory: { ...f.inventory, metalInsert: updater(f.inventory.metalInsert) } } : f));
  const updateInsertLot = (key: string, idx: number, field: 'qtyOnHand' | 'unitPriceVnd', value: number) =>
    setInsert((entries) =>
      entries.map((e) =>
        `${e.renType}|${e.ptSize}` !== key ? e : { ...e, lots: e.lots.map((l, i) => (i === idx ? { ...l, [field]: value } : l)) },
      ),
    );
  const addInsertLot = (key: string) =>
    setInsert((entries) =>
      entries.map((e) => {
        if (`${e.renType}|${e.ptSize}` !== key) return e;
        if (e.lots.length >= 5) return e;
        return { ...e, lots: [{ qtyOnHand: 0, unitPriceVnd: e.replacementPriceVnd }, ...e.lots] };
      }),
    );
  const removeInsertLot = (key: string, idx: number) =>
    setInsert((entries) =>
      entries.map((e) => {
        if (`${e.renType}|${e.ptSize}` !== key || e.lots.length <= 1) return e;
        return { ...e, lots: e.lots.filter((_, i) => i !== idx) };
      }),
    );

  const addMaterial = () => {
    if (!newMat.id.trim() || !newMat.name.trim()) return;
    if (form.materials.some((m) => m.id === newMat.id.trim())) {
      alert(`ID "${newMat.id}" đã tồn tại — chọn ID khác.`);
      return;
    }
    // Luôn APPEND vào cuối mảng — giữ bất biến thứ tự materials[] (ADR-012) +
    // đúng giả định index cố định của rules (ADR-015).
    setMaterials((mats) => [
      ...mats,
      {
        id: newMat.id.trim(),
        name: newMat.name.trim(),
        code: newMat.code.trim(),
        originLabel: newMat.originLabel.trim(),
        importTaxRate: 0,
        customsLogisticsFeeRate: 0,
        markupVf: 0,
        inventory: { lots: [{ tons: 0, priceUsdPerKg: 0 }], priceLock: { baseline: 0, thresholdPct: 0.03 }, replacementPriceUsdPerKg: 0 },
      },
    ]);
    setNewMat({ id: '', name: '', code: '', originLabel: '' });
    setAddingMaterial(false);
  };

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

  const wAvg = material ? weightedAvgUsdPerKg(material.inventory.lots) : null;
  const totalKg = material ? totalInventoryKg(material.inventory.lots) : 0;
  const dualEntry = material ? internal.dualCosting.byMaterial.find((e) => e.materialId === material.id) : null;
  const linesUsingMaterial = material ? form.products.filter((p) => p.materialId === material.id).map((p) => p.kind) : [];
  const lineLabel = linesUsingMaterial.includes('pipe') && linesUsingMaterial.includes('fitting') ? 'Ống + Phụ Kiện' : linesUsingMaterial.includes('pipe') ? 'Ống CPVC' : linesUsingMaterial.includes('fitting') ? 'Phụ Kiện' : 'Chưa gán SP nào';

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Quản Trị Dữ Liệu Gốc</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Tồn Kho Compound</h1>
            <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>Đợt nhập compound theo từng nguyên liệu + ren kim loại mua ngoài (ADR-002/008)</div>
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

      <SectionHeader title="Chọn nguyên liệu" right={<span style={{ fontSize: 9, color: '#737373' }}>materials[] hiện có {form.materials.length}</span>} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {form.materials.map((m) => (
          <button
            key={m.id}
            onClick={() => setMaterialId(m.id)}
            style={{ padding: '6px 14px', borderRadius: 14, border: `1px solid ${m.id === activeMaterialId ? '#a8003b' : '#d8d8d8'}`, background: m.id === activeMaterialId ? '#a8003b' : '#fff', color: m.id === activeMaterialId ? '#fff' : '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            {m.name}
          </button>
        ))}
        <button
          onClick={() => setAddingMaterial((v) => !v)}
          style={{ padding: '6px 14px', borderRadius: 14, border: '1px dashed #a8003b', background: '#fff', color: '#a8003b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >
          + Thêm nguyên liệu
        </button>
      </div>

      {addingMaterial && (
        <div style={{ padding: 14, background: '#f5f5f3', border: '1px dashed #d8d8d8', borderRadius: 2, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
            {(
              [
                ['id', 'ID (slug)', 'vd: corzan-pipe-2'],
                ['name', 'Tên hiển thị', 'vd: Corzan XL-200'],
                ['code', 'Mã', 'vd: CZ-XL-200'],
                ['originLabel', 'Xuất xứ', 'vd: Ấn Độ (AIFTA)'],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} style={{ display: 'block' }}>
                <span style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>{label}</span>
                <input
                  value={newMat[key]}
                  placeholder={placeholder}
                  onChange={(e) => setNewMat((v) => ({ ...v, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '6px 9px', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 12, outline: 'none', background: '#fff' }}
                />
              </label>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#737373', marginBottom: 10, lineHeight: 1.5 }}>
            Tạo nguyên liệu MỚI rỗng (chưa gắn SP nào). Gán <code>Product.materialId</code> cho SKU cụ thể là thao tác riêng, chỉ admin (material.md) — chưa có màn hình ở đây, ngoài phạm vi M12.9d.
          </div>
          <button onClick={addMaterial} style={{ padding: '8px 16px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 2, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Tạo nguyên liệu
          </button>
          <button onClick={() => setAddingMaterial(false)} style={{ padding: '8px 16px', background: '#fff', color: '#a8003b', border: '1px solid #a8003b', borderRadius: 2, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', marginLeft: 8 }}>
            Hủy
          </button>
        </div>
      )}

      {material && (
        <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,.04)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '12px 16px', background: '#f5f5f3', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {material.name} <span style={{ fontSize: 9, color: '#737373', fontWeight: 400 }}>· {material.code ?? '—'} · {material.originLabel ?? '—'}</span>
            </div>
            <div style={{ fontSize: 9.5, color: '#737373', marginTop: 2 }}>{lineLabel} · replacementPriceUsdPerKg hiện tại: {fmtUsd(material.inventory.replacementPriceUsdPerKg)} USD/kg</div>
          </div>
          <div style={{ padding: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
              <thead>
                <tr>
                  {['Đợt nhập', 'Tấn', 'USD/kg', '≈ tỷ đ', ''].map((h, i) => (
                    <th key={h} style={{ fontSize: 8.5, fontWeight: 700, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: i === 0 ? 'left' : 'right', padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {material.inventory.lots.map((lot, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 8px', fontSize: 11, color: '#737373', borderBottom: '1px solid #f8f8f6' }}>Đợt {i + 1}{i === 0 ? ' (gần nhất)' : ''}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #f8f8f6' }}>
                      <input type="number" step="0.5" value={lot.tons} onChange={(e) => updateLot(material.id, i, 'tons', parseFloat(e.target.value) || 0)} style={{ width: 90, padding: '5px 8px', border: '1px solid #2563eb', borderRadius: 2, fontSize: 12, textAlign: 'right', outline: 'none', background: '#eff6ff', fontVariantNumeric: 'tabular-nums' }} />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #f8f8f6' }}>
                      <input type="number" step="0.01" value={lot.priceUsdPerKg} onChange={(e) => updateLot(material.id, i, 'priceUsdPerKg', parseFloat(e.target.value) || 0)} style={{ width: 90, padding: '5px 8px', border: '1px solid #2563eb', borderRadius: 2, fontSize: 12, textAlign: 'right', outline: 'none', background: '#eff6ff', fontVariantNumeric: 'tabular-nums' }} />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 12, borderBottom: '1px solid #f8f8f6', fontVariantNumeric: 'tabular-nums' }}>
                      {((lot.tons * 1000 * lot.priceUsdPerKg * USD_VND_FALLBACK) / 1e9).toFixed(2)} tỷ
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #f8f8f6' }}>
                      <button disabled={material.inventory.lots.length <= 1} onClick={() => removeLot(material.id, i)} style={{ background: 'none', border: 'none', color: material.inventory.lots.length <= 1 ? '#b3b3b3' : '#DC2626', cursor: material.inventory.lots.length <= 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => addLot(material.id)}
              disabled={material.inventory.lots.length >= 5}
              style={{ padding: '6px 14px', background: '#fff', border: '1px dashed #2563eb', color: '#2563eb', borderRadius: 2, fontSize: 10.5, fontWeight: 600, cursor: material.inventory.lots.length >= 5 ? 'not-allowed' : 'pointer', opacity: material.inventory.lots.length >= 5 ? 0.5 : 1 }}
            >
              + Thêm đợt nhập
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 14 }}>
              <div style={{ background: '#f5f5f3', border: '1px solid #f0f0f0', borderRadius: 2, padding: '10px 12px' }}>
                <div style={{ fontSize: 8.5, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Bình quân gia quyền (xem trước)</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{wAvg !== null ? fmtUsd(wAvg) : '—'}</div>
                <div style={{ fontSize: 9, color: '#737373', marginTop: 2 }}>USD/kg · từ đợt nhập đang sửa</div>
              </div>
              <div style={{ background: '#f5f5f3', border: '1px solid #f0f0f0', borderRadius: 2, padding: '10px 12px' }}>
                <div style={{ fontSize: 8.5, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Tổng tồn kho</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(totalKg)}</div>
                <div style={{ fontSize: 9, color: '#737373', marginTop: 2 }}>kg</div>
              </div>
              <div style={{ background: '#f5f5f3', border: '1px solid #f0f0f0', borderRadius: 2, padding: '10px 12px' }}>
                <div style={{ fontSize: 8.5, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Lãi/lỗ giữ kho (đã lưu)</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: dualEntry && dualEntry.holdingGainLossVnd >= 0 ? '#16A34A' : '#DC2626' }}>
                  {dualEntry ? `${dualEntry.holdingGainLossVnd >= 0 ? '+' : ''}${fmtVnd(dualEntry.holdingGainLossVnd)}` : '—'}
                </div>
                <div style={{ fontSize: 9, color: '#737373', marginTop: 2 }}>đ · theo outputs/internal — Lưu để cập nhật</div>
              </div>
              <div style={{ background: '#f5f5f3', border: '1px solid #f0f0f0', borderRadius: 2, padding: '10px 12px' }}>
                <div style={{ fontSize: 8.5, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Cảnh báo VAS-02</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: dualEntry?.provisionWarning ? '#DC2626' : '#16A34A' }}>{dualEntry?.provisionWarning ?? 'Không có'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <SectionHeader title="Nguyên liệu ren kim loại mua ngoài (ADR-008)" color="#2563eb" right={<span style={{ fontSize: 9, color: '#737373' }}>{form.inventory.metalInsert.length} dòng theo (loại ren, size PT) · click để mở đợt nhập</span>} />
      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f3' }}>
              {['Loại ren', 'Size PT', 'Giá tái tạo', 'Tồn kho', 'Bình quân gia quyền', 'Lãi/lỗ giữ kho', ''].map((h, i) => (
                <th key={h} style={{ fontSize: 8.5, fontWeight: 700, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: i < 2 ? 'left' : 'right', padding: 8, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.inventory.metalInsert.map((entry) => {
              const key = `${entry.renType}|${entry.ptSize}`;
              const qty = entry.lots.reduce((s, l) => s + l.qtyOnHand, 0);
              const iAvg = weightedAvgInsertPriceVnd(entry.lots);
              const dEntry = internal.dualCosting.metalInsert.find((e) => `${e.renType}|${e.ptSize}` === key);
              const isOpen = expandedInsert === key;
              return (
                <Fragment key={key}>
                  <tr onClick={() => setExpandedInsert(isOpen ? null : key)} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '7px 8px', fontSize: 11.5, borderBottom: '1px solid #f8f8f6' }}>Ren {entry.renType}</td>
                    <td style={{ padding: '7px 8px', fontSize: 11.5, borderBottom: '1px solid #f8f8f6' }}>PT {entry.ptSize}</td>
                    <td style={{ padding: '7px 8px', fontSize: 11.5, textAlign: 'right', borderBottom: '1px solid #f8f8f6', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(entry.replacementPriceVnd)} đ</td>
                    <td style={{ padding: '7px 8px', fontSize: 11.5, textAlign: 'right', borderBottom: '1px solid #f8f8f6', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(qty)} cái</td>
                    <td style={{ padding: '7px 8px', fontSize: 11.5, textAlign: 'right', borderBottom: '1px solid #f8f8f6', fontVariantNumeric: 'tabular-nums' }}>{iAvg !== null ? `${fmtVnd(iAvg)} đ` : '—'}</td>
                    <td style={{ padding: '7px 8px', fontSize: 11.5, textAlign: 'right', borderBottom: '1px solid #f8f8f6', fontVariantNumeric: 'tabular-nums', color: dEntry && dEntry.holdingGainLossVnd >= 0 ? '#16A34A' : '#DC2626' }}>
                      {dEntry ? `${dEntry.holdingGainLossVnd >= 0 ? '+' : ''}${fmtVnd(dEntry.holdingGainLossVnd)} đ` : '—'}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#b3b3b3', borderBottom: '1px solid #f8f8f6' }}>{isOpen ? '▴' : '▾'}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ background: '#fafaf8', padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, color: '#737373', marginBottom: 8 }}>Đợt nhập ren {entry.renType} PT{entry.ptSize} — sổ sách bình quân gia quyền (ADR-002/008)</div>
                        <table style={{ maxWidth: 440, borderCollapse: 'collapse', marginBottom: 8 }}>
                          <thead>
                            <tr>{['Đợt', 'Số lượng', 'đ/cái', ''].map((h) => <th key={h} style={{ fontSize: 8.5, color: '#737373', textAlign: 'right', padding: '4px 8px' }}>{h}</th>)}</tr>
                          </thead>
                          <tbody>
                            {entry.lots.map((lot, i) => (
                              <tr key={i}>
                                <td style={{ fontSize: 10.5, color: '#737373', padding: '4px 8px' }}>Đợt {i + 1}{i === 0 ? ' (gần nhất)' : ''}</td>
                                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                                  <input type="number" value={lot.qtyOnHand} onChange={(e) => updateInsertLot(key, i, 'qtyOnHand', parseInt(e.target.value, 10) || 0)} style={{ width: 80, padding: '4px 6px', border: '1px solid #93c5fd', borderRadius: 2, fontSize: 11, textAlign: 'right', outline: 'none', background: '#eff6ff', fontVariantNumeric: 'tabular-nums' }} />
                                </td>
                                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                                  <input type="number" value={lot.unitPriceVnd} onChange={(e) => updateInsertLot(key, i, 'unitPriceVnd', parseInt(e.target.value, 10) || 0)} style={{ width: 80, padding: '4px 6px', border: '1px solid #93c5fd', borderRadius: 2, fontSize: 11, textAlign: 'right', outline: 'none', background: '#eff6ff', fontVariantNumeric: 'tabular-nums' }} />
                                </td>
                                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                                  <button disabled={entry.lots.length <= 1} onClick={() => removeInsertLot(key, i)} style={{ background: 'none', border: 'none', color: entry.lots.length <= 1 ? '#b3b3b3' : '#DC2626', cursor: entry.lots.length <= 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>✕</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button
                          onClick={() => addInsertLot(key)}
                          disabled={entry.lots.length >= 5}
                          style={{ padding: '5px 12px', background: '#fff', border: '1px dashed #2563eb', color: '#2563eb', borderRadius: 2, fontSize: 10, fontWeight: 600, cursor: entry.lots.length >= 5 ? 'not-allowed' : 'pointer', opacity: entry.lots.length >= 5 ? 0.5 : 1 }}
                        >
                          + Thêm đợt nhập
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isAdmin && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2, fontSize: 10, color: '#1e3a5f' }}>
          Ngưỡng khóa giá (<code>thresholdPct</code>) không sửa được ở màn này — quản lý ở tab <b>Tham Số</b>, chỉ Admin (ADR-015).
        </div>
      )}
    </div>
  );
}
