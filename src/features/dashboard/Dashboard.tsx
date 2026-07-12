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

const TIER_DEFS = [
  { key: 'variableCostFloor', bac: 1, label: 'Sàn biến phí', role: 'Không ai được bán thủng — lỗ tiền tươi ngay lập tức', color: '#DC2626' },
  { key: 'cashBreakEven', bac: 2, label: 'Hòa vốn tiền mặt', role: 'Quản trị — phòng thủ khi thị trường xấu, dòng tiền còn dương', color: '#ea580c' },
  { key: 'breakEvenFullCost', bac: 3, label: 'Giá thành đầy đủ', role: 'Sản xuất + kế toán (TT200) — GĐ duyệt mới được bán tới đây', color: '#d97706' },
  { key: 'enterpriseBreakEven', bac: 4, label: 'Hòa vốn toàn DN', role: 'Quản trị + đầu tư — giá bán thường ngày PHẢI trên mức này', color: '#2563eb' },
  { key: 'targetPrice', bac: 5, label: 'Giá mục tiêu (VF)', role: 'Bán hàng — giá chào chuẩn; khoảng lùi 5→4→3 theo thẩm quyền', color: '#16A34A' },
] as const;

type Ladder = ScenarioOutput['priceLadder']['byLineMaterial'][number]['ladder'];

