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
import { useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { fmtVnd } from '../../lib/format.js';
import { ScenarioInputSchema, type ScenarioInput } from '../../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource, MoldAsset } from '../../schemas/resource.js';
import type { FittingProduct } from '../../schemas/product.js';
import { moldDepreciationPerYear } from '../../engine/mold-depreciation.js';
import { calculatePipeCapacity } from '../../engine/pipe.js';
import { calculateFittingCapacity } from '../../engine/fitting.js';
import { MoldAssetModal } from '../config/MoldAssetModal.js';

type SectionId = 'assets' | 'conv' | 'oh' | 'mat' | 'sku' | 'fin' | 'pnl';
const SETUP_SECTIONS: Array<{ id: SectionId; no: string; t: string; cap: string }> = [
  { id: 'assets', no: '01', t: 'Tài sản cố định', cap: 'CAPEX · khấu hao · phân bổ' },
  { id: 'conv', no: '02', t: 'Chi phí chế biến', cap: 'nhân công · điện · nước theo dòng' },
  { id: 'oh', no: '03', t: 'Chi phí chung & ngoài SX', cap: 'thuê · lab · UL · tài chính' },
  { id: 'mat', no: '04', t: 'Nguyên liệu (compound)', cap: 'giá · thuế · markup · khóa giá' },
  { id: 'sku', no: '05', t: 'Danh mục sản phẩm', cap: 'SKU · đơn trọng · khuôn' },
  { id: 'fin', no: '06', t: 'Tham số tài chính', cap: 'tỷ giá · VAT · markup kênh · vốn' },
];

const ALLOC = {
  pipe: { label: 'Trực tiếp · Ống', bg: '#eaf1fd', fg: '#1f5fd0' },
  fit: { label: 'Trực tiếp · Phụ kiện', bg: '#f2ebfb', fg: '#7a3fc0' },
  shared: { label: 'Chung · phân bổ', bg: '#f7efdf', fg: '#8a5a12' },
} as const;

// ── Ô NHẬP (viền, sửa được; disabled → xám khóa) ──
function InCell({ value, onChange, unit, disabled, width = 130 }: { value: number; onChange: (v: number) => void; unit?: string; disabled?: boolean; width?: number | string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width, padding: '6px 9px', borderRadius: 6, fontSize: 13, fontWeight: 600, textAlign: 'right',
          fontVariantNumeric: 'tabular-nums', outline: 'none',
          border: `1px solid ${disabled ? '#e5e5e5' : '#c8cdd5'}`, background: disabled ? '#f7f7f7' : '#fff',
          color: disabled ? '#9aa0aa' : '#1a1a1a', cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      {unit && <span style={{ fontSize: 9, color: '#b3b3b3' }}>{unit}</span>}
    </div>
  );
}
// ── SỐ TỰ TÍNH (nền xám + nhãn fx, chỉ đọc) ──
function FxCell({ value, unit }: { value: number; unit?: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, background: '#eef1f4', borderRadius: 6, padding: '6px 10px', minWidth: 130 }}>
      <span style={{ fontSize: 8.5, fontWeight: 700, color: '#6b7280', border: '1px solid #c8cdd5', borderRadius: 3, padding: '0 3px', lineHeight: 1.35 }}>fx</span>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, fontWeight: 700, color: '#3a3f47', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(value)}</span>
      {unit && <span style={{ fontSize: 9, color: '#9aa0aa' }}>{unit}</span>}
    </div>
  );
}
function AllocTag({ kind }: { kind: keyof typeof ALLOC }) {
  const a = ALLOC[kind];
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: a.bg, color: a.fg, whiteSpace: 'nowrap' }}>{a.label}</span>;
}
// Ô lưới cho mục chế biến/tài chính: nhãn trên, control dưới; derived = nền xám.
function GridCell({ label, derived, children }: { label: React.ReactNode; derived?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ padding: '13px 15px', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', background: derived ? '#fafbfc' : '#fff', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ fontSize: 11.5, color: '#565b64', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>{label}</div>
      {children}
    </div>
  );
}

