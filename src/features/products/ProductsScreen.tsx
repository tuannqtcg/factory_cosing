import { useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { ScenarioInputSchema, type ScenarioInput } from '../../schemas/scenario.js';
import type { PipeProduct, FittingProduct, Product } from '../../schemas/product.js';

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
  const canEdit = role === 'admin' || role === 'pricing';
  const [form, setForm] = useState<ScenarioInput | null>(null);
  const loadedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'pipe' | 'fitting'>('pipe');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  if (scenario && !loadedRef.current) {
    loadedRef.current = true;
    setForm(scenario);
  }

  if (!canEdit) {
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

  const seedCorzanPipes = () => {
    const corzanMat = form?.materials.find((m) => m.name.toLowerCase().includes('corzan') || m.id.toLowerCase().includes('corzan')) || form?.materials[0];
    const corzanId = corzanMat?.id ?? '';
    
    const data = [
      ["3/4", "20", 0.358279989],
      ["1", "25", 0.526176116],
      ["1,25", "32", 0.712158917],
      ["1,5", "40", 0.848996797],
      ["2", "50", 1.137023817],
      ["2,5", "65", 1.79489852],
      ["3", "80", 2.351474652],
      ["3,5", "90", 2.82435135],
      ["4", "100", 3.345977956],
      ["5", "125", 4.537816317],
      ["6", "150", 5.894814898],
      ["8", "200", 8.87743801],
      ["10", "250", 12.58565203],
      ["12", "300", 16.6358004],
      ["14", "350", 19.68879769],
      ["16", "400", 25.7212535],
      ["18", "450", 32.50674525],
      ["20", "500", 38.19039286],
      ["24", "600", 53.15278768]
    ];

    setForm((f) => {
      if (!f) return f;
      const newPipes = data.map((row) => ({
        kind: 'pipe' as const,
        dn: row[1] as string,
        spec: `SCH40 ${row[0]}"`,
        odMm: Number(row[1]),
        minWallThicknessMm: 2,
        unitWeightKgPerM: row[2] as number,
        materialId: corzanId
      }));
      return {
        ...f,
        products: [...f.products, ...newPipes]
      };
    });
  };

  return (
    <div style={{ padding: '32px 36px', paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Quản Trị Dữ Liệu Gốc</div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Danh Mục Sản Phẩm</h1>
          <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>
            Quản lý các mã Ống và Phụ kiện tham gia vào bài toán tính giá thành
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveState === 'saved' && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ Đã lưu</span>}
          {saveState === 'error' && <span style={{ fontSize: 11, color: '#DC2626' }}>{saveError}</span>}
          <button
            onClick={() => void handleSave()}
            disabled={saveState === 'saving'}
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

      <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
        <button
          onClick={activeTab === 'pipe' ? addPipe : addFitting}
          style={{ padding: '6px 14px', borderRadius: 14, border: '1px dashed #a8003b', background: '#fff', color: '#a8003b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >
          + Thêm {activeTab === 'pipe' ? 'Ống CPVC' : 'Phụ Kiện'} mới
        </button>
        {activeTab === 'pipe' && (
          <button
            onClick={seedCorzanPipes}
            style={{ padding: '6px 14px', borderRadius: 2, border: '1px dashed #16A34A', background: '#fff', color: '#16A34A', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            + Seed 19 Ống Corzan SCH40
          </button>
        )}
      </div>
    </div>
  );
}