function SectionHeader({ index, title, color = '#a8003b', note }: { index: string; title: string; color?: string; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
      <div style={{ width: 3, height: 14, background: color, borderRadius: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color }}>
        {index}. {title}
      </div>
      {note && <div style={{ fontSize: 9, color: '#737373', marginLeft: 4 }}>{note}</div>}
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
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>
      {materials.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          style={{
            padding: '3px 10px',
            cursor: 'pointer',
            border: `1px solid ${m.id === selectedId ? '#a8003b' : '#d8d8d8'}`,
            background: m.id === selectedId ? '#a8003b' : '#fff',
            color: m.id === selectedId ? '#fff' : '#555',
            borderRadius: 2,
            fontSize: 10,
            fontWeight: 600,
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
      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 160px 160px', padding: '9px 18px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', gap: 12 }}>
          <div />
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em' }}>Bậc giá / Thẩm quyền</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textAlign: 'right', textTransform: 'uppercase' }}>Ống CPVC</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textAlign: 'right', textTransform: 'uppercase' }}>Phụ Kiện</div>
        </div>
        {TIER_DEFS.map((tg) => (
          <div key={tg.bac} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 160px 160px', padding: '12px 18px', borderBottom: '1px solid #f2f2f2', alignItems: 'start', gap: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: tg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{tg.bac}</span>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{tg.label}</div>
              <div style={{ fontSize: 10, color: '#737373', marginBottom: 7 }}>{tg.role}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                {(
                  [
                    ['ỐNG', pipeLadder[tg.key], rp],
                    ['PHỤ KIỆN', fittingLadder[tg.key], rf],
                  ] as const
                ).map(([lbl, v, r]) => (
                  <div key={lbl} style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: '#b3b3b3', marginBottom: 3 }}>{lbl}</div>
                    <div style={{ height: 3, background: '#f0f0f0', borderRadius: 2 }}>
                      <div style={{ height: 3, borderRadius: 2, background: tg.color, width: bar(v, r) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {[pipeLadder[tg.key], fittingLadder[tg.key]].map((v, i) => (
              <div key={i} style={{ textAlign: 'right', paddingTop: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(v)}</div>
                <div style={{ fontSize: 9, color: '#b3b3b3', marginTop: 1 }}>đ/kg</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, padding: 15 }}>{children}</div>;
}
function CardLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.08em', color: '#737373', marginBottom: 7 }}>{children}</div>;
}
function CardValue({ children, color }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 21, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{children}</div>;
}
function CardNote({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: '#737373', marginTop: 2 }}>{children}</div>;
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
  const canSeeCostDetail = role === 'admin' || role === 'pricing';
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

  const kpis = useMemo(() => (canSeeCostDetail && scenario ? calculateDashboardKpis(scenario) : null), [canSeeCostDetail, scenario]);

  const pipeCvpChartData = useMemo(() => {
    if (!pipeCvp || !pipeLadder || !kpis) return [];
    const maxCapacity = kpis.capacityLevels[2]?.productionKgYear || pipeCvp.breakEvenKgYear * 2;
    const step = maxCapacity / 5;
    const data = [];
    for (let i = 0; i <= 6; i++) {
      const kg = i * step;
      data.push({
        kg: Math.round(kg),
        doanhThu: (kg * pipeLadder.targetPrice) / 1e9,
        chiPhi: (pipeCvp.fixedCostPerYear + kg * pipeCvp.variableCostPerKg) / 1e9,
        dinhPhi: pipeCvp.fixedCostPerYear / 1e9,
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

  if (!canSeeCostDetail && !salesPriceLadder && !internal) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải bảng giá…</div>;
  }
  if (canSeeCostDetail && (!scenario || !internal)) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản + kết quả tính…</div>;
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
  const tdColor = !topDownPrice ? '#b3b3b3' : !tdAboveFloor ? '#DC2626' : !tdAboveFullCost ? '#ea580c' : tdMarginPct! > 15 ? '#16A34A' : '#d97706';
  const tdStatus = !topDownPrice ? '—' : !tdAboveFloor ? 'DƯỚI SÀN BIẾN PHÍ — lỗ tiền mặt' : !tdAboveFullCost ? 'Dưới giá thành — lỗ gộp' : tdMarginPct! > 15 ? 'Có lãi tốt' : 'Lãi thấp — cần xem lại';
  const tdBannerBg = tdAboveFullCost ? '#f0fdf4' : tdAboveFloor ? '#fffbeb' : '#fef2f2';

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Tổng Quan Quản Trị</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-.5px' }}>Bảng điều khiển (Dashboard)</h1>
          {canSeeCostDetail && scenario && (
            <div style={{ fontSize: 11, color: '#737373', marginTop: 6, display: 'flex', gap: 12 }}>
              <span>Tỷ giá: <b>{fmtVnd(usdRate!)}</b></span>
              <span>•</span>
              <span>Nguyên liệu Ống: <b>{pipeRefMaterial?.name || '—'}</b> ({fmtUsd(pipeRefMaterial?.inventory.replacementPriceUsdPerKg || 0)}/kg)</span>
              <span>•</span>
              <span>Nguyên liệu PK: <b>{fittingRefMaterial?.name || '—'}</b> ({fmtUsd(fittingRefMaterial?.inventory.replacementPriceUsdPerKg || 0)}/kg)</span>
            </div>
          )}
        </div>
        {canSeeCostDetail && (
          <div style={{ display: 'flex', gap: 12 }}>
            <MaterialPicker label="Dòng Ống" materials={pipeMaterials} selectedId={activePipeMatId ?? ''} onSelect={setPipeMaterialId} />
            <MaterialPicker label="Dòng Phụ kiện" materials={fittingMaterials} selectedId={activeFittingMatId ?? ''} onSelect={setFittingMaterialId} />
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      {canSeeCostDetail && (
        <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #e5e5e5', marginBottom: 24 }}>
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
                fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                color: activeTab === t.id ? '#a8003b' : '#737373',
                borderBottom: `2px solid ${activeTab === t.id ? '#a8003b' : 'transparent'}`,
                cursor: 'pointer',
                marginBottom: -1
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && canSeeCostDetail && kpis && internal && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
            <Card>
              <CardLabel>EBIT Mục Tiêu (CS Bình thường)</CardLabel>
              <CardValue color={kpis.investment.ebitAtNormalCapacityVfPrice > 0 ? '#16A34A' : '#DC2626'}>{fmtTyVnd(kpis.investment.ebitAtNormalCapacityVfPrice)}</CardValue>
              <CardNote>Tại giá VF & chạy 3 ca</CardNote>
            </Card>
            <Card>
              <CardLabel>Thời gian thu hồi vốn</CardLabel>
              <CardValue color="#16A34A">{kpis.investment.paybackYears.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} năm</CardValue>
              <CardNote>Tổng đầu tư: {fmtTyVnd(kpis.investment.totalFixedCapitalInvested)}</CardNote>
            </Card>
            <Card>
              <CardLabel>Điểm hòa vốn toàn DN</CardLabel>
              <CardValue>{fmtTyVnd(kpis.investment.enterpriseBreakEvenRevenuePerYear)}</CardValue>
              <CardNote>Doanh thu yêu cầu để bù đắp định phí</CardNote>
            </Card>
            <Card>
              <CardLabel>Chi phí gia công Ống (không NVL)</CardLabel>
              <CardValue color="#ea580c">{fmtVnd(kpis.capacityLevels.find(l => l.shifts === 3)?.processingCostPerKg || 0)} đ/kg</CardValue>
              <CardNote>Tại năng suất 3 ca</CardNote>
            </Card>
          </div>
        </div>
      )}

      {/* Lock bar — ADR-004, di chuyển vào Tab Pricing (Chiến lược giá) */}
      {(activeTab === 'pricing' || !canSeeCostDetail) && lockRows.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {lockRows.map(([label, material, entry]) => {
            const ev = entry!.evaluation;
            const color = ev.isLocked ? '#16A34A' : '#DC2626';
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 2, border: `1px solid ${color}`, background: ev.isLocked ? '#f0fdf4' : '#fef2f2', flex: 1, minWidth: 220 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.04em' }}>
                    {label} — {ev.isLocked ? 'KHÓA' : 'MỞ KHÓA'}
                  </div>
                  <div style={{ fontSize: 9, color: '#737373', marginTop: 1 }}>
                    Baseline {fmtUsd(material!.inventory.priceLock.baseline)} · Replacement {fmtUsd(ev.replacement)} · Lệch{' '}
                    {Number.isFinite(ev.deviationPct) ? fmtPct(ev.deviationPct) : '∞'}
                    {ev.stalenessWarning ? ` · ⚠ ${ev.stalenessWarning}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
          {anyUnlocked && (
            <button onClick={() => void chotBaselineMoi()} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Chốt Baseline Mới
            </button>
          )}
        </div>
      )}

      {/* I. Thang giá - Chuyển vào Tab Pricing */}
      {(activeTab === 'pricing' || !canSeeCostDetail) && pipeLadder && fittingLadder && (
        <LadderSection
          pipeLadder={pipeLadder}
          fittingLadder={fittingLadder}
        />
      )}

      {canSeeCostDetail && kpis && internal && pipeLadder && pipeCvp ? (
        <>
          {/* II. Sản xuất — 3 mức công suất Ống */}
          {activeTab === 'manufacturing' && (
            <div style={{ marginBottom: 22 }}>
              <SectionHeader index="II" title="HIỆU QUẢ THEO CÔNG SUẤT — DÒNG ỐNG (ĐÙN LIÊN TỤC)" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {kpis.capacityLevels.map((level, i) => {
                 const marginVf = tdTarget > 0 ? ((tdTarget - level.costPerKg) / tdTarget) * 100 : 0;
                return (
                  <div key={level.shifts} onClick={() => setSelectedShift(i)} style={{ background: '#fff', border: `2px solid ${i === selectedShift ? '#a8003b' : '#e0e0e0'}`, borderRadius: 2, padding: 15, cursor: 'pointer' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#737373', fontWeight: 600, marginBottom: 7 }}>Mô phỏng Ống: {level.shifts} ca</div>
                    <div style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.3px' }}>{fmtVnd(level.productionKgYear)}</div>
                    <div style={{ fontSize: 10, color: '#737373', marginTop: 1, marginBottom: 8 }}>kg ống/năm · {Math.round((level.shifts / 3) * 100)}% CS thiết kế</div>
                    <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((level.shifts / 3) * 100)}%`, height: '100%', background: level.shifts === 1 ? '#eab308' : level.shifts === 2 ? '#3b82f6' : '#16a34a' }} />
                    </div>
                    <div style={{ height: 1, background: '#f0f0f0', marginBottom: 10 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div>
                        <div style={{ fontSize: 9, color: '#737373', marginBottom: 2 }}>Giá thành/kg</div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(level.costPerKg)} đ</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, color: '#737373', marginBottom: 2 }}>Phí gia công/kg</div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#ea580c' }}>{fmtVnd(level.processingCostPerKg)} đ</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', marginTop: 10 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, color: '#737373', marginBottom: 2 }}>Margin VF</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>{marginVf.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 24 }}>
              <SectionHeader index="" title="HIỆU QUẢ SẢN XUẤT — DÒNG PHỤ KIỆN (ÉP PHUN)" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <div style={{ background: '#fff', border: '2px solid #e0e0e0', borderRadius: 2, padding: 15 }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#737373', fontWeight: 600, marginBottom: 7 }}>Công suất bình thường</div>
                  <div style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.3px' }}>{fmtVnd(kpis.fittingCapacity.productionKgYear)}</div>
                  <div style={{ fontSize: 10, color: '#737373', marginTop: 1, marginBottom: 10 }}>kg phụ kiện/năm</div>
                  <div style={{ height: 1, background: '#f0f0f0', marginBottom: 10 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: 9, color: '#737373', marginBottom: 2 }}>Giá thành/kg</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(kpis.fittingCapacity.costPerKg)} đ</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: '#737373', marginBottom: 2 }}>Phí gia công/kg</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#ea580c' }}>{fmtVnd(kpis.fittingCapacity.processingCostPerKg)} đ</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', marginTop: 10 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: '#737373', marginBottom: 2 }}>Margin VF</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>
                        {fittingLadder ? ((fittingLadder.targetPrice - kpis.fittingCapacity.costPerKg) / fittingLadder.targetPrice * 100).toFixed(2) : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* III. Top-down */}
          {activeTab === 'pricing' && (
            <div style={{ marginBottom: 22 }}>
              <SectionHeader index="III" title="PHÂN TÍCH NGƯỢC (TOP-DOWN) — CHIẾN LƯỢC MUA HÀNG" color="#333" note="Nhập giá bán mục tiêu (VNĐ/kg) → hệ thống tự tìm ngược mức giá thu mua nguyên liệu tối đa (USD/kg) để đạt điểm hòa vốn." />
              <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0 }}>
                <div style={{ padding: 20, borderRight: '1px solid #f0f0f0', background: '#f5f5f3' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Giá bán mục tiêu — Ống (đ/kg)</div>
                  <div style={{ fontSize: 9, color: '#737373', marginBottom: 12 }}>
                    Giá tham chiếu: sàn biến phí {fmtVnd(tdFloor)} · VF {fmtVnd(tdTarget)}
                  </div>
                  <input
                    type="number"
                    value={topDownPrice || ''}
                    onChange={(e) => setTopDownPrice(parseFloat(e.target.value) || 0)}
                    placeholder="Nhập giá đ/kg..."
                    style={{ width: '100%', padding: '10px 14px', border: '2px solid #333', borderRadius: 2, fontSize: 16, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', outline: 'none', background: '#fff' }}
                  />
                  <div style={{ fontSize: 9, color: '#737373', marginTop: 6, textAlign: 'right' }}>VNĐ / kg ống</div>
                  <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 2, border: `1px solid ${tdColor}`, background: tdBannerBg }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: tdColor }}>{tdStatus}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
                  <div style={{ padding: 16, borderRight: '1px solid #f5f5f5' }}>
                    <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Margin tại giá này</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tdColor }}>{tdMarginPct !== null ? tdMarginPct.toFixed(1) : '—'}%</div>
                    <div style={{ fontSize: 9, color: '#737373', marginTop: 4 }}>vs giá thành đầy đủ {fmtVnd(tdFullCost)} đ</div>
                  </div>
                  <div style={{ padding: 16, borderRight: '1px solid #f5f5f5' }}>
                    <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Compound tối đa</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1a1a1a' }}>{tdMaxCompound !== null ? fmtUsd(tdMaxCompound) : '—'}</div>
                    <div style={{ fontSize: 9, color: '#737373', marginTop: 4 }}>
                      USD/kg · Hiện tại: {pipeRefMaterial ? fmtUsd(pipeRefMaterial.inventory.replacementPriceUsdPerKg) : '—'} USD/kg
                    </div>
                  </div>
                  <div style={{ padding: 16, borderRight: '1px solid #f5f5f5' }}>
                    <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>SL hòa vốn tại giá này</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1a1a1a' }}>{tdBepQty !== null ? fmtVnd(tdBepQty) : '—'}</div>
                    <div style={{ fontSize: 9, color: '#737373', marginTop: 4 }}>kg/năm · {tdBepPct !== null ? tdBepPct.toFixed(1) : '—'}% CS bình thường</div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>So thang giá (ống)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      {(
                        [
                          ['Sàn BP', tdFloor, '#DC2626'],
                          ['GT đầy đủ', tdFullCost, '#d97706'],
                          ['Giá VF', tdTarget, '#16A34A'],
                        ] as const
                      ).map(([lbl, v, c]) => (
                        <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                          <span style={{ color: c }}>{lbl}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', color: '#737373' }}>{fmtVnd(v)}</span>
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
              <div style={{ fontSize: 11, color: '#555', marginBottom: 16, background: '#f5f5f5', padding: '10px 14px', borderRadius: 2, borderLeft: '3px solid #d97706' }}>
                <b>Lưu ý về Tài sản dùng chung (Shared Assets):</b> Khấu hao khuôn mẫu và máy đùn ở đây là chi phí được phân bổ theo <b>tổng công suất của tất cả thương hiệu/vật liệu</b> (VD: BlazeMaster, Corzan...) được chạy trên cùng dây chuyền.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <Card>
                <CardLabel>Hòa vốn CVP — Ống</CardLabel>
                <CardValue>{fmtVnd(pipeCvp.breakEvenKgYear)} kg</CardValue>
                <CardNote>{fmtPct(pipeCvp.pctOfNormalCapacity)} công suất bình thường</CardNote>
                <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 7 }}>
                  <div style={{ width: `${Math.min(100, Math.round(pipeCvp.pctOfNormalCapacity * 100))}%`, height: 4, background: '#16A34A', borderRadius: 2 }} />
                </div>
              </Card>
              <Card>
                <CardLabel>Chi phí CSNR — Ống</CardLabel>
                <CardValue color="#DC2626">{fmtTyVnd(pipeCvp.fixedCostPerYear)}</CardValue>
                <CardNote>Định phí chưa được hấp thụ kỳ KH (chưa có kế hoạch SX)</CardNote>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef2f2', padding: '3px 8px', borderRadius: 2, marginTop: 7 }}>
                  <span style={{ color: '#DC2626', fontSize: 10, fontWeight: 600 }}>⚠ Cảnh báo tải thấp</span>
                </div>
              </Card>
              <Card>
                <CardLabel>Hòa vốn CVP — Phụ kiện</CardLabel>
                <CardValue>{fittingCvp ? fmtVnd(fittingCvp.breakEvenKgYear) : '—'} kg</CardValue>
                <CardNote>{fittingCvp ? fmtPct(fittingCvp.pctOfUtilizedHours) : '—'} giờ máy huy động</CardNote>
                {fittingCvp && (
                <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 7 }}>
                  <div style={{ width: `${Math.min(100, Math.round(fittingCvp.pctOfUtilizedHours * 100))}%`, height: 4, background: '#16A34A', borderRadius: 2 }} />
                </div>
                )}
              </Card>
              <Card>
                <CardLabel>Chi phí CSNR — Phụ kiện</CardLabel>
                <CardValue color="#DC2626">{fittingCvp ? fmtTyVnd(fittingCvp.fixedCostPerYear) : '—'}</CardValue>
                <CardNote>Định phí chưa được hấp thụ (giờ máy rảnh rỗi)</CardNote>
              </Card>
              <Card>
                <CardLabel>Doanh thu hòa vốn toàn DN</CardLabel>
                <CardValue>{fmtTyVnd(kpis.investment.enterpriseBreakEvenRevenuePerYear)}</CardValue>
                <CardNote>Gồm SX + vận hành + lãi vay</CardNote>
              </Card>
              <Card>
                <CardLabel>Tổng vốn cố định</CardLabel>
                <CardValue>{fmtTyVnd(kpis.investment.totalFixedCapitalInvested)}</CardValue>
                <CardNote>Thiết bị + {scenario ? (scenario.resources.fitting as { moldAssets: unknown[] }).moldAssets.length : '—'} bộ khuôn + Lab/UL</CardNote>
              </Card>
              <Card>
                <CardLabel>EBIT tại CS bình thường + VF</CardLabel>
                <CardValue color="#16A34A">{fmtTyVnd(kpis.investment.ebitAtNormalCapacityVfPrice)}</CardValue>
                <CardNote>3 ca + giá mục tiêu VF</CardNote>
              </Card>
              <Card>
                <CardLabel>Thời gian thu hồi vốn</CardLabel>
                <CardValue color="#16A34A">{kpis.investment.paybackYears.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} năm</CardValue>
                <CardNote>EBIT + khấu hao · ~{Math.round(kpis.investment.paybackYears * 12)} tháng</CardNote>
              </Card>
              </div>
              <div style={{ marginTop: 32 }}>
                <SectionHeader index="" title="BIỂU ĐỒ HÒA VỐN CVP — ỐNG (ĐƠN VỊ: TỶ VNĐ)" />
                <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, padding: 20, height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={pipeCvpChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="kg" tickFormatter={(v) => fmtVnd(v)} tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => v.toFixed(1)} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => value.toFixed(2) + ' Tỷ đ'} labelFormatter={(lbl) => 'Sản lượng: ' + fmtVnd(Number(lbl)) + ' kg'} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Area type="monotone" dataKey="dinhPhi" fill="#fee2e2" stroke="none" name="Định phí" />
                      <Line type="monotone" dataKey="chiPhi" stroke="#dc2626" strokeWidth={3} name="Tổng chi phí" dot={false} />
                      <Line type="monotone" dataKey="doanhThu" stroke="#16a34a" strokeWidth={3} name="Tổng doanh thu" dot={false} />
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
      ) : (
        !canSeeCostDetail && (
          <div style={{ padding: '14px 16px', background: '#f5f5f3', border: '1px dashed #d8d8d8', borderRadius: 2, fontSize: 10, color: '#737373' }}>
            Vai Bán Hàng chỉ xem thang giá + bảng giá (ADR-006, security-review) — công suất, phân tích ngược, cấu trúc chi phí và đầu tư không hiển thị ở đây.
          </div>
        )
      )}
    </div>
  );
}
