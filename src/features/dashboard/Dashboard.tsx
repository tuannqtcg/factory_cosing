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
// ADR-033 roll-out: trình bày qua design tokens (đen–trắng tối giản). Thang giá
// 5 bậc + biểu đồ CVP giữ dải màu hợp lệ (dữ liệu thật), ánh xạ về token
// success/warning/danger ở 2 đầu; nhãn Ống/Phụ kiện phân biệt bằng chữ, không hue.
import { useMemo, useState } from 'react';
import { type AppRole } from '../../lib/firebase.js';
import { fmtVnd, fmtUsd, fmtPct, fmtTyVnd } from '../../lib/format.js';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import { referenceMaterialOf } from '../../engine/scenario.js';
import { calculateDashboardKpis } from '../../engine/dashboard-support.js';
import CostWaterfall from '../shared/CostWaterfall.js';
import { CIT_RATE } from '../../engine/ceo-planner.js';
import { solve } from '../../engine/solver.js';
import { calculateScenario } from '../../engine/scenario.js';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, ReferenceLine } from 'recharts';
import { Screen, tk, ft, rd, tnum } from '../../design/primitives.js';
import { eyebrowStyle } from '../../design/tokens.js';

const TIER_DEFS = [
  { key: 'variableCostFloor', bac: 1, label: 'Sàn biến phí', role: 'Không ai được bán thủng — lỗ tiền tươi ngay lập tức', color: tk.danger },
  { key: 'cashBreakEven', bac: 2, label: 'Hòa vốn tiền mặt', role: 'Quản trị — phòng thủ khi thị trường xấu, dòng tiền còn dương', color: tk.warning },
  { key: 'breakEvenFullCost', bac: 3, label: 'Giá thành đầy đủ', role: 'Sản xuất + kế toán (TT200) — GĐ duyệt mới được bán tới đây', color: tk.warningInk },
  { key: 'enterpriseBreakEven', bac: 4, label: 'Hòa vốn toàn DN', role: 'Quản trị + đầu tư — giá bán thường ngày PHẢI trên mức này', color: tk.inkMuted },
  { key: 'targetPrice', bac: 5, label: 'Giá mục tiêu (VF)', role: 'Bán hàng — giá chào chuẩn; khoảng lùi 5→4→3 theo thẩm quyền', color: tk.success },
] as const;

type Ladder = ScenarioOutput['priceLadder']['byLineMaterial'][number]['ladder'];

function SectionHeader({ index, title, color = tk.ink, note }: { index: string; title: string; color?: string; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
      <div style={{ width: 3, height: 14, background: color, borderRadius: 1, flexShrink: 0 }} />
      <div style={{ fontSize: ft.size.eyebrow, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: ft.weight.bold, color }}>
        {index}. {title}
      </div>
      {note && <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginLeft: 4 }}>{note}</div>}
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
    <div
      style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 8 }}
      title={`${label} đang chạy ≥2 nguyên liệu (VD: BlazeMaster + Corzan). Bấm để đổi TOÀN BỘ số liệu trang này (thang giá, hoà vốn, EBIT...) sang tính theo đúng nguyên liệu đó — không phải chọn "xem thêm", mà là "xem RIÊNG nguyên liệu này".`}
    >
      <span style={{ ...eyebrowStyle }}>Xem số liệu {label.replace(/^Dòng /, 'dòng ')} theo nguyên liệu:</span>
      {materials.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          title={`Xem toàn bộ số liệu trang này theo ${m.name}`}
          style={{
            padding: '3px 10px',
            cursor: 'pointer',
            border: `1px solid ${m.id === selectedId ? tk.brand : tk.borderStrong}`,
            background: m.id === selectedId ? tk.brand : tk.surface,
            color: m.id === selectedId ? tk.inkInverse : tk.inkMuted,
            borderRadius: rd.sm,
            fontSize: ft.size.eyebrow,
            fontWeight: ft.weight.semibold,
          }}
        >
          {m.name}
        </button>
      ))}
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
    <div style={{ marginBottom: 22 }}>
      <SectionHeader index="I" title="THANG GIÁ 5 BẬC — VNĐ/KG" />
      <div style={{ background: tk.surface, border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 160px 160px', padding: '9px 18px', background: tk.surfaceMuted, borderBottom: `1px solid ${tk.border}`, gap: 12, minWidth: 560 }}>
          <div />
          <div style={{ ...eyebrowStyle }}>Bậc giá / Thẩm quyền</div>
          <div style={{ ...eyebrowStyle, textAlign: 'right' }}>Ống CPVC</div>
          <div style={{ ...eyebrowStyle, textAlign: 'right' }}>Phụ Kiện</div>
        </div>
        {TIER_DEFS.map((tg) => (
          <div key={tg.bac} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 160px 160px', padding: '12px 18px', borderBottom: `1px solid ${tk.surfaceMuted}`, alignItems: 'start', gap: 12, minWidth: 560 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: tg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <span style={{ color: tk.inkInverse, fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold }}>{tg.bac}</span>
            </div>
            <div>
              <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.semibold, marginBottom: 2, color: tk.ink }}>{tg.label}</div>
              <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginBottom: 7 }}>{tg.role}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                {(
                  [
                    ['ỐNG', pipeLadder[tg.key], rp],
                    ['PHỤ KIỆN', fittingLadder[tg.key], rf],
                  ] as const
                ).map(([lbl, v, r]) => (
                  <div key={lbl} style={{ flex: 1 }}>
                    <div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint, marginBottom: 3 }}>{lbl}</div>
                    <div style={{ height: 3, background: tk.surfaceMuted, borderRadius: rd.sm }}>
                      <div style={{ height: 3, borderRadius: rd.sm, background: tg.color, width: bar(v, r) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {[pipeLadder[tg.key], fittingLadder[tg.key]].map((v, i) => (
              <div key={i} style={{ textAlign: 'right', paddingTop: 1 }}>
                <div style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{fmtVnd(v)}</div>
                <div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint, marginTop: 1 }}>đ/kg</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: tk.surface, border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, padding: 15 }}>{children}</div>;
}
function CardLabel({ children, tooltip }: { children: React.ReactNode, tooltip?: string }) {
  return (
    <div style={{ ...eyebrowStyle, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 4 }}>
      {children}
      {tooltip && (
        <span title={tooltip} style={{ cursor: 'help', background: tk.surfaceMuted, color: tk.inkMuted, borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold }}>?</span>
      )}
    </div>
  );
}
function CardValue({ children, color }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: ft.size.xl, fontWeight: ft.weight.bold, ...tnum, color: color ?? tk.ink }}>{children}</div>;
}
function CardNote({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 2 }}>{children}</div>;
}

