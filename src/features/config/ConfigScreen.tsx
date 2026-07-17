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
//
// ADR-033 — TRÌNH BÀY: Tailwind + shadcn/ui (Card/Input/Button), theme đen–trắng.
// Logic/props/field-map/format số giữ NGUYÊN; màu chỉ dành cho TRẠNG THÁI (lưu/lỗi).
import { useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase.js';
import type { AppRole } from '../../lib/firebase.js';
import { fmtVnd } from '../../lib/format.js';
import { ScenarioInputSchema, type ScenarioInput } from '../../schemas/scenario.js';
import type { ContinuousKgResource, MachineHourResource, MoldAsset } from '../../schemas/resource.js';
import type { CostPool } from '../../schemas/cost-pool.js';
import { MoldAssetModal } from './MoldAssetModal.js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="h-3.5 w-0.5 shrink-0 rounded-sm bg-foreground" />
        <div className="text-eyebrow font-semibold uppercase tracking-[.12em] text-faint">{title}</div>
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
}: {
  values: T;
  onChange: (key: keyof T & string, value: number) => void;
  fields: Array<FieldDef<T>>;
  pricingLocked: boolean;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] overflow-hidden rounded-md border bg-card">
      {fields.map((f) => {
        const disabled = !!f.locked && pricingLocked;
        return (
          <div key={f.key} className="border-b border-r border-border p-4">
            <div className="mb-1.5 flex items-center justify-between gap-1 text-eyebrow text-muted-foreground">
              <span>{f.label}</span>
              {f.locked && <span className="shrink-0 opacity-70">🔒</span>}
            </div>
            <Input
              type="number"
              step={f.step}
              value={values[f.key] as number}
              disabled={disabled}
              onChange={(e) => onChange(f.key, parseFloat(e.target.value) || 0)}
              className="h-8 px-2 text-right text-sm font-semibold tabular-nums"
            />
            <div className="mt-1 text-right text-eyebrow text-faint">{f.unit}</div>
          </div>
        );
      })}
    </div>
  );
}

const PIPE_MACHINE_FIELDS: Array<FieldDef<ContinuousKgResource>> = [
  { key: 'maxCapacityKgPerHour', label: 'Công suất tối đa máy đùn', unit: 'kg/giờ', locked: true },
  { key: 'actualCapacityKgPerHour', label: 'Công suất thực tế máy đùn', unit: 'kg/giờ', locked: true },
  { key: 'extruderCount', label: 'Số máy đùn', unit: 'máy', locked: true },
  { key: 'yieldRate', label: 'Yield sản phẩm đạt', unit: 'tỷ lệ (0,9=90%)', locked: true, step: '0.01' },
  { key: 'extruderPriceEach', label: 'Đơn giá máy đùn/máy', unit: 'đ/máy', locked: true },
  { key: 'depreciationYears', label: 'Số năm khấu hao máy', unit: 'năm', locked: true },
  { key: 'moldPullerCutterCost', label: 'Khuôn ống + puller/cutter', unit: 'đ', locked: true },
  { key: 'moldDepreciationYears', label: 'Số năm khấu hao khuôn ống', unit: 'năm', locked: true },
  { key: 'electricityKw', label: 'Điện vận hành', unit: 'kW', locked: true },
  { key: 'waterM3PerHour', label: 'Nước tiêu thụ', unit: 'm³/giờ', locked: true },
  { key: 'continuousRunDaysPerBatch', label: 'Ngày chạy / đợt', unit: 'ngày', locked: true },
  { key: 'maintenanceDaysPerBatch', label: 'Ngày bảo trì / đợt', unit: 'ngày', locked: true },
  { key: 'operatingDaysPerYear', label: 'Ngày vận hành / năm', unit: 'ngày', locked: true },
  { key: 'hoursPerShift', label: 'Số giờ / ca', unit: 'giờ', locked: true },
];

