// Màn "Thiết lập dữ liệu" (ADR-049 — IA gộp cấu hình, CHỈ trình bày lại, KHÔNG
// đổi schema/engine). Prototype Pha 1: prototype/data-setup.html.
//
// Nguyên tắc: gom các field đang rải ở "Tham Số" + "Cấu Hình Nhà Máy" thành 1 màn
// xếp theo BẢN CHẤT kế toán, tách rõ Ô NHẬP (viền, sửa được) vs SỐ TỰ TÍNH (nền
// xám + nhãn fx, chỉ đọc). Số tự tính LẤY từ engine đang có (khấu hao thẳng =
// nguyên giá×SL/đời — đúng công thức pipe.ts/fitting.ts/cost-pool.ts; khấu hao
// khuôn gọi moldDepreciationPerYear ADR-007). KHÔNG phát minh công thức mới.
//
// Trạng thái: mục ① Sổ tài sản cố định XONG. Mục ②–⑥ + Báo cáo đang dựng dần
// (tạm trỏ về màn cũ) — làm từng mục một.
// ADR-033 roll-out: trình bày qua design tokens (đen–trắng tối giản). 3 nhóm
// phân bổ (Ống/Phụ kiện/Chung) phân biệt bằng NHÃN CHỮ, không hue riêng — nhất
// quán với mọi màn khác đã di trú (accent tương tác = đen).
import { useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { fmtVnd, fmtUsd } from '../../lib/format.js';
import { ScenarioInputSchema, type ScenarioInput, type ScenarioOutput } from '../../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource, MoldAsset } from '../../schemas/resource.js';
import type { FittingProduct, PipeProduct } from '../../schemas/product.js';
import type { Material } from '../../schemas/material.js';
import ProductsScreen from '../products/ProductsScreen.js';
import { moldDepreciationPerYear } from '../../engine/mold-depreciation.js';
import { effectivePipeCapacity } from '../../engine/pipe.js';
import { calculateFittingCapacity } from '../../engine/fitting.js';
import { sharedFixedCostsTotalPerYear, landedCostPerKgVnd } from '../../engine/cost-pool.js';
import { weightedAvgUsdPerKg, totalInventoryKg } from '../../engine/dual-costing.js';
import { calculateDashboardKpis } from '../../engine/dashboard-support.js';
import CostWaterfall from '../shared/CostWaterfall.js';
import { writePriceLockAuditEntry } from '../../lib/priceLockAudit.js';
import { MoldAssetModal } from '../config/MoldAssetModal.js';
import { tk, ft, rd, tnum } from '../../design/primitives.js';
import { eyebrowStyle } from '../../design/tokens.js';

type SectionId = 'assets' | 'conv' | 'oh' | 'mat' | 'sku' | 'fin' | 'pricing' | 'pnl';
const SETUP_SECTIONS: Array<{ id: SectionId; no: string; t: string; cap: string }> = [
  { id: 'assets', no: '01', t: 'Tài sản cố định', cap: 'CAPEX · khấu hao · phân bổ' },
  { id: 'conv', no: '02', t: 'Chi phí chế biến', cap: 'nhân công · điện · nước theo dòng' },
  { id: 'oh', no: '03', t: 'Chi phí chung & ngoài SX', cap: 'thuê · lab · UL · tài chính' },
  { id: 'mat', no: '04', t: 'Nguyên liệu (compound)', cap: 'giá · thuế · khóa giá' },
  { id: 'sku', no: '05', t: 'Danh mục sản phẩm', cap: 'SKU · đơn trọng · khuôn' },
  { id: 'fin', no: '06', t: 'Tham số tài chính', cap: 'tỷ giá · VAT · vốn' },
  { id: 'pricing', no: '07', t: 'Chính sách giá & markup', cap: 'giá thành → hòa vốn → markup → giá' },
];

// ADR-033 — 3 nhóm phân bổ phân biệt bằng nhãn chữ (không hue riêng), nền/chữ
// trung tính dùng chung cho cả Ống/Phụ kiện/Chung — nhất quán mọi màn khác.
const ALLOC = {
  pipe: { label: 'Trực tiếp · Ống' },
  fit: { label: 'Trực tiếp · Phụ kiện' },
  shared: { label: 'Chung · phân bổ' },
} as const;

// ── Ô NHẬP (viền, sửa được; disabled → xám khóa) ──
function InCell({ value, onChange, unit, disabled, width = 130 }: { value: number; onChange: (v: number) => void; unit?: string; disabled?: boolean; width?: number | string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <input
        type="number"
        className={disabled ? undefined : 'ds-in'}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width, padding: '6px 9px', borderRadius: rd.md, fontSize: ft.size.sm, fontWeight: ft.weight.semibold, textAlign: 'right',
          ...tnum, outline: 'none',
          border: `1px solid ${disabled ? tk.border : tk.borderStrong}`, background: disabled ? tk.surfaceMuted : tk.surface,
          color: disabled ? tk.inkFaint : tk.ink, cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      {unit && <span style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>{unit}</span>}
    </div>
  );
}
// ── SỐ TỰ TÍNH (nền xám + nhãn fx, chỉ đọc) ──
function FxCell({ value, unit }: { value: number; unit?: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, background: tk.surfaceMuted, borderRadius: rd.md, padding: '6px 10px', minWidth: 130 }}>
      <span style={{ fontSize: 8.5, fontWeight: ft.weight.bold, color: tk.inkMuted, border: `1px solid ${tk.borderStrong}`, borderRadius: 3, padding: '0 3px', lineHeight: 1.35 }}>fx</span>
      <span style={{ fontFamily: ft.mono, fontSize: ft.size.sm, fontWeight: ft.weight.bold, color: tk.ink, ...tnum }}>{fmtVnd(value)}</span>
      {unit && <span style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>{unit}</span>}
    </div>
  );
}
function AllocTag({ kind }: { kind: keyof typeof ALLOC }) {
  const a = ALLOC[kind];
  return <span style={{ fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, padding: '3px 9px', borderRadius: rd.pill, background: tk.surfaceMuted, color: tk.inkMuted, whiteSpace: 'nowrap' }}>{a.label}</span>;
}
// Ô lưới cho mục chế biến/tài chính: nhãn trên, control dưới; derived = nền xám.
function GridCell({ label, derived, children }: { label: React.ReactNode; derived?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ padding: '13px 15px', borderRight: `1px solid ${tk.surfaceMuted}`, borderBottom: `1px solid ${tk.surfaceMuted}`, background: derived ? tk.surfaceMuted : tk.surface, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, fontWeight: ft.weight.medium, display: 'flex', alignItems: 'center', gap: 5 }}>{label}</div>
      {children}
    </div>
  );
}

