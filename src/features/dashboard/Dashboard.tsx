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
  pickers,
}: {
  pipeLadder: Ladder;
  fittingLadder: Ladder;
  pickers?: React.ReactNode;
}) {
  const range = (l: Ladder) => ({ min: l.variableCostFloor, max: l.targetPrice });
  const rp = range(pipeLadder);
  const rf = range(fittingLadder);
  const bar = (v: number, r: { min: number; max: number }) => `${Math.round(((v - r.min) / (r.max - r.min)) * 100)}%`;
  return (
    <div style={{ marginBottom: 22 }}>
      <SectionHeader index="I" title="THANG GIÁ 5 BẬC — VNĐ/KG" />
      {pickers}
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
  scenarioId,
  scenario,
  internal,
  salesPriceLadder,
}: {
  role: AppRole;
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

  const kpis = useMemo(() => (canSeeCostDetail && scenario ? calculateDashboardKpis(scenario) : null), [canSeeCostDetail, scenario]);

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
    if (!scenario) return;
    // ADR-004: chốt lại baseline = replacement hiện hành cho material đang MỞ KHÓA.
    const materials = scenario.materials.map((m) => {
      const entry = internal?.priceLock.byMaterial.find((e) => e.materialId === m.id);
      if (!entry || entry.evaluation.isLocked) return m;
      return { ...m, inventory: { ...m.inventory, priceLock: { ...m.inventory.priceLock, baseline: m.inventory.replacementPriceUsdPerKg } } };
    });
    await updateDoc(doc(db, `scenarios/${scenarioId}`), { materials });
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
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Tổng Quan Quản Trị</div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Dashboard — BlazeMaster CPVC</h1>
        {canSeeCostDetail && scenario && (
          <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>
            Mô hình giá thành v3.7 · Tỷ giá: {fmtVnd(usdRate!)} · Replacement ống: {fmtUsd(pipeRefMaterial!.inventory.replacementPriceUsdPerKg)} USD/kg · PK:{' '}
            {fmtUsd(fittingRefMaterial!.inventory.replacementPriceUsdPerKg)} USD/kg
          </div>
        )}
      </div>

      {/* Lock bar — ADR-004, chỉ tầng chiến lược (ADR-006) */}
      {canSeeCostDetail && lockRows.length > 0 && (
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

      {/* I. Thang giá */}
      {pipeLadder && fittingLadder && (
        <LadderSection
          pipeLadder={pipeLadder}
          fittingLadder={fittingLadder}
          pickers={
            canSeeCostDetail ? (
              <>
                <MaterialPicker label="Ống" materials={pipeMaterials} selectedId={activePipeMatId ?? ''} onSelect={setPipeMaterialId} />
                <MaterialPicker label="Phụ kiện" materials={fittingMaterials} selectedId={activeFittingMatId ?? ''} onSelect={setFittingMaterialId} />
              </>
            ) : undefined
          }
        />
      )}

      {canSeeCostDetail && kpis && internal && pipeLadder && pipeCvp ? (
        <>
          {/* II. Sản xuất — 3 mức công suất Ống */}
          <div style={{ marginBottom: 22 }}>
            <SectionHeader index="II" title="SẢN XUẤT — 3 MỨC CÔNG SUẤT ỐNG" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {kpis.capacityLevels.map((level, i) => {
                const marginVf = tdTarget > 0 ? ((tdTarget - level.costPerKg) / tdTarget) * 100 : 0;
                return (
                  <div key={level.shifts} onClick={() => setSelectedShift(i)} style={{ background: '#fff', border: `2px solid ${i === selectedShift ? '#a8003b' : '#e0e0e0'}`, borderRadius: 2, padding: 15, cursor: 'pointer' }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#737373', fontWeight: 600, marginBottom: 7 }}>{level.shifts} ca</div>
                    <div style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.3px' }}>{fmtVnd(level.productionKgYear)}</div>
                    <div style={{ fontSize: 10, color: '#737373', marginTop: 1, marginBottom: 10 }}>kg/năm · {Math.round((level.shifts / 3) * 100)}% CS thiết kế</div>
                    <div style={{ height: 1, background: '#f0f0f0', marginBottom: 10 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div>
                        <div style={{ fontSize: 9, color: '#737373', marginBottom: 2 }}>Giá thành/kg</div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(level.costPerKg)} đ</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, color: '#737373', marginBottom: 2 }}>Margin VF</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>{marginVf.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* III. Top-down */}
          <div style={{ marginBottom: 22 }}>
            <SectionHeader index="III" title="PHÂN TÍCH NGƯỢC (TOP-DOWN) — ỐNG CPVC" color="#333" note="Nhập giá bán mục tiêu → hệ thống tính ngược compound, margin, sản lượng" />
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

          {/* IV. Hòa vốn & đầu tư */}
          <div>
            <SectionHeader index="IV" title="HÒA VỐN & ĐẦU TƯ" />
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
          </div>
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
