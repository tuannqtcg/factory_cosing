// ADR-033 roll-out: trình bày qua design tokens (đen–trắng tối giản).
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { ScenarioInputSchema, type ScenarioInput } from '../../schemas/scenario.js';
import { managementStatusOf, type PipeProduct, type FittingProduct, type Product } from '../../schemas/product.js';
import type { MoldAsset } from '../../schemas/resource.js';
import { calculateScenario } from '../../engine/scenario.js';
import { Screen, tk, ft, rd } from '../../design/primitives.js';
import { eyebrowStyle } from '../../design/tokens.js';

const InputNode = ({ value, onChange, type = 'text', width = 60, placeholder = '' }: any) => (
  <input
    type={type}
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(type === 'number' ? (e.target.value ? Number(e.target.value) : e.target.value) : e.target.value)}
    style={{ width, padding: '4px 6px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, fontSize: ft.size.xs, color: tk.ink }}
  />
);

export default function ProductsScreen({
  role,
  scenarioId,
  scenario,
  formOverride,
  onFormChange,
  hideChrome,
}: {
  role: AppRole;
  scenarioId: string;
  scenario: ScenarioInput | null;
  // Chế độ "controlled" (nhúng ở Thiết Lập Dữ Liệu — ADR-049): dùng CHUNG form +
  // setter của màn cha để 1 nguồn dữ liệu, 1 nút Lưu (tránh 2 form ghi đè nhau).
  formOverride?: ScenarioInput | null;
  onFormChange?: Dispatch<SetStateAction<ScenarioInput | null>>;
  hideChrome?: boolean;
}) {
  // ADR-039 — quyền khớp rules server: DANH MỤC (products[]) mở cho cả Toàn
  // Quyền lẫn Định Giá (master data kỹ thuật); riêng KHUÔN (moldAssets — tài
  // sản vốn: giá mua, khấu hao) vẫn chỉ Toàn Quyền, kể cả việc gán SKU↔khuôn.
  const canEdit = role === 'admin' || role === 'pricing';
  const canEditMolds = role === 'admin';
  const canView = canEdit;
  const controlled = !!onFormChange;
  const [internalForm, setInternalForm] = useState<ScenarioInput | null>(null);
  const loadedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'pipe' | 'fitting'>('pipe');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [diag, setDiag] = useState<{ ok: boolean; msg: string } | null>(null);

  const form = controlled ? formOverride ?? null : internalForm;
  const setForm = controlled ? onFormChange! : setInternalForm;

  if (!controlled && scenario && !loadedRef.current) {
    loadedRef.current = true;
    setInternalForm(scenario);
  }

  if (!canView) {
    return (
      <Screen>
        <h1 style={{ margin: 0, fontSize: ft.size.xxl, fontWeight: ft.weight.bold, color: tk.ink }}>Danh Mục Sản Phẩm</h1>
        <p style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Màn hình này chỉ dành cho vai Toàn Quyền / Định Giá.</p>
      </Screen>
    );
  }
  if (!form) {
    return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải danh mục sản phẩm…</div></Screen>;
  }

  const materials = form.materials;
  const pipeProducts = form.products.filter((p) => p.kind === 'pipe') as PipeProduct[];
  const fittingProducts = form.products.filter((p) => p.kind === 'fitting') as FittingProduct[];
  // ADR-046 — công suất TỐI ĐA máy đùn (kg/giờ) = HẰNG SỐ vật lý, dùng làm trần
  // cảnh báo khi nhập m/giờ theo size (m/giờ × đơn trọng không được vượt trần này).
  const pipeMaxKgPerHour = form.resources.pipe.driverType === 'continuous_kg' ? form.resources.pipe.maxCapacityKgPerHour : undefined;
  // ADR-047 — cách tính giá thành Ống đang bật (công tắc toàn cục ở sidebar). CHỈ
  // đọc để trình bày cho khớp: cột "CS đùn (m/giờ)" đổi VAI TRÒ theo chế độ —
  // 'meters' thì con số này quyết định giá vốn từng size; 'kg' thì nó chỉ là
  // cảnh báo công suất, KHÔNG ăn vào giá (rải đều theo kg, chuẩn Excel v3.4).
  const pipeCostMethod = form.pipeCostMethod ?? 'kg';
  const costByMeters = pipeCostMethod === 'meters';

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

  // ADR-044 — KIỂM TRA vì sao bảng giá thiếu: chạy engine NGAY trên dữ liệu đang
  // sửa. Phân biệt rõ 3 tình huống: (a) dữ liệu lỗi → engine ném → bảng giá KHÔNG
  // cập nhật được; (b) phụ kiện "chờ khuôn" (0 lên giá) → thiếu khuôn; (c) engine
  // báo CÓ lên giá nhưng bảng giá vẫn trống → máy chủ chưa tính lại (Cloud Function).
  const checkPriceListData = () => {
    if (!form) return;
    const parsed = ScenarioInputSchema.safeParse(form);
    if (!parsed.success) {
      setDiag({ ok: false, msg: `✗ Dữ liệu CHƯA HỢP LỆ: ${parsed.error.issues[0]?.message ?? 'lỗi không rõ'}.\nBảng giá không thể cập nhật cho tới khi sửa. Kiểm tra lại các SKU/nguyên liệu vừa nhập.` });
      return;
    }
    let out;
    try {
      out = calculateScenario(parsed.data);
    } catch (e) {
      setDiag({ ok: false, msg: `✗ Không tính được giá: ${e instanceof Error ? e.message : String(e)}.\nThường do SKU trỏ tới nguyên liệu đã xóa, hoặc trùng khóa. Sửa xong bấm lại.` });
      return;
    }
    // Đếm phụ kiện active/chờ-khuôn theo nguyên liệu.
    const byMat = new Map<string, { active: number; pending: number }>();
    for (const sku of out.skuPriceChains) {
      if (sku.productKey.productName === undefined) continue; // bỏ ống
      const e = byMat.get(sku.productKey.materialId) ?? { active: 0, pending: 0 };
      if (sku.managementStatus === 'active') e.active++; else e.pending++;
      byMat.set(sku.productKey.materialId, e);
    }
    const nameOf = (id: string) => parsed.data.materials.find((m) => m.id === id)?.name ?? id;
    const lines = [...byMat.entries()].map(([id, c]) => `• ${nameOf(id)}: ${c.active} SẼ lên bảng giá${c.pending ? `, ${c.pending} chờ khuôn (ẩn)` : ''}`);
    const totalActive = [...byMat.values()].reduce((s, c) => s + c.active, 0);
    const tail = totalActive > 0
      ? '\n\n→ Có SKU sẽ lên giá. Nếu bảng giá THẬT vẫn trống: bấm "Lưu" (để máy chủ tính lại), hoặc máy chủ (Cloud Function) chưa tính — chờ 1–2 phút / báo lại.'
      : '\n\n→ 0 SKU lên giá: phụ kiện đều "chờ khuôn" — KHUÔN bị thiếu. Cần gán khuôn (tên+size phải khớp khuôn dùng chung BlazeMaster).';
    setDiag({ ok: totalActive > 0, msg: `✓ Dữ liệu hợp lệ. Phụ kiện theo nguyên liệu:\n${lines.join('\n')}${tail}` });
  };

  return (
    <div style={{ padding: hideChrome ? '18px 18px 24px' : '32px 36px', paddingBottom: hideChrome ? 24 : 100 }}>
      {!hideChrome && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ ...eyebrowStyle, marginBottom: 5 }}>Quản Trị Dữ Liệu Gốc</div>
          <h1 style={{ margin: 0, fontSize: ft.size.xxl, fontWeight: ft.weight.bold, letterSpacing: '-.3px', color: tk.ink }}>Danh Mục Sản Phẩm</h1>
          <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 4 }}>
            Quản lý các mã Ống và Phụ kiện tham gia vào bài toán tính giá thành. Phụ kiện chỉ LÊN BẢNG GIÁ khi đã gán khuôn — nhiều SKU dùng chung một khuôn là bình thường (cùng khuôn, khác nguyên liệu).
          </div>
          {!canEditMolds && (
            <div style={{ fontSize: ft.size.xs, color: tk.warningInk, background: tk.warningTint, border: `1px solid ${tk.warning}`, borderRadius: rd.md, padding: '7px 12px', marginTop: 8, fontWeight: ft.weight.semibold }}>
              Bạn tạo/sửa được danh mục sản phẩm. Riêng GÁN KHUÔN là thao tác trên tài sản vốn — chỉ vai Toàn Quyền làm được: SKU mới của bạn sẽ ở trạng thái "chờ khuôn" cho tới khi được gán.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveState === 'saved' && <span style={{ fontSize: ft.size.xs, color: tk.successInk, fontWeight: ft.weight.semibold }}>✓ Đã lưu</span>}
          {saveState === 'error' && <span style={{ fontSize: ft.size.xs, color: tk.dangerInk }}>{saveError}</span>}
          <button
            onClick={() => void handleSave()}
            disabled={saveState === 'saving' || !canEdit}
            style={{ padding: '10px 22px', background: tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.sm, cursor: 'pointer', fontSize: ft.size.xs, fontWeight: ft.weight.bold, letterSpacing: '.06em', textTransform: 'uppercase' }}
          >
            {saveState === 'saving' ? 'Đang lưu…' : 'Lưu & Cập Nhật'}
          </button>
        </div>
      </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['pipe', 'fitting'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '6px 14px',
              borderRadius: rd.pill,
              border: `1px solid ${activeTab === t ? tk.brand : tk.borderStrong}`,
              background: activeTab === t ? tk.brand : tk.surface,
              color: activeTab === t ? tk.inkInverse : tk.inkMuted,
              fontSize: ft.size.xs,
              fontWeight: ft.weight.semibold,
              cursor: 'pointer',
            }}
          >
            {t === 'pipe' ? `Ống CPVC (${pipeProducts.length})` : `Phụ Kiện (${fittingProducts.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'pipe' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 12,
            padding: '9px 13px',
            borderRadius: rd.md,
            border: `1px solid ${costByMeters ? tk.ink : tk.warning}`,
            background: costByMeters ? tk.surfaceMuted : tk.warningTint,
            fontSize: ft.size.sm,
            lineHeight: 1.5,
            color: tk.ink,
          }}
        >
          <span style={{ fontWeight: ft.weight.bold }}>{costByMeters ? '⏱' : '⚖'}</span>
          <span>
            Đang tính giá thành Ống <b>{costByMeters ? 'theo m/giờ (giờ máy per-size)' : 'theo kg (rải đều — chuẩn Excel)'}</b>.{' '}
            {costByMeters ? (
              <>
                Cột <b>“CS đùn (m/giờ)”</b> bên dưới <b>quyết định giá vốn từng size</b> (size chạy chậm gánh giá cao hơn) và{' '}
                <b>tổng sản lượng/năm</b> (size chậm kéo công suất máy xuống → doanh thu &amp; lợi nhuận đổi theo — ADR-048).
                Hãy nhập số đo m/giờ thật; size bỏ trống sẽ suy từ tốc độ chung (rơi về đúng kết quả theo kg).
              </>
            ) : (
              <>
                Cột <b>“CS đùn (m/giờ)”</b> bên dưới <b>KHÔNG ảnh hưởng giá</b> ở chế độ này — chỉ dùng để{' '}
                <b>cảnh báo công suất</b> (m/giờ × đơn trọng có vượt trần máy không). Đổi cách tính ở công tắc “Cách tính giá thành Ống” trên thanh bên.
              </>
            )}
          </span>
        </div>
      )}

      <div style={{ background: tk.surface, border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, overflowX: 'auto' }}>
        {activeTab === 'pipe' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
            <thead style={{ background: tk.surfaceMuted, fontSize: ft.size.xs, textTransform: 'uppercase', color: tk.inkMuted }}>
              <tr>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>DN</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Tiêu chuẩn (Spec)</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>OD (mm)</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Dày min (mm)</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Đơn trọng (kg/m)</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }} title="ADR-069 — số cây ống đóng trong 1 túi ni lông, dùng khi công tắc &quot;Bao bì Ống&quot; = theo túi. Để trống = DN này vẫn tính theo kg (flat) dù công tắc bật.">Cây/túi</th>
                <th
                  style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${costByMeters ? tk.ink : tk.borderStrong}`,
                    background: costByMeters ? tk.surfaceMuted : undefined,
                    color: costByMeters ? tk.ink : tk.inkFaint,
                    fontWeight: costByMeters ? ft.weight.bold : ft.weight.regular,
                  }}
                  title={
                    costByMeters
                      ? `Đang tính giá THEO m/giờ: con số này quyết định giá vốn từng size. Cảnh báo nếu m/giờ × đơn trọng vượt công suất tối đa máy${pipeMaxKgPerHour ? ` (${pipeMaxKgPerHour} kg/giờ)` : ''}.`
                      : `Đang tính giá THEO kg: cột này KHÔNG ăn vào giá, chỉ cảnh báo nếu m/giờ × đơn trọng vượt công suất tối đa máy${pipeMaxKgPerHour ? ` (${pipeMaxKgPerHour} kg/giờ)` : ''}.`
                  }
                >
                  CS đùn (m/giờ){costByMeters ? ' → giá' : ' · chỉ cảnh báo'}
                </th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Nguyên liệu (Compound)</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}`, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {pipeProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${tk.surfaceMuted}` }}>
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
                    <InputNode
                      type="number"
                      value={p.piecesPerBag ?? ''}
                      placeholder="—"
                      onChange={(v: number | string) =>
                        updateProduct(i, 'pipe', { ...p, piecesPerBag: v === '' || Number.isNaN(Number(v)) ? undefined : Number(v) })
                      }
                      width={60}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {(() => {
                      const mph = p.capacityMetersPerHour;
                      const kgh = mph !== undefined ? mph * p.unitWeightKgPerM : undefined;
                      const over = kgh !== undefined && pipeMaxKgPerHour !== undefined && kgh > pipeMaxKgPerHour;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <InputNode
                            type="number"
                            value={mph ?? ''}
                            onChange={(v: number | string) => updateProduct(i, 'pipe', { ...p, capacityMetersPerHour: v === '' || Number.isNaN(Number(v)) ? undefined : Number(v) })}
                            width={70}
                            placeholder="m/giờ"
                          />
                          {kgh !== undefined && (
                            <span title={over ? `Vượt công suất máy: ${Math.round(kgh)} kg/giờ > ${pipeMaxKgPerHour} kg/giờ. Giảm m/giờ.` : `≈ ${Math.round(kgh)} kg/giờ (trong ngưỡng)`}
                              style={{ fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, color: over ? tk.dangerInk : tk.successInk, whiteSpace: 'nowrap' }}>
                              {over ? `⚠ ${Math.round(kgh)}kg/h` : `✓ ${Math.round(kgh)}kg/h`}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <select
                      value={p.materialId}
                      onChange={(e) => updateProduct(i, 'pipe', { ...p, materialId: e.target.value })}
                      style={{ width: 140, padding: '4px 6px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, fontSize: ft.size.xs, background: tk.surface, color: tk.ink }}
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button onClick={() => removeProduct(i, 'pipe')} style={{ color: tk.dangerInk, background: 'none', border: 'none', cursor: 'pointer', fontSize: ft.size.sm }}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1000 }}>
            <thead style={{ background: tk.surfaceMuted, fontSize: ft.size.xs, textTransform: 'uppercase', color: tk.inkMuted }}>
              <tr>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Tên SP</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Size</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Khuôn (DN)</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Chu kỳ (s)</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Khoang</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Đơn trọng (kg)</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }} title="ADR-060 — số cái/thùng carton, dùng khi công tắc &quot;Bao bì Phụ kiện&quot; = theo thùng. Để trống = SKU này vẫn tính theo kg (flat) dù công tắc bật.">Cái/thùng</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}` }}>Nguyên liệu</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}`, width: 170 }}>Khuôn (dùng chung được)</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}`, width: 140 }}>Ren Kim Loại</th>
                <th style={{ padding: '8px 12px', borderBottom: `1px solid ${tk.borderStrong}`, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {fittingProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${tk.surfaceMuted}`, verticalAlign: 'top' }}>
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
                    <InputNode
                      type="number"
                      value={p.piecesPerBox ?? ''}
                      placeholder="—"
                      onChange={(v: number | string) =>
                        updateProduct(i, 'fitting', { ...p, piecesPerBox: v === '' || Number.isNaN(Number(v)) ? undefined : Number(v) })
                      }
                      width={55}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <select
                      value={p.materialId}
                      onChange={(e) => updateProduct(i, 'fitting', { ...p, materialId: e.target.value })}
                      style={{ width: 120, padding: '4px 6px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, fontSize: ft.size.xs, background: tk.surface, color: tk.ink }}
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
                            style={{ width: 160, padding: '4px 6px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, fontSize: ft.size.eyebrow, background: tk.surface, color: tk.ink }}
                          >
                            <option value="">— Chưa có khuôn —</option>
                            {moldAssets.map((a) => (
                              <option key={a.id} value={a.id}>{a.label}</option>
                            ))}
                          </select>
                          <div style={{ fontSize: ft.size.eyebrow, marginTop: 3, fontWeight: ft.weight.bold, color: managementStatusOf(p, moldAssets) === 'active' ? tk.successInk : tk.warningInk }}>
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
                      <div style={{ fontSize: ft.size.eyebrow, background: tk.surfaceMuted, padding: 6, borderRadius: rd.sm, border: `1px dashed ${tk.borderStrong}` }}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                          <select
                            value={p.metalInsert.renType}
                            onChange={(e) => updateProduct(i, 'fitting', { ...p, metalInsert: { ...p.metalInsert!, renType: e.target.value as any } })}
                            style={{ padding: '2px 4px', fontSize: ft.size.eyebrow, outline: 'none', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, background: tk.surface, color: tk.ink }}
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
                          <button onClick={() => { const { metalInsert, ...rest } = p; updateProduct(i, 'fitting', rest as FittingProduct); }} style={{ fontSize: ft.size.eyebrow, color: tk.dangerInk, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Xóa ren</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => updateProduct(i, 'fitting', { ...p, metalInsert: { renType: 'trong', ptSize: '1/2"', insertQtyPerUnit: 1 } })} style={{ fontSize: ft.size.eyebrow, padding: '4px 8px', borderRadius: rd.sm, border: `1px dashed ${tk.borderStrong}`, background: tk.surface, color: tk.ink, cursor: 'pointer' }}>+ Thêm ren</button>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button onClick={() => removeProduct(i, 'fitting')} style={{ color: tk.dangerInk, background: 'none', border: 'none', cursor: 'pointer', fontSize: ft.size.sm }}>Xóa</button>
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
          style={{ padding: '6px 14px', borderRadius: rd.pill, border: `1px dashed ${tk.borderStrong}`, background: tk.surface, color: tk.ink, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, cursor: 'pointer' }}
        >
          + Thêm {activeTab === 'pipe' ? 'Ống CPVC' : 'Phụ Kiện'} mới
        </button>
        <button
          onClick={checkPriceListData}
          title="Chạy engine ngay trên dữ liệu đang sửa để biết vì sao bảng giá thiếu (dữ liệu lỗi / thiếu khuôn / máy chủ chưa tính)."
          style={{ padding: '6px 14px', borderRadius: rd.pill, border: `1px dashed ${tk.borderStrong}`, background: tk.surface, color: tk.inkMuted, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, cursor: 'pointer' }}
        >
          🔎 Kiểm tra dữ liệu bảng giá
        </button>
      </div>
      {diag && (
        <div style={{ marginTop: 10, padding: '11px 14px', borderRadius: rd.md, border: `1px solid ${diag.ok ? tk.success : tk.danger}`, background: diag.ok ? tk.successTint : tk.dangerTint, color: diag.ok ? tk.successInk : tk.dangerInk, fontSize: ft.size.sm, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {diag.msg}
        </div>
      )}
    </div>
  );
}
