// M12.9b — màn hình Cấu Hình Nhà Máy (tab `config`, vai admin/pricing), theo
// đúng bố cục prototype Pha 1 (mục "Cấu Hình Nhà Máy" — 4 khối A/B/C/D) NHƯNG
// field-mapped lại đúng schema thật (ScenarioInput.resources.pipe/fitting +
// costPool) thay vì bucket "chung" giả định của mock: schema không có 1 khối
// "lịch vận hành chung" — mỗi Resource (Ống/Phụ Kiện) có bộ field vận hành
// RIÊNG (ngày chạy/bảo trì, giờ/ca, lương, điện, nước…), nên khối A của
// prototype được TÁCH vào đúng 2 khối Ống/Phụ Kiện bên dưới thay vì giữ 1
// khối chung không tồn tại trong dữ liệu thật.
//
// Khóa field theo vai — ĐÚNG resource.md + cost-pool.md (rules đã enforce ở
// firestore.rules, form chỉ disable cho UX + phòng thủ client, không thay rules):
// - resources.pipe: actualCapacityKgPerHour/extruderPriceEach/extruderCount/
//   moldPullerCutterCost/yieldRate khóa.
// - resources.fitting: yieldRate/machineTypes[]/moldAssets khóa (moldAssets
//   không sửa trực tiếp ở đây — quản lý qua audit log riêng `moldAssets/{id}`,
//   ADR-007 "còn treo", chỉ hiển thị tổng đọc-only).
// - costPool: TOÀN BỘ khóa (sharedFixedCosts/nonProductionCosts/
//   solvent550PricePerBox) TRỪ `currency`/`markup` (biến chiến lược, pricing
//   sửa được — cost-pool.md "Khóa tham số theo vai").
// KHÔNG hiển thị `avgProductivityKgPerMachineHour` (ADR-011: đổi giữa auto/ghi
// đè thủ công là đổi CHÍNH SÁCH công suất, cần ADR riêng — không phải field
// nhập tay thường, cố tình loại khỏi form này).
import { useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { fmtVnd } from '../../lib/format.js';
import { ScenarioInputSchema, type ScenarioInput } from '../../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource } from '../../schemas/resource.js';
import type { CostPool } from '../../schemas/cost-pool.js';

function SectionHeader({ title, color = '#a8003b', right }: { title: string; color?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 14, background: color, borderRadius: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

interface FieldDef<T> {
  key: keyof T & string;
  label: string;
  unit: string;
  locked?: boolean;
  step?: string;
}

function FieldGrid<T extends Record<string, unknown>>({
  values,
  onChange,
  fields,
  pricingLocked,
  accent,
  accentBg,
}: {
  values: T;
  onChange: (key: keyof T & string, value: number) => void;
  fields: Array<FieldDef<T>>;
  pricingLocked: boolean;
  accent: string;
  accentBg: string;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
      {fields.map((f) => {
        const disabled = !!f.locked && pricingLocked;
        return (
          <div key={f.key} style={{ padding: '14px 16px', borderRight: '1px solid #f2f2f2', borderBottom: '1px solid #f2f2f2' }}>
            <div style={{ fontSize: 9, color: '#737373', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
              <span>{f.label}</span>
              {f.locked && <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}>🔒</span>}
            </div>
            <input
              type="number"
              step={f.step}
              value={values[f.key] as number}
              disabled={disabled}
              onChange={(e) => onChange(f.key, parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '5px 8px',
                borderRadius: 2,
                fontSize: 13,
                fontWeight: 700,
                textAlign: 'right',
                outline: 'none',
                border: `1px solid ${disabled ? '#e5e5e5' : accent}`,
                background: disabled ? '#f9f9f9' : accentBg,
                opacity: disabled ? 0.65 : 1,
                cursor: disabled ? 'not-allowed' : 'auto',
              }}
            />
            <div style={{ fontSize: 9, color: '#b3b3b3', marginTop: 3, textAlign: 'right' }}>{f.unit}</div>
          </div>
        );
      })}
    </div>
  );
}

const PIPE_FIELDS: Array<FieldDef<ContinuousKgResource>> = [
  { key: 'maxCapacityKgPerHour', label: 'Công suất tối đa máy đùn', unit: 'kg/giờ' },
  { key: 'actualCapacityKgPerHour', label: 'Công suất thực tế máy đùn', unit: 'kg/giờ', locked: true },
  { key: 'normalShifts', label: 'Số ca bình thường', unit: 'ca (1-3)' },
  { key: 'extruderCount', label: 'Số máy đùn', unit: 'máy', locked: true },
  { key: 'yieldRate', label: 'Yield sản phẩm đạt', unit: 'tỷ lệ (0,9=90%)', locked: true, step: '0.01' },
  { key: 'extruderPriceEach', label: 'Đơn giá máy đùn/máy', unit: 'đ/máy', locked: true },
  { key: 'moldPullerCutterCost', label: 'Khuôn ống + puller/cutter', unit: 'đ', locked: true },
  { key: 'depreciationYears', label: 'Số năm khấu hao máy', unit: 'năm' },
  { key: 'annualMaintenance', label: 'Bảo trì phần ống', unit: 'đ/năm' },
  { key: 'peoplePerShift', label: 'Số người / ca', unit: 'người' },
  { key: 'avgSalaryMonthly', label: 'Lương bình quân', unit: 'đ/tháng' },
  { key: 'monthsSalaryPerYear', label: 'Số tháng lương', unit: 'tháng/năm' },
  { key: 'continuousRunDaysPerBatch', label: 'Ngày chạy / đợt', unit: 'ngày' },
  { key: 'maintenanceDaysPerBatch', label: 'Ngày bảo trì / đợt', unit: 'ngày' },
  { key: 'operatingDaysPerYear', label: 'Ngày vận hành / năm', unit: 'ngày' },
  { key: 'hoursPerShift', label: 'Số giờ / ca', unit: 'giờ' },
  { key: 'electricityKw', label: 'Điện vận hành', unit: 'kW' },
  { key: 'electricityPricePerKwh', label: 'Đơn giá điện', unit: 'đ/kWh' },
  { key: 'waterM3PerHour', label: 'Nước', unit: 'm³/giờ' },
  { key: 'waterPricePerM3', label: 'Đơn giá nước', unit: 'đ/m³' },
  { key: 'packagingCostPerKg', label: 'Bao bì + vật tư tiêu hao', unit: 'đ/kg TP' },
];

const FITTING_FIELDS: Array<FieldDef<MachineHourResource>> = [
  { key: 'normalShifts', label: 'Số ca bình thường', unit: 'ca (1-3)' },
  { key: 'normalUtilizationFactor', label: 'Hệ số huy động', unit: 'tỷ lệ', step: '0.05' },
  { key: 'yieldRate', label: 'Yield sản phẩm đạt', unit: 'tỷ lệ', locked: true, step: '0.01' },
  { key: 'depreciationYears', label: 'Số năm khấu hao máy ép', unit: 'năm' },
  { key: 'annualMoldMaintenance', label: 'Bảo trì khuôn', unit: 'đ/năm' },
  { key: 'peoplePerShift', label: 'Số người / ca', unit: 'người' },
  { key: 'avgSalaryMonthly', label: 'Lương bình quân', unit: 'đ/tháng' },
  { key: 'monthsSalaryPerYear', label: 'Số tháng lương', unit: 'tháng/năm' },
  { key: 'continuousRunDaysPerBatch', label: 'Ngày chạy / đợt', unit: 'ngày' },
  { key: 'maintenanceDaysPerBatch', label: 'Ngày bảo trì / đợt', unit: 'ngày' },
  { key: 'operatingDaysPerYear', label: 'Ngày vận hành / năm', unit: 'ngày' },
  { key: 'hoursPerShift', label: 'Số giờ / ca', unit: 'giờ' },
  { key: 'electricityKwPerMachineHour', label: 'Điện / giờ máy', unit: 'kW' },
  { key: 'electricityPricePerKwh', label: 'Đơn giá điện', unit: 'đ/kWh' },
  { key: 'waterM3PerMachineHour', label: 'Nước / giờ máy', unit: 'm³/giờ' },
  { key: 'waterPricePerM3', label: 'Đơn giá nước', unit: 'đ/m³' },
  { key: 'packagingCostPerKg', label: 'Bao bì + vật tư', unit: 'đ/kg TP' },
];

type CostPoolFlat = {
  labAnnualized: number;
  vnUlSetupAnnualized: number;
  ulSetupAnnualized: number;
  sharedDepreciationYears: number;
  annualComplianceFee: number;
  annualLandRent: number;
  operatingCostPerYear: number;
  financialCostPerYear: number;
  solvent550PricePerBox: number;
};
const COST_POOL_LOCKED_FIELDS: Array<FieldDef<CostPoolFlat>> = [
  { key: 'labAnnualized', label: 'Phòng thử nghiệm (Lab)', unit: 'đ/năm', locked: true },
  { key: 'ulSetupAnnualized', label: 'Khởi tạo thử nghiệm UL', unit: 'đ/năm', locked: true },
  { key: 'vnUlSetupAnnualized', label: 'UL trong nước (giữ chỗ)', unit: 'đ/năm', locked: true },
  { key: 'sharedDepreciationYears', label: 'Số năm khấu hao Lab/UL', unit: 'năm', locked: true },
  { key: 'annualComplianceFee', label: 'Phí tuân thủ / năm', unit: 'đ/năm', locked: true },
  { key: 'annualLandRent', label: 'Thuê đất / năm', unit: 'đ/năm', locked: true },
  { key: 'operatingCostPerYear', label: 'Chi phí vận hành ngoài SX', unit: 'đ/năm · bậc 4 hòa vốn', locked: true },
  { key: 'financialCostPerYear', label: 'Chi phí tài chính (lãi vay)', unit: 'đ/năm · bậc 4 hòa vốn', locked: true },
  { key: 'solvent550PricePerBox', label: 'Dung môi 550', unit: 'đ/thùng', locked: true },
];

type PolicyFlat = { usdVndRate: number; vatOutputRate: number; mandatoryInsuranceRate: number; markupTcg: number; listPriceMargin: number };
const POLICY_FIELDS: Array<FieldDef<PolicyFlat>> = [
  { key: 'usdVndRate', label: 'Tỷ giá USD/VND', unit: 'đ/USD' },
  { key: 'vatOutputRate', label: 'Thuế VAT đầu ra', unit: 'tỷ lệ (0,08=8%)', step: '0.01' },
  { key: 'mandatoryInsuranceRate', label: 'BH bắt buộc + KPCĐ', unit: 'tỷ lệ (0,235=23,5%)', step: '0.001' },
  { key: 'markupTcg', label: 'Markup TCG', unit: 'tỷ lệ', step: '0.01' },
  { key: 'listPriceMargin', label: 'Biên giá niêm yết', unit: 'tỷ lệ (0-0,9)', step: '0.01' },
];

export default function ConfigScreen({
  role,
  scenarioId,
  scenario,
}: {
  role: AppRole;
  scenarioId: string;
  scenario: ScenarioInput | null;
}) {
  const canEdit = role === 'admin' || role === 'pricing';
  const pricingLocked = role !== 'admin'; // pricing thấy khóa 🔒, admin sửa hết
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
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Cấu Hình Nhà Máy</h1>
        <p style={{ fontSize: 12, color: '#737373' }}>Màn hình này chỉ dành cho vai Toàn Quyền / Định Giá.</p>
      </div>
    );
  }
  if (!form) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải cấu hình…</div>;
  }

  const pipe = form.resources.pipe as ContinuousKgResource;
  const fitting = form.resources.fitting as MachineHourResource;
  const costPool = form.costPool;

  const setPipe = (key: keyof ContinuousKgResource & string, value: number) =>
    setForm((f) => (f ? { ...f, resources: { ...f.resources, pipe: { ...(f.resources.pipe as ContinuousKgResource), [key]: value } } } : f));
  const setFitting = (key: keyof MachineHourResource & string, value: number) =>
    setForm((f) => (f ? { ...f, resources: { ...f.resources, fitting: { ...(f.resources.fitting as MachineHourResource), [key]: value } } } : f));
  const setMachineType = (index: number, key: 'priceVnd' | 'count', value: number) =>
    setForm((f) => {
      if (!f) return f;
      const cur = f.resources.fitting as MachineHourResource;
      const machineTypes = cur.machineTypes.map((m, i) => (i === index ? { ...m, [key]: value } : m));
      return { ...f, resources: { ...f.resources, fitting: { ...cur, machineTypes } } };
    });
  const setCostPoolFlat = (key: keyof CostPoolFlat, value: number) =>
    setForm((f) => {
      if (!f) return f;
      const cp: CostPool = f.costPool;
      if (key === 'sharedDepreciationYears') {
        return { ...f, costPool: { ...cp, sharedFixedCosts: { ...cp.sharedFixedCosts, depreciationYears: value } } };
      }
      if (key === 'operatingCostPerYear' || key === 'financialCostPerYear') {
        return { ...f, costPool: { ...cp, nonProductionCosts: { ...cp.nonProductionCosts, [key]: value } } };
      }
      if (key === 'solvent550PricePerBox') {
        return { ...f, costPool: { ...cp, solvent550PricePerBox: value } };
      }
      return { ...f, costPool: { ...cp, sharedFixedCosts: { ...cp.sharedFixedCosts, [key]: value } } };
    });
  const setPolicy = (key: keyof PolicyFlat, value: number) =>
    setForm((f) => {
      if (!f) return f;
      const cp: CostPool = f.costPool;
      if (key === 'markupTcg' || key === 'listPriceMargin') {
        return { ...f, costPool: { ...cp, markup: { ...cp.markup, [key]: value } } };
      }
      return { ...f, costPool: { ...cp, currency: { ...cp.currency, [key]: value } } };
    });

  const costPoolFlat: CostPoolFlat = {
    labAnnualized: costPool.sharedFixedCosts.labAnnualized,
    vnUlSetupAnnualized: costPool.sharedFixedCosts.vnUlSetupAnnualized,
    ulSetupAnnualized: costPool.sharedFixedCosts.ulSetupAnnualized,
    sharedDepreciationYears: costPool.sharedFixedCosts.depreciationYears,
    annualComplianceFee: costPool.sharedFixedCosts.annualComplianceFee,
    annualLandRent: costPool.sharedFixedCosts.annualLandRent,
    operatingCostPerYear: costPool.nonProductionCosts.operatingCostPerYear,
    financialCostPerYear: costPool.nonProductionCosts.financialCostPerYear,
    solvent550PricePerBox: costPool.solvent550PricePerBox,
  };
  const policyFlat: PolicyFlat = {
    usdVndRate: costPool.currency.usdVndRate,
    vatOutputRate: costPool.currency.vatOutputRate,
    mandatoryInsuranceRate: costPool.currency.mandatoryInsuranceRate,
    markupTcg: costPool.markup.markupTcg,
    listPriceMargin: costPool.markup.listPriceMargin,
  };

  const moldAssetsTotalVnd = fitting.moldAssets.reduce((s, m) => s + m.costVnd, 0);

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
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>
          Cấu Hình Nguồn Lực Nhà Máy
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Cấu Hình Nhà Máy</h1>
            <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>Chỉnh sửa tham số nguồn lực → toàn bộ giá thành, hòa vốn, MHR tự cập nhật theo</div>
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

      {pricingLocked && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 2, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ fontSize: 18, flexShrink: 0, marginTop: -2 }}>🔒</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>Tham số cốt lõi bị khóa — Chỉ Admin mới có quyền sửa</div>
            <div style={{ fontSize: 10, color: '#7f1d1d' }}>Các ô đánh dấu 🔒 (công suất, số máy, yield, giá máy, chi phí chung) không thể chỉnh sửa để đảm bảo tính toàn vẹn dữ liệu. Liên hệ Admin nếu cần thay đổi.</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <SectionHeader title="A. Ống CPVC — Máy đùn" />
        <FieldGrid values={pipe} onChange={setPipe} fields={PIPE_FIELDS} pricingLocked={pricingLocked} accent="#a8003b" accentBg="#fff7f7" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionHeader
          title="B. Phụ Kiện — Máy ép phun"
          color="#2563eb"
          right={
            <div style={{ fontSize: 10, color: '#737373' }}>
              Tổng giá trị khuôn hiện có: <strong style={{ color: '#1a1a1a' }}>{fmtVnd(moldAssetsTotalVnd)} đ</strong> ({fitting.moldAssets.length} bộ — quản lý qua audit log riêng, ADR-007)
            </div>
          }
        />
        <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 8 }}>
          {fitting.machineTypes.map((m, i) => (
            <div key={m.id} style={{ display: 'contents' }}>
              <div style={{ padding: '14px 16px', borderRight: '1px solid #f2f2f2', borderBottom: '1px solid #f2f2f2' }}>
                <div style={{ fontSize: 9, color: '#737373', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Đơn giá máy ép loại {m.id}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>🔒</span>
                </div>
                <input
                  type="number"
                  value={m.priceVnd}
                  disabled={pricingLocked}
                  onChange={(e) => setMachineType(i, 'priceVnd', parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 8px', borderRadius: 2, fontSize: 13, fontWeight: 700, textAlign: 'right', outline: 'none', border: `1px solid ${pricingLocked ? '#e5e5e5' : '#93c5fd'}`, background: pricingLocked ? '#f9f9f9' : '#eff6ff', opacity: pricingLocked ? 0.65 : 1, cursor: pricingLocked ? 'not-allowed' : 'auto' }}
                />
                <div style={{ fontSize: 9, color: '#b3b3b3', marginTop: 3, textAlign: 'right' }}>đ/máy</div>
              </div>
              <div style={{ padding: '14px 16px', borderRight: '1px solid #f2f2f2', borderBottom: '1px solid #f2f2f2' }}>
                <div style={{ fontSize: 9, color: '#737373', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Số máy loại {m.id}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>🔒</span>
                </div>
                <input
                  type="number"
                  value={m.count}
                  disabled={pricingLocked}
                  onChange={(e) => setMachineType(i, 'count', parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '5px 8px', borderRadius: 2, fontSize: 13, fontWeight: 700, textAlign: 'right', outline: 'none', border: `1px solid ${pricingLocked ? '#e5e5e5' : '#93c5fd'}`, background: pricingLocked ? '#f9f9f9' : '#eff6ff', opacity: pricingLocked ? 0.65 : 1, cursor: pricingLocked ? 'not-allowed' : 'auto' }}
                />
                <div style={{ fontSize: 9, color: '#b3b3b3', marginTop: 3, textAlign: 'right' }}>máy</div>
              </div>
            </div>
          ))}
        </div>
        <FieldGrid values={fitting} onChange={setFitting} fields={FITTING_FIELDS} pricingLocked={pricingLocked} accent="#2563eb" accentBg="#eff6ff" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionHeader title="C. Chi Phí Chung & Ngoài Sản Xuất" color="#737373" right={<span style={{ fontSize: 10, color: '#737373' }}>Toàn bộ khối này chỉ Admin ghi (cost-pool.md)</span>} />
        <FieldGrid values={costPoolFlat} onChange={setCostPoolFlat} fields={COST_POOL_LOCKED_FIELDS} pricingLocked={pricingLocked} accent="#d8d8d8" accentBg="#f5f5f3" />
      </div>

      <div>
        <SectionHeader title="D. Tỷ Giá & Chính Sách Markup" color="#16A34A" right={<span style={{ fontSize: 10, color: '#737373' }}>Mở cho Định Giá — biến chiến lược T2/T3</span>} />
        <FieldGrid values={policyFlat} onChange={setPolicy} fields={POLICY_FIELDS} pricingLocked={false} accent="#16A34A" accentBg="#f0fdf4" />
      </div>
    </div>
  );
}