const PIPE_OP_FIELDS: Array<FieldDef<ContinuousKgResource>> = [
  { key: 'normalShifts', label: 'Số ca bình thường', unit: 'ca (1-3)' },
  { key: 'peoplePerShift', label: 'Số người / ca', unit: 'người' },
  { key: 'avgSalaryMonthly', label: 'Lương bình quân', unit: 'đ/tháng' },
  { key: 'monthsSalaryPerYear', label: 'Số tháng lương', unit: 'tháng/năm' },
  { key: 'electricityPricePerKwh', label: 'Đơn giá điện', unit: 'đ/kWh' },
  { key: 'waterPricePerM3', label: 'Đơn giá nước', unit: 'đ/m³' },
  { key: 'annualMaintenance', label: 'Bảo trì phần ống', unit: 'đ/năm' },
  { key: 'packagingCostPerKg', label: 'Bao bì + vật tư tiêu hao', unit: 'đ/kg TP' },
];

const FITTING_MACHINE_FIELDS: Array<FieldDef<MachineHourResource>> = [
  { key: 'yieldRate', label: 'Yield sản phẩm đạt', unit: 'tỷ lệ', locked: true, step: '0.01' },
  { key: 'depreciationYears', label: 'Số năm khấu hao máy ép', unit: 'năm', locked: true },
  { key: 'electricityKwPerMachineHour', label: 'Điện / giờ máy', unit: 'kW', locked: true },
  { key: 'waterM3PerMachineHour', label: 'Nước / giờ máy', unit: 'm³/giờ', locked: true },
  { key: 'continuousRunDaysPerBatch', label: 'Ngày chạy / đợt', unit: 'ngày', locked: true },
  { key: 'maintenanceDaysPerBatch', label: 'Ngày bảo trì / đợt', unit: 'ngày', locked: true },
  { key: 'operatingDaysPerYear', label: 'Ngày vận hành / năm', unit: 'ngày', locked: true },
  { key: 'hoursPerShift', label: 'Số giờ / ca', unit: 'giờ', locked: true },
];