export default function DataSetupScreen({ role, user, scenarioId, scenario, internal, initialSection }: {
  role: AppRole;
  user: { uid: string; email: string | null } | null;
  scenarioId: string;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
  // ADR-052 — deep-link từ Dashboard "xem chi tiết" mở thẳng mục tương ứng.
  initialSection?: SectionId;
}) {
  // Master-data tài sản khóa cho vai Định Giá (khớp firestore.rules — chỉ admin
  // sửa giá máy/khấu hao/CAPEX; ranh giới bảo mật, không phải điều hướng vai).
  const locked = role !== 'admin';
  const isAdmin = role === 'admin';
  const [section, setSection] = useState<SectionId>(initialSection ?? 'assets');
  const [form, setForm] = useState<ScenarioInput | null>(null);
  const loadedRef = useRef(false);
  const lastPersistedMaterialsRef = useRef<Material[] | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMoldModal, setShowMoldModal] = useState(false);

  if (scenario && !loadedRef.current) {
    loadedRef.current = true;
    setForm(scenario);
    lastPersistedMaterialsRef.current = scenario.materials;
  }
  if (!form) return <div style={{ padding: '32px 36px', fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải dữ liệu thiết lập…</div>;

  const pipe = form.resources.pipe as ContinuousKgResource;
  const fitting = form.resources.fitting as MachineHourResource;
  const shared = form.costPool.sharedFixedCosts;
  const asOfYear = form.asOfYear;

  const setPipe = (key: keyof ContinuousKgResource & string, v: number) =>
    setForm((f) => (f ? { ...f, resources: { ...f.resources, pipe: { ...(f.resources.pipe as ContinuousKgResource), [key]: v } } } : f));
  const setFitting = (key: keyof MachineHourResource & string, v: number) =>
    setForm((f) => (f ? { ...f, resources: { ...f.resources, fitting: { ...(f.resources.fitting as MachineHourResource), [key]: v } } } : f));
  const setMachineType = (i: number, key: 'priceVnd' | 'count', v: number) =>
    setForm((f) => {
      if (!f) return f;
      const cur = f.resources.fitting as MachineHourResource;
      return { ...f, resources: { ...f.resources, fitting: { ...cur, machineTypes: cur.machineTypes.map((m, ix) => (ix === i ? { ...m, [key]: v } : m)) } } };
    });
  const setShared = (key: keyof typeof shared & string, v: number) =>
    setForm((f) => (f ? { ...f, costPool: { ...f.costPool, sharedFixedCosts: { ...f.costPool.sharedFixedCosts, [key]: v } } } : f));
  const setMoldAssets = (molds: MoldAsset[]) =>
    setForm((f) => (f ? { ...f, resources: { ...f.resources, fitting: { ...(f.resources.fitting as MachineHourResource), moldAssets: molds } } } : f));
  const setNonProd = (key: 'operatingCostPerYear' | 'financialCostPerYear', v: number) =>
    setForm((f) => (f ? { ...f, costPool: { ...f.costPool, nonProductionCosts: { ...f.costPool.nonProductionCosts, [key]: v } } } : f));

  // ── Nguyên liệu (mục ④) — cùng setter/ngữ nghĩa AssumptionsScreen ──
  const setMaterials = (updater: (m: Material[]) => Material[]) => setForm((f) => (f ? { ...f, materials: updater(f.materials) } : f));
  const updMatNum = (id: string, key: 'markupVf' | 'importTaxRate' | 'customsLogisticsFeeRate', v: number) =>
    setMaterials((ms) => ms.map((m) => (m.id !== id ? m : { ...m, [key]: v })));
  const updReplacement = (id: string, v: number) =>
    setMaterials((ms) => ms.map((m) => (m.id !== id ? m : { ...m, inventory: { ...m.inventory, replacementPriceUsdPerKg: v } })));
  // ── Lô nhập compound (ADR-002 — bình quân gia quyền). Cùng ngữ nghĩa InventoryScreen. ──
  const updLot = (id: string, i: number, key: 'tons' | 'priceUsdPerKg', v: number) =>
    setMaterials((ms) => ms.map((m) => (m.id !== id ? m : { ...m, inventory: { ...m.inventory, lots: m.inventory.lots.map((l, ix) => (ix === i ? { ...l, [key]: v } : l)) } })));
  const addLot = (id: string) =>
    setMaterials((ms) => ms.map((m) => {
      if (m.id !== id || m.inventory.lots.length >= 5) return m; // schema max 5 lô
      return { ...m, inventory: { ...m.inventory, lots: [{ tons: 0, priceUsdPerKg: m.inventory.replacementPriceUsdPerKg }, ...m.inventory.lots] } };
    }));
  const removeLot = (id: string, i: number) =>
    setMaterials((ms) => ms.map((m) => (m.id !== id ? m : { ...m, inventory: { ...m.inventory, lots: m.inventory.lots.filter((_, ix) => ix !== i) } })));
  const updThreshold = (id: string, v: number) =>
    setMaterials((ms) => ms.map((m) => (m.id !== id ? m : { ...m, inventory: { ...m.inventory, priceLock: { ...m.inventory.priceLock, thresholdPct: v } } })));
  const chotBaseline = (id: string) =>
    setMaterials((ms) => ms.map((m) => (m.id !== id ? m : { ...m, inventory: { ...m.inventory, priceLock: { ...m.inventory.priceLock, baseline: m.inventory.replacementPriceUsdPerKg } } })));
  const updMatText = (id: string, key: 'name' | 'code' | 'originLabel', v: string) =>
    setMaterials((ms) => ms.map((m) => (m.id !== id ? m : { ...m, [key]: v })));
  const productRefsMaterial = (id: string) => form.products.some((p) => p.materialId === id);
  const addMaterial = () =>
    setMaterials((ms) => {
      let n = ms.length + 1;
      let id = `nguyen-lieu-${n}`;
      while (ms.some((m) => m.id === id)) id = `nguyen-lieu-${++n}`;
      return [...ms, { id, name: 'Nguyên liệu mới', code: '', originLabel: '', importTaxRate: 0, customsLogisticsFeeRate: 0.01, markupVf: 0.3, inventory: { lots: [], priceLock: { baseline: 0, thresholdPct: 0.03 }, replacementPriceUsdPerKg: 0 } }];
    });
  const removeMaterial = (id: string) => {
    if (productRefsMaterial(id)) { window.alert('Không xóa được: vẫn còn SKU dùng nguyên liệu này. Đổi/xóa ở mục Danh mục sản phẩm trước.'); return; }
    if (!window.confirm('Xóa nguyên liệu này? Bấm "Lưu" để áp dụng.')) return;
    setMaterials((ms) => ms.filter((m) => m.id !== id));
  };

  // ── Tham số tài chính (mục ⑥) ──
  const setCurrency = (key: 'usdVndRate' | 'vatOutputRate' | 'mandatoryInsuranceRate', v: number) =>
    setForm((f) => (f ? { ...f, costPool: { ...f.costPool, currency: { ...f.costPool.currency, [key]: v } } } : f));
  const setMarkup = (key: 'markupTcg' | 'listPriceMargin', v: number) =>
    setForm((f) => (f ? { ...f, costPool: { ...f.costPool, markup: { ...f.costPool.markup, [key]: v } } } : f));
  // ADR-055 — tỷ lệ đáy (production mix) % cho compound CHÍNH của dòng
  const setProductionMix = (key: 'productionMixPipePrimaryPct' | 'productionMixFittingPrimaryPct', v: number) =>
    setForm((f) => (f ? { ...f, [key]: v } : f));
  const setSolvent = (v: number) => setForm((f) => (f ? { ...f, costPool: { ...f.costPool, solvent550PricePerBox: v } } : f));

  // ── Khấu hao/năm — CÙNG công thức engine (thẳng = nguyên giá×SL/đời; khuôn = ADR-007) ──
  const depExtruder = (pipe.extruderPriceEach * pipe.extruderCount) / pipe.depreciationYears;
  const depPuller = pipe.moldPullerCutterCost / pipe.moldDepreciationYears;
  const depPipe = depExtruder + depPuller; // = extruderDepreciationPerYear (pipe.ts)
  const moldTotalVnd = fitting.moldAssets.reduce((s, m) => s + m.costVnd, 0);
  const depMolds = moldDepreciationPerYear(fitting.moldAssets, asOfYear); // ADR-007
  const depMachine = (i: number) => (fitting.machineTypes[i]!.priceVnd * fitting.machineTypes[i]!.count) / fitting.depreciationYears;
  const depFit = fitting.machineTypes.reduce((s, _m, i) => s + depMachine(i), 0) + depMolds;
  const depLab = shared.labAnnualized / shared.depreciationYears;
  const depUl = shared.ulSetupAnnualized / shared.depreciationYears;
  const depVnUl = shared.vnUlSetupAnnualized / shared.depreciationYears;
  const depFactory = (shared.factoryConstructionCost || 0) / (shared.factoryDepreciationYears || 10);
  const depShared = depLab + depUl + depVnUl + depFactory;

  // ── MỤC ②: chi phí chế biến/năm theo dòng — CÙNG công thức engine (pipe.ts / fitting.ts) ──
  const insurance = form.costPool.currency.mandatoryInsuranceRate;
  const pipeCap = effectivePipeCapacity(
    pipe,
    form.products.filter((p): p is PipeProduct => p.kind === 'pipe'),
    form.pipeCostMethod ?? 'kg',
  );
  const pipeHours = pipeCap.normalOperatingHours;
  const fittingProducts = form.products.filter((p): p is FittingProduct => p.kind === 'fitting');
  const fitCap = calculateFittingCapacity(fitting, fittingProducts);
  const fitHours = fitCap.normalMachineHoursUtilized;
  const laborOf = (r: { normalShifts: number; peoplePerShift: number; avgSalaryMonthly: number; monthsSalaryPerYear: number }) =>
    r.normalShifts * r.peoplePerShift * r.avgSalaryMonthly * r.monthsSalaryPerYear * (1 + insurance);
  const pipeLabor = laborOf(pipe);
  const pipeElec = pipe.electricityKw * pipe.electricityPricePerKwh * pipeHours;
  const pipeWater = pipe.waterM3PerHour * pipe.waterPricePerM3 * pipeHours;
  const pipeConvTotal = depPipe + pipeLabor + pipeElec + pipeWater + pipe.annualMaintenance;
  const fitLabor = laborOf(fitting);
  const fitElec = fitting.electricityKwPerMachineHour * fitting.electricityPricePerKwh * fitHours;
  const fitWater = fitting.waterM3PerMachineHour * fitting.waterPricePerM3 * fitHours;
  const fitConvTotal = depFit + fitLabor + fitElec + fitWater + fitting.annualMoldMaintenance;

  // ── MỤC ③: chi phí chung sản xuất (phân bổ theo sản lượng — sharedCostAllocationRatio)
  //           + chi phí ngoài SX (chỉ lãi/lỗ). CÙNG hàm engine, không tính mới. ──
  const sharedTotal = sharedFixedCostsTotalPerYear(shared); // = depShared + kiểm định + thuê đất
  const pipeKgYear = pipeCap.normalCapacityKgYear;
  const fitKgYear = fitCap.estimatedProductionKgYear;
  const denomKg = pipeKgYear + fitKgYear;
  const ratioPipe = denomKg > 0 ? pipeKgYear / denomKg : 0;
  const sharedToPipe = sharedTotal * ratioPipe;
  const sharedToFit = sharedTotal * (1 - ratioPipe);
  const nonProdTotal = form.costPool.nonProductionCosts.operatingCostPerYear + form.costPool.nonProductionCosts.financialCostPerYear;

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError(null);
    const parsed = ScenarioInputSchema.safeParse(form);
    if (!parsed.success) {
      setSaveState('error');
      setSaveError(`Dữ liệu không hợp lệ: ${parsed.error.issues[0]?.message ?? 'lỗi không rõ'}`);
      return;
    }
    // Audit khi baseline khóa giá đổi (bảo mật giá — như AssumptionsScreen).
    const prevMaterials = lastPersistedMaterialsRef.current ?? [];
    const baselineChanges = parsed.data.materials
      .map((m) => ({ m, prev: prevMaterials.find((p) => p.id === m.id) }))
      .filter(({ m, prev }) => prev && prev.inventory.priceLock.baseline !== m.inventory.priceLock.baseline);
    try {
      await setDoc(doc(db, `scenarios/${scenarioId}`), parsed.data);
      setSaveState('saved');
      lastPersistedMaterialsRef.current = parsed.data.materials;
      if (user && (role === 'admin' || role === 'pricing')) {
        await Promise.all(
          baselineChanges.map(({ m, prev }) =>
            writePriceLockAuditEntry(scenarioId, {
              materialId: m.id, materialName: m.name,
              oldBaselineUsdPerKg: prev!.inventory.priceLock.baseline, newBaselineUsdPerKg: m.inventory.priceLock.baseline,
              changedByUid: user.uid, changedByEmail: user.email, changedByRole: role,
            }),
          ),
        );
      }
      setTimeout(() => setSaveState('idle'), 3000);
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const th: React.CSSProperties = { textAlign: 'left', fontSize: ft.size.xs, letterSpacing: '.05em', textTransform: 'uppercase', color: tk.inkMuted, fontWeight: ft.weight.bold, padding: '10px 14px', borderBottom: `1px solid ${tk.border}`, whiteSpace: 'nowrap', background: tk.surfaceMuted };
  const td: React.CSSProperties = { padding: '9px 14px', borderBottom: `1px solid ${tk.surfaceMuted}`, verticalAlign: 'middle', color: tk.ink };
  const rNum: React.CSSProperties = { textAlign: 'right' };

  return (
    <div style={{ display: 'flex', minHeight: '100%', gap: 0 }}>
      {/* Hiệu ứng ô NHẬP: viền + quầng đen khi rê/chọn để biết ô nào gõ được. */}
      <style>{`
        .ds-in { transition: box-shadow .12s ease, border-color .12s ease, background-color .12s ease; caret-color:${tk.brand}; }
        .ds-in:hover { border-color:${tk.brand} !important; background-color:${tk.surfaceMuted} !important; }
        .ds-in:focus { border-color:${tk.brand} !important; background-color:${tk.surface} !important; box-shadow:0 0 0 3px rgba(10,10,10,.12); }
        .ds-in::placeholder { color:${tk.inkFaint}; }
      `}</style>
      {/* Rail mục con */}
      <nav style={{ width: 232, flexShrink: 0, borderRight: `1px solid ${tk.border}`, padding: '26px 12px', background: tk.surface }}>
        <div style={{ ...eyebrowStyle }}>Dữ liệu gốc</div>
        <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, margin: '3px 0 18px', letterSpacing: '-.01em', color: tk.ink }}>Thiết lập dữ liệu</div>
        {SETUP_SECTIONS.map((s) => {
          const on = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)} style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', alignItems: 'flex-start', padding: '10px 11px', borderRadius: rd.lg, marginBottom: 2, border: 'none', cursor: 'pointer', background: on ? tk.brand : 'transparent', color: on ? tk.inkInverse : tk.ink }}>
              <span style={{ fontFamily: ft.mono, fontSize: ft.size.xs, fontWeight: ft.weight.bold, color: on ? tk.inkInverse : tk.inkFaint, paddingTop: 1 }}>{s.no}</span>
              <span><span style={{ display: 'block', fontSize: ft.size.sm, fontWeight: ft.weight.semibold }}>{s.t}</span><span style={{ display: 'block', fontSize: ft.size.eyebrow, color: on ? 'rgba(255,255,255,.72)' : tk.inkFaint, marginTop: 1 }}>{s.cap}</span></span>
            </button>
          );
        })}
        <div style={{ margin: '16px 6px 6px', paddingTop: 14, borderTop: `1px solid ${tk.border}`, fontSize: ft.size.eyebrow, color: tk.inkFaint, lineHeight: 1.5 }}>
          Xem kết quả lãi/lỗ ở màn <b>Tổng Quan</b> (đã dời lên đó).
        </div>
      </nav>

      {/* Nội dung */}
      <div style={{ flex: 1, padding: '26px 30px', maxWidth: 1120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: ft.size.xxl, fontWeight: ft.weight.bold, letterSpacing: '-.3px', color: tk.ink }}>
              {section === 'assets' ? 'Tài sản cố định & khấu hao' : section === 'conv' ? 'Chi phí chế biến theo dòng' : section === 'oh' ? 'Chi phí chung & ngoài sản xuất' : section === 'mat' ? 'Nguyên liệu (compound)' : section === 'sku' ? 'Danh mục sản phẩm' : section === 'fin' ? 'Tham số tài chính' : section === 'pricing' ? 'Chính sách giá & markup' : section === 'pnl' ? 'Báo cáo lãi/lỗ' : 'Thiết lập dữ liệu'}
            </h1>
            <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, marginTop: 4, maxWidth: '64ch' }}>
              {section === 'assets'
                ? 'Khai báo mọi tài sản như trang “Nhập liệu ban đầu” của Excel. Nhập nguyên giá và đời khấu hao; cột khấu hao/năm + phân bổ về dòng do hệ thống tự tính.'
                : section === 'conv'
                  ? 'Nhân công, điện, nước, bảo trì và thông số vận hành — truy được về từng dòng (Ống · Phụ kiện). Ô nhập sửa được; nhân công/điện/nước/tổng là số tự tính.'
                  : section === 'oh'
                    ? 'Chi phí chung sản xuất (khấu hao tài sản chung + kiểm định + thuê đất) phân bổ 2 dòng theo sản lượng. Chi phí ngoài SX tách riêng — chỉ tính lãi/lỗ.'
                    : section === 'mat'
                      ? 'Từng compound: giá tái tạo, thuế NK, phí HQ, ngưỡng khóa. Giá NL/kg nhập về + trạng thái khóa giá tự tính. (Markup VF đã chuyển sang mục ⑦ Chính sách giá — đặt sau giá thành/hòa vốn.)'
                      : section === 'sku'
                        ? 'Danh sách SKU + quy cách từng sản phẩm (đơn trọng, CS đùn m/giờ, gán khuôn) — nhúng màn Danh Mục Sản Phẩm có sẵn.'
                        : section === 'fin'
                          ? 'Tỷ giá, VAT, bảo hiểm và vốn lưu động — áp cho toàn hệ thống.'
                          : section === 'pricing'
                            ? 'Markup đặt SAU giá thành + hòa vốn: mỗi compound thấy giá thành đầy đủ → hòa vốn → nhập markup VF → ra giá bán VF (live). Kèm markup kênh TCG/NPP.'
                            : 'Bảng kết quả kinh doanh — chỉ ĐỌC số từ phần Thiết lập rồi tính lãi/lỗ. Không nhập liệu ở đây.'}
            </div>
          </div>
          {section !== 'pnl' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {saveState === 'saved' && <span style={{ fontSize: ft.size.xs, color: tk.successInk, fontWeight: ft.weight.semibold }}>✓ Đã lưu</span>}
              {saveState === 'error' && <span style={{ fontSize: ft.size.xs, color: tk.dangerInk }}>{saveError}</span>}
              <button onClick={() => void handleSave()} disabled={saveState === 'saving' || locked} style={{ padding: '10px 20px', background: locked ? tk.borderStrong : tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.md, cursor: locked ? 'not-allowed' : 'pointer', fontSize: ft.size.xs, fontWeight: ft.weight.bold, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {saveState === 'saving' ? 'Đang lưu…' : 'Lưu & cập nhật'}
              </button>
            </div>
          )}
        </div>

        {/* Quy ước nhập vs tự tính */}
        {section !== 'sku' && section !== 'pnl' && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: ft.size.sm, color: tk.inkMuted, background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, padding: '9px 13px', marginBottom: 18 }}>
            <b style={{ color: tk.ink }}>Quy ước:</b>
            <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}><span style={{ width: 26, height: 17, borderRadius: 4, background: tk.surface, border: `1px solid ${tk.borderStrong}` }} /> Ô <b>nhập liệu</b> — sửa được</span>
            <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}><span style={{ width: 26, height: 17, borderRadius: 4, background: tk.surfaceMuted, display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: ft.weight.bold, color: tk.inkMuted }}>fx</span> Số <b>tự tính</b> — chỉ hiển thị</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><AllocTag kind="pipe" /><AllocTag kind="fit" /><AllocTag kind="shared" /></span>
          </div>
        )}

        {locked && section !== 'sku' && section !== 'pnl' && (
          <div style={{ background: tk.warningTint, border: `1px solid ${tk.warning}`, borderRadius: rd.md, padding: '9px 13px', marginBottom: 16, fontSize: ft.size.sm, color: tk.warningInk }}>
            🔒 Tài sản (giá máy, khấu hao, CAPEX) là dữ liệu vốn — chỉ vai <b>Toàn quyền</b> sửa. Bạn đang xem ở chế độ chỉ đọc.
          </div>
        )}

        {/* ── MỤC 01: SỔ TÀI SẢN CỐ ĐỊNH ── */}
        {section === 'assets' && (
          <>
            <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px', borderBottom: `1px solid ${tk.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div><div style={{ ...eyebrowStyle }}>Sổ tài sản cố định</div><div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink }}>Máy móc, khuôn, nhà xưởng</div></div>
                <span style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Khấu hao đường thẳng = Nguyên giá × SL ÷ Đời</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: ft.size.md, minWidth: 860 }}>
                  <thead><tr>
                    <th style={th}>Tài sản</th><th style={{ ...th, ...rNum }}>Nguyên giá / đơn vị</th><th style={{ ...th, ...rNum }}>SL</th>
                    <th style={{ ...th, ...rNum }}>Đời (năm)</th><th style={{ ...th, ...rNum }}>Khấu hao / năm</th><th style={th}>Phân bổ về</th>
                  </tr></thead>
                  <tbody>
                    {/* Ống */}
                    <tr>
                      <td style={td}><b>Máy đùn ống CPVC</b><div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>dây chuyền đùn liên tục</div></td>
                      <td style={{ ...td, ...rNum }}><InCell value={pipe.extruderPriceEach} onChange={(v) => setPipe('extruderPriceEach', v)} unit="đ/máy" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum }}><InCell value={pipe.extruderCount} onChange={(v) => setPipe('extruderCount', v)} unit="máy" disabled={locked} width={54} /></td>
                      <td style={{ ...td, ...rNum }}><InCell value={pipe.depreciationYears} onChange={(v) => setPipe('depreciationYears', v)} unit="năm" disabled={locked} width={54} /></td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depExtruder} unit="đ" /></td>
                      <td style={td}><AllocTag kind="pipe" /></td>
                    </tr>
                    <tr>
                      <td style={td}><b>Bộ khuôn kéo & cắt ống</b><div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>đời khấu hao ngắn</div></td>
                      <td style={{ ...td, ...rNum }}><InCell value={pipe.moldPullerCutterCost} onChange={(v) => setPipe('moldPullerCutterCost', v)} unit="đ" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum, color: tk.inkFaint, fontFamily: ft.mono }}>1</td>
                      <td style={{ ...td, ...rNum }}><InCell value={pipe.moldDepreciationYears} onChange={(v) => setPipe('moldDepreciationYears', v)} unit="năm" disabled={locked} width={54} /></td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depPuller} unit="đ" /></td>
                      <td style={td}><AllocTag kind="pipe" /></td>
                    </tr>
                    {/* Phụ kiện — máy ép */}
                    {fitting.machineTypes.map((m, i) => (
                      <tr key={m.id}>
                        <td style={td}><b>Máy ép phun — loại {m.id}</b></td>
                        <td style={{ ...td, ...rNum }}><InCell value={m.priceVnd} onChange={(v) => setMachineType(i, 'priceVnd', v)} unit="đ/máy" disabled={locked} /></td>
                        <td style={{ ...td, ...rNum }}><InCell value={m.count} onChange={(v) => setMachineType(i, 'count', v)} unit="máy" disabled={locked} width={54} /></td>
                        <td style={{ ...td, ...rNum }}><InCell value={fitting.depreciationYears} onChange={(v) => setFitting('depreciationYears', v)} unit="năm" disabled={locked} width={54} /></td>
                        <td style={{ ...td, ...rNum }}><FxCell value={depMachine(i)} unit="đ" /></td>
                        <td style={td}><AllocTag kind="fit" /></td>
                      </tr>
                    ))}
                    {/* Phụ kiện — khuôn dùng chung (ADR-007/012/038) */}
                    <tr>
                      <td style={td}><b>Bộ khuôn ép phụ kiện</b><div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>nhiều SKU dùng chung 1 khuôn · khấu hao theo năm mua</div></td>
                      <td style={{ ...td, ...rNum }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                          <span style={{ fontFamily: ft.mono, fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink }}>{fmtVnd(moldTotalVnd)}</span>
                          <button onClick={() => setShowMoldModal(true)} style={{ fontSize: ft.size.eyebrow, padding: '3px 8px', borderRadius: rd.sm, border: `1px solid ${tk.borderStrong}`, background: tk.surfaceMuted, color: tk.ink, cursor: 'pointer', fontWeight: ft.weight.semibold }}>Quản lý {fitting.moldAssets.length} khuôn</button>
                        </div>
                      </td>
                      <td style={{ ...td, ...rNum, color: tk.inkFaint, fontFamily: ft.mono }}>{fitting.moldAssets.length}</td>
                      <td style={{ ...td, ...rNum, fontSize: ft.size.eyebrow, color: tk.inkFaint }}>theo từng khuôn</td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depMolds} unit="đ" /></td>
                      <td style={td}><AllocTag kind="fit" /></td>
                    </tr>
                    {/* Chung */}
                    <tr>
                      <td style={td}><b>Máy móc thiết bị thử nghiệm</b><div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>phòng lab · dùng chung 2 dòng</div></td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.labAnnualized} onChange={(v) => setShared('labAnnualized', v)} unit="đ" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum, color: tk.inkFaint, fontFamily: ft.mono }}>1</td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.depreciationYears} onChange={(v) => setShared('depreciationYears', v)} unit="năm · chung Lab/UL" disabled={locked} width={54} /></td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depLab} unit="đ" /></td>
                      <td style={td}><AllocTag kind="shared" /></td>
                    </tr>
                    <tr>
                      <td style={td}><b>Chứng nhận UL (thiết bị & setup)</b></td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.ulSetupAnnualized} onChange={(v) => setShared('ulSetupAnnualized', v)} unit="đ" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum, color: tk.inkFaint, fontFamily: ft.mono }}>1</td>
                      <td style={{ ...td, ...rNum, fontSize: ft.size.eyebrow, color: tk.inkFaint }}>chung Lab/UL</td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depUl} unit="đ" /></td>
                      <td style={td}><AllocTag kind="shared" /></td>
                    </tr>
                    <tr>
                      <td style={td}><b>UL trong nước</b><div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>giữ chỗ</div></td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.vnUlSetupAnnualized} onChange={(v) => setShared('vnUlSetupAnnualized', v)} unit="đ" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum, color: tk.inkFaint, fontFamily: ft.mono }}>1</td>
                      <td style={{ ...td, ...rNum, fontSize: ft.size.eyebrow, color: tk.inkFaint }}>chung Lab/UL</td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depVnUl} unit="đ" /></td>
                      <td style={td}><AllocTag kind="shared" /></td>
                    </tr>
                    <tr>
                      <td style={td}><b>Nhà xưởng</b></td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.factoryConstructionCost || 0} onChange={(v) => setShared('factoryConstructionCost', v)} unit="đ" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum, color: tk.inkFaint, fontFamily: ft.mono }}>1</td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.factoryDepreciationYears || 10} onChange={(v) => setShared('factoryDepreciationYears', v)} unit="năm" disabled={locked} width={54} /></td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depFactory} unit="đ" /></td>
                      <td style={td}><AllocTag kind="shared" /></td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ ...td, fontWeight: ft.weight.bold, background: tk.surfaceMuted, borderTop: `2px solid ${tk.borderStrong}` }}>Tổng khấu hao / năm</td>
                      <td style={{ ...td, background: tk.surfaceMuted, borderTop: `2px solid ${tk.borderStrong}` }} colSpan={3}></td>
                      <td style={{ ...td, ...rNum, background: tk.surfaceMuted, borderTop: `2px solid ${tk.borderStrong}` }}><FxCell value={depPipe + depFit + depShared} unit="đ" /></td>
                      <td style={{ ...td, background: tk.surfaceMuted, borderTop: `2px solid ${tk.borderStrong}` }}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* KPI phân bổ khấu hao */}
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', padding: '14px 18px', borderTop: `1px solid ${tk.border}`, background: tk.surfaceMuted }}>
                <div><div style={{ ...eyebrowStyle }}>Khấu hao → Ống</div><div style={{ fontFamily: ft.mono, fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginTop: 3 }}>{fmtVnd(depPipe)} đ/năm</div></div>
                <div><div style={{ ...eyebrowStyle }}>Khấu hao → Phụ kiện</div><div style={{ fontFamily: ft.mono, fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginTop: 3 }}>{fmtVnd(depFit)} đ/năm</div></div>
                <div><div style={{ ...eyebrowStyle }}>Khấu hao → Chung</div><div style={{ fontFamily: ft.mono, fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginTop: 3 }}>{fmtVnd(depShared)} đ/năm</div></div>
              </div>
            </div>
            <div style={{ fontSize: ft.size.xs, color: tk.inkFaint, marginTop: 10 }}>
              Khấu hao/năm và tổng phân bổ là số <b>tự tính</b> — cùng công thức engine đang dùng (khuôn theo năm mua, ADR-007). Không nhập, không đổi logic.
            </div>
          </>
        )}

        {/* ── MỤC 02: CHI PHÍ CHẾ BIẾN THEO DÒNG ── */}
        {section === 'conv' && (() => {
          const fxTag = <span style={{ fontSize: 8.5, fontWeight: ft.weight.bold, color: tk.inkMuted, border: `1px solid ${tk.borderStrong}`, borderRadius: 3, padding: '0 3px' }}>fx</span>;
          const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(206px, 1fr))', border: `1px solid ${tk.border}`, borderRadius: rd.md, overflow: 'hidden', borderRight: 'none', borderBottom: 'none' };
          const cardStyle: React.CSSProperties = { background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, padding: 16, marginBottom: 16 };
          const kpi = (label: string, val: number, dep: number) => (
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', padding: '13px 4px 2px' }}>
              <div><div style={{ ...eyebrowStyle }}>{label}</div>
                <div style={{ fontFamily: ft.mono, fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginTop: 3 }}>{fmtVnd(val)} đ/năm</div>
                <div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint, marginTop: 2 }}>gồm khấu hao trực tiếp {fmtVnd(dep)} đ</div></div>
            </div>
          );
          return (
            <div>
              <div style={{ ...cardStyle }}>
                <div style={{ ...eyebrowStyle, marginBottom: 2 }}>Dòng Ống CPVC</div>
                <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginBottom: 12 }}>Chi phí chế biến / năm</div>
                <div style={gridStyle}>
                  <GridCell label="Số ca / ngày"><InCell width="100%" value={pipe.normalShifts} onChange={(v) => setPipe('normalShifts', v)} unit="ca (1-3)" /></GridCell>
                  <GridCell label="Số giờ / ca"><InCell width="100%" value={pipe.hoursPerShift} onChange={(v) => setPipe('hoursPerShift', v)} unit="giờ/ca" /></GridCell>
                  <GridCell derived label={<>Giờ vận hành / năm {fxTag}</>}><FxCell value={pipeHours} unit="giờ" /></GridCell>
                  <GridCell label="Số người / ca"><InCell width="100%" value={pipe.peoplePerShift} onChange={(v) => setPipe('peoplePerShift', v)} unit="người" /></GridCell>
                  <GridCell label="Lương bình quân / tháng"><InCell width="100%" value={pipe.avgSalaryMonthly} onChange={(v) => setPipe('avgSalaryMonthly', v)} unit="đ" /></GridCell>
                  <GridCell label="Số tháng lương / năm"><InCell width="100%" value={pipe.monthsSalaryPerYear} onChange={(v) => setPipe('monthsSalaryPerYear', v)} unit="tháng" /></GridCell>
                  <GridCell derived label={<>Nhân công / năm {fxTag}</>}><FxCell value={pipeLabor} unit="đ" /></GridCell>
                  <GridCell label={<>Công suất điện {locked && '🔒'}</>}><InCell width="100%" value={pipe.electricityKw} onChange={(v) => setPipe('electricityKw', v)} unit="kW" disabled={locked} /></GridCell>
                  <GridCell label="Đơn giá điện"><InCell width="100%" value={pipe.electricityPricePerKwh} onChange={(v) => setPipe('electricityPricePerKwh', v)} unit="đ/kWh" /></GridCell>
                  <GridCell derived label={<>Tiền điện / năm {fxTag}</>}><FxCell value={pipeElec} unit="đ" /></GridCell>
                  <GridCell label={<>Nước tiêu thụ {locked && '🔒'}</>}><InCell width="100%" value={pipe.waterM3PerHour} onChange={(v) => setPipe('waterM3PerHour', v)} unit="m³/giờ" disabled={locked} /></GridCell>
                  <GridCell label="Đơn giá nước"><InCell width="100%" value={pipe.waterPricePerM3} onChange={(v) => setPipe('waterPricePerM3', v)} unit="đ/m³" /></GridCell>
                  <GridCell derived label={<>Tiền nước / năm {fxTag}</>}><FxCell value={pipeWater} unit="đ" /></GridCell>
                  <GridCell label="Bảo trì phần ống / năm"><InCell width="100%" value={pipe.annualMaintenance} onChange={(v) => setPipe('annualMaintenance', v)} unit="đ" /></GridCell>
                  <GridCell label="Bao bì + vật tư"><InCell width="100%" value={pipe.packagingCostPerKg} onChange={(v) => setPipe('packagingCostPerKg', v)} unit="đ/kg TP" /></GridCell>
                </div>
                {kpi('Tổng chế biến Ống', pipeConvTotal, depPipe)}
              </div>

              <div style={{ ...cardStyle }}>
                <div style={{ ...eyebrowStyle, marginBottom: 2 }}>Dòng Phụ kiện</div>
                <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginBottom: 12 }}>Chi phí chế biến / năm</div>
                <div style={gridStyle}>
                  <GridCell label="Số ca / ngày"><InCell width="100%" value={fitting.normalShifts} onChange={(v) => setFitting('normalShifts', v)} unit="ca (1-3)" /></GridCell>
                  <GridCell label="Số giờ / ca"><InCell width="100%" value={fitting.hoursPerShift} onChange={(v) => setFitting('hoursPerShift', v)} unit="giờ/ca" /></GridCell>
                  <GridCell label="Hệ số huy động giờ máy"><InCell width="100%" value={fitting.normalUtilizationFactor} onChange={(v) => setFitting('normalUtilizationFactor', v)} unit="tỷ lệ (0,6=60%)" /></GridCell>
                  <GridCell derived label={<>Giờ máy huy động / năm {fxTag}</>}><FxCell value={fitHours} unit="giờ" /></GridCell>
                  <GridCell label="Số người / ca"><InCell width="100%" value={fitting.peoplePerShift} onChange={(v) => setFitting('peoplePerShift', v)} unit="người" /></GridCell>
                  <GridCell label="Lương bình quân / tháng"><InCell width="100%" value={fitting.avgSalaryMonthly} onChange={(v) => setFitting('avgSalaryMonthly', v)} unit="đ" /></GridCell>
                  <GridCell label="Số tháng lương / năm"><InCell width="100%" value={fitting.monthsSalaryPerYear} onChange={(v) => setFitting('monthsSalaryPerYear', v)} unit="tháng" /></GridCell>
                  <GridCell derived label={<>Nhân công / năm {fxTag}</>}><FxCell value={fitLabor} unit="đ" /></GridCell>
                  <GridCell label={<>Điện / giờ máy {locked && '🔒'}</>}><InCell width="100%" value={fitting.electricityKwPerMachineHour} onChange={(v) => setFitting('electricityKwPerMachineHour', v)} unit="kW" disabled={locked} /></GridCell>
                  <GridCell label="Đơn giá điện"><InCell width="100%" value={fitting.electricityPricePerKwh} onChange={(v) => setFitting('electricityPricePerKwh', v)} unit="đ/kWh" /></GridCell>
                  <GridCell derived label={<>Tiền điện / năm {fxTag}</>}><FxCell value={fitElec} unit="đ" /></GridCell>
                  <GridCell label={<>Nước / giờ máy {locked && '🔒'}</>}><InCell width="100%" value={fitting.waterM3PerMachineHour} onChange={(v) => setFitting('waterM3PerMachineHour', v)} unit="m³/giờ" disabled={locked} /></GridCell>
                  <GridCell label="Đơn giá nước"><InCell width="100%" value={fitting.waterPricePerM3} onChange={(v) => setFitting('waterPricePerM3', v)} unit="đ/m³" /></GridCell>
                  <GridCell derived label={<>Tiền nước / năm {fxTag}</>}><FxCell value={fitWater} unit="đ" /></GridCell>
                  <GridCell label="Bảo trì khuôn / năm"><InCell width="100%" value={fitting.annualMoldMaintenance} onChange={(v) => setFitting('annualMoldMaintenance', v)} unit="đ" /></GridCell>
                  <GridCell label="Bao bì + vật tư"><InCell width="100%" value={fitting.packagingCostPerKg} onChange={(v) => setFitting('packagingCostPerKg', v)} unit="đ/kg TP" /></GridCell>
                </div>
                {kpi('Tổng chế biến Phụ kiện', fitConvTotal, depFit)}
              </div>

              {/* Thác chi phí đ/kg — tách 4 tầng để đối chiếu cảm nhận vận hành với giá thành đầy đủ */}
              {(() => {
                let layers: { pipe: import('../../engine/cost-breakdown.js').CostLayersPerKg; fitting: import('../../engine/cost-breakdown.js').CostLayersPerKg } | null = null;
                try { const k = calculateDashboardKpis(form); layers = { pipe: k.pipeCostLayers, fitting: k.fittingCostLayers }; } catch { layers = null; }
                if (!layers) return null;
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ ...eyebrowStyle, marginBottom: 3 }}>Thác chi phí — tiền đi đâu?</div>
                    <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, marginBottom: 12, maxWidth: '72ch' }}>
                      Cùng một giá thành đầy đủ, tách rõ 4 tầng. <b>Gia công tiền mặt</b> là phần quản đốc thường "cảm" được (nhân công·điện·nước·bảo trì·bao bì); <b>khấu hao</b> và <b>nguyên liệu nhập</b> là 2 tầng dễ bị bỏ quên nhưng chiếm phần lớn.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
                      <CostWaterfall layers={layers.pipe} title="Dòng Ống CPVC" subtitle="giá thành đầy đủ / kg — tại công suất bình thường" />
                      <CostWaterfall layers={layers.fitting} title="Dòng Phụ kiện" subtitle="giá thành đầy đủ / kg — khấu hao/kg cao khi công suất chưa lấp đầy" />
                    </div>
                  </div>
                );
              })()}

              <div style={{ fontSize: ft.size.xs, color: tk.inkFaint }}>Nhân công/điện/nước/tổng là số <b>tự tính</b> theo công thức engine (nhân công = ca×người×lương×tháng×(1+BH); điện/nước = định mức × <b>giờ vận hành/năm</b>). <b>Giờ vận hành/năm</b> = số mẻ × ngày chạy liên tục × số ca × <b>số giờ/ca</b> (Ống) — đổi <b>số giờ/ca</b> (vd 1 ca 12 giờ, 2 ca = 24 giờ) là điện/nước tính lại đúng thực tế nhà máy. Bao bì tính theo kg thành phẩm, không gộp vào tổng/năm.</div>
            </div>
          );
        })()}

        {/* ── MỤC 03: CHI PHÍ CHUNG & NGOÀI SẢN XUẤT ── */}
        {section === 'oh' && (() => {
          const fxTag = <span style={{ fontSize: 8.5, fontWeight: ft.weight.bold, color: tk.inkMuted, border: `1px solid ${tk.borderStrong}`, borderRadius: 3, padding: '0 3px' }}>fx</span>;
          const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', border: `1px solid ${tk.border}`, borderRadius: rd.md, overflow: 'hidden' };
          const cardStyle: React.CSSProperties = { background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, padding: 16, marginBottom: 16 };
          return (
            <div>
              <div style={cardStyle}>
                <div style={{ ...eyebrowStyle, marginBottom: 2 }}>Chi phí chung sản xuất</div>
                <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginBottom: 2 }}>Dùng chung 2 dòng → phân bổ theo sản lượng</div>
                <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, marginBottom: 12 }}>Máy thử nghiệm / UL đã ở Sổ tài sản — khấu hao tự về đây.</div>
                <div style={gridStyle}>
                  <GridCell derived label={<>Khấu hao tài sản chung (từ Sổ tài sản) {fxTag}</>}><FxCell value={depShared} unit="đ" /></GridCell>
                  <GridCell label="Chi phí kiểm định / năm"><InCell width="100%" value={shared.annualComplianceFee} onChange={(v) => setShared('annualComplianceFee', v)} unit="đ" disabled={locked} /></GridCell>
                  <GridCell label="Thuê đất / năm"><InCell width="100%" value={shared.annualLandRent} onChange={(v) => setShared('annualLandRent', v)} unit="đ" disabled={locked} /></GridCell>
                  <GridCell derived label={<>Tổng chi phí chung sản xuất {fxTag}</>}><FxCell value={sharedTotal} unit="đ" /></GridCell>
                </div>
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', padding: '13px 4px 2px' }}>
                  <div><div style={{ ...eyebrowStyle }}>Tỷ lệ phân bổ (theo sản lượng kg/năm)</div>
                    <div style={{ fontFamily: ft.mono, fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginTop: 3 }}>Ống {(ratioPipe * 100).toFixed(1)}% · PK {((1 - ratioPipe) * 100).toFixed(1)}%</div></div>
                  <div><div style={{ ...eyebrowStyle }}>Phân bổ → Ống</div>
                    <div style={{ fontFamily: ft.mono, fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginTop: 3 }}>{fmtVnd(sharedToPipe)} đ/năm</div></div>
                  <div><div style={{ ...eyebrowStyle }}>Phân bổ → Phụ kiện</div>
                    <div style={{ fontFamily: ft.mono, fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginTop: 3 }}>{fmtVnd(sharedToFit)} đ/năm</div></div>
                </div>
                <div style={{ fontSize: ft.size.xs, color: tk.inkFaint, marginTop: 8 }}>Tỷ lệ = sản lượng dòng ÷ tổng sản lượng (Ống {fmtVnd(pipeKgYear)} kg · PK {fmtVnd(fitKgYear)} kg) — <b>tự tính từ công suất</b>, không nhập tay.</div>
              </div>

              <div style={cardStyle}>
                <div style={{ ...eyebrowStyle, marginBottom: 2 }}>Chi phí ngoài sản xuất</div>
                <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginBottom: 2 }}>Chỉ để tính lãi/lỗ — KHÔNG vào giá thành/kg</div>
                <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, marginBottom: 12 }}>Trừ thẳng khỏi lợi nhuận (P&amp;L) · chỉ hiện ở hòa vốn toàn doanh nghiệp (thang giá bậc 4).</div>
                <div style={gridStyle}>
                  <GridCell label="Chi phí vận hành ngoài SX / năm"><InCell width="100%" value={form.costPool.nonProductionCosts.operatingCostPerYear} onChange={(v) => setNonProd('operatingCostPerYear', v)} unit="đ" disabled={locked} /></GridCell>
                  <GridCell label="Chi phí tài chính / năm"><InCell width="100%" value={form.costPool.nonProductionCosts.financialCostPerYear} onChange={(v) => setNonProd('financialCostPerYear', v)} unit="đ" disabled={locked} /></GridCell>
                  <GridCell derived label={<>Tổng ngoài sản xuất {fxTag}</>}><FxCell value={nonProdTotal} unit="đ" /></GridCell>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── MỤC 04: NGUYÊN LIỆU (COMPOUND) ── */}
        {section === 'mat' && (() => {
          const usdRate = form.costPool.currency.usdVndRate;
          const fxTag = <span style={{ fontSize: 8.5, fontWeight: ft.weight.bold, color: tk.inkMuted, border: `1px solid ${tk.borderStrong}`, borderRadius: 3, padding: '0 3px' }}>fx</span>;
          const ratesOf = (m: Material) => ({ importTaxRate: m.importTaxRate, customsLogisticsFeeRate: m.customsLogisticsFeeRate, usdVndRate: usdRate });
          const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', border: `1px solid ${tk.surfaceMuted}`, borderRadius: rd.md, overflow: 'hidden' };
          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                {isAdmin && <button onClick={addMaterial} style={{ padding: '6px 14px', borderRadius: rd.pill, border: `1px dashed ${tk.successInk}`, background: tk.surface, color: tk.successInk, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, cursor: 'pointer' }}>➕ Thêm nguyên liệu</button>}
              </div>
              <div style={{ display: 'grid', gap: 14 }}>
                {form.materials.map((m) => {
                  const replLanded = landedCostPerKgVnd(m.inventory.replacementPriceUsdPerKg, ratesOf(m));
                  // Giá vốn BÌNH QUÂN GIA QUYỀN từ các lô mua (bản nháp) — hàm pure đã xuất (dual-costing.ts), không phải công thức bịa.
                  const wAvg = weightedAvgUsdPerKg(m.inventory.lots); // null nếu chưa nhập lô nào → giá vốn = giá tái tạo
                  const invKg = totalInventoryKg(m.inventory.lots);
                  const bookUsd = wAvg ?? m.inventory.replacementPriceUsdPerKg;
                  const bookLanded = landedCostPerKgVnd(bookUsd, ratesOf(m));
                  // Lãi/lỗ giữ kho + cảnh báo VAS-02 lấy THẲNG từ engine (đã tính trên dữ liệu ĐÃ LƯU) — không tính lại ở client.
                  const dualEntry = internal?.dualCosting.byMaterial.find((e) => e.materialId === m.id);
                  const lockEntry = internal?.priceLock.byMaterial.find((e) => e.materialId === m.id);
                  const isLocked = lockEntry?.evaluation.isLocked ?? null;
                  const usedByLines = form.products.filter((p) => p.materialId === m.id).map((p) => p.kind);
                  const lineLabel = usedByLines.includes('pipe') && usedByLines.includes('fitting') ? 'Ống + Phụ kiện' : usedByLines.includes('pipe') ? 'Ống' : usedByLines.includes('fitting') ? 'Phụ kiện' : 'chưa gán SKU';
                  return (
                    <div key={m.id} style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, overflow: 'hidden' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: `1px solid ${tk.surfaceMuted}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          {isAdmin ? (
                            <input className="ds-in" value={m.name} onChange={(e) => updMatText(m.id, 'name', e.target.value)} style={{ width: 190, padding: '5px 8px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.md, fontSize: ft.size.md, fontWeight: ft.weight.bold, outline: 'none', color: tk.ink }} />
                          ) : <b style={{ fontSize: ft.size.md, color: tk.ink }}>{m.name}</b>}
                          <span style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>{m.code || '—'} · {m.originLabel || '—'}</span>
                          <span style={{ fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, padding: '2px 8px', borderRadius: rd.pill, background: tk.surfaceMuted, color: tk.inkMuted }}>{lineLabel}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {isLocked !== null && (
                            <span style={{ fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, color: isLocked ? tk.successInk : tk.dangerInk }}>{isLocked ? '🔒 KHÓA' : '🔓 MỞ KHÓA'}</span>
                          )}
                          {isLocked === false && <button onClick={() => chotBaseline(m.id)} style={{ fontSize: 9.5, padding: '3px 7px', borderRadius: rd.sm, border: `1px solid ${tk.ink}`, background: tk.surface, color: tk.ink, cursor: 'pointer', fontWeight: ft.weight.bold }}>Chốt baseline</button>}
                          {isAdmin && <button onClick={() => removeMaterial(m.id)} disabled={productRefsMaterial(m.id)} title={productRefsMaterial(m.id) ? 'Còn SKU dùng' : 'Xóa'} style={{ fontSize: ft.size.sm, color: productRefsMaterial(m.id) ? tk.inkFaint : tk.dangerInk, background: 'none', border: 'none', cursor: productRefsMaterial(m.id) ? 'not-allowed' : 'pointer' }}>Xóa</button>}
                        </div>
                      </div>

                      {/* Tham số thương mại/thuế + giá tái tạo */}
                      <div style={{ padding: 14 }}>
                        <div style={gridStyle}>
                          <GridCell label="Giá tái tạo (thị trường hiện hành)"><InCell width="100%" value={m.inventory.replacementPriceUsdPerKg} onChange={(v) => updReplacement(m.id, v)} unit="USD/kg" /></GridCell>
                          <GridCell label="Thuế nhập khẩu"><InCell width="100%" value={m.importTaxRate} onChange={(v) => updMatNum(m.id, 'importTaxRate', v)} unit="tỷ lệ (0,06=6%)" /></GridCell>
                          <GridCell label="Phí hải quan + vận chuyển"><InCell width="100%" value={m.customsLogisticsFeeRate} onChange={(v) => updMatNum(m.id, 'customsLogisticsFeeRate', v)} unit="tỷ lệ" /></GridCell>
                          <GridCell label="Ngưỡng khóa giá"><InCell width="100%" value={m.inventory.priceLock.thresholdPct} onChange={(v) => updThreshold(m.id, v)} unit="0,03=3%" disabled={!isAdmin} /></GridCell>
                          <GridCell derived label={<>Giá tái tạo nhập về / kg {fxTag}</>}><FxCell value={replLanded} unit="đ" /></GridCell>
                        </div>

                        {/* Đợt nhập (lô mua) — nhiều lô giá khác nhau → bình quân gia quyền */}
                        <div style={{ marginTop: 14, border: `1px solid ${tk.surfaceMuted}`, borderRadius: rd.md, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 13px', background: tk.surfaceMuted, borderBottom: `1px solid ${tk.surfaceMuted}` }}>
                            <div>
                              <div style={{ ...eyebrowStyle }}>Đợt nhập (lô mua)</div>
                              <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 1 }}>Mỗi lô = số tấn × giá USD/kg khi mua (vd lô 2025: 2,9 · lô 2026: 2,6). Giá vốn sổ sách = bình quân gia quyền các lô.</div>
                            </div>
                            <button onClick={() => addLot(m.id)} disabled={m.inventory.lots.length >= 5} title={m.inventory.lots.length >= 5 ? 'Tối đa 5 lô' : 'Thêm lô'} style={{ padding: '5px 12px', borderRadius: rd.pill, border: `1px dashed ${tk.successInk}`, background: tk.surface, color: m.inventory.lots.length >= 5 ? tk.inkFaint : tk.successInk, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, cursor: m.inventory.lots.length >= 5 ? 'not-allowed' : 'pointer' }}>➕ Thêm lô</button>
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: ft.size.md }}>
                            <thead><tr>
                              <th style={{ ...th, padding: '8px 13px' }}>Lô</th>
                              <th style={{ ...th, ...rNum, padding: '8px 13px' }}>Số lượng (tấn)</th>
                              <th style={{ ...th, ...rNum, padding: '8px 13px' }}>Giá mua (USD/kg)</th>
                              <th style={{ ...th, ...rNum, padding: '8px 13px' }}>Giá trị lô (USD)</th>
                              <th style={{ ...th, padding: '8px 13px' }}></th>
                            </tr></thead>
                            <tbody>
                              {m.inventory.lots.length === 0 && (
                                <tr><td colSpan={5} style={{ ...td, color: tk.inkFaint, fontSize: ft.size.sm, padding: '12px 13px' }}>Chưa nhập lô nào — giá vốn sổ sách tạm lấy theo <b>giá tái tạo</b> ({fmtUsd(m.inventory.replacementPriceUsdPerKg)} USD/kg). Thêm lô để phản ánh giá mua thực tế.</td></tr>
                              )}
                              {m.inventory.lots.map((lot, i) => (
                                <tr key={i}>
                                  <td style={{ ...td, padding: '8px 13px', color: tk.inkMuted, fontSize: ft.size.sm }}>{i === 0 ? 'Lô gần nhất' : `Lô #${i + 1}`}</td>
                                  <td style={{ ...td, ...rNum, padding: '8px 13px' }}><InCell value={lot.tons} onChange={(v) => updLot(m.id, i, 'tons', v)} unit="tấn" width={90} /></td>
                                  <td style={{ ...td, ...rNum, padding: '8px 13px' }}><InCell value={lot.priceUsdPerKg} onChange={(v) => updLot(m.id, i, 'priceUsdPerKg', v)} unit="USD/kg" width={90} /></td>
                                  <td style={{ ...td, ...rNum, padding: '8px 13px', fontFamily: ft.mono, color: tk.inkMuted }}>{fmtUsd(lot.tons * 1000 * lot.priceUsdPerKg)}</td>
                                  <td style={{ ...td, padding: '8px 13px' }}><button onClick={() => removeLot(m.id, i)} style={{ fontSize: ft.size.sm, color: tk.dangerInk, background: 'none', border: 'none', cursor: 'pointer' }}>Xóa</button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* KPI giá vốn bình quân + lãi/lỗ giữ kho */}
                        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', padding: '13px 4px 2px' }}>
                          <div>
                            <div style={{ ...eyebrowStyle }}>Giá vốn bình quân {wAvg === null && '(≈ giá tái tạo)'}</div>
                            <div style={{ fontFamily: ft.mono, fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginTop: 3 }}>{fmtUsd(bookUsd)} <span style={{ fontSize: ft.size.xs, color: tk.inkFaint }}>USD/kg</span></div>
                            <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 2 }}>≈ {fmtVnd(bookLanded)} đ/kg (đã gồm thuế/phí)</div>
                          </div>
                          <div>
                            <div style={{ ...eyebrowStyle }}>Tồn kho</div>
                            <div style={{ fontFamily: ft.mono, fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginTop: 3 }}>{Math.round(invKg).toLocaleString('vi-VN')} <span style={{ fontSize: ft.size.xs, color: tk.inkFaint }}>kg</span></div>
                          </div>
                          {dualEntry && (
                            <div>
                              <div style={{ ...eyebrowStyle }}>Lãi/lỗ giữ kho <span style={{ textTransform: 'none', fontWeight: ft.weight.medium }}>(đã lưu)</span></div>
                              <div style={{ fontFamily: ft.mono, fontSize: ft.size.lg, fontWeight: ft.weight.bold, marginTop: 3, color: dualEntry.holdingGainLossVnd < 0 ? tk.dangerInk : tk.successInk }}>{dualEntry.holdingGainLossVnd >= 0 ? '+' : ''}{fmtVnd(dualEntry.holdingGainLossVnd)} <span style={{ fontSize: ft.size.xs, color: tk.inkFaint }}>đ</span></div>
                              {dualEntry.holdingGainLossVnd < 0 && <div style={{ fontSize: ft.size.xs, color: tk.dangerInk, marginTop: 2, maxWidth: '32ch' }}>⚠ Giá tái tạo dưới bình quân — cân nhắc dự phòng giảm giá tồn kho (VAS-02)</div>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: ft.size.xs, color: tk.inkFaint, marginTop: 12 }}>
                <b>Giá vốn bình quân</b> = Σ(tấn × giá lô) ÷ Σtấn (hàm <code>weightedAvgUsdPerKg</code>) — chính là giá vốn SỔ SÁCH (ADR-002), khác <b>giá tái tạo</b> (thị trường hiện hành) dùng để định giá bán. Lãi/lỗ giữ kho + trạng thái KHÓA/MỞ đọc thẳng từ engine (ADR-002/004), cập nhật sau khi <b>Lưu</b>. Thuế/phí khác nhau theo compound (BlazeMaster EU 6% · Corzan AIFTA 0%).
              </div>
            </div>
          );
        })()}

        {/* ── MỤC 05: DANH MỤC SẢN PHẨM (nhúng màn có sẵn) ── */}
        {section === 'sku' && (
          <div>
            <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.md, padding: '9px 13px', marginBottom: 14 }}>
              Danh sách SKU + quy cách (đơn trọng · CS đùn m/giờ · gán khuôn). Dùng chung <b>nút Lưu ở trên</b> — mọi thay đổi (mục ①–⑦ và ở đây) lưu một lần, không ghi đè lẫn nhau.
            </div>
            <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, overflow: 'hidden' }}>
              <ProductsScreen role={role} scenarioId={scenarioId} scenario={scenario} formOverride={form} onFormChange={setForm} hideChrome />
            </div>
          </div>
        )}

        {/* ── MỤC 06: THAM SỐ TÀI CHÍNH ── */}
        {section === 'fin' && (() => {
          const cur = form.costPool.currency;
          const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', border: `1px solid ${tk.border}`, borderRadius: rd.lg, overflow: 'hidden' };
          return (
            <div>
              <div style={gridStyle}>
                <GridCell label="Tỷ giá USD → VND"><InCell width="100%" value={cur.usdVndRate} onChange={(v) => setCurrency('usdVndRate', v)} unit="đ/USD" /></GridCell>
                <GridCell label="VAT đầu ra"><InCell width="100%" value={cur.vatOutputRate} onChange={(v) => setCurrency('vatOutputRate', v)} unit="tỷ lệ (0,08=8%)" /></GridCell>
                <GridCell label="Bảo hiểm bắt buộc + KPCĐ"><InCell width="100%" value={cur.mandatoryInsuranceRate} onChange={(v) => setCurrency('mandatoryInsuranceRate', v)} unit="tỷ lệ (0,235=23,5%)" /></GridCell>
                <GridCell label={<>Dung môi 550 / thùng {locked && '🔒'}</>}><InCell width="100%" value={form.costPool.solvent550PricePerBox} onChange={setSolvent} unit="đ" disabled={locked} /></GridCell>
                <GridCell label={<>Vốn lưu động ban đầu {locked && '🔒'}</>}><InCell width="100%" value={shared.workingCapital || 0} onChange={(v) => setShared('workingCapital', v)} unit="đ" disabled={locked} /></GridCell>
              </div>
              <div style={{ fontSize: ft.size.xs, color: tk.inkFaint, marginTop: 10 }}>
                Tham số áp cho toàn hệ thống. Chính sách markup (VF → TCG → NPP) đặt ở mục ⑦ Chính sách giá.
              </div>
            </div>
          );
        })()}

        {/* ── MỤC 07: CHÍNH SÁCH GIÁ & MARKUP (markup sau giá thành + hòa vốn) ── */}
        {section === 'pricing' && (() => {
          const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', border: `1px solid ${tk.border}`, borderRadius: rd.lg, overflow: 'hidden' };
          return (
            <div>
              <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '13px 16px', borderBottom: `1px solid ${tk.border}` }}>
                  <div style={{ ...eyebrowStyle }}>Markup VF theo compound</div>
                  <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink }}>Giá thành → hòa vốn → <span style={{ color: tk.successInk }}>+markup</span> → giá bán VF</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: ft.size.md, minWidth: 780 }}>
                    <thead><tr>
                      <th style={th}>Compound</th><th style={{ ...th, ...rNum }}>Giá thành đầy đủ</th>
                      <th style={{ ...th, ...rNum }}>Hòa vốn toàn DN</th><th style={{ ...th, ...rNum }}>Markup VF</th>
                      <th style={{ ...th, ...rNum }}>Giá bán VF</th>
                    </tr></thead>
                    <tbody>
                      {form.materials.map((m) => {
                        const entry = internal?.priceLadder.byLineMaterial.find((e) => e.materialId === m.id);
                        const fullCost = entry?.ladder.breakEvenFullCost ?? null;
                        const breakEven = entry?.ladder.enterpriseBreakEven ?? null;
                        const vfLive = fullCost !== null ? fullCost * (1 + m.markupVf) : null; // = engine targetPrice
                        return (
                          <tr key={m.id}>
                            <td style={td}><b>{m.name}</b><div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>{entry ? (entry.line === 'pipe' ? 'Ống' : 'Phụ kiện') : 'chưa có SKU lên giá'}</div></td>
                            <td style={{ ...td, ...rNum }}>{fullCost !== null ? <FxCell value={fullCost} unit="đ/kg" /> : <span style={{ color: tk.inkFaint }}>—</span>}</td>
                            <td style={{ ...td, ...rNum }}>{breakEven !== null ? <FxCell value={breakEven} unit="đ/kg" /> : <span style={{ color: tk.inkFaint }}>—</span>}</td>
                            <td style={{ ...td, ...rNum }}><InCell value={m.markupVf} onChange={(v) => updMatNum(m.id, 'markupVf', v)} unit="tỷ lệ (0,25=25%)" width={90} /></td>
                            <td style={{ ...td, ...rNum }}>{vfLive !== null ? <FxCell value={vfLive} unit="đ/kg" /> : <span style={{ color: tk.inkFaint }}>—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: ft.size.xs, color: tk.inkFaint, padding: '10px 16px' }}>
                  Markup áp trên <b>giá thành đầy đủ</b> (đã gồm NVL + chế biến + chi phí chung phân bổ), không phải trên giá NL. Giá thành/hòa vốn đọc từ engine (thang giá 5 bậc); giá VF = giá thành × (1+markup) — đúng công thức engine.
                </div>
              </div>

              {/* ── ADR-055 — TỶ LỆ ĐÁY: chia % công suất dòng giữa 2 compound chung máy ── */}
              {(() => {
                const pipeMats = form.materials.filter((m) => form.products.some((p) => p.kind === 'pipe' && p.materialId === m.id));
                const fitMats = form.materials.filter((m) => form.products.some((p) => p.kind === 'fitting' && p.materialId === m.id));
                const pipeKg = internal?.capacity.pipe.normalCapacityKgYear;
                const fitKg = internal?.capacity.fitting.estimatedProductionKgYear;
                const fmtKg = (v?: number) => (v === undefined ? '—' : `${Math.round(v).toLocaleString('vi-VN')} kg`);
                const mixRow = (label: string, mats: Material[], pct: number, onPct: (v: number) => void, totalKg?: number) => {
                  const primary = mats[0], secondary = mats[1];
                  if (!primary) return null;
                  if (!secondary)
                    return (
                      <div key={label} style={{ padding: '10px 14px', border: `1px solid ${tk.surfaceMuted}`, borderRadius: rd.md, fontSize: ft.size.sm, color: tk.inkMuted, background: tk.surfaceMuted }}>
                        <b>Dòng {label}:</b> chỉ 1 compound (<b>{primary?.name ?? '—'}</b>) chạy dòng này — chưa cần chia đáy.
                      </div>
                    );
                  const frac = Math.min(100, Math.max(0, pct)) / 100;
                  return (
                    <div key={label} style={{ padding: '12px 14px', border: `1px solid ${tk.surfaceMuted}`, borderRadius: rd.md }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink }}>Dòng {label}</div>
                        <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>% cho <b>{primary.name}</b> · còn lại → <b>{secondary.name}</b></div>
                      </div>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                        <input type="range" min={0} max={100} step={1} value={pct} onChange={(e) => onPct(Number(e.target.value))} style={{ flex: '1 1 200px', minWidth: 180, accentColor: tk.brand }} />
                        <div style={{ width: 120 }}><InCell width="100%" value={pct} onChange={onPct} unit="%" /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: ft.size.sm }}>
                        <div><span style={{ color: tk.inkFaint }}>{primary.name}:</span> <b style={{ fontFamily: ft.mono, color: tk.ink }}>{fmtKg(totalKg !== undefined ? totalKg * frac : undefined)}</b></div>
                        <div><span style={{ color: tk.inkFaint }}>{secondary.name}:</span> <b style={{ fontFamily: ft.mono, color: tk.ink }}>{fmtKg(totalKg !== undefined ? totalKg * (1 - frac) : undefined)}</b></div>
                      </div>
                    </div>
                  );
                };
                return (
                  <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, padding: 16, marginBottom: 16 }}>
                    <div style={{ ...eyebrowStyle, marginBottom: 2 }}>Tỷ lệ đáy · Cơ cấu sản lượng</div>
                    <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginBottom: 4 }}>Chia công suất dòng giữa 2 compound (vd BlazeMaster / Corzan)</div>
                    <div style={{ fontSize: ft.size.xs, color: tk.inkFaint, marginBottom: 12 }}>Doanh thu = phần chính × giá chính + phần phụ × giá phụ (mỗi loại theo thang giá riêng). Trợ Lý CEO có thể ghi đè tạm khi mô phỏng.</div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {mixRow('Ống', pipeMats, form.productionMixPipePrimaryPct ?? 100, (v) => setProductionMix('productionMixPipePrimaryPct', v), pipeKg)}
                      {mixRow('Phụ kiện', fitMats, form.productionMixFittingPrimaryPct ?? 100, (v) => setProductionMix('productionMixFittingPrimaryPct', v), fitKg)}
                    </div>
                  </div>
                );
              })()}

              <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, padding: 16 }}>
                <div style={{ ...eyebrowStyle, marginBottom: 2 }}>Markup kênh phân phối</div>
                <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink, marginBottom: 12 }}>VF → TCG → Nhà phân phối</div>
                <div style={gridStyle}>
                  <GridCell label="Markup kênh TCG"><InCell width="100%" value={form.costPool.markup.markupTcg} onChange={(v) => setMarkup('markupTcg', v)} unit="tỷ lệ (0,3=30%)" /></GridCell>
                  <GridCell label="Biên nhà phân phối (NPP)"><InCell width="100%" value={form.costPool.markup.listPriceMargin} onChange={(v) => setMarkup('listPriceMargin', v)} unit="tỷ lệ (0-0,9)" /></GridCell>
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      {showMoldModal && (
        <MoldAssetModal
          initialMolds={fitting.moldAssets}
          canEdit={!locked}
          onClose={() => setShowMoldModal(false)}
          onSave={(newMolds) => { setMoldAssets(newMolds); setShowMoldModal(false); }}
        />
      )}
    </div>
  );
}
