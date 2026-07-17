// M12.5 — màn hình Dashboard (tab `dashboard`), dựng ĐÚNG prototype Pha 1 đã
// duyệt (prototype/blazemaster-costing-app.dc.html, mục Tổng Quan Quản Trị):
// lock bar ADR-004 → I. thang giá 5 bậc → II. 3 mức công suất Ống → III.
// phân tích ngược top-down → IV. hòa vốn & đầu tư. Vai sales chỉ thấy I + ghi
// chú (ADR-006). Khác prototype (mock tự tính trong trang): mọi số ở đây từ
// `outputs/internal` (Cloud Function tính) + engine pure gọi tại chỗ
// (`calculateDashboardKpis`, `solve` — vai admin/pricing được đọc trọn
// ScenarioInput nên chạy engine client-side không xuyên thủng ranh giới dữ
// liệu nào). ADR-012: thang giá/CVP theo (line, materialId) — có selector
// nguyên liệu khi 1 line có >1 material.
// ADR-033 — TRÌNH BÀY: Tailwind + shadcn/ui (Card/Input/Button/Segmented), theme
// đen–trắng (src/index.css). Logic/props/format giữ NGUYÊN; màu CHỈ cho DỮ LIỆU
// (EBIT âm/dương, khóa/mở, trạng thái top-down). Recharts giữ hex cho series.
import { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, type AppRole } from '../../lib/firebase.js';
import { fmtVnd, fmtUsd, fmtPct, fmtTyVnd } from '../../lib/format.js';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import { referenceMaterialOf } from '../../engine/scenario.js';
import { calculateDashboardKpis } from '../../engine/dashboard-support.js';
import { solve } from '../../engine/solver.js';
import { calculateScenario } from '../../engine/scenario.js';
import { writePriceLockAuditEntry } from '../../lib/priceLockAudit.js';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, ReferenceLine } from 'recharts';
import { Card as UICard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';

const TIER_DEFS = [
  { key: 'variableCostFloor', bac: 1, label: 'Sàn biến phí', role: 'Không ai được bán thủng — lỗ tiền tươi ngay lập tức' },
  { key: 'cashBreakEven', bac: 2, label: 'Hòa vốn tiền mặt', role: 'Quản trị — phòng thủ khi thị trường xấu, dòng tiền còn dương' },
  { key: 'breakEvenFullCost', bac: 3, label: 'Giá thành đầy đủ', role: 'Sản xuất + kế toán (TT200) — GĐ duyệt mới được bán tới đây' },
  { key: 'enterpriseBreakEven', bac: 4, label: 'Hòa vốn toàn DN', role: 'Quản trị + đầu tư — giá bán thường ngày PHẢI trên mức này' },
  { key: 'targetPrice', bac: 5, label: 'Giá mục tiêu (VF)', role: 'Bán hàng — giá chào chuẩn; khoảng lùi 5→4→3 theo thẩm quyền' },
] as const;

type Ladder = ScenarioOutput['priceLadder']['byLineMaterial'][number]['ladder'];

function SectionHeader({ index, title, note }: { index: string; title: string; note?: string }) {
  return (
    <div className="mb-[11px] flex items-center gap-2">
      <div className="h-3.5 w-[3px] shrink-0 rounded-[1px] bg-foreground" />
      <div className="text-eyebrow font-bold uppercase tracking-[.12em] text-foreground">
        {index}. {title}
      </div>
      {note && <div className="ml-1 text-eyebrow text-muted-foreground">{note}</div>}
    </div>
  );
}

/** Selector nguyên liệu cho 1 line (ADR-012) — chỉ hiện khi có >1 material. */
function MaterialPicker({
  label,
  materials,
  selectedId,
  onSelect,
}: {
  label: string;
  materials: ScenarioInput['materials'];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (materials.length <= 1) return null;
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <span className="text-eyebrow uppercase tracking-[.08em] text-muted-foreground">{label}</span>
      <Segmented
        size="sm"
        value={selectedId}
        onChange={onSelect}
        options={materials.map((m) => ({ id: m.id, label: m.name }))}
      />
    </div>
  );
}

function LadderSection({
  pipeLadder,
  fittingLadder,
}: {
  pipeLadder: Ladder;
  fittingLadder: Ladder;
}) {
  const range = (l: Ladder) => ({ min: l.variableCostFloor, max: l.targetPrice });
  const rp = range(pipeLadder);
  const rf = range(fittingLadder);
  const bar = (v: number, r: { min: number; max: number }) => `${Math.round(((v - r.min) / (r.max - r.min)) * 100)}%`;
  return (
    <div className="mb-[22px]">
      <SectionHeader index="I" title="THANG GIÁ 5 BẬC — VNĐ/KG" />
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="grid grid-cols-[32px_1fr_160px_160px] gap-3 border-b bg-muted px-[18px] py-2.5">
          <div />
          <div className="text-eyebrow font-bold uppercase tracking-[.08em] text-muted-foreground">Bậc giá / Thẩm quyền</div>
          <div className="text-right text-eyebrow font-bold uppercase text-muted-foreground">Ống CPVC</div>
          <div className="text-right text-eyebrow font-bold uppercase text-muted-foreground">Phụ Kiện</div>
        </div>
        {TIER_DEFS.map((tg) => (
          <div key={tg.bac} className="grid grid-cols-[32px_1fr_160px_160px] items-start gap-3 border-b border-muted px-[18px] py-3">
            <div className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary">
              <span className="text-[10px] font-bold text-primary-foreground">{tg.bac}</span>
            </div>
            <div>
              <div className="mb-0.5 text-xs font-semibold text-foreground">{tg.label}</div>
              <div className="mb-[7px] text-[10px] text-muted-foreground">{tg.role}</div>
              <div className="flex gap-4">
                {(
                  [
                    ['ỐNG', pipeLadder[tg.key], rp],
                    ['PHỤ KIỆN', fittingLadder[tg.key], rf],
                  ] as const
                ).map(([lbl, v, r]) => (
                  <div key={lbl} className="flex-1">
                    <div className="mb-[3px] text-[8px] text-faint">{lbl}</div>
                    <div className="h-[3px] rounded-[2px] bg-muted">
                      <div className="h-[3px] rounded-[2px] bg-foreground" style={{ width: bar(v, r) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {[pipeLadder[tg.key], fittingLadder[tg.key]].map((v, i) => (
              <div key={i} className="pt-px text-right">
                <div className="text-sm font-bold tabular-nums text-foreground">{fmtVnd(v)}</div>
                <div className="mt-px text-[9px] text-faint">đ/kg</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <UICard className={cn('p-[15px]', className)}>{children}</UICard>;
}
function CardLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="mb-[7px] flex items-center gap-1 text-eyebrow uppercase tracking-[.08em] text-muted-foreground">
      {children}
      {tooltip && (
        <span
          title={tooltip}
          className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full bg-border text-[9px] font-bold text-muted-foreground"
        >
          ?
        </span>
      )}
    </div>
  );
}
function CardValue({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('text-[21px] font-bold tabular-nums text-foreground', className)}>{children}</div>;
}
function CardNote({ children }: { children: React.ReactNode }) {
  return <div className="mt-0.5 text-[10px] text-muted-foreground">{children}</div>;
}

export default function Dashboard({
  role,
  user,
  scenarioId,
  scenario,
  internal,
  salesPriceLadder,
}: {
  role: AppRole;
  /** M12.10 (security-review) — ai chốt baseline, ghi vào priceLockAudit. */
  user: { uid: string; email: string | null } | null;
  scenarioId: string;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
  /** priceLadder từ outputs/priceList — nguồn duy nhất của vai sales (M12.6: PriceListDoc.priceLadder). */
  salesPriceLadder: ScenarioOutput['priceLadder'] | null;
}) {
  // ADR-026 — bỏ cờ `canSeeCostDetail` + nhánh view sales dự phòng (code chết:
  // chỉ admin/pricing đăng nhập được — ADR-023). Dashboard chỉ còn luồng CEO.
  const [selectedShift, setSelectedShift] = useState(2);
  const [topDownPrice, setTopDownPrice] = useState(0);
  const [pipeMaterialId, setPipeMaterialId] = useState<string | null>(null);
  const [fittingMaterialId, setFittingMaterialId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'manufacturing' | 'investor' | 'pricing'>('overview');

  // ── Chọn material theo line (ADR-012) — mặc định material tham chiếu ──────
  const pipeMaterials = useMemo(
    () => (scenario ? scenario.materials.filter((m) => scenario.products.some((p) => p.kind === 'pipe' && p.materialId === m.id)) : []),
    [scenario],
  );
  const fittingMaterials = useMemo(
    () => (scenario ? scenario.materials.filter((m) => scenario.products.some((p) => p.kind === 'fitting' && p.materialId === m.id)) : []),
    [scenario],
  );
  const activePipeMatId = pipeMaterialId ?? pipeMaterials[0]?.id ?? null;
  const activeFittingMatId = fittingMaterialId ?? fittingMaterials[0]?.id ?? null;

  const ladderOf = (line: 'pipe' | 'fitting', materialId: string | null): Ladder | null => {
    const source = internal?.priceLadder ?? salesPriceLadder;
    if (!source) return null;
    const entries = source.byLineMaterial.filter((e) => e.line === line);
    return (materialId ? entries.find((e) => e.materialId === materialId) : entries[0])?.ladder ?? entries[0]?.ladder ?? null;
  };
  const pipeLadder = ladderOf('pipe', activePipeMatId);
  const fittingLadder = ladderOf('fitting', activeFittingMatId);

  const pipeCvpEntry = internal?.cvp.byLineMaterial.find((e) => e.line === 'pipe' && e.materialId === activePipeMatId) ?? null;
  const pipeCvp = pipeCvpEntry && pipeCvpEntry.line === 'pipe' ? pipeCvpEntry : null;

  const fittingCvpEntry = internal?.cvp.byLineMaterial.find((e) => e.line === 'fitting' && e.materialId === activeFittingMatId) ?? null;
  const fittingCvp = fittingCvpEntry && fittingCvpEntry.line === 'fitting' ? fittingCvpEntry : null;

  const kpis = useMemo(() => (scenario ? calculateDashboardKpis(scenario) : null), [scenario]);

  const pipeCvpChartData = useMemo(() => {
    if (!pipeCvp || !pipeLadder || !kpis) return [];
    const maxCapacity = kpis.capacityLevels[2]?.productionKgYear || pipeCvp.breakEvenKgYear * 2;
    const step = maxCapacity / 5;
    const data = [];
    for (let i = 0; i <= 6; i++) {
      const kg = i * step;
      const doanhThu = (kg * pipeLadder.targetPrice) / 1e9;
      const chiPhi = (pipeCvp.fixedCostPerYear + kg * pipeCvp.variableCostPerKg) / 1e9;
      data.push({
        kg: Math.round(kg),
        doanhThu,
        chiPhi,
        dinhPhi: pipeCvp.fixedCostPerYear / 1e9,
        loiNhuan: doanhThu - chiPhi,
      });
    }
    return data;
  }, [pipeCvp, pipeLadder, kpis]);

  // ── Top-down: compound tối đa = bisection trên calculateScenario (luật
  //   inverse-solver #1: KHÔNG công thức ngược tay), mục tiêu = giá thành đầy
  //   đủ của Ống tại material đang chọn ─────────────────────────────────────
  const tdMaxCompound = useMemo(() => {
    if (!scenario || topDownPrice <= 0 || !activePipeMatId) return null;
    const materialIndex = scenario.materials.findIndex((m) => m.id === activePipeMatId);
    if (materialIndex < 0) return null;
    const result = solve<ScenarioInput, ScenarioOutput>({
      baseInput: scenario,
      forwardFn: calculateScenario,
      freeVarPath: `materials.${materialIndex}.inventory.replacementPriceUsdPerKg`,
      targetSelector: (o) => o.priceLadder.byLineMaterial.find((e) => e.line === 'pipe' && e.materialId === activePipeMatId)!.ladder.breakEvenFullCost,
      target: topDownPrice,
      bounds: [0, 20],
      tol: 0.5,
    });
    return result.feasible ? result.value : null;
  }, [scenario, topDownPrice, activePipeMatId]);

  if (!scenario || !internal) {
    return <div className="px-9 py-8 text-xs text-muted-foreground">Đang tải kịch bản + kết quả tính…</div>;
  }

  const pipeRefMaterial = scenario ? referenceMaterialOf(scenario.materials, scenario.products, 'pipe') : null;
  const fittingRefMaterial = scenario ? referenceMaterialOf(scenario.materials, scenario.products, 'fitting') : null;
  const usdRate = scenario?.costPool.currency.usdVndRate;

  // Lock bar theo material đang chọn của từng line (ADR-004 + ADR-012)
  const lockEntryOf = (materialId: string | null) =>
    materialId ? internal?.priceLock.byMaterial.find((e) => e.materialId === materialId) ?? null : null;
  const lockRows = (
    [
      ['BẢNG GIÁ ỐNG', scenario?.materials.find((m) => m.id === activePipeMatId), lockEntryOf(activePipeMatId)],
      ['BẢNG GIÁ PHỤ KIỆN', scenario?.materials.find((m) => m.id === activeFittingMatId), lockEntryOf(activeFittingMatId)],
    ] as const
  ).filter(([, m, e]) => m && e);
  const anyUnlocked = lockRows.some(([, , e]) => !e!.evaluation.isLocked);

  const chotBaselineMoi = async () => {
    if (!scenario || !user || (role !== 'admin' && role !== 'pricing')) return;
    // ADR-004: chốt lại baseline = replacement hiện hành cho material đang MỞ KHÓA.
    const changed: Array<{ materialId: string; materialName: string; oldBaseline: number; newBaseline: number }> = [];
    const materials = scenario.materials.map((m) => {
      const entry = internal?.priceLock.byMaterial.find((e) => e.materialId === m.id);
      if (!entry || entry.evaluation.isLocked) return m;
      changed.push({ materialId: m.id, materialName: m.name, oldBaseline: m.inventory.priceLock.baseline, newBaseline: m.inventory.replacementPriceUsdPerKg });
      return { ...m, inventory: { ...m.inventory, priceLock: { ...m.inventory.priceLock, baseline: m.inventory.replacementPriceUsdPerKg } } };
    });
    await updateDoc(doc(db, `scenarios/${scenarioId}`), { materials });
    // M12.10 (security-review) — audit log SAU KHI ghi thành công, 1 entry/material đổi.
    await Promise.all(
      changed.map((c) =>
        writePriceLockAuditEntry(scenarioId, {
          materialId: c.materialId,
          materialName: c.materialName,
          oldBaselineUsdPerKg: c.oldBaseline,
          newBaselineUsdPerKg: c.newBaseline,
          changedByUid: user.uid,
          changedByEmail: user.email,
          changedByRole: role,
        }),
      ),
    );
  };

  const tierAt = pipeLadder;
  const tdFloor = tierAt?.variableCostFloor ?? 0;
  const tdFullCost = tierAt?.breakEvenFullCost ?? 0;
  const tdTarget = tierAt?.targetPrice ?? 0;
  const tdMarginPct = topDownPrice > 0 && tdFullCost > 0 ? ((topDownPrice - tdFullCost) / topDownPrice) * 100 : null;
  const tdBepQty = pipeCvp && topDownPrice > tdFloor ? pipeCvp.fixedCostPerYear / (topDownPrice - tdFloor) : null;
  const tdBepPct = tdBepQty && internal ? (tdBepQty / internal.capacity.pipe.normalCapacityKgYear) * 100 : null;
  const tdAboveFloor = topDownPrice > tdFloor;
  const tdAboveFullCost = topDownPrice > tdFullCost;
  // Màu DỮ LIỆU cho trạng thái giá top-down (dưới sàn = nguy, dưới giá thành =
  // cảnh báo, lãi tốt = success, lãi thấp = cảnh báo).
  const tdCls = !topDownPrice ? 'text-faint' : !tdAboveFloor ? 'text-destructive' : !tdAboveFullCost ? 'text-warning' : tdMarginPct! > 15 ? 'text-success' : 'text-warning';
  const tdStatus = !topDownPrice ? '—' : !tdAboveFloor ? 'DƯỚI SÀN BIẾN PHÍ — lỗ tiền mặt' : !tdAboveFullCost ? 'Dưới giá thành — lỗ gộp' : tdMarginPct! > 15 ? 'Có lãi tốt' : 'Lãi thấp — cần xem lại';
  const tdBannerCls = tdAboveFullCost ? 'border-success/30 bg-success-tint' : tdAboveFloor ? 'border-warning/30 bg-warning-tint' : 'border-destructive/30 bg-destructive-tint';

  return (
    <div className="mx-auto max-w-[1200px] px-9 py-8">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="mb-[5px] text-eyebrow uppercase tracking-[.14em] text-muted-foreground">Tổng Quan Quản Trị</div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bảng điều khiển (Dashboard)</h1>
          <div className="mt-1.5 flex gap-3 text-[11px] text-muted-foreground">
            <span>Tỷ giá: <b className="text-foreground">{fmtVnd(usdRate!)}</b></span>
            <span>•</span>
            <span>Nguyên liệu Ống: <b className="text-foreground">{pipeRefMaterial?.name || '—'}</b> ({fmtUsd(pipeRefMaterial?.inventory.replacementPriceUsdPerKg || 0)}/kg)</span>
            <span>•</span>
            <span>Nguyên liệu PK: <b className="text-foreground">{fittingRefMaterial?.name || '—'}</b> ({fmtUsd(fittingRefMaterial?.inventory.replacementPriceUsdPerKg || 0)}/kg)</span>
          </div>
        </div>
        <div className="flex gap-3">
          <MaterialPicker label="Dòng Ống" materials={pipeMaterials} selectedId={activePipeMatId ?? ''} onSelect={setPipeMaterialId} />
          <MaterialPicker label="Dòng Phụ kiện" materials={fittingMaterials} selectedId={activeFittingMatId ?? ''} onSelect={setFittingMaterialId} />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mb-6 flex gap-6 border-b">
        {[
          { id: 'overview', label: 'TỔNG QUAN' },
          { id: 'manufacturing', label: 'SẢN XUẤT' },
          { id: 'investor', label: 'ĐẦU TƯ & TÀI CHÍNH' },
          { id: 'pricing', label: 'CHIẾN LƯỢC GIÁ' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              '-mb-px cursor-pointer border-b-2 pb-3 text-[11px] font-bold uppercase tracking-[.06em] transition-colors',
              activeTab === t.id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && kpis && internal && scenario && (
        (() => {
          const shifts = scenario.resources.pipe.driverType === 'continuous_kg' ? scenario.resources.pipe.normalShifts : 3;
          return (
            <div>
              <div className="mb-6 grid grid-cols-6 gap-4">
                <Card>
                  <CardLabel tooltip={`Doanh thu dự kiến tại công suất thiết kế (${shifts} ca) với giá bán mục tiêu (VF)`}>Doanh thu dự kiến</CardLabel>
                  <CardValue>{fmtTyVnd(kpis.investment.expectedRevenueVf)}</CardValue>
                  <CardNote>Tại năng suất {shifts} ca + giá VF</CardNote>
                </Card>
                <Card>
                  <CardLabel tooltip="Earnings Before Interest and Taxes - Lợi nhuận trước thuế và lãi vay">EBIT Mục Tiêu (CS Bình thường)</CardLabel>
                  <CardValue className={kpis.investment.ebitAtNormalCapacityVfPrice > 0 ? 'text-success' : 'text-destructive'}>{fmtTyVnd(kpis.investment.ebitAtNormalCapacityVfPrice)}</CardValue>
                  <CardNote>Tại giá VF & chạy {shifts} ca</CardNote>
                </Card>
                <Card>
                  <CardLabel tooltip="Doanh thu cần đạt MỖI NĂM để bắt đầu có lãi, bù đắp toàn bộ định phí (gồm khấu hao, phí ngoài SX, lãi vay).">Điểm hòa vốn (Doanh thu/Năm)</CardLabel>
                  <CardValue>{fmtTyVnd(kpis.investment.enterpriseBreakEvenRevenuePerYear)}</CardValue>
                  <CardNote>Bù đắp Định phí: Khấu hao, Lương, Lãi vay...</CardNote>
                </Card>
                <Card>
                  <CardLabel tooltip="Thời gian để dòng tiền (EBIT + Khấu hao) thu hồi lại Tổng vốn cố định ban đầu.">Thời gian thu hồi vốn</CardLabel>
                  <CardValue>{kpis.investment.paybackYears.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} năm</CardValue>
                  <CardNote>Từ dòng tiền = EBIT + Khấu hao</CardNote>
                </Card>
                <Card>
                  <CardLabel>Phí gia công Ống (không NVL)</CardLabel>
                  <CardValue>{fmtVnd(kpis.capacityLevels.find(l => l.shifts === shifts)?.processingCostPerKg || 0)} đ/kg</CardValue>
                  <CardNote>Tại năng suất {shifts} ca</CardNote>
                </Card>
                <Card>
                  <CardLabel>Phí gia công Phụ Kiện (BGGQ)</CardLabel>
                  <CardValue>{fmtVnd(kpis.fittingCapacity.processingCostPerKg || 0)} đ/kg</CardValue>
                  <CardNote>Bình quân theo trọng lượng</CardNote>
                </Card>
              </div>
            </div>
          );
        })()
      )}

      {/* Lock bar — ADR-004, di chuyển vào Tab Pricing (Chiến lược giá) */}
      {activeTab === 'pricing' && lockRows.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2.5">
          {lockRows.map(([label, material, entry]) => {
            const ev = entry!.evaluation;
            return (
              <div
                key={label}
                className={cn(
                  'flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border px-3.5 py-2',
                  ev.isLocked ? 'border-success/40 bg-success-tint' : 'border-destructive/40 bg-destructive-tint',
                )}
              >
                <div className={cn('h-2 w-2 shrink-0 rounded-full', ev.isLocked ? 'bg-success' : 'bg-destructive')} />
                <div>
                  <div className={cn('text-[10px] font-bold tracking-[.04em]', ev.isLocked ? 'text-success' : 'text-destructive')}>
                    {label} — {ev.isLocked ? 'KHÓA' : 'MỞ KHÓA'}
                  </div>
                  <div className="mt-px text-[9px] text-muted-foreground">
                    Baseline {fmtUsd(material!.inventory.priceLock.baseline)} · Replacement {fmtUsd(ev.replacement)} · Lệch{' '}
                    {Number.isFinite(ev.deviationPct) ? fmtPct(ev.deviationPct) : '∞'}
                    {ev.stalenessWarning ? ` · ⚠ ${ev.stalenessWarning}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
          {anyUnlocked && (
            <Button size="sm" onClick={() => void chotBaselineMoi()} className="uppercase tracking-[.06em]">
              Chốt Baseline Mới
            </Button>
          )}
        </div>
      )}

      {/* I. Thang giá - Chuyển vào Tab Pricing */}
      {activeTab === 'pricing' && pipeLadder && fittingLadder && (
        <LadderSection
          pipeLadder={pipeLadder}
          fittingLadder={fittingLadder}
        />
      )}

      {kpis && internal && pipeLadder && pipeCvp && (
        <>
          {/* II. Sản xuất — 3 mức công suất Ống */}
          {activeTab === 'manufacturing' && (
            <div className="mb-[22px]">
              <SectionHeader index="II" title="HIỆU QUẢ THEO CÔNG SUẤT — DÒNG ỐNG (ĐÙN LIÊN TỤC)" />
              <div className="grid grid-cols-3 gap-3">
              {kpis.capacityLevels.map((level, i) => {
                 const marginVf = tdTarget > 0 ? ((tdTarget - level.costPerKg) / tdTarget) * 100 : 0;
                return (
                  <UICard key={level.shifts} onClick={() => setSelectedShift(i)} className={cn('cursor-pointer border-2 p-[15px]', i === selectedShift ? 'border-foreground' : 'border-border')}>
                    <div className="mb-[7px] text-eyebrow font-semibold uppercase tracking-[.1em] text-muted-foreground">Mô phỏng Ống: {level.shifts} ca</div>
                    <div className="text-[19px] font-bold tabular-nums tracking-tight text-foreground">{fmtVnd(level.productionKgYear)}</div>
                    <div className="mb-2 mt-px text-[10px] text-muted-foreground">kg ống/năm (~ {fmtVnd(level.productionKgYear / 1000)} tấn) · {Math.round((level.shifts / 3) * 100)}% CS thiết kế</div>
                    <div className="mb-3 h-1 overflow-hidden rounded-[2px] bg-muted">
                      <div className="h-full bg-foreground" style={{ width: `${Math.round((level.shifts / 3) * 100)}%` }} />
                    </div>
                    <div className="mb-2.5 h-px bg-muted" />
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="mb-0.5 text-[9px] text-muted-foreground">Giá thành/kg</div>
                        <div className="text-[13px] font-bold tabular-nums text-foreground">{fmtVnd(level.costPerKg)} đ</div>
                      </div>
                      <div className="text-right">
                        <div className="mb-0.5 text-[9px] text-muted-foreground">Phí gia công/kg</div>
                        <div className="text-[13px] font-bold tabular-nums text-foreground">{fmtVnd(level.processingCostPerKg)} đ</div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-baseline justify-end">
                      <div className="text-right">
                        <div className="mb-0.5 text-[9px] text-muted-foreground">Margin VF</div>
                        <div className="text-[13px] font-bold text-foreground">{marginVf.toFixed(2)}%</div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-baseline justify-between border-t border-muted pt-2.5">
                      <div>
                        <div className="mb-0.5 text-[9px] text-muted-foreground">Lợi nhuận trước thuế (EBIT)</div>
                        <div className={cn('text-[13px] font-bold tabular-nums', level.productionKgYear * (pipeLadder.targetPrice - level.costPerKg) > 0 ? 'text-success' : 'text-destructive')}>
                          {fmtTyVnd(level.productionKgYear * (pipeLadder.targetPrice - level.costPerKg))} Tỷ đ
                        </div>
                      </div>
                    </div>
                  </UICard>
                );
              })}
            </div>
            <div className="mt-6">
              <SectionHeader index="" title="HIỆU QUẢ SẢN XUẤT — DÒNG PHỤ KIỆN (ÉP PHUN)" />
              <div className="grid grid-cols-3 gap-3">
                <UICard className="border-2 border-border p-[15px]">
                  <div className="mb-[7px] text-eyebrow font-semibold uppercase tracking-[.1em] text-muted-foreground">Công suất bình thường</div>
                  <div className="text-[19px] font-bold tabular-nums tracking-tight text-foreground">{fmtVnd(kpis.fittingCapacity.productionKgYear)}</div>
                  <div className="mb-2.5 mt-px text-[10px] text-muted-foreground">kg phụ kiện/năm (~ {fmtVnd(kpis.fittingCapacity.productionKgYear / 1000)} tấn)</div>
                  <div className="mb-2.5 h-px bg-muted" />
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="mb-0.5 text-[9px] text-muted-foreground">Giá thành/kg</div>
                      <div className="text-[13px] font-bold tabular-nums text-foreground">{fmtVnd(kpis.fittingCapacity.costPerKg)} đ</div>
                    </div>
                    <div className="text-right">
                      <div className="mb-0.5 text-[9px] text-muted-foreground">Phí gia công/kg</div>
                      <div className="text-[13px] font-bold tabular-nums text-foreground">{fmtVnd(kpis.fittingCapacity.processingCostPerKg)} đ</div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-end">
                    <div className="text-right">
                      <div className="mb-0.5 text-[9px] text-muted-foreground">Margin VF</div>
                      <div className="text-[13px] font-bold text-foreground">
                        {fittingLadder ? ((fittingLadder.targetPrice - kpis.fittingCapacity.costPerKg) / fittingLadder.targetPrice * 100).toFixed(2) : 0}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between border-t border-muted pt-2.5">
                    <div>
                      <div className="mb-0.5 text-[9px] text-muted-foreground">Lợi nhuận trước thuế (EBIT)</div>
                      <div className={cn('text-[13px] font-bold tabular-nums', fittingLadder && (kpis.fittingCapacity.productionKgYear * (fittingLadder.targetPrice - kpis.fittingCapacity.costPerKg)) > 0 ? 'text-success' : 'text-destructive')}>
                        {fittingLadder ? fmtTyVnd(kpis.fittingCapacity.productionKgYear * (fittingLadder.targetPrice - kpis.fittingCapacity.costPerKg)) : 0} Tỷ đ
                      </div>
                    </div>
                  </div>
                </UICard>
              </div>
            </div>
          </div>
          )}

          {/* III. Top-down */}
          {activeTab === 'pricing' && (
            <div className="mb-[22px]">
              <SectionHeader index="III" title="PHÂN TÍCH NGƯỢC (TOP-DOWN) — CHIẾN LƯỢC MUA HÀNG" note="Nhập giá bán mục tiêu (VNĐ/kg) → hệ thống tự tìm ngược mức giá thu mua nguyên liệu tối đa (USD/kg) để đạt điểm hòa vốn." />
              <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
              <div className="grid grid-cols-[260px_1fr]">
                <div className="border-r border-muted bg-muted p-5">
                  <div className="mb-1 text-[10px] font-bold text-foreground">Giá bán mục tiêu — Ống (đ/kg)</div>
                  <div className="mb-3 text-[9px] text-muted-foreground">
                    Giá tham chiếu: sàn biến phí {fmtVnd(tdFloor)} · VF {fmtVnd(tdTarget)}
                  </div>
                  <Input
                    type="number"
                    value={topDownPrice || ''}
                    onChange={(e) => setTopDownPrice(parseFloat(e.target.value) || 0)}
                    placeholder="Nhập giá đ/kg..."
                    className="h-11 text-base font-bold text-right tabular-nums"
                  />
                  <div className="mt-1.5 text-right text-[9px] text-muted-foreground">VNĐ / kg ống</div>
                  <div className={cn('mt-3.5 rounded-lg border px-3 py-2', tdBannerCls)}>
                    <div className={cn('text-[10px] font-bold', tdCls)}>{tdStatus}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4">
                  <div className="border-r border-muted p-4">
                    <div className="mb-1.5 text-eyebrow uppercase tracking-[.08em] text-muted-foreground">Margin tại giá này</div>
                    <div className={cn('text-[22px] font-bold tabular-nums', tdCls)}>{tdMarginPct !== null ? tdMarginPct.toFixed(1) : '—'}%</div>
                    <div className="mt-1 text-[9px] text-muted-foreground">vs giá thành đầy đủ {fmtVnd(tdFullCost)} đ</div>
                  </div>
                  <div className="border-r border-muted p-4">
                    <div className="mb-1.5 text-eyebrow uppercase tracking-[.08em] text-muted-foreground">Compound tối đa</div>
                    <div className="text-[22px] font-bold tabular-nums text-foreground">{tdMaxCompound !== null ? fmtUsd(tdMaxCompound) : '—'}</div>
                    <div className="mt-1 text-[9px] text-muted-foreground">
                      USD/kg · Hiện tại: {pipeRefMaterial ? fmtUsd(pipeRefMaterial.inventory.replacementPriceUsdPerKg) : '—'} USD/kg
                    </div>
                  </div>
                  <div className="border-r border-muted p-4">
                    <div className="mb-1.5 text-eyebrow uppercase tracking-[.08em] text-muted-foreground">SL hòa vốn tại giá này</div>
                    <div className="text-[22px] font-bold tabular-nums text-foreground">{tdBepQty !== null ? fmtVnd(tdBepQty) : '—'}</div>
                    <div className="mt-1 text-[9px] text-muted-foreground">kg/năm · {tdBepPct !== null ? tdBepPct.toFixed(1) : '—'}% CS bình thường</div>
                  </div>
                  <div className="p-4">
                    <div className="mb-1.5 text-eyebrow uppercase tracking-[.08em] text-muted-foreground">So thang giá (ống)</div>
                    <div className="mt-1 flex flex-col gap-1">
                      {(
                        [
                          ['Sàn BP', tdFloor, 'text-destructive'],
                          ['GT đầy đủ', tdFullCost, 'text-warning'],
                          ['Giá VF', tdTarget, 'text-success'],
                        ] as const
                      ).map(([lbl, v, c]) => (
                        <div key={lbl} className="flex justify-between text-[10px]">
                          <span className={c}>{lbl}</span>
                          <span className="tabular-nums text-muted-foreground">{fmtVnd(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}

          {/* IV. Hòa vốn & Đầu tư */}
          {activeTab === 'investor' && (
            <div>
              <SectionHeader index="IV" title="ĐẦU TƯ TÀI SẢN DÙNG CHUNG & ĐIỂM HÒA VỐN (CVP)" />
              <div className="mb-4 rounded-lg border-l-[3px] border-warning bg-muted px-3.5 py-2.5 text-[11px] text-muted-foreground">
                <b className="text-foreground">Lưu ý về Tài sản dùng chung (Shared Assets):</b> Khấu hao khuôn mẫu và máy đùn ở đây là chi phí được phân bổ theo <b className="text-foreground">tổng công suất của tất cả thương hiệu/vật liệu</b> (VD: BlazeMaster, Corzan...) được chạy trên cùng dây chuyền.
              </div>
              <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardLabel tooltip="Cost-Volume-Profit: Sản lượng yêu cầu để đủ bù đắp phần định phí của riêng dòng Ống">Hòa vốn CVP — Ống</CardLabel>
                <CardValue>{fmtVnd(pipeCvp.breakEvenKgYear)} kg</CardValue>
                <CardNote>{fmtPct(pipeCvp.pctOfNormalCapacity)} công suất bình thường</CardNote>
                <div className="mt-[7px] h-1 rounded-[2px] bg-muted">
                  <div className="h-1 rounded-[2px] bg-foreground" style={{ width: `${Math.min(100, Math.round(pipeCvp.pctOfNormalCapacity * 100))}%` }} />
                </div>
              </Card>
              <Card>
                <CardLabel tooltip="Công Suất Nhàn Rỗi: Định phí không được phân bổ vào sản phẩm do máy không chạy đủ công suất bình thường">Chi phí CSNR — Ống</CardLabel>
                <CardValue className="text-destructive">{fmtTyVnd(pipeCvp.fixedCostPerYear)}</CardValue>
                <CardNote>Định phí chưa được hấp thụ kỳ KH (chưa có kế hoạch SX)</CardNote>
                <div className="mt-[7px] inline-flex items-center gap-1 rounded-[2px] bg-destructive-tint px-2 py-[3px]">
                  <span className="text-[10px] font-semibold text-destructive">⚠ Cảnh báo tải thấp</span>
                </div>
              </Card>
              <Card>
                <CardLabel tooltip="Cost-Volume-Profit: Sản lượng yêu cầu để đủ bù đắp phần định phí của riêng dòng Phụ kiện">Hòa vốn CVP — Phụ kiện</CardLabel>
                <CardValue>{fittingCvp ? fmtVnd(fittingCvp.breakEvenKgYear) : '—'} kg</CardValue>
                <CardNote>{fittingCvp ? fmtPct(fittingCvp.pctOfUtilizedHours) : '—'} giờ máy huy động</CardNote>
                {fittingCvp && (
                <div className="mt-[7px] h-1 rounded-[2px] bg-muted">
                  <div className="h-1 rounded-[2px] bg-foreground" style={{ width: `${Math.min(100, Math.round(fittingCvp.pctOfUtilizedHours * 100))}%` }} />
                </div>
                )}
              </Card>
              <Card>
                <CardLabel tooltip="Công Suất Nhàn Rỗi: Định phí không được phân bổ vào sản phẩm do máy không chạy đủ công suất bình thường">Chi phí CSNR — Phụ kiện</CardLabel>
                <CardValue className="text-destructive">{fittingCvp ? fmtTyVnd(fittingCvp.fixedCostPerYear) : '—'}</CardValue>
                <CardNote>Định phí chưa được hấp thụ (giờ máy rảnh rỗi)</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="Doanh thu cần đạt để bù đắp định phí khối SX, ngoài SX và chi phí tài chính (tính theo tỷ suất LN dự kiến)">Doanh thu hòa vốn toàn DN</CardLabel>
                <CardValue>{fmtTyVnd(kpis.investment.enterpriseBreakEvenRevenuePerYear)}</CardValue>
                <CardNote>Gồm SX + vận hành + lãi vay</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="Tổng cộng CAPEX máy móc, khuôn, nhà xưởng, điện nước và vốn lưu động">Tổng vốn cố định</CardLabel>
                <CardValue>{fmtTyVnd(kpis.investment.totalFixedCapitalInvested)}</CardValue>
                <CardNote>Thiết bị + {scenario ? (scenario.resources.fitting as { moldAssets: unknown[] }).moldAssets.length : '—'} bộ khuôn + hạ tầng</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="Lợi nhuận trước thuế và lãi vay tính tại kịch bản bán giá VF và chạy đúng công suất bình thường">EBIT tại CS bình thường + VF</CardLabel>
                <CardValue className="text-success">{fmtTyVnd(kpis.investment.ebitAtNormalCapacityVfPrice)}</CardValue>
                <CardNote>3 ca + giá mục tiêu VF</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="= Tổng vốn đầu tư / (EBIT + Khấu hao)">Thời gian thu hồi vốn</CardLabel>
                <CardValue>{kpis.investment.paybackYears.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} năm</CardValue>
                <CardNote>EBIT + khấu hao · ~{Math.round(kpis.investment.paybackYears * 12)} tháng</CardNote>
              </Card>
              </div>
              <div className="mt-8">
                <SectionHeader index="" title="BIỂU ĐỒ HÒA VỐN CVP — ỐNG (ĐƠN VỊ: TỶ VNĐ)" />
                <div className="h-[400px] rounded-lg border bg-card p-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={pipeCvpChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e6e6" />
                      <XAxis dataKey="kg" tickFormatter={(v) => fmtVnd(v)} tick={{ fontSize: 11, fill: '#525252' }} />
                      <YAxis tickFormatter={(v) => v.toFixed(1)} tick={{ fontSize: 11, fill: '#525252' }} />
                      <Tooltip formatter={(value: any) => Number(value).toFixed(2) + ' Tỷ đ'} labelFormatter={(lbl) => 'Sản lượng: ' + fmtVnd(Number(lbl)) + ' kg'} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Area type="monotone" dataKey="dinhPhi" fill="#fee2e2" stroke="none" name="Định phí" />
                      <Line type="monotone" dataKey="chiPhi" stroke="#dc2626" strokeWidth={3} name="Tổng chi phí" dot={false} />
                      <Line type="monotone" dataKey="doanhThu" stroke="#16a34a" strokeWidth={3} name="Tổng doanh thu" dot={false} />
                      <Line type="monotone" dataKey="loiNhuan" stroke="#eab308" strokeWidth={2} strokeDasharray="5 5" name="Lợi nhuận (EBIT)" dot={false} />
                      {pipeCvp && (
                        <ReferenceLine x={pipeCvp.breakEvenKgYear} stroke="#d97706" strokeDasharray="3 3" label={{ position: 'top', value: 'Hòa vốn', fill: '#d97706', fontSize: 11 }} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