const FITTING_OP_FIELDS: Array<FieldDef<MachineHourResource>> = [
  { key: 'normalShifts', label: 'Số ca bình thường', unit: 'ca (1-3)' },
  { key: 'normalUtilizationFactor', label: 'Hệ số huy động', unit: 'tỷ lệ', step: '0.05' },
  { key: 'peoplePerShift', label: 'Số người / ca', unit: 'người' },
  { key: 'avgSalaryMonthly', label: 'Lương bình quân', unit: 'đ/tháng' },
  { key: 'monthsSalaryPerYear', label: 'Số tháng lương', unit: 'tháng/năm' },
  { key: 'electricityPricePerKwh', label: 'Đơn giá điện', unit: 'đ/kWh' },
  { key: 'waterPricePerM3', label: 'Đơn giá nước', unit: 'đ/m³' },
  { key: 'annualMoldMaintenance', label: 'Bảo trì khuôn', unit: 'đ/năm' },
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
  factoryConstructionCost: number;
  factoryDepreciationYears: number;
  workingCapital: number;
};
const COST_POOL_LOCKED_FIELDS: Array<FieldDef<CostPoolFlat>> = [
  { key: 'factoryConstructionCost', label: 'XD Nhà xưởng & Phụ trợ (CAPEX)', unit: 'đ', locked: true },
  { key: 'factoryDepreciationYears', label: 'Số năm khấu hao xưởng', unit: 'năm', locked: true },
  { key: 'workingCapital', label: 'Vốn lưu động ban đầu', unit: 'đ', locked: true },
  { key: 'labAnnualized', label: 'Phòng thử nghiệm (Lab)', unit: 'đ/năm', locked: true },
  { key: 'ulSetupAnnualized', label: 'Khởi tạo thử nghiệm UL', unit: 'đ/năm', locked: true },
  { key: 'vnUlSetupAnnualized', label: 'UL trong nước (giữ chỗ)', unit: 'đ/năm', locked: true },
  { key: 'sharedDepreciationYears', label: 'Số năm khấu hao Lab/UL', unit: 'năm', locked: true },
  { key: 'annualComplianceFee', label: 'Phí tuân thủ / năm', unit: 'đ/năm', locked: true },
  { key: 'annualLandRent', label: 'Thuê đất / xưởng (1 năm)', unit: 'đ/năm', locked: true },
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
  // ADR-026 — bỏ guard "chỉ dành cho vai X" (chỉ admin/pricing đăng nhập được).
  // GIỮ `pricingLocked`: field chiến lược (currency/markup) admin-only khớp
  // firestore.rules — ranh giới bảo mật, không phải điều hướng theo vai.
  const pricingLocked = role !== 'admin'; // pricing thấy khóa 🔒, admin sửa hết
  const [form, setForm] = useState<ScenarioInput | null>(null);
  const loadedRef = useRef(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMoldModal, setShowMoldModal] = useState(false);

  if (scenario && !loadedRef.current) {
    loadedRef.current = true;
    setForm(scenario);
  }

  if (!form) {
    return <div className="px-9 py-8 text-sm text-muted-foreground">Đang tải cấu hình…</div>;
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
      if (key === 'factoryDepreciationYears') {
        return { ...f, costPool: { ...cp, sharedFixedCosts: { ...cp.sharedFixedCosts, factoryDepreciationYears: value } } };
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
    factoryConstructionCost: costPool.sharedFixedCosts.factoryConstructionCost || 0,
    factoryDepreciationYears: costPool.sharedFixedCosts.factoryDepreciationYears || 10,
    workingCapital: costPool.sharedFixedCosts.workingCapital || 0,
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
    <div className="px-9 py-8">
      <div className="mb-5">
        <div className="text-eyebrow font-semibold uppercase tracking-[.14em] text-faint">Cấu Hình Nguồn Lực Nhà Máy</div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Cấu Hình Nhà Máy</h1>
            <div className="mt-1 text-sm text-muted-foreground">Chỉnh sửa tham số nguồn lực → toàn bộ giá thành, hòa vốn, MHR tự cập nhật theo</div>
          </div>
          <Button onClick={() => void handleSave()} disabled={saveState === 'saving'} className="uppercase tracking-[.06em]">
            {saveState === 'saving' ? 'Đang lưu…' : 'Lưu & Cập Nhật'}
          </Button>
        </div>
        {saveState === 'saved' && <div className="mt-1.5 text-xs font-semibold text-success">✓ Đã lưu — Cloud Function sẽ tự tính lại toàn bộ giá thành</div>}
        {saveState === 'error' && <div className="mt-1.5 text-xs text-destructive">{saveError}</div>}
      </div>

      {pricingLocked && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border bg-muted px-4 py-3">
          <div className="shrink-0 text-lg">🔒</div>
          <div>
            <div className="mb-1 text-xs font-bold text-foreground">Tham số cốt lõi bị khóa — Chỉ Admin mới có quyền sửa</div>
            <div className="text-xs text-muted-foreground">Các ô đánh dấu 🔒 (công suất, số máy, yield, giá máy, chi phí chung) không thể chỉnh sửa để đảm bảo tính toàn vẹn dữ liệu. Liên hệ Admin nếu cần thay đổi.</div>
          </div>
        </div>
      )}

      <div className="mb-5">
        <SectionHeader title="A. Ống CPVC — Biến số Vận hành & Thị trường" />
        <FieldGrid values={pipe} onChange={setPipe} fields={PIPE_OP_FIELDS} pricingLocked={pricingLocked} />

        <div className="mt-4">
          <div className="mb-2 text-eyebrow font-semibold uppercase tracking-[.05em] text-faint">Thông số Kỹ thuật & Đầu tư (Master Data)</div>
          <FieldGrid values={pipe} onChange={setPipe} fields={PIPE_MACHINE_FIELDS} pricingLocked={pricingLocked} />
        </div>
      </div>

      <div className="mb-5">
        <SectionHeader
          title="B. Phụ Kiện — Máy ép phun"
          right={
            <div className="text-right text-xs text-muted-foreground">
              Tổng giá trị khuôn: <strong className="text-foreground tabular-nums">{fmtVnd(fitting.moldAssets.reduce((sum, m) => sum + m.costVnd, 0))} đ</strong> ({fitting.moldAssets.length} bộ)
              <div className="mt-1">
                <Button variant="outline" size="sm" onClick={() => setShowMoldModal(true)}>
                  Quản lý Danh Sách {fitting.moldAssets.length} Khuôn
                </Button>
              </div>
            </div>
          }
        />
        <div className="mb-2 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] overflow-hidden rounded-md border bg-card">
          {fitting.machineTypes.map((m, i) => (
            <div key={m.id} className="contents">
              <div className="border-b border-r border-border p-4">
                <div className="mb-1.5 flex justify-between text-eyebrow text-muted-foreground">
                  <span>Đơn giá máy ép loại {m.id}</span>
                  <span className="opacity-70">🔒</span>
                </div>
                <Input
                  type="number"
                  value={m.priceVnd}
                  disabled={pricingLocked}
                  onChange={(e) => setMachineType(i, 'priceVnd', parseFloat(e.target.value) || 0)}
                  className="h-8 px-2 text-right text-sm font-semibold tabular-nums"
                />
                <div className="mt-1 text-right text-eyebrow text-faint">đ/máy</div>
              </div>
              <div className="border-b border-r border-border p-4">
                <div className="mb-1.5 flex justify-between text-eyebrow text-muted-foreground">
                  <span>Số máy loại {m.id}</span>
                  <span className="opacity-70">🔒</span>
                </div>
                <Input
                  type="number"
                  value={m.count}
                  disabled={pricingLocked}
                  onChange={(e) => setMachineType(i, 'count', parseFloat(e.target.value) || 0)}
                  className="h-8 px-2 text-right text-sm font-semibold tabular-nums"
                />
                <div className="mt-1 text-right text-eyebrow text-faint">máy</div>
              </div>
            </div>
          ))}
        </div>
        <FieldGrid values={fitting} onChange={setFitting} fields={FITTING_OP_FIELDS} pricingLocked={pricingLocked} />

        <div className="mt-4">
          <div className="mb-2 text-eyebrow font-semibold uppercase tracking-[.05em] text-faint">Thông số Kỹ thuật & Đầu tư (Master Data)</div>
          <FieldGrid values={fitting} onChange={setFitting} fields={FITTING_MACHINE_FIELDS} pricingLocked={pricingLocked} />
        </div>
      </div>

      <div className="mb-5">
        <SectionHeader title="C. Chi Phí Chung & Ngoài Sản Xuất" right={<span className="text-eyebrow text-muted-foreground">Toàn bộ khối này chỉ Admin ghi (cost-pool.md)</span>} />
        <FieldGrid values={costPoolFlat} onChange={setCostPoolFlat} fields={COST_POOL_LOCKED_FIELDS} pricingLocked={pricingLocked} />
      </div>

      <div>
        <SectionHeader title="D. Tỷ Giá & Chính Sách Markup" right={<span className="text-eyebrow text-muted-foreground">Mở cho Định Giá — biến chiến lược T2/T3</span>} />
        <FieldGrid values={policyFlat} onChange={setPolicy} fields={POLICY_FIELDS} pricingLocked={false} />
      </div>

      {showMoldModal && (
        <MoldAssetModal
          initialMolds={fitting.moldAssets}
          canEdit={!pricingLocked}
          onClose={() => setShowMoldModal(false)}
          onSave={(newMolds) => {
            setFitting('moldAssets' as any, newMolds as any);
            setShowMoldModal(false);
          }}
        />
      )}
    </div>
  );
}
