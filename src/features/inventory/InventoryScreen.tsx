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
// ADR-033 roll-out: trình bày qua design tokens (đen–trắng tối giản). Ô đang
// sửa (lots) trước dùng viền/nền xanh dương — nay dùng viền đen đậm + nền xám
// nhạt để nhất quán "accent = đen" toàn app; đỏ/xanh lá giữ cho tín hiệu lãi/lỗ.
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
import { Screen, Card, tk, sp, ft, rd, tnum } from '../../design/primitives.js';
import { eyebrowStyle } from '../../design/tokens.js';

const USD_VND_FALLBACK = 25000; // chỉ dùng để ước lượng ≈tỷ đ hiển thị nhanh khi gõ — KHÔNG dùng cho tính giá thành

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 14, background: tk.brand, borderRadius: 1, flexShrink: 0 }} />
        <div style={{ ...eyebrowStyle, color: tk.ink }}>{title}</div>
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
  const [activeMainTab, setActiveMainTab] = useState<'compound' | 'metal'>('compound');
  const [expandedInsert, setExpandedInsert] = useState<string | null>(null);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [newMat, setNewMat] = useState({ id: '', name: '', code: '', originLabel: '' });
  const [newLineUsage, setNewLineUsage] = useState<'pipe' | 'fitting' | 'both'>('pipe');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  if (scenario && !loadedRef.current) {
    loadedRef.current = true;
    setForm(scenario);
  }

  if (!canEdit) {
    return (
      <Screen>
        <h1 style={{ margin: 0, fontSize: ft.size.xxl, fontWeight: ft.weight.bold, color: tk.ink }}>Tồn Kho Compound</h1>
        <p style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Màn hình này chỉ dành cho vai Toàn Quyền / Định Giá.</p>
      </Screen>
    );
  }
  if (!form || !internal) {
    return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải kịch bản + kết quả tính…</div></Screen>;
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
    const matId = newMat.id.trim();
    const newMaterialObj: Material = {
      id: matId,
      name: newMat.name.trim(),
      code: newMat.code.trim(),
      originLabel: newMat.originLabel.trim(),
      importTaxRate: 0,
      customsLogisticsFeeRate: 0,
      markupVf: 0,
      inventory: { lots: [{ tons: 0, priceUsdPerKg: 0 }], priceLock: { baseline: 0, thresholdPct: 0.03 }, replacementPriceUsdPerKg: 0 },
    };

    setForm((f) => {
      if (!f) return f;
      const newProducts = [...f.products];
      if (newLineUsage === 'pipe' || newLineUsage === 'both') {
        newProducts.push({
          kind: 'pipe',
          dn: '20',
          spec: 'Mẫu tự động',
          odMm: 20,
          minWallThicknessMm: 2,
          unitWeightKgPerM: 0.2,
          materialId: matId,
        });
      }
      if (newLineUsage === 'fitting' || newLineUsage === 'both') {
        newProducts.push({
          kind: 'fitting',
          productName: `Phụ kiện ${newMaterialObj.name}`,
          sizeLabel: '20',
          unit: 'cái',
          moldSizeDN: 20,
          cycleTimeSec: 60,
          cavity: 1,
          unitWeightKg: 0.1,
          materialId: matId,
        });
      }
      return {
        ...f,
        materials: [...f.materials, newMaterialObj],
        products: newProducts,
      };
    });

    setNewMat({ id: '', name: '', code: '', originLabel: '' });
    setAddingMaterial(false);
  };

  const seedCorzanMaterials = () => {
    setForm((f) => {
      if (!f) return f;
      if (f.materials.some(m => m.id === 'corzan-3175' || m.id === 'corzan-3212')) return f;

      const mat1: Material = {
        id: 'corzan-3175',
        name: 'CORZAN® 3175',
        code: 'Pipe',
        originLabel: 'Chưa rõ',
        importTaxRate: 0,
        customsLogisticsFeeRate: 0,
        markupVf: 0.25,
        inventory: { lots: [{ tons: 0, priceUsdPerKg: 3.47 }], priceLock: { baseline: 3.47, thresholdPct: 0.03 }, replacementPriceUsdPerKg: 3.47 },
      };

      const mat2: Material = {
        id: 'corzan-3212',
        name: 'CORZAN® 3212',
        code: 'Fitting',
        originLabel: 'Chưa rõ',
        importTaxRate: 0,
        customsLogisticsFeeRate: 0,
        markupVf: 0.40,
        inventory: { lots: [{ tons: 0, priceUsdPerKg: 3.97 }], priceLock: { baseline: 3.97, thresholdPct: 0.03 }, replacementPriceUsdPerKg: 3.97 },
      };

      return {
        ...f,
        materials: [...f.materials, mat1, mat2],
      };
    });
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
    <Screen>
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...eyebrowStyle, marginBottom: 5 }}>Quản Trị Dữ Liệu Gốc</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: ft.size.xxl, fontWeight: ft.weight.bold, letterSpacing: '-.3px', color: tk.ink }}>Tồn Kho Compound</h1>
            <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 4 }}>Đợt nhập compound theo từng nguyên liệu + ren kim loại mua ngoài (ADR-002/008)</div>
          </div>
          <button
            onClick={() => void handleSave()}
            disabled={saveState === 'saving'}
            style={{ padding: '10px 22px', background: tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.sm, cursor: 'pointer', fontSize: ft.size.xs, fontWeight: ft.weight.bold, letterSpacing: '.06em', textTransform: 'uppercase' }}
          >
            {saveState === 'saving' ? 'Đang lưu…' : 'Lưu & Cập Nhật'}
          </button>
        </div>
        {saveState === 'saved' && <div style={{ fontSize: ft.size.xs, color: tk.successInk, fontWeight: ft.weight.semibold, marginTop: 6 }}>✓ Đã lưu — Cloud Function sẽ tự tính lại toàn bộ giá thành</div>}
        {saveState === 'error' && <div style={{ fontSize: ft.size.xs, color: tk.dangerInk, marginTop: 6 }}>{saveError}</div>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button
          onClick={() => setActiveMainTab('compound')}
          style={{ padding: '6px 14px', borderRadius: rd.pill, border: `1px solid ${activeMainTab === 'compound' ? tk.brand : tk.borderStrong}`, background: activeMainTab === 'compound' ? tk.brand : tk.surface, color: activeMainTab === 'compound' ? tk.inkInverse : tk.inkMuted, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, cursor: 'pointer' }}
        >
          Hạt Nhựa (Compound)
        </button>
        <button
          onClick={() => setActiveMainTab('metal')}
          style={{ padding: '6px 14px', borderRadius: rd.pill, border: `1px solid ${activeMainTab === 'metal' ? tk.brand : tk.borderStrong}`, background: activeMainTab === 'metal' ? tk.brand : tk.surface, color: activeMainTab === 'metal' ? tk.inkInverse : tk.inkMuted, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, cursor: 'pointer' }}
        >
          Ren Kim Loại (Metal Insert)
        </button>
      </div>

      {activeMainTab === 'compound' && (
        <>
          <SectionHeader title="Chọn nguyên liệu" right={<span style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>materials[] hiện có {form.materials.length}</span>} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {form.materials.map((m) => (
          <button
            key={m.id}
            onClick={() => setMaterialId(m.id)}
            style={{ padding: '6px 14px', borderRadius: rd.pill, border: `1px solid ${m.id === activeMaterialId ? tk.brand : tk.borderStrong}`, background: m.id === activeMaterialId ? tk.brand : tk.surface, color: m.id === activeMaterialId ? tk.inkInverse : tk.inkMuted, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, cursor: 'pointer' }}
          >
            {m.name}
          </button>
        ))}
        <button
          onClick={() => setAddingMaterial((v) => !v)}
          style={{ padding: '6px 14px', borderRadius: rd.pill, border: `1px dashed ${tk.borderStrong}`, background: tk.surface, color: tk.ink, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, cursor: 'pointer' }}
        >
          + Thêm nguyên liệu
        </button>
        <button
          onClick={seedCorzanMaterials}
          style={{ padding: '6px 14px', borderRadius: rd.pill, border: `1px dashed ${tk.successInk}`, background: tk.surface, color: tk.successInk, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, cursor: 'pointer' }}
        >
          + Seed 2 Mã Corzan
        </button>
      </div>

      {addingMaterial && (
        <div style={{ padding: 14, background: tk.surfaceMuted, border: `1px dashed ${tk.borderStrong}`, borderRadius: rd.sm, marginBottom: 16 }}>
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
                <span style={{ ...eyebrowStyle, display: 'block', marginBottom: 4 }}>{label}</span>
                <input
                  value={newMat[key]}
                  placeholder={placeholder}
                  onChange={(e) => setNewMat((v) => ({ ...v, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '6px 9px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, fontSize: ft.size.sm, outline: 'none', background: tk.surface, color: tk.ink }}
                />
              </label>
            ))}
            <label style={{ display: 'block' }}>
              <span style={{ ...eyebrowStyle, display: 'block', marginBottom: 4 }}>Dùng cho hệ</span>
              <select
                value={newLineUsage}
                onChange={(e) => setNewLineUsage(e.target.value as any)}
                style={{ width: '100%', padding: '5px 9px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, fontSize: ft.size.sm, outline: 'none', background: tk.surface, color: tk.ink }}
              >
                <option value="pipe">Ống</option>
                <option value="fitting">Phụ kiện</option>
                <option value="both">Cả Ống và Phụ kiện</option>
              </select>
            </label>
          </div>
          <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginBottom: 10, lineHeight: 1.5 }}>
            Tạo nguyên liệu MỚI. Hệ thống sẽ tự động sinh thêm 1 sản phẩm mẫu (dummy) thuộc dòng (Ống/Phụ kiện) bạn vừa chọn để nguyên liệu có thể lập tức tham gia vào quá trình tính toán giá thành.
          </div>
          <button onClick={addMaterial} style={{ padding: '8px 16px', background: tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.sm, fontSize: ft.size.xs, fontWeight: ft.weight.bold, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Tạo nguyên liệu
          </button>
          <button onClick={() => setAddingMaterial(false)} style={{ padding: '8px 16px', background: tk.surface, color: tk.ink, border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, fontSize: ft.size.xs, fontWeight: ft.weight.bold, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', marginLeft: 8 }}>
            Hủy
          </button>
        </div>
      )}

      {material && (
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '12px 16px', background: tk.surfaceMuted, borderBottom: `1px solid ${tk.border}` }}>
            <div style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink }}>
              {material.name} <span style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, fontWeight: ft.weight.regular }}>· {material.code ?? '—'} · {material.originLabel ?? '—'}</span>
            </div>
            <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginTop: 2 }}>{lineLabel} · replacementPriceUsdPerKg hiện tại: {fmtUsd(material.inventory.replacementPriceUsdPerKg)} USD/kg</div>
          </div>
          <div style={{ padding: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
              <thead>
                <tr>
                  {['Đợt nhập', 'Tấn', 'USD/kg', '≈ tỷ đ', ''].map((h, i) => (
                    <th key={h} style={{ ...eyebrowStyle, textAlign: i === 0 ? 'left' : 'right', padding: '6px 8px', borderBottom: `1px solid ${tk.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {material.inventory.lots.map((lot, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 8px', fontSize: ft.size.xs, color: tk.inkMuted, borderBottom: `1px solid ${tk.surfaceMuted}` }}>Đợt {i + 1}{i === 0 ? ' (gần nhất)' : ''}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: `1px solid ${tk.surfaceMuted}` }}>
                      <input type="number" step="0.5" value={lot.tons} onChange={(e) => updateLot(material.id, i, 'tons', parseFloat(e.target.value) || 0)} style={{ width: 90, padding: '5px 8px', border: `1px solid ${tk.ink}`, borderRadius: rd.sm, fontSize: ft.size.sm, textAlign: 'right', outline: 'none', background: tk.surfaceMuted, color: tk.ink, ...tnum }} />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: `1px solid ${tk.surfaceMuted}` }}>
                      <input type="number" step="0.01" value={lot.priceUsdPerKg} onChange={(e) => updateLot(material.id, i, 'priceUsdPerKg', parseFloat(e.target.value) || 0)} style={{ width: 90, padding: '5px 8px', border: `1px solid ${tk.ink}`, borderRadius: rd.sm, fontSize: ft.size.sm, textAlign: 'right', outline: 'none', background: tk.surfaceMuted, color: tk.ink, ...tnum }} />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: ft.size.sm, borderBottom: `1px solid ${tk.surfaceMuted}`, ...tnum, color: tk.ink }}>
                      {((lot.tons * 1000 * lot.priceUsdPerKg * USD_VND_FALLBACK) / 1e9).toFixed(2)} tỷ
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: `1px solid ${tk.surfaceMuted}` }}>
                      <button disabled={material.inventory.lots.length <= 1} onClick={() => removeLot(material.id, i)} style={{ background: 'none', border: 'none', color: material.inventory.lots.length <= 1 ? tk.inkFaint : tk.dangerInk, cursor: material.inventory.lots.length <= 1 ? 'not-allowed' : 'pointer', fontSize: ft.size.md }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => addLot(material.id)}
              disabled={material.inventory.lots.length >= 5}
              style={{ padding: '6px 14px', background: tk.surface, border: `1px dashed ${tk.ink}`, color: tk.ink, borderRadius: rd.sm, fontSize: ft.size.eyebrow, fontWeight: ft.weight.semibold, cursor: material.inventory.lots.length >= 5 ? 'not-allowed' : 'pointer', opacity: material.inventory.lots.length >= 5 ? 0.5 : 1 }}
            >
              + Thêm đợt nhập
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 14 }}>
              <Card pad={0} style={{ background: tk.surfaceMuted, padding: '10px 12px' }}>
                <div style={{ ...eyebrowStyle, marginBottom: 4 }}>Bình quân gia quyền (xem trước)</div>
                <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{wAvg !== null ? fmtUsd(wAvg) : '—'}</div>
                <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 2 }}>USD/kg · từ đợt nhập đang sửa</div>
              </Card>
              <Card pad={0} style={{ background: tk.surfaceMuted, padding: '10px 12px' }}>
                <div style={{ ...eyebrowStyle, marginBottom: 4 }}>Tổng tồn kho</div>
                <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{fmtVnd(totalKg)}</div>
                <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 2 }}>kg</div>
              </Card>
              <Card pad={0} style={{ background: tk.surfaceMuted, padding: '10px 12px' }}>
                <div style={{ ...eyebrowStyle, marginBottom: 4 }}>Lãi/lỗ giữ kho (đã lưu)</div>
                <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, ...tnum, color: dualEntry && dualEntry.holdingGainLossVnd >= 0 ? tk.successInk : tk.dangerInk }}>
                  {dualEntry ? `${dualEntry.holdingGainLossVnd >= 0 ? '+' : ''}${fmtVnd(dualEntry.holdingGainLossVnd)}` : '—'}
                </div>
                <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 2 }}>đ · theo outputs/internal — Lưu để cập nhật</div>
              </Card>
              <Card pad={0} style={{ background: tk.surfaceMuted, padding: '10px 12px' }}>
                <div style={{ ...eyebrowStyle, marginBottom: 4 }}>Cảnh báo VAS-02</div>
                <div style={{ fontSize: ft.size.xs, fontWeight: ft.weight.bold, color: dualEntry?.provisionWarning ? tk.dangerInk : tk.successInk }}>{dualEntry?.provisionWarning ?? 'Không có'}</div>
              </Card>
            </div>
          </div>
        </Card>
      )}
      </>
      )}

      {activeMainTab === 'metal' && (
      <>
      <SectionHeader title="Nguyên liệu ren kim loại mua ngoài (ADR-008)" right={<span style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>{form.inventory.metalInsert.length} dòng theo (loại ren, size PT) · click để mở đợt nhập</span>} />
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: tk.surfaceMuted }}>
              {['Loại ren', 'Size PT', 'Giá tái tạo', 'Tồn kho', 'Bình quân gia quyền', 'Lãi/lỗ giữ kho', ''].map((h, i) => (
                <th key={h} style={{ ...eyebrowStyle, textAlign: i < 2 ? 'left' : 'right', padding: 8, borderBottom: `1px solid ${tk.border}` }}>{h}</th>
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
                    <td style={{ padding: '7px 8px', fontSize: ft.size.sm, color: tk.ink, borderBottom: `1px solid ${tk.surfaceMuted}` }}>Ren {entry.renType}</td>
                    <td style={{ padding: '7px 8px', fontSize: ft.size.sm, color: tk.ink, borderBottom: `1px solid ${tk.surfaceMuted}` }}>PT {entry.ptSize}</td>
                    <td style={{ padding: '7px 8px', fontSize: ft.size.sm, textAlign: 'right', borderBottom: `1px solid ${tk.surfaceMuted}`, ...tnum, color: tk.ink }}>{fmtVnd(entry.replacementPriceVnd)} đ</td>
                    <td style={{ padding: '7px 8px', fontSize: ft.size.sm, textAlign: 'right', borderBottom: `1px solid ${tk.surfaceMuted}`, ...tnum, color: tk.ink }}>{fmtVnd(qty)} cái</td>
                    <td style={{ padding: '7px 8px', fontSize: ft.size.sm, textAlign: 'right', borderBottom: `1px solid ${tk.surfaceMuted}`, ...tnum, color: tk.ink }}>{iAvg !== null ? `${fmtVnd(iAvg)} đ` : '—'}</td>
                    <td style={{ padding: '7px 8px', fontSize: ft.size.sm, textAlign: 'right', borderBottom: `1px solid ${tk.surfaceMuted}`, ...tnum, color: dEntry && dEntry.holdingGainLossVnd >= 0 ? tk.successInk : tk.dangerInk }}>
                      {dEntry ? `${dEntry.holdingGainLossVnd >= 0 ? '+' : ''}${fmtVnd(dEntry.holdingGainLossVnd)} đ` : '—'}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: tk.inkFaint, borderBottom: `1px solid ${tk.surfaceMuted}` }}>{isOpen ? '▴' : '▾'}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ background: tk.surfaceMuted, padding: '10px 14px' }}>
                        <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginBottom: 8 }}>Đợt nhập ren {entry.renType} PT{entry.ptSize} — sổ sách bình quân gia quyền (ADR-002/008)</div>
                        <table style={{ maxWidth: 440, borderCollapse: 'collapse', marginBottom: 8 }}>
                          <thead>
                            <tr>{['Đợt', 'Số lượng', 'đ/cái', ''].map((h) => <th key={h} style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, textAlign: 'right', padding: '4px 8px' }}>{h}</th>)}</tr>
                          </thead>
                          <tbody>
                            {entry.lots.map((lot, i) => (
                              <tr key={i}>
                                <td style={{ fontSize: ft.size.xs, color: tk.inkMuted, padding: '4px 8px' }}>Đợt {i + 1}{i === 0 ? ' (gần nhất)' : ''}</td>
                                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                                  <input type="number" value={lot.qtyOnHand} onChange={(e) => updateInsertLot(key, i, 'qtyOnHand', parseInt(e.target.value, 10) || 0)} style={{ width: 80, padding: '4px 6px', border: `1px solid ${tk.ink}`, borderRadius: rd.sm, fontSize: ft.size.xs, textAlign: 'right', outline: 'none', background: tk.surface, color: tk.ink, ...tnum }} />
                                </td>
                                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                                  <input type="number" value={lot.unitPriceVnd} onChange={(e) => updateInsertLot(key, i, 'unitPriceVnd', parseInt(e.target.value, 10) || 0)} style={{ width: 80, padding: '4px 6px', border: `1px solid ${tk.ink}`, borderRadius: rd.sm, fontSize: ft.size.xs, textAlign: 'right', outline: 'none', background: tk.surface, color: tk.ink, ...tnum }} />
                                </td>
                                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                                  <button disabled={entry.lots.length <= 1} onClick={() => removeInsertLot(key, i)} style={{ background: 'none', border: 'none', color: entry.lots.length <= 1 ? tk.inkFaint : tk.dangerInk, cursor: entry.lots.length <= 1 ? 'not-allowed' : 'pointer', fontSize: ft.size.sm }}>✕</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button
                          onClick={() => addInsertLot(key)}
                          disabled={entry.lots.length >= 5}
                          style={{ padding: '5px 12px', background: tk.surface, border: `1px dashed ${tk.ink}`, color: tk.ink, borderRadius: rd.sm, fontSize: ft.size.eyebrow, fontWeight: ft.weight.semibold, cursor: entry.lots.length >= 5 ? 'not-allowed' : 'pointer', opacity: entry.lots.length >= 5 ? 0.5 : 1 }}
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
      </Card>
      </>
      )}

      {!isAdmin && (
        <div style={{ marginTop: sp[4], padding: '10px 14px', background: tk.surfaceMuted, border: `1px solid ${tk.border}`, borderRadius: rd.sm, fontSize: ft.size.xs, color: tk.inkMuted }}>
          Ngưỡng khóa giá (<code>thresholdPct</code>) không sửa được ở màn này — quản lý ở tab <b>Tham Số</b>, chỉ Admin (ADR-015).
        </div>
      )}
    </Screen>
  );
}