export default function Dashboard({
  role,
  user,
  scenarioId,
  scenario,
  internal,
  salesPriceLadder,
  onNavigate,
}: {
  role: AppRole;
  /** M12.10 (security-review) — ai chốt baseline, ghi vào priceLockAudit. */
  user: { uid: string; email: string | null } | null;
  scenarioId: string;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
  /** priceLadder từ outputs/priceList — nguồn duy nhất của vai sales (M12.6: PriceListDoc.priceLadder). */
  salesPriceLadder: ScenarioOutput['priceLadder'] | null;
  /** ADR-041 — điều hướng sang màn CHỈNH THẬT (Tham Số) khi cần chốt baseline. */
  onNavigate?: (tab: string) => void;
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
    return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải kịch bản + kết quả tính…</div></Screen>;
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

  // ADR-041 — Tổng Quan là màn CHỈ XEM: KHÔNG còn ghi thật ở đây. Thao tác "chốt
  // baseline" (ghi materials) đã dời hẳn về Tham Số (một nhà duy nhất cho việc
  // chỉnh dữ liệu gốc) — tránh một màn "xem" lại lén sửa dữ liệu, đúng ranh giới
  // đọc/ghi. Ở đây chỉ còn LINK điều hướng sang Tham Số khi có nguyên liệu mở khóa.

  const tierAt = pipeLadder;
  const tdFloor = tierAt?.variableCostFloor ?? 0;
  const tdFullCost = tierAt?.breakEvenFullCost ?? 0;
  const tdTarget = tierAt?.targetPrice ?? 0;
  const tdMarginPct = topDownPrice > 0 && tdFullCost > 0 ? ((topDownPrice - tdFullCost) / topDownPrice) * 100 : null;
  const tdBepQty = pipeCvp && topDownPrice > tdFloor ? pipeCvp.fixedCostPerYear / (topDownPrice - tdFloor) : null;
  const tdBepPct = tdBepQty && internal ? (tdBepQty / internal.capacity.pipe.normalCapacityKgYear) * 100 : null;
  const tdAboveFloor = topDownPrice > tdFloor;
  const tdAboveFullCost = topDownPrice > tdFullCost;
  const tdColor = !topDownPrice ? tk.inkFaint : !tdAboveFloor ? tk.dangerInk : !tdAboveFullCost ? tk.warning : tdMarginPct! > 15 ? tk.successInk : tk.warningInk;
  const tdStatus = !topDownPrice ? '—' : !tdAboveFloor ? 'DƯỚI SÀN BIẾN PHÍ — lỗ tiền mặt' : !tdAboveFullCost ? 'Dưới giá thành — lỗ gộp' : tdMarginPct! > 15 ? 'Có lãi tốt' : 'Lãi thấp — cần xem lại';
  const tdBannerBg = tdAboveFullCost ? tk.successTint : tdAboveFloor ? tk.warningTint : tk.dangerTint;

  return (
    <Screen maxWidth={1200}>
      <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ ...eyebrowStyle, marginBottom: 5 }}>Tổng Quan Quản Trị</div>
          <h1 style={{ margin: 0, fontSize: ft.size.xxl, fontWeight: ft.weight.bold, letterSpacing: '-.5px', color: tk.ink }}>Bảng điều khiển (Dashboard)</h1>
          <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <span>Tỷ giá: <b>{fmtVnd(usdRate!)}</b></span>
            <span>•</span>
            <span>Nguyên liệu Ống: <b>{pipeRefMaterial?.name || '—'}</b> ({fmtUsd(pipeRefMaterial?.inventory.replacementPriceUsdPerKg || 0)}/kg)</span>
            <span>•</span>
            <span>Nguyên liệu PK: <b>{fittingRefMaterial?.name || '—'}</b> ({fmtUsd(fittingRefMaterial?.inventory.replacementPriceUsdPerKg || 0)}/kg)</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <MaterialPicker label="Dòng Ống" materials={pipeMaterials} selectedId={activePipeMatId ?? ''} onSelect={setPipeMaterialId} />
          <MaterialPicker label="Dòng Phụ kiện" materials={fittingMaterials} selectedId={activeFittingMatId ?? ''} onSelect={setFittingMaterialId} />
        </div>
      </div>

      {/* Tabs Navigation — cuộn ngang trên mobile thay vì bể dòng (4 tab chữ dài) */}
      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${tk.border}`, marginBottom: 24, overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'TỔNG QUAN' },
          { id: 'manufacturing', label: 'SẢN XUẤT' },
          { id: 'investor', label: 'ĐẦU TƯ & TÀI CHÍNH' },
          { id: 'pricing', label: 'CHIẾN LƯỢC GIÁ' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              background: 'none', border: 'none', padding: '0 0 12px 0',
              fontSize: ft.size.xs, fontWeight: ft.weight.bold, letterSpacing: '.06em', textTransform: 'uppercase',
              color: activeTab === t.id ? tk.ink : tk.inkMuted,
              borderBottom: `2px solid ${activeTab === t.id ? tk.brand : 'transparent'}`,
              cursor: 'pointer',
              marginBottom: -1,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && kpis && internal && scenario && (
        (() => {
          const shifts = scenario.resources.pipe.driverType === 'continuous_kg' ? scenario.resources.pipe.normalShifts : 3;
          const pipeLevel = kpis.capacityLevels.find(l => l.shifts === shifts);
          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: 16, marginBottom: 24 }}>
                <Card>
                  <CardLabel tooltip={`Doanh thu dự kiến tại công suất thiết kế (${shifts} ca) với giá bán mục tiêu (VF)`}>Doanh thu dự kiến</CardLabel>
                  <CardValue color={tk.ink}>{fmtTyVnd(kpis.investment.expectedRevenueVf)}</CardValue>
                  <CardNote>Tại năng suất {shifts} ca + giá VF</CardNote>
                </Card>
                <Card>
                  <CardLabel tooltip="Earnings Before Interest and Taxes - Lợi nhuận trước thuế và lãi vay">EBIT Mục Tiêu (CS Bình thường)</CardLabel>
                  <CardValue color={kpis.investment.ebitAtNormalCapacityVfPrice > 0 ? tk.successInk : tk.dangerInk}>{fmtTyVnd(kpis.investment.ebitAtNormalCapacityVfPrice)}</CardValue>
                  <CardNote>Tại giá VF & chạy {shifts} ca</CardNote>
                </Card>
                <Card>
                  <CardLabel tooltip="Doanh thu cần đạt MỖI NĂM để bắt đầu có lãi, bù đắp toàn bộ định phí (gồm khấu hao, phí ngoài SX, lãi vay).">Điểm hòa vốn (Doanh thu/Năm)</CardLabel>
                  <CardValue>{fmtTyVnd(kpis.investment.enterpriseBreakEvenRevenuePerYear)}</CardValue>
                  <CardNote>Bù đắp Định phí: Khấu hao, Lương, Lãi vay...</CardNote>
                </Card>
                <Card>
                  <CardLabel tooltip="Thời gian để dòng tiền (EBIT + Khấu hao) thu hồi lại Tổng vốn cố định ban đầu.">Thời gian thu hồi vốn</CardLabel>
                  <CardValue color={tk.successInk}>{kpis.investment.paybackYears.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} năm</CardValue>
                  <CardNote>Từ dòng tiền = EBIT + Khấu hao</CardNote>
                </Card>
                <Card>
                  <CardLabel>Phí gia công Ống (không NVL)</CardLabel>
                  <CardValue color={tk.warningInk}>{fmtVnd(pipeLevel?.processingCostPerKg || 0)} đ/kg</CardValue>
                  <CardNote><span style={{ color: tk.successInk }}>trực tiếp {fmtVnd(pipeLevel?.directProcessingPerKg || 0)}</span> · chung {fmtVnd(pipeLevel?.sharedOverheadPerKg || 0)} · <span style={{ color: tk.warning }}>khấu hao {fmtVnd(pipeLevel?.depreciationPerKg || 0)}</span></CardNote>
                </Card>
                <Card>
                  <CardLabel>Phí gia công Phụ Kiện (BGGQ)</CardLabel>
                  <CardValue color={tk.ink}>{fmtVnd(kpis.fittingCapacity.processingCostPerKg || 0)} đ/kg</CardValue>
                  <CardNote><span style={{ color: tk.successInk }}>trực tiếp {fmtVnd(kpis.fittingCapacity.directProcessingPerKg || 0)}</span> · chung {fmtVnd(kpis.fittingCapacity.sharedOverheadPerKg || 0)} · <span style={{ color: tk.warning }}>khấu hao {fmtVnd(kpis.fittingCapacity.depreciationPerKg || 0)}</span></CardNote>
                </Card>
              </div>

              {/* ── Kết quả kinh doanh (P&L) — dời từ Thiết Lập lên đây (ADR-052) ── */}
              {(() => {
                const nonProd = scenario.costPool.nonProductionCosts.operatingCostPerYear + scenario.costPool.nonProductionCosts.financialCostPerYear;
                const revenue = kpis.investment.expectedRevenueVf;
                const ebit = kpis.investment.ebitAtNormalCapacityVfPrice;
                const gross = ebit + nonProd;
                const tax = ebit > 0 ? ebit * CIT_RATE : 0;
                const cogs = revenue - gross, net = ebit - tax;
                // ADR-055 — doanh thu Ống/PK lấy TRỰC TIẾP từ KPI (đã gộp tỷ lệ đáy
                // chính+phụ) để khớp tuyệt đối expectedRevenueVf, không tự nhân lại.
                const pipeRev = kpis.investment.expectedRevenuePipeVf;
                const fitRev = kpis.investment.expectedRevenueFittingVf;
                const pct = (v: number) => (revenue > 0 ? `${((v / revenue) * 100).toFixed(1)}%` : '—');
                const detail = (s: string) => onNavigate?.(`data-setup:${s}`);
                const rows: Array<{ label: string; v: number; kind: 'rev' | 'sub' | 'total' | 'grand'; neg?: boolean; to?: string }> = [
                  { label: 'Doanh thu thuần (giá VF)', v: revenue, kind: 'rev', to: 'pricing' },
                  { label: '(−) Giá vốn hàng bán', v: cogs, kind: 'sub', neg: true, to: 'conv' },
                  { label: '= Lãi gộp', v: gross, kind: 'total' },
                  { label: '(−) Chi phí ngoài sản xuất', v: nonProd, kind: 'sub', neg: true, to: 'oh' },
                  { label: '= Lợi nhuận trước thuế (EBIT)', v: ebit, kind: 'total' },
                  { label: `(−) Thuế TNDN (${Math.round(CIT_RATE * 100)}%)`, v: tax, kind: 'sub', neg: true },
                  { label: '= Lợi nhuận sau thuế', v: net, kind: 'grand' },
                ];
                return (
                  <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: rd.lg, overflow: 'hidden', marginBottom: 24 }}>
                    <div style={{ padding: '13px 18px', borderBottom: `1px solid ${tk.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div><div style={{ ...eyebrowStyle, color: tk.successInk }}>Kết quả kinh doanh (P&L)</div><div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, color: tk.ink }}>Lãi/lỗ cả năm — theo dữ liệu đã thiết lập</div></div>
                      {onNavigate && (
                        <button onClick={() => onNavigate('data-setup')} style={{ padding: '7px 14px', background: tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.md, fontSize: ft.size.xs, fontWeight: ft.weight.bold, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>⚙ Thiết lập dữ liệu →</button>
                      )}
                    </div>
                    {/* Breakdown doanh thu theo loại */}
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '12px 18px', borderBottom: `1px solid ${tk.surfaceMuted}`, background: tk.surfaceMuted }}>
                      <div><div style={{ ...eyebrowStyle }}>Doanh thu Ống</div><div style={{ fontFamily: ft.mono, fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink }}>{fmtVnd(pipeRev)} đ</div></div>
                      <div><div style={{ ...eyebrowStyle }}>Doanh thu Phụ kiện</div><div style={{ fontFamily: ft.mono, fontSize: ft.size.md, fontWeight: ft.weight.bold, color: tk.ink }}>{fmtVnd(fitRev)} đ</div></div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: ft.size.md, minWidth: 560 }}>
                        <tbody>
                          {rows.map((r) => {
                            const isT = r.kind === 'total', isG = r.kind === 'grand', isR = r.kind === 'rev';
                            return (
                              <tr key={r.label} style={{ background: isT || isG ? tk.surfaceMuted : 'transparent', borderTop: isG ? `2px solid ${tk.ink}` : isT ? `1px solid ${tk.borderStrong}` : `1px solid ${tk.surfaceMuted}` }}>
                                <td style={{ padding: isG ? '12px 18px' : '9px 18px', fontWeight: isR || isT || isG ? ft.weight.bold : ft.weight.regular, color: r.kind === 'sub' ? tk.inkMuted : tk.ink, paddingLeft: r.kind === 'sub' ? 34 : 18, fontSize: isG ? ft.size.md : ft.size.md }}>{r.label}</td>
                                <td style={{ padding: isG ? '12px 12px' : '9px 12px', textAlign: 'right', fontFamily: ft.mono, fontWeight: isR || isT || isG ? ft.weight.bold : ft.weight.medium, ...tnum, color: isG ? (net >= 0 ? tk.successInk : tk.dangerInk) : tk.ink, fontSize: isG ? ft.size.lg : ft.size.md }}>{r.neg ? `(${fmtVnd(r.v)})` : fmtVnd(r.v)}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', color: tk.inkFaint, fontSize: ft.size.sm, width: 60, ...tnum }}>{r.kind === 'sub' ? '' : pct(r.v)}</td>
                                <td style={{ padding: '9px 18px 9px 6px', textAlign: 'right', width: 96 }}>
                                  {r.to && onNavigate && <button onClick={() => detail(r.to!)} style={{ fontSize: ft.size.sm, color: tk.ink, background: 'none', border: 'none', cursor: 'pointer', fontWeight: ft.weight.bold, whiteSpace: 'nowrap' }}>xem chi tiết →</button>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize: ft.size.xs, color: tk.inkFaint, padding: '10px 18px', lineHeight: 1.5 }}>
                      Số từ engine theo dữ liệu đã lưu (giá bán markup chuẩn). Bấm <b>“xem chi tiết →”</b> để nhảy đúng mục trong Thiết Lập Dữ Liệu mà xem/sửa. Chi phí ngoài SX chỉ ở P&L, không vào giá thành/kg.
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()
      )}

      {/* Lock bar — ADR-004, di chuyển vào Tab Pricing (Chiến lược giá) */}
      {activeTab === 'pricing' && lockRows.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {lockRows.map(([label, material, entry]) => {
            const ev = entry!.evaluation;
            const color = ev.isLocked ? tk.successInk : tk.dangerInk;
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: rd.sm, border: `1px solid ${color}`, background: ev.isLocked ? tk.successTint : tk.dangerTint, flex: 1, minWidth: 220 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, color, letterSpacing: '.04em' }}>
                    {label} — {ev.isLocked ? 'KHÓA' : 'MỞ KHÓA'}
                  </div>
                  <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginTop: 1 }}>
                    Baseline {fmtUsd(material!.inventory.priceLock.baseline)} · Replacement {fmtUsd(ev.replacement)} · Lệch{' '}
                    {Number.isFinite(ev.deviationPct) ? fmtPct(ev.deviationPct) : '∞'}
                    {ev.stalenessWarning ? ` · ⚠ ${ev.stalenessWarning}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
          {anyUnlocked && onNavigate && (
            <button
              onClick={() => onNavigate('data-setup')}
              title="Việc chốt baseline là chỉnh dữ liệu gốc — làm ở Thiết Lập Dữ Liệu (mục ④ Nguyên liệu) để mọi màn tính lại nhất quán."
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: tk.surface, color: tk.ink, border: `1px solid ${tk.ink}`, borderRadius: rd.sm, cursor: 'pointer', fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
            >
              Chỉnh ở Thiết Lập Dữ Liệu →
            </button>
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
            <div style={{ marginBottom: 22 }}>
              <SectionHeader index="II" title="HIỆU QUẢ THEO CÔNG SUẤT — DÒNG ỐNG (ĐÙN LIÊN TỤC)" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 12 }}>
              {kpis.capacityLevels.map((level, i) => {
                 const marginVf = tdTarget > 0 ? ((tdTarget - level.costPerKg) / tdTarget) * 100 : 0;
                return (
                  <div key={level.shifts} onClick={() => setSelectedShift(i)} style={{ background: tk.surface, border: `2px solid ${i === selectedShift ? tk.brand : tk.border}`, borderRadius: rd.sm, padding: 15, cursor: 'pointer' }}>
                    <div style={{ ...eyebrowStyle, marginBottom: 7 }}>Mô phỏng Ống: {level.shifts} ca</div>
                    <div style={{ fontSize: ft.size.xl, fontWeight: ft.weight.bold, ...tnum, letterSpacing: '-.3px', color: tk.ink }}>{fmtVnd(level.productionKgYear)}</div>
                    <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 1, marginBottom: 8 }}>kg ống/năm (~ {fmtVnd(level.productionKgYear / 1000)} tấn) · {Math.round((level.shifts / 3) * 100)}% CS thiết kế</div>
                    <div style={{ height: 4, background: tk.surfaceMuted, borderRadius: rd.sm, marginBottom: 12, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((level.shifts / 3) * 100)}%`, height: '100%', background: tk.brand }} />
                    </div>
                    <div style={{ height: 1, background: tk.surfaceMuted, marginBottom: 10 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div>
                        <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginBottom: 2 }}>Giá thành/kg</div>
                        <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{fmtVnd(level.costPerKg)} đ</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginBottom: 2 }}>Phí gia công/kg</div>
                        <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, ...tnum, color: tk.warningInk }}>{fmtVnd(level.processingCostPerKg)} đ</div>
                        <div style={{ fontSize: ft.size.eyebrow, color: tk.successInk, marginTop: 3, ...tnum }}>· trực tiếp {fmtVnd(level.directProcessingPerKg)}</div>
                        <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, ...tnum }}>· chung {fmtVnd(level.sharedOverheadPerKg)}</div>
                        <div style={{ fontSize: ft.size.eyebrow, color: tk.warning, ...tnum }}>· khấu hao {fmtVnd(level.depreciationPerKg)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', marginTop: 10 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginBottom: 2 }}>Margin VF</div>
                        <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, color: tk.successInk }}>{marginVf.toFixed(2)}%</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${tk.surfaceMuted}` }}>
                      <div>
                        <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginBottom: 2 }}>Lợi nhuận trước thuế (EBIT)</div>
                        <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, ...tnum, color: level.productionKgYear * (pipeLadder.targetPrice - level.costPerKg) > 0 ? tk.successInk : tk.dangerInk }}>
                          {fmtTyVnd(level.productionKgYear * (pipeLadder.targetPrice - level.costPerKg))} Tỷ đ
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 24 }}>
              <SectionHeader index="" title="HIỆU QUẢ SẢN XUẤT — DÒNG PHỤ KIỆN (ÉP PHUN)" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 12 }}>
                <div style={{ background: tk.surface, border: `2px solid ${tk.border}`, borderRadius: rd.sm, padding: 15 }}>
                  <div style={{ ...eyebrowStyle, marginBottom: 7 }}>Công suất bình thường</div>
                  <div style={{ fontSize: ft.size.xl, fontWeight: ft.weight.bold, ...tnum, letterSpacing: '-.3px', color: tk.ink }}>{fmtVnd(kpis.fittingCapacity.productionKgYear)}</div>
                  <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginTop: 1, marginBottom: 10 }}>kg phụ kiện/năm (~ {fmtVnd(kpis.fittingCapacity.productionKgYear / 1000)} tấn)</div>
                  <div style={{ height: 1, background: tk.surfaceMuted, marginBottom: 10 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginBottom: 2 }}>Giá thành/kg</div>
                      <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{fmtVnd(kpis.fittingCapacity.costPerKg)} đ</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginBottom: 2 }}>Phí gia công/kg</div>
                      <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, ...tnum, color: tk.warningInk }}>{fmtVnd(kpis.fittingCapacity.processingCostPerKg)} đ</div>
                      <div style={{ fontSize: ft.size.eyebrow, color: tk.successInk, marginTop: 3, ...tnum }}>· trực tiếp {fmtVnd(kpis.fittingCapacity.directProcessingPerKg)}</div>
                      <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, ...tnum }}>· chung {fmtVnd(kpis.fittingCapacity.sharedOverheadPerKg)}</div>
                      <div style={{ fontSize: ft.size.eyebrow, color: tk.warning, ...tnum }}>· khấu hao {fmtVnd(kpis.fittingCapacity.depreciationPerKg)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', marginTop: 10 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginBottom: 2 }}>Margin VF</div>
                      <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, color: tk.successInk }}>
                        {fittingLadder ? ((fittingLadder.targetPrice - kpis.fittingCapacity.costPerKg) / fittingLadder.targetPrice * 100).toFixed(2) : 0}%
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${tk.surfaceMuted}` }}>
                    <div>
                      <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginBottom: 2 }}>Lợi nhuận trước thuế (EBIT)</div>
                      <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.bold, ...tnum, color: fittingLadder && (kpis.fittingCapacity.productionKgYear * (fittingLadder.targetPrice - kpis.fittingCapacity.costPerKg)) > 0 ? tk.successInk : tk.dangerInk }}>
                        {fittingLadder ? fmtTyVnd(kpis.fittingCapacity.productionKgYear * (fittingLadder.targetPrice - kpis.fittingCapacity.costPerKg)) : 0} Tỷ đ
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 24 }}>
              <SectionHeader index="" title="THÁC CHI PHÍ / KG — TIỀN ĐI ĐÂU?" note="Tách giá thành đầy đủ thành 4 tầng: gia công tiền mặt (phần quản đốc 'cảm' được) · chi phí chung · khấu hao máy/khuôn · nguyên liệu nhập. Giải thích vì sao giá thành cao hơn nhiều so với chi phí gia công cảm nhận." />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px,1fr))', gap: 14 }}>
                <CostWaterfall layers={kpis.pipeCostLayers} title="Dòng Ống CPVC" subtitle="giá thành đầy đủ / kg — tại công suất bình thường" />
                <CostWaterfall layers={kpis.fittingCostLayers} title="Dòng Phụ kiện" subtitle="giá thành đầy đủ / kg — khấu hao/kg cao khi công suất chưa lấp đầy" />
              </div>
            </div>
          </div>
          )}

          {/* III. Top-down */}
          {activeTab === 'pricing' && (
            <div style={{ marginBottom: 22 }}>
              <SectionHeader index="III" title="PHÂN TÍCH NGƯỢC (TOP-DOWN) — CHIẾN LƯỢC MUA HÀNG" note="Nhập giá bán mục tiêu (VNĐ/kg) → hệ thống tự tìm ngược mức giá thu mua nguyên liệu tối đa (USD/kg) để đạt điểm hòa vốn." />
              <div style={{ background: tk.surface, border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 0 }}>
                <div style={{ padding: 20, borderRight: `1px solid ${tk.surfaceMuted}`, background: tk.surfaceMuted }}>
                  <div style={{ fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, color: tk.ink, marginBottom: 4 }}>Giá bán mục tiêu — Ống (đ/kg)</div>
                  <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginBottom: 12 }}>
                    Giá tham chiếu: sàn biến phí {fmtVnd(tdFloor)} · VF {fmtVnd(tdTarget)}
                  </div>
                  <input
                    type="number"
                    value={topDownPrice || ''}
                    onChange={(e) => setTopDownPrice(parseFloat(e.target.value) || 0)}
                    placeholder="Nhập giá đ/kg..."
                    style={{ width: '100%', padding: '10px 14px', border: `2px solid ${tk.ink}`, borderRadius: rd.sm, fontSize: ft.size.lg, fontWeight: ft.weight.bold, textAlign: 'right', ...tnum, outline: 'none', background: tk.surface, color: tk.ink }}
                  />
                  <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginTop: 6, textAlign: 'right' }}>VNĐ / kg ống</div>
                  <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: rd.sm, border: `1px solid ${tdColor}`, background: tdBannerBg }}>
                    <div style={{ fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, color: tdColor }}>{tdStatus}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 0 }}>
                  <div style={{ padding: 16, borderRight: `1px solid ${tk.surfaceMuted}` }}>
                    <div style={{ ...eyebrowStyle, marginBottom: 6 }}>Margin tại giá này</div>
                    <div style={{ fontSize: ft.size.xxl, fontWeight: ft.weight.bold, ...tnum, color: tdColor }}>{tdMarginPct !== null ? tdMarginPct.toFixed(1) : '—'}%</div>
                    <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginTop: 4 }}>vs giá thành đầy đủ {fmtVnd(tdFullCost)} đ</div>
                  </div>
                  <div style={{ padding: 16, borderRight: `1px solid ${tk.surfaceMuted}` }}>
                    <div style={{ ...eyebrowStyle, marginBottom: 6 }}>Compound tối đa</div>
                    <div style={{ fontSize: ft.size.xxl, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{tdMaxCompound !== null ? fmtUsd(tdMaxCompound) : '—'}</div>
                    <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginTop: 4 }}>
                      USD/kg · Hiện tại: {pipeRefMaterial ? fmtUsd(pipeRefMaterial.inventory.replacementPriceUsdPerKg) : '—'} USD/kg
                    </div>
                  </div>
                  <div style={{ padding: 16, borderRight: `1px solid ${tk.surfaceMuted}` }}>
                    <div style={{ ...eyebrowStyle, marginBottom: 6 }}>SL hòa vốn tại giá này</div>
                    <div style={{ fontSize: ft.size.xxl, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{tdBepQty !== null ? fmtVnd(tdBepQty) : '—'}</div>
                    <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginTop: 4 }}>kg/năm · {tdBepPct !== null ? tdBepPct.toFixed(1) : '—'}% CS bình thường</div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ ...eyebrowStyle, marginBottom: 6 }}>So thang giá (ống)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      {(
                        [
                          ['Sàn BP', tdFloor, tk.danger],
                          ['GT đầy đủ', tdFullCost, tk.warningInk],
                          ['Giá VF', tdTarget, tk.success],
                        ] as const
                      ).map(([lbl, v, c]) => (
                        <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: ft.size.eyebrow }}>
                          <span style={{ color: c }}>{lbl}</span>
                          <span style={{ ...tnum, color: tk.inkMuted }}>{fmtVnd(v)}</span>
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
              <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginBottom: 16, background: tk.surfaceMuted, padding: '10px 14px', borderRadius: rd.sm, borderLeft: `3px solid ${tk.ink}` }}>
                <b>Lưu ý về Tài sản dùng chung (Shared Assets):</b> Khấu hao khuôn mẫu và máy đùn ở đây là chi phí được phân bổ theo <b>tổng công suất của tất cả thương hiệu/vật liệu</b> (VD: BlazeMaster, Corzan...) được chạy trên cùng dây chuyền.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 12 }}>
              <Card>
                <CardLabel tooltip="Cost-Volume-Profit: Sản lượng yêu cầu để đủ bù đắp phần định phí của riêng dòng Ống">Hòa vốn CVP — Ống</CardLabel>
                <CardValue>{fmtVnd(pipeCvp.breakEvenKgYear)} kg</CardValue>
                <CardNote>{fmtPct(pipeCvp.pctOfNormalCapacity)} công suất bình thường</CardNote>
                <div style={{ height: 4, background: tk.surfaceMuted, borderRadius: rd.sm, marginTop: 7 }}>
                  <div style={{ width: `${Math.min(100, Math.round(pipeCvp.pctOfNormalCapacity * 100))}%`, height: 4, background: tk.success, borderRadius: rd.sm }} />
                </div>
              </Card>
              <Card>
                <CardLabel tooltip="Công Suất Nhàn Rỗi: Định phí không được phân bổ vào sản phẩm do máy không chạy đủ công suất bình thường">Chi phí CSNR — Ống</CardLabel>
                <CardValue color={tk.dangerInk}>{fmtTyVnd(pipeCvp.fixedCostPerYear)}</CardValue>
                <CardNote>Định phí chưa được hấp thụ kỳ KH (chưa có kế hoạch SX)</CardNote>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: tk.dangerTint, padding: '3px 8px', borderRadius: rd.sm, marginTop: 7 }}>
                  <span style={{ color: tk.dangerInk, fontSize: ft.size.eyebrow, fontWeight: ft.weight.semibold }}>⚠ Cảnh báo tải thấp</span>
                </div>
              </Card>
              <Card>
                <CardLabel tooltip="Cost-Volume-Profit: Sản lượng yêu cầu để đủ bù đắp phần định phí của riêng dòng Phụ kiện">Hòa vốn CVP — Phụ kiện</CardLabel>
                <CardValue>{fittingCvp ? fmtVnd(fittingCvp.breakEvenKgYear) : '—'} kg</CardValue>
                <CardNote>{fittingCvp ? fmtPct(fittingCvp.pctOfUtilizedHours) : '—'} giờ máy huy động</CardNote>
                {fittingCvp && (
                <div style={{ height: 4, background: tk.surfaceMuted, borderRadius: rd.sm, marginTop: 7 }}>
                  <div style={{ width: `${Math.min(100, Math.round(fittingCvp.pctOfUtilizedHours * 100))}%`, height: 4, background: tk.success, borderRadius: rd.sm }} />
                </div>
                )}
              </Card>
              <Card>
                <CardLabel tooltip="Công Suất Nhàn Rỗi: Định phí không được phân bổ vào sản phẩm do máy không chạy đủ công suất bình thường">Chi phí CSNR — Phụ kiện</CardLabel>
                <CardValue color={tk.dangerInk}>{fittingCvp ? fmtTyVnd(fittingCvp.fixedCostPerYear) : '—'}</CardValue>
                <CardNote>Định phí chưa được hấp thụ (giờ máy rảnh rỗi)</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="Doanh thu cần đạt để bù đắp định phí khối SX, ngoài SX và chi phí tài chính (tính theo tỷ suất LN dự kiến) — GỘP cả 2 dòng theo 1 tỷ lệ đảm phí bình quân.">Doanh thu hòa vốn toàn DN</CardLabel>
                <CardValue>{fmtTyVnd(kpis.investment.enterpriseBreakEvenRevenuePerYear)}</CardValue>
                <CardNote>Gồm SX + vận hành + lãi vay — cả Ống + Phụ kiện</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="ADR-062 — hoà vốn doanh thu RIÊNG dòng Ống: định phí CVP của ống + phần chi phí ngoài SX/lãi vay chia theo tỷ trọng doanh thu ống, chia cho tỷ lệ đảm phí RIÊNG của ống (khác tỷ lệ bình quân dùng ở thẻ gộp).">Doanh thu hòa vốn — Ống</CardLabel>
                <CardValue>{fmtTyVnd(kpis.investment.pipeBreakEvenRevenuePerYear)}</CardValue>
                <CardNote>Đảm phí ống {fmtPct(kpis.investment.pipeContributionMarginRatio)} · thực tế {fmtTyVnd(kpis.investment.expectedRevenuePipeVf)}</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="ADR-062 — hoà vốn doanh thu RIÊNG dòng Phụ kiện: định phí CVP của phụ kiện + phần chi phí ngoài SX/lãi vay chia theo tỷ trọng doanh thu phụ kiện, chia cho tỷ lệ đảm phí RIÊNG của phụ kiện.">Doanh thu hòa vốn — Phụ kiện</CardLabel>
                <CardValue>{fmtTyVnd(kpis.investment.fittingBreakEvenRevenuePerYear)}</CardValue>
                <CardNote>Đảm phí phụ kiện {fmtPct(kpis.investment.fittingContributionMarginRatio)} · thực tế {fmtTyVnd(kpis.investment.expectedRevenueFittingVf)}</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="Chi phí túi ni lông bọc ống, cấu hình ở Thiết Lập Dữ Liệu — luôn tính theo kg thành phẩm.">Bao bì — Ống (túi ni lông)</CardLabel>
                <CardValue>{fmtVnd(kpis.packaging.pipe.packagingCostPerKgVnd)} đ/kg</CardValue>
                <CardNote>Cộng thẳng vào giá thành/kg</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="Chi phí bao bì carton phụ kiện (ADR-060) — 'Theo kg' = flat rải đều mọi SKU; 'Theo thùng' = giá 1 thùng ÷ số cái/thùng từng SKU. Đổi ở công tắc sidebar 'Bao bì Phụ kiện'.">Bao bì — Phụ kiện (carton)</CardLabel>
                <CardValue>
                  {kpis.packaging.fitting.method === 'per_box'
                    ? `${fmtVnd(kpis.packaging.fitting.packagingBoxCostVnd)} đ/thùng`
                    : `${fmtVnd(kpis.packaging.fitting.packagingCostPerKgVnd)} đ/kg`}
                </CardValue>
                <CardNote>{kpis.packaging.fitting.method === 'per_box' ? 'Chia theo cái/thùng từng SKU (ADR-060)' : 'Rải đều theo kg (flat, chuẩn Excel)'}</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="Tổng cộng CAPEX máy móc, khuôn, nhà xưởng, điện nước và vốn lưu động">Tổng vốn cố định</CardLabel>
                <CardValue>{fmtTyVnd(kpis.investment.totalFixedCapitalInvested)}</CardValue>
                <CardNote>Thiết bị + {scenario ? (scenario.resources.fitting as { moldAssets: unknown[] }).moldAssets.length : '—'} bộ khuôn + hạ tầng</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="Lợi nhuận trước thuế và lãi vay tính tại kịch bản bán giá VF và chạy đúng công suất bình thường">EBIT tại CS bình thường + VF</CardLabel>
                <CardValue color={tk.successInk}>{fmtTyVnd(kpis.investment.ebitAtNormalCapacityVfPrice)}</CardValue>
                <CardNote>3 ca + giá mục tiêu VF</CardNote>
              </Card>
              <Card>
                <CardLabel tooltip="= Tổng vốn đầu tư / (EBIT + Khấu hao)">Thời gian thu hồi vốn</CardLabel>
                <CardValue color={tk.successInk}>{kpis.investment.paybackYears.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} năm</CardValue>
                <CardNote>EBIT + khấu hao · ~{Math.round(kpis.investment.paybackYears * 12)} tháng</CardNote>
              </Card>
              </div>
              <div style={{ marginTop: 32 }}>
                <SectionHeader index="" title="BIỂU ĐỒ HÒA VỐN CVP — ỐNG (ĐƠN VỊ: TỶ VNĐ)" />
                <div style={{ background: tk.surface, border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, padding: 20, height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={pipeCvpChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tk.surfaceMuted} />
                      <XAxis dataKey="kg" tickFormatter={(v) => fmtVnd(v)} tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => v.toFixed(1)} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: any) => Number(value).toFixed(2) + ' Tỷ đ'} labelFormatter={(lbl) => 'Sản lượng: ' + fmtVnd(Number(lbl)) + ' kg'} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Area type="monotone" dataKey="dinhPhi" fill={tk.dangerTint} stroke="none" name="Định phí" />
                      <Line type="monotone" dataKey="chiPhi" stroke={tk.danger} strokeWidth={3} name="Tổng chi phí" dot={false} />
                      <Line type="monotone" dataKey="doanhThu" stroke={tk.success} strokeWidth={3} name="Tổng doanh thu" dot={false} />
                      <Line type="monotone" dataKey="loiNhuan" stroke={tk.warning} strokeWidth={2} strokeDasharray="5 5" name="Lợi nhuận (EBIT)" dot={false} />
                      {pipeCvp && (
                        <ReferenceLine x={pipeCvp.breakEvenKgYear} stroke={tk.warningInk} strokeDasharray="3 3" label={{ position: 'top', value: 'Hòa vốn', fill: tk.warningInk, fontSize: 11 }} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Screen>
  );
}
