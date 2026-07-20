import { useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { ScenarioInputSchema, type ScenarioInput } from '../../schemas/scenario.js';
import { managementStatusOf, type PipeProduct, type FittingProduct, type Product } from '../../schemas/product.js';
import type { MoldAsset } from '../../schemas/resource.js';

const InputNode = ({ value, onChange, type = 'text', width = 60, placeholder = '' }: any) => (
  <input
    type={type}
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(type === 'number' ? (e.target.value ? Number(e.target.value) : e.target.value) : e.target.value)}
    style={{ width, padding: '4px 6px', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 11 }}
  />
);

export default function ProductsScreen({
  role,
  scenarioId,
  scenario,
}: {
  role: AppRole;
  scenarioId: string;
  scenario: ScenarioInput | null;
}) {
  // ADR-039 — quyền khớp rules server: DANH MỤC (products[]) mở cho cả Toàn
  // Quyền lẫn Định Giá (master data kỹ thuật); riêng KHUÔN (moldAssets — tài
  // sản vốn: giá mua, khấu hao) vẫn chỉ Toàn Quyền, kể cả việc gán SKU↔khuôn.
  const canEdit = role === 'admin' || role === 'pricing';
  const canEditMolds = role === 'admin';
  const canView = canEdit;
  const [form, setForm] = useState<ScenarioInput | null>(null);
  const loadedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'pipe' | 'fitting'>('pipe');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  if (scenario && !loadedRef.current) {
    loadedRef.current = true;
    setForm(scenario);
  }

  if (!canView) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Danh Mục Sản Phẩm</h1>
        <p style={{ fontSize: 12, color: '#737373' }}>Màn hình này chỉ dành cho vai Toàn Quyền / Định Giá.</p>
      </div>
    );
  }
  if (!form) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải danh mục sản phẩm…</div>;
  }

  const materials = form.materials;
  const pipeProducts = form.products.filter((p) => p.kind === 'pipe') as PipeProduct[];
  const fittingProducts = form.products.filter((p) => p.kind === 'fitting') as FittingProduct[];

  // Khuôn (ADR-007): phụ kiện chỉ LÊN BẢNG GIÁ khi có khuôn sản xuất nó. Nhiều
  // SKU dùng chung 1 khuôn (cùng khuôn, khác compound — ADR-012) là bình thường.
  const moldAssets: MoldAsset[] = form.resources.fitting.driverType === 'machine_hour' ? form.resources.fitting.moldAssets : [];
  const moldOfSku = (p: FittingProduct) =>
    moldAssets.find((a) => a.producesSkus.some((s) => s.productName === p.productName && s.sizeLabel === p.sizeLabel));
  const assignMold = (p: FittingProduct, moldId: string) => {
    setForm((f) => {
      if (!f || f.resources.fitting.driverType !== 'machine_hour') return f;
      const current = f.resources.fitting.moldAssets;
      // Khuôn phải sản xuất ít nhất 1 SKU — chặn thao tác làm khuôn rỗng.
      const emptied = current.find(
        (a) =>
          a.id !== moldId &&
          a.producesSkus.length === 1 &&
          a.producesSkus[0]!.productName === p.productName &&
          a.producesSkus[0]!.sizeLabel === p.sizeLabel,
      );
      if (emptied) {
        window.alert(`Không gỡ được: khuôn "${emptied.label}" sẽ không còn sản xuất SKU nào. Gán SKU khác vào khuôn đó trước, hoặc xử lý khuôn ở Cấu Hình Nhà Máy.`);
        return f;
      }
      const nextMolds = current.map((a) => {
        const without = a.producesSkus.filter((s) => !(s.productName === p.productName && s.sizeLabel === p.sizeLabel));
        const skus = a.id === moldId ? [...without, { productName: p.productName, sizeLabel: p.sizeLabel }] : without;
        return { ...a, producesSkus: skus };
      });
      return { ...f, resources: { ...f.resources, fitting: { ...f.resources.fitting, moldAssets: nextMolds } } };
    });
  };

  const updateProduct = (indexInKind: number, kind: 'pipe' | 'fitting', newProduct: Product) => {
    setForm((f) => {
      if (!f) return f;
      const products = [...f.products];
      // Find the actual index in the main products array
      let count = 0;
      const actualIndex = products.findIndex((p) => {
        if (p.kind === kind) {
          if (count === indexInKind) return true;
          count++;
        }
        return false;
      });
      if (actualIndex >= 0) {
        products[actualIndex] = newProduct;
      }
      return { ...f, products };
    });
  };

  const removeProduct = (indexInKind: number, kind: 'pipe' | 'fitting') => {
    if (!window.confirm('Bạn có chắc muốn xoá sản phẩm này? Việc xoá sẽ làm mất dữ liệu lịch sử giá của sản phẩm.')) return;
    setForm((f) => {
      if (!f) return f;
      let count = 0;
      const products = f.products.filter((p) => {
        if (p.kind === kind) {
          if (count === indexInKind) {
            count++;
            return false;
          }
          count++;
        }
        return true;
      });
      return { ...f, products };
    });
  };

  const addPipe = () => {
    setForm((f) => {
      if (!f) return f;
      const newPipe: PipeProduct = {
        kind: 'pipe',
        dn: '20',
        spec: 'SDR 11',
        odMm: 20,
        minWallThicknessMm: 2,
        unitWeightKgPerM: 0.1,
        materialId: f.materials.find((m) => f.products.some(p => p.kind === 'pipe' && p.materialId === m.id))?.id || f.materials[0]?.id || '',
      };
      return { ...f, products: [...f.products, newPipe] };
    });
  };

  const addFitting = () => {
    setForm((f) => {
      if (!f) return f;
      const newFitting: FittingProduct = {
        kind: 'fitting',
        productName: 'Nối trơn',
        sizeLabel: '20',
        unit: 'cái',
        moldSizeDN: 20,
        cycleTimeSec: 60,
        cavity: 1,
        unitWeightKg: 0.05,
        materialId: f.materials.find((m) => f.products.some(p => p.kind === 'fitting' && p.materialId === m.id))?.id || f.materials[0]?.id || '',
      };
      return { ...f, products: [...f.products, newFitting] };
    });
  };

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError(null);
    // Chặn trùng khóa SKU (Ống: DN + nguyên liệu; Phụ kiện: tên + size + nguyên
    // liệu) — mỗi cặp (DN, nguyên liệu) hiện chỉ mang 1 tiêu chuẩn; muốn cùng
    // DN cùng nguyên liệu chạy 2 tiêu chuẩn (vd SDR 13.5 và SCH80) là nâng cấp
    // khóa sản phẩm — chưa hỗ trợ.
    const seen = new Set<string>();
    for (const p of form?.products ?? []) {
      const key = p.kind === 'pipe' ? `Ống DN${p.dn} · ${materials.find((m) => m.id === p.materialId)?.name ?? p.materialId}` : `${p.productName} ${p.sizeLabel} · ${materials.find((m) => m.id === p.materialId)?.name ?? p.materialId}`;
      if (seen.has(key)) {
        setSaveState('error');
        setSaveError(`Trùng sản phẩm: "${key}" xuất hiện 2 lần. Mỗi (kích cỡ, nguyên liệu) chỉ được khai 1 dòng — cùng DN cùng nguyên liệu mà khác tiêu chuẩn thì hệ thống chưa phân biệt được.`);
        return;
      }
      seen.add(key);
    }
    const parsed = ScenarioInputSchema.safeParse(form);
    if (!parsed.success) {
      setSaveState('error');
      setSaveError(`Dữ liệu không hợp lệ: ${parsed.error.issues[0]?.message ?? 'lỗi không rõ'}`);
      return;
    }
    try {
      await setDoc(doc(db, `scenarios/${scenarioId}`), parsed.data);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{ padding: '32px 36px', paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Quản Trị Dữ Liệu Gốc</div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Danh Mục Sản Phẩm</h1>
          <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>
            Quản lý các mã Ống và Phụ kiện tham gia vào bài toán tính giá thành. Phụ kiện chỉ LÊN BẢNG GIÁ khi đã gán khuôn — nhiều SKU dùng chung một khuôn là bình thường (cùng khuôn, khác nguyên liệu).
          </div>
          {!canEditMolds && (
            <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #b45309', borderRadius: 6, padding: '7px 12px', marginTop: 8, fontWeight: 600 }}>
              Bạn tạo/sửa được danh mục sản phẩm. Riêng GÁN KHUÔN là thao tác trên tài sản vốn — chỉ vai Toàn Quyền làm được: SKU mới của bạn sẽ ở trạng thái "chờ khuôn" cho tới khi được gán.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveState === 'saved' && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ Đã lưu</span>}
          {saveState === 'error' && <span style={{ fontSize: 11, color: '#DC2626' }}>{saveError}</span>}
          <button
            onClick={() => void handleSave()}
            disabled={saveState === 'saving' || !canEdit}
            style={{ padding: '10px 22px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}
          >
            {saveState === 'saving' ? 'Đang lưu…' : 'Lưu & Cập Nhật'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['pipe', 'fitting'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '6px 14px',
              borderRadius: 14,
              border: `1px solid ${activeTab === t ? '#a8003b' : '#d8d8d8'}`,
              background: activeTab === t ? '#a8003b' : '#fff',
              color: activeTab === t ? '#fff' : '#555',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t === 'pipe' ? `Ống CPVC (${pipeProducts.length})` : `Phụ Kiện (${fittingProducts.length})`}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflowX: 'auto' }}>
        {activeTab === 'pipe' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
            <thead style={{ background: '#f5f5f5', fontSize: 10, textTransform: 'uppercase', color: '#555' }}>
              <tr>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>DN</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Tiêu chuẩn (Spec)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>OD (mm)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Dày min (mm)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Đơn trọng (kg/m)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Nguyên liệu (Compound)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {pipeProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode value={p.dn} onChange={(v: string) => updateProduct(i, 'pipe', { ...p, dn: v })} width={60} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode value={p.spec} onChange={(v: string) => updateProduct(i, 'pipe', { ...p, spec: v })} width={100} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode type="number" value={p.odMm} onChange={(v: number) => updateProduct(i, 'pipe', { ...p, odMm: v })} width={60} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode type="number" value={p.minWallThicknessMm} onChange={(v: number) => updateProduct(i, 'pipe', { ...p, minWallThicknessMm: v })} width={60} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode type="number" value={p.unitWeightKgPerM} onChange={(v: number) => updateProduct(i, 'pipe', { ...p, unitWeightKgPerM: v })} width={70} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <select
                      value={p.materialId}
                      onChange={(e) => updateProduct(i, 'pipe', { ...p, materialId: e.target.value })}
                      style={{ width: 140, padding: '4px 6px', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 11, background: '#fff' }}
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button onClick={() => removeProduct(i, 'pipe')} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1000 }}>
            <thead style={{ background: '#f5f5f5', fontSize: 10, textTransform: 'uppercase', color: '#555' }}>
              <tr>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Tên SP</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Size</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Khuôn (DN)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Chu kỳ (s)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Khoang</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Đơn trọng (kg)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8' }}>Nguyên liệu</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8', width: 170 }}>Khuôn (dùng chung được)</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8', width: 140 }}>Ren Kim Loại</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid #d8d8d8', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {fittingProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode value={p.productName} onChange={(v: string) => updateProduct(i, 'fitting', { ...p, productName: v })} width={100} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode value={p.sizeLabel} onChange={(v: string) => updateProduct(i, 'fitting', { ...p, sizeLabel: v })} width={50} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode type="number" value={p.moldSizeDN} onChange={(v: number) => updateProduct(i, 'fitting', { ...p, moldSizeDN: v })} width={50} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode type="number" value={p.cycleTimeSec} onChange={(v: number) => updateProduct(i, 'fitting', { ...p, cycleTimeSec: v })} width={50} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode type="number" value={p.cavity} onChange={(v: number) => updateProduct(i, 'fitting', { ...p, cavity: v })} width={50} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <InputNode type="number" value={p.unitWeightKg} onChange={(v: number) => updateProduct(i, 'fitting', { ...p, unitWeightKg: v })} width={60} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <select
                      value={p.materialId}
                      onChange={(e) => updateProduct(i, 'fitting', { ...p, materialId: e.target.value })}
                      style={{ width: 120, padding: '4px 6px', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 11, background: '#fff' }}
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {(() => {
                      const mold = moldOfSku(p);
                      return (
                        <div>
                          <select
                            value={mold?.id ?? ''}
                            disabled={!canEditMolds}
                            onChange={(e) => assignMold(p, e.target.value)}
                            style={{ width: 160, padding: '4px 6px', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 10.5, background: '#fff' }}
                          >
                            <option value="">— Chưa có khuôn —</option>
                            {moldAssets.map((a) => (
                              <option key={a.id} value={a.id}>{a.label}</option>
                            ))}
                          </select>
                          <div style={{ fontSize: 9, marginTop: 3, fontWeight: 700, color: managementStatusOf(p, moldAssets) === 'active' ? '#16A34A' : '#b45309' }}>
                            {managementStatusOf(p, moldAssets) === 'active'
                              ? `✅ Có khuôn — lên bảng giá${mold && mold.producesSkus.length > 1 ? ` (chung với ${mold.producesSkus.length - 1} SKU khác)` : ''}`
                              : '⏳ Chờ khuôn — ẨN khỏi bảng giá'}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {p.metalInsert ? (
                      <div style={{ fontSize: 10, background: '#f5f5f3', padding: 6, borderRadius: 2, border: '1px dashed #d8d8d8' }}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                          <select
                            value={p.metalInsert.renType}
                            onChange={(e) => updateProduct(i, 'fitting', { ...p, metalInsert: { ...p.metalInsert!, renType: e.target.value as any } })}
                            style={{ padding: '2px 4px', fontSize: 10, outline: 'none', border: '1px solid #d8d8d8', borderRadius: 2, background: '#fff' }}
                          >
                            <option value="trong">Trong</option>
                            <option value="ngoài">Ngoài</option>
                          </select>
                          <InputNode value={p.metalInsert.ptSize} onChange={(v: string) => updateProduct(i, 'fitting', { ...p, metalInsert: { ...p.metalInsert!, ptSize: v } })} width={40} placeholder="Size" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          SL: <InputNode type="number" value={p.metalInsert.insertQtyPerUnit} onChange={(v: number) => updateProduct(i, 'fitting', { ...p, metalInsert: { ...p.metalInsert!, insertQtyPerUnit: v } })} width={40} />
                        </div>
                        <div style={{ textAlign: 'right', marginTop: 4 }}>
                          <button onClick={() => { const { metalInsert, ...rest } = p; updateProduct(i, 'fitting', rest as FittingProduct); }} style={{ fontSize: 9, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Xóa ren</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => updateProduct(i, 'fitting', { ...p, metalInsert: { renType: 'trong', ptSize: '1/2"', insertQtyPerUnit: 1 } })} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 2, border: '1px dashed #a8003b', background: '#fff', color: '#a8003b', cursor: 'pointer' }}>+ Thêm ren</button>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button onClick={() => removeProduct(i, 'fitting')} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 14, display: canEdit ? 'flex' : 'none', gap: 10 }}>
        <button
          onClick={activeTab === 'pipe' ? addPipe : addFitting}
          style={{ padding: '6px 14px', borderRadius: 14, border: '1px dashed #a8003b', background: '#fff', color: '#a8003b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >
          + Thêm {activeTab === 'pipe' ? 'Ống CPVC' : 'Phụ Kiện'} mới
        </button>
      </div>
    </div>
  );
}