export default function DataSetupScreen({ role, scenarioId, scenario }: { role: AppRole; scenarioId: string; scenario: ScenarioInput | null }) {
  // Master-data tài sản khóa cho vai Định Giá (khớp firestore.rules — chỉ admin
  // sửa giá máy/khấu hao/CAPEX; ranh giới bảo mật, không phải điều hướng vai).
  const locked = role !== 'admin';
  const [section, setSection] = useState<SectionId>('assets');
  const [form, setForm] = useState<ScenarioInput | null>(null);
  const loadedRef = useRef(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMoldModal, setShowMoldModal] = useState(false);

  if (scenario && !loadedRef.current) {
    loadedRef.current = true;
    setForm(scenario);
  }
  if (!form) return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải dữ liệu thiết lập…</div>;

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
  const pipeHours = calculatePipeCapacity(pipe).normalOperatingHours;
  const fittingProducts = form.products.filter((p): p is FittingProduct => p.kind === 'fitting');
  const fitHours = calculateFittingCapacity(fitting, fittingProducts).normalMachineHoursUtilized;
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

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a8f98', fontWeight: 700, padding: '10px 14px', borderBottom: '1px solid #e6e8ec', whiteSpace: 'nowrap', background: '#fafbfc' };
  const td: React.CSSProperties = { padding: '9px 14px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' };
  const rNum: React.CSSProperties = { textAlign: 'right' };

  return (
    <div style={{ display: 'flex', minHeight: '100%', gap: 0 }}>
      {/* Rail mục con */}
      <nav style={{ width: 232, flexShrink: 0, borderRight: '1px solid #e6e8ec', padding: '26px 12px', background: '#fff' }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#a3a3a3', fontWeight: 700 }}>Dữ liệu gốc</div>
        <div style={{ fontSize: 16, fontWeight: 700, margin: '3px 0 18px', letterSpacing: '-.01em' }}>Thiết lập dữ liệu</div>
        {SETUP_SECTIONS.map((s) => {
          const on = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)} style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', alignItems: 'flex-start', padding: '10px 11px', borderRadius: 9, marginBottom: 2, border: 'none', cursor: 'pointer', background: on ? '#0d0e11' : 'transparent', color: on ? '#fff' : '#1a1a1a' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700, color: on ? '#fff' : '#a3a3a3', paddingTop: 1 }}>{s.no}</span>
              <span><span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{s.t}</span><span style={{ display: 'block', fontSize: 10.5, color: on ? 'rgba(255,255,255,.72)' : '#9aa0aa', marginTop: 1 }}>{s.cap}</span></span>
            </button>
          );
        })}
        <div style={{ margin: '16px 6px 6px', paddingTop: 14, borderTop: '1px solid #e6e8ec', fontSize: 9, letterSpacing: '.13em', textTransform: 'uppercase', color: '#a3a3a3', fontWeight: 700 }}>Báo cáo (đọc số)</div>
        <button onClick={() => setSection('pnl')} style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', alignItems: 'flex-start', padding: '10px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', background: section === 'pnl' ? '#0d0e11' : 'transparent', color: section === 'pnl' ? '#fff' : '#1a1a1a' }}>
          <span style={{ fontSize: 13, color: section === 'pnl' ? '#fff' : '#a3a3a3', paddingTop: 1 }}>↳</span>
          <span><span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>Báo cáo lãi/lỗ</span><span style={{ display: 'block', fontSize: 10.5, color: section === 'pnl' ? 'rgba(255,255,255,.72)' : '#9aa0aa', marginTop: 1 }}>nhận số → tính lãi/lỗ · chỉ xem</span></span>
        </button>
      </nav>

      {/* Nội dung */}
      <div style={{ flex: 1, padding: '26px 30px', maxWidth: 1120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>
              {section === 'assets' ? 'Tài sản cố định & khấu hao' : section === 'conv' ? 'Chi phí chế biến theo dòng' : 'Thiết lập dữ liệu'}
            </h1>
            <div style={{ fontSize: 12, color: '#737373', marginTop: 4, maxWidth: '64ch' }}>
              {section === 'assets'
                ? 'Khai báo mọi tài sản như trang “Nhập liệu ban đầu” của Excel. Nhập nguyên giá và đời khấu hao; cột khấu hao/năm + phân bổ về dòng do hệ thống tự tính.'
                : section === 'conv'
                  ? 'Nhân công, điện, nước, bảo trì và thông số vận hành — truy được về từng dòng (Ống · Phụ kiện). Ô nhập sửa được; nhân công/điện/nước/tổng là số tự tính.'
                  : 'Gộp các khai báo cũ theo trật tự kế toán. Chọn mục ở thanh bên trái.'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {saveState === 'saved' && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ Đã lưu</span>}
            {saveState === 'error' && <span style={{ fontSize: 11, color: '#DC2626' }}>{saveError}</span>}
            <button onClick={() => void handleSave()} disabled={saveState === 'saving' || locked} style={{ padding: '10px 20px', background: locked ? '#c9a3b1' : '#a8003b', color: '#fff', border: 'none', borderRadius: 6, cursor: locked ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {saveState === 'saving' ? 'Đang lưu…' : 'Lưu & cập nhật'}
            </button>
          </div>
        </div>

        {/* Quy ước nhập vs tự tính */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 11.5, color: '#565b64', background: '#fff', border: '1px solid #e6e8ec', borderRadius: 10, padding: '9px 13px', marginBottom: 18 }}>
          <b style={{ color: '#1a1a1a' }}>Quy ước:</b>
          <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}><span style={{ width: 26, height: 17, borderRadius: 4, background: '#fff', border: '1px solid #c8cdd5' }} /> Ô <b>nhập liệu</b> — sửa được</span>
          <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}><span style={{ width: 26, height: 17, borderRadius: 4, background: '#eef1f4', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 700, color: '#6b7280' }}>fx</span> Số <b>tự tính</b> — chỉ hiển thị</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><AllocTag kind="pipe" /><AllocTag kind="fit" /><AllocTag kind="shared" /></span>
        </div>

        {locked && (
          <div style={{ background: '#fffbeb', border: '1px solid #f0c98a', borderRadius: 8, padding: '9px 13px', marginBottom: 16, fontSize: 11.5, color: '#8a5a12' }}>
            🔒 Tài sản (giá máy, khấu hao, CAPEX) là dữ liệu vốn — chỉ vai <b>Toàn quyền</b> sửa. Bạn đang xem ở chế độ chỉ đọc.
          </div>
        )}

        {/* ── MỤC 01: SỔ TÀI SẢN CỐ ĐỊNH ── */}
        {section === 'assets' && (
          <>
            <div style={{ background: '#fff', border: '1px solid #e6e8ec', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px', borderBottom: '1px solid #e6e8ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div><div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#a3a3a3', fontWeight: 700 }}>Sổ tài sản cố định</div><div style={{ fontSize: 14.5, fontWeight: 700 }}>Máy móc, khuôn, nhà xưởng</div></div>
                <span style={{ fontSize: 11.5, color: '#737373' }}>Khấu hao đường thẳng = Nguyên giá × SL ÷ Đời</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 860 }}>
                  <thead><tr>
                    <th style={th}>Tài sản</th><th style={{ ...th, ...rNum }}>Nguyên giá / đơn vị</th><th style={{ ...th, ...rNum }}>SL</th>
                    <th style={{ ...th, ...rNum }}>Đời (năm)</th><th style={{ ...th, ...rNum }}>Khấu hao / năm</th><th style={th}>Phân bổ về</th>
                  </tr></thead>
                  <tbody>
                    {/* Ống */}
                    <tr>
                      <td style={td}><b>Máy đùn ống CPVC</b><div style={{ fontSize: 10.5, color: '#9aa0aa' }}>dây chuyền đùn liên tục</div></td>
                      <td style={{ ...td, ...rNum }}><InCell value={pipe.extruderPriceEach} onChange={(v) => setPipe('extruderPriceEach', v)} unit="đ/máy" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum }}><InCell value={pipe.extruderCount} onChange={(v) => setPipe('extruderCount', v)} unit="máy" disabled={locked} width={54} /></td>
                      <td style={{ ...td, ...rNum }}><InCell value={pipe.depreciationYears} onChange={(v) => setPipe('depreciationYears', v)} unit="năm" disabled={locked} width={54} /></td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depExtruder} unit="đ" /></td>
                      <td style={td}><AllocTag kind="pipe" /></td>
                    </tr>
                    <tr>
                      <td style={td}><b>Bộ khuôn kéo & cắt ống</b><div style={{ fontSize: 10.5, color: '#9aa0aa' }}>đời khấu hao ngắn</div></td>
                      <td style={{ ...td, ...rNum }}><InCell value={pipe.moldPullerCutterCost} onChange={(v) => setPipe('moldPullerCutterCost', v)} unit="đ" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum, color: '#9aa0aa', fontFamily: 'ui-monospace, monospace' }}>1</td>
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
                      <td style={td}><b>Bộ khuôn ép phụ kiện</b><div style={{ fontSize: 10.5, color: '#9aa0aa' }}>nhiều SKU dùng chung 1 khuôn · khấu hao theo năm mua</div></td>
                      <td style={{ ...td, ...rNum }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, fontWeight: 700 }}>{fmtVnd(moldTotalVnd)}</span>
                          <button onClick={() => setShowMoldModal(true)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px solid #bfa', background: '#f2ebfb', color: '#7a3fc0', cursor: 'pointer', fontWeight: 600, borderColor: '#d6c4ef' }}>Quản lý {fitting.moldAssets.length} khuôn</button>
                        </div>
                      </td>
                      <td style={{ ...td, ...rNum, color: '#9aa0aa', fontFamily: 'ui-monospace, monospace' }}>{fitting.moldAssets.length}</td>
                      <td style={{ ...td, ...rNum, fontSize: 10.5, color: '#9aa0aa' }}>theo từng khuôn</td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depMolds} unit="đ" /></td>
                      <td style={td}><AllocTag kind="fit" /></td>
                    </tr>
                    {/* Chung */}
                    <tr>
                      <td style={td}><b>Máy móc thiết bị thử nghiệm</b><div style={{ fontSize: 10.5, color: '#9aa0aa' }}>phòng lab · dùng chung 2 dòng</div></td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.labAnnualized} onChange={(v) => setShared('labAnnualized', v)} unit="đ" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum, color: '#9aa0aa', fontFamily: 'ui-monospace, monospace' }}>1</td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.depreciationYears} onChange={(v) => setShared('depreciationYears', v)} unit="năm · chung Lab/UL" disabled={locked} width={54} /></td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depLab} unit="đ" /></td>
                      <td style={td}><AllocTag kind="shared" /></td>
                    </tr>
                    <tr>
                      <td style={td}><b>Chứng nhận UL (thiết bị & setup)</b></td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.ulSetupAnnualized} onChange={(v) => setShared('ulSetupAnnualized', v)} unit="đ" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum, color: '#9aa0aa', fontFamily: 'ui-monospace, monospace' }}>1</td>
                      <td style={{ ...td, ...rNum, fontSize: 10.5, color: '#9aa0aa' }}>chung Lab/UL</td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depUl} unit="đ" /></td>
                      <td style={td}><AllocTag kind="shared" /></td>
                    </tr>
                    <tr>
                      <td style={td}><b>UL trong nước</b><div style={{ fontSize: 10.5, color: '#9aa0aa' }}>giữ chỗ</div></td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.vnUlSetupAnnualized} onChange={(v) => setShared('vnUlSetupAnnualized', v)} unit="đ" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum, color: '#9aa0aa', fontFamily: 'ui-monospace, monospace' }}>1</td>
                      <td style={{ ...td, ...rNum, fontSize: 10.5, color: '#9aa0aa' }}>chung Lab/UL</td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depVnUl} unit="đ" /></td>
                      <td style={td}><AllocTag kind="shared" /></td>
                    </tr>
                    <tr>
                      <td style={td}><b>Nhà xưởng</b></td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.factoryConstructionCost || 0} onChange={(v) => setShared('factoryConstructionCost', v)} unit="đ" disabled={locked} /></td>
                      <td style={{ ...td, ...rNum, color: '#9aa0aa', fontFamily: 'ui-monospace, monospace' }}>1</td>
                      <td style={{ ...td, ...rNum }}><InCell value={shared.factoryDepreciationYears || 10} onChange={(v) => setShared('factoryDepreciationYears', v)} unit="năm" disabled={locked} width={54} /></td>
                      <td style={{ ...td, ...rNum }}><FxCell value={depFactory} unit="đ" /></td>
                      <td style={td}><AllocTag kind="shared" /></td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ ...td, fontWeight: 700, background: '#fafbfc', borderTop: '2px solid #d3d7dd' }}>Tổng khấu hao / năm</td>
                      <td style={{ ...td, background: '#fafbfc', borderTop: '2px solid #d3d7dd' }} colSpan={3}></td>
                      <td style={{ ...td, ...rNum, background: '#fafbfc', borderTop: '2px solid #d3d7dd' }}><FxCell value={depPipe + depFit + depShared} unit="đ" /></td>
                      <td style={{ ...td, background: '#fafbfc', borderTop: '2px solid #d3d7dd' }}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* KPI phân bổ khấu hao */}
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', padding: '14px 18px', borderTop: '1px solid #e6e8ec', background: '#fafbfc' }}>
                <div><div style={{ fontSize: 10.5, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Khấu hao → Ống</div><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, color: '#1f5fd0', marginTop: 3 }}>{fmtVnd(depPipe)} đ/năm</div></div>
                <div><div style={{ fontSize: 10.5, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Khấu hao → Phụ kiện</div><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, color: '#7a3fc0', marginTop: 3 }}>{fmtVnd(depFit)} đ/năm</div></div>
                <div><div style={{ fontSize: 10.5, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Khấu hao → Chung</div><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, color: '#8a5a12', marginTop: 3 }}>{fmtVnd(depShared)} đ/năm</div></div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#a3a3a3', marginTop: 10 }}>
              Khấu hao/năm và tổng phân bổ là số <b>tự tính</b> — cùng công thức engine đang dùng (khuôn theo năm mua, ADR-007). Không nhập, không đổi logic.
            </div>
          </>
        )}

        {/* ── MỤC 02: CHI PHÍ CHẾ BIẾN THEO DÒNG ── */}
        {section === 'conv' && (() => {
          const fxTag = <span style={{ fontSize: 8.5, fontWeight: 700, color: '#6b7280', border: '1px solid #c8cdd5', borderRadius: 3, padding: '0 3px' }}>fx</span>;
          const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(206px, 1fr))', border: '1px solid #e6e8ec', borderRadius: 10, overflow: 'hidden', borderRight: 'none', borderBottom: 'none' };
          const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e6e8ec', borderRadius: 12, padding: 16, marginBottom: 16 };
          const kpi = (label: string, val: number, color: string, dep: number) => (
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', padding: '13px 4px 2px' }}>
              <div><div style={{ fontSize: 10.5, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>{label}</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, color, marginTop: 3 }}>{fmtVnd(val)} đ/năm</div>
                <div style={{ fontSize: 10.5, color: '#9aa0aa', marginTop: 2 }}>gồm khấu hao trực tiếp {fmtVnd(dep)} đ</div></div>
            </div>
          );
          return (
            <div>
              <div style={{ ...cardStyle }}>
                <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#1f5fd0', fontWeight: 700, marginBottom: 2 }}>Dòng Ống CPVC</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 12 }}>Chi phí chế biến / năm</div>
                <div style={gridStyle}>
                  <GridCell label="Số ca / ngày"><InCell width="100%" value={pipe.normalShifts} onChange={(v) => setPipe('normalShifts', v)} unit="ca (1-3)" /></GridCell>
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
                {kpi('Tổng chế biến Ống', pipeConvTotal, '#1f5fd0', depPipe)}
              </div>

              <div style={{ ...cardStyle }}>
                <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7a3fc0', fontWeight: 700, marginBottom: 2 }}>Dòng Phụ kiện</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 12 }}>Chi phí chế biến / năm</div>
                <div style={gridStyle}>
                  <GridCell label="Số ca / ngày"><InCell width="100%" value={fitting.normalShifts} onChange={(v) => setFitting('normalShifts', v)} unit="ca (1-3)" /></GridCell>
                  <GridCell label="Hệ số huy động giờ máy"><InCell width="100%" value={fitting.normalUtilizationFactor} onChange={(v) => setFitting('normalUtilizationFactor', v)} unit="tỷ lệ (0,6=60%)" /></GridCell>
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
                {kpi('Tổng chế biến Phụ kiện', fitConvTotal, '#7a3fc0', depFit)}
              </div>
              <div style={{ fontSize: 11, color: '#a3a3a3' }}>Nhân công/điện/nước/tổng là số <b>tự tính</b> theo công thức engine (nhân công = ca×người×lương×tháng×(1+BH); điện/nước theo giờ vận hành). Bao bì tính theo kg thành phẩm, không gộp vào tổng/năm.</div>
            </div>
          );
        })()}

        {/* ── MỤC ③–⑥ + Báo cáo: đang dựng dần ── */}
        {section !== 'assets' && section !== 'conv' && (
          <div style={{ background: '#fff', border: '1px dashed #d3d7dd', borderRadius: 12, padding: '40px 30px', textAlign: 'center', color: '#737373' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🚧</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Mục “{[...SETUP_SECTIONS, { id: 'pnl' as SectionId, t: 'Báo cáo lãi/lỗ' }].find((s) => s.id === section)?.t}” đang được dựng</div>
            <div style={{ fontSize: 12, marginTop: 6, maxWidth: '52ch', margin: '6px auto 0' }}>
              Đang chuyển từng mục từ “Tham Số” + “Cấu Hình Nhà Máy” sang đây theo trật tự kế toán. Trong lúc chờ, dữ liệu mục này vẫn nhập/sửa được ở 2 màn cũ. Mục ① Sổ tài sản cố định đã hoàn thiện.
            </div>
          </div>
        )}
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
