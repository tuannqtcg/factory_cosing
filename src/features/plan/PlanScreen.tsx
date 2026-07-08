// M12.7 — màn hình Kế Hoạch SX (tab `plan`, vai production/admin), dựng đúng
// prototype Pha 1 đã duyệt: bảng Ống nhập MÉT theo DN (cột kg/m, kg TP, giờ
// máy, ngày SX) + bảng Phụ kiện nhóm theo loại nhập SỐ CÁI (cột kg/cái,
// cycle, cavity, giờ máy, kg TP) + các tile tổng hợp.
//
// Khác prototype (mock tự tính toàn bộ trong trang) — ghi rõ để khỏi tưởng
// thiếu: cột dẫn xuất từng dòng (kg TP, giờ máy, ngày SX) là SỐ HỌC thuần từ
// tham số kỹ thuật trong outputs/productCatalog (ADR-014); còn "Ca máy cần",
// NVL cần mua (đ), nhân công, cảnh báo khuôn là KẾT QUẢ ENGINE — chỉ hiển thị
// từ `outputs/plan` do Cloud Function onPlanInputWrite (M12.4b) tính sau khi
// bấm "Lưu & tính", KHÔNG tự lắp lại công thức engine ở client. Thêm hàng
// nhập kỳ/nhân công hiện có/hệ số dự phòng — 3 field bắt buộc của PlanInput
// (ADR-009 #3) mà prototype mock không có.
import { useEffect, useMemo, useState } from 'react';
import { fmtVnd } from '../../lib/format.js';
import type { ProductCatalogDoc, PlanInput, PlanResult } from '../../schemas/scenario.js';

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
      <div style={{ width: 3, height: 14, background: '#a8003b', borderRadius: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color: '#a8003b' }}>{title}</div>
    </div>
  );
}
function Tile({ label, children, note, borderColor }: { label: string; children: React.ReactNode; note?: React.ReactNode; borderColor?: string }) {
  return (
    <div style={{ background: '#fff', border: borderColor ? `2px solid ${borderColor}` : '1px solid #d8d8d8', padding: 13, borderRadius: 2 }}>
      <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{children}</div>
      {note && <div style={{ fontSize: 10, color: '#737373', marginTop: 2 }}>{note}</div>}
    </div>
  );
}

const numInputStyle = (color: string, bg: string): React.CSSProperties => ({
  width: 100,
  padding: '5px 10px',
  border: `1px solid ${color}`,
  borderRadius: 2,
  fontSize: 12,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  outline: 'none',
  background: bg,
});

function shiftsLabel(v: PlanResult['shiftsNeeded']['pipe']): { text: string; color: string } {
  if (typeof v === 'number') return { text: `${v} ca`, color: v === 1 ? '#16A34A' : v === 2 ? '#d97706' : '#DC2626' };
  return { text: `THIẾU — cần thêm ${v.extraMachinesNeeded} máy`, color: '#DC2626' };
}

export default function PlanScreen({
  catalog,
  planResult,
  savedInput,
  scenarioId,
  onSave,
}: {
  catalog: ProductCatalogDoc | null;
  planResult: PlanResult | null;
  savedInput: PlanInput | null;
  scenarioId: string;
  onSave: (input: PlanInput) => Promise<string | null>;
}) {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [period, setPeriod] = useState('2026-Q3');
  const [periodMonths, setPeriodMonths] = useState(3);
  const [laborPipe, setLaborPipe] = useState(4);
  const [laborFitting, setLaborFitting] = useState(2);
  const [safetyPct, setSafetyPct] = useState(5);
  const [pipeMeters, setPipeMeters] = useState<Record<string, number>>({}); // key = dn|materialId
  const [fittingQty, setFittingQty] = useState<Record<string, number>>({}); // key = name|size|materialId
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadedFromSaved, setLoadedFromSaved] = useState(false);

  // Nạp form từ planInputs đã lưu (1 lần — không ghi đè khi đang gõ)
  useEffect(() => {
    if (!savedInput || loadedFromSaved) return;
    setLoadedFromSaved(true);
    setPeriod(savedInput.period);
    setPeriodMonths(savedInput.periodMonths);
    setLaborPipe(savedInput.currentLaborHeadcount.pipe);
    setLaborFitting(savedInput.currentLaborHeadcount.fitting);
    setSafetyPct(savedInput.materialSafetyStockFactor * 100);
    setPipeMeters(Object.fromEntries(savedInput.pipePlan.map((e) => [`${e.dn}|${e.materialId ?? ''}`, e.meters])));
    setFittingQty(
      Object.fromEntries(savedInput.fittingPlan.map((e) => [`${e.productName}|${e.sizeLabel}|${e.materialId ?? ''}`, e.qty])),
    );
  }, [savedInput, loadedFromSaved]);

  const activeFittings = useMemo(() => (catalog ? catalog.fittings.filter((f) => f.managementStatus === 'active') : []), [catalog]);
  const fittingGroups = useMemo(() => {
    const groups: Array<{ type: string; rows: typeof activeFittings }> = [];
    for (const f of activeFittings) {
      const g = groups.find((x) => x.type === f.productName);
      if (g) g.rows.push(f);
      else groups.push({ type: f.productName, rows: [f] });
    }
    return groups;
  }, [activeFittings]);
  // ADR-012: chỉ hiện tên nguyên liệu khi LINE đó có >1 material (SKU trùng tên/size khác compound)
  const showPipeMaterial = useMemo(() => (catalog ? new Set(catalog.pipes.map((p) => p.materialId)).size > 1 : false), [catalog]);
  const showFittingMaterial = useMemo(
    () => (catalog ? new Set(catalog.fittings.map((p) => p.materialId)).size > 1 : false),
    [catalog],
  );

  if (!catalog) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải danh mục sản phẩm…</div>;
  }
  const { pipe: pp, fitting: fp } = catalog.params;

  // ── Cột dẫn xuất (số học thuần từ tham số kỹ thuật — xem ghi chú đầu file) ──
  const pipeRows = catalog.pipes.map((p) => {
    const key = `${p.dn}|${p.materialId}`;
    const meters = pipeMeters[key] ?? 0;
    const kgTP = meters * p.unitWeightKgPerM;
    const gio = kgTP / pp.yieldRate / pp.actualCapacityKgPerHour;
    return { ...p, key, meters, kgTP, gio, ngay: gio / pp.hoursPerShift, hasData: meters > 0 };
  });
  const totalPipeKg = pipeRows.reduce((s, r) => s + r.kgTP, 0);
  const totalPipeGio = pipeRows.reduce((s, r) => s + r.gio, 0);

  const machineHoursPerUnit = (cy: number, cavity: number) => cy / (3600 * cavity * fp.yieldRate);
  const fittingRows = activeFittings.map((f) => {
    const key = `${f.productName}|${f.sizeLabel}|${f.materialId}`;
    const qty = fittingQty[key] ?? 0;
    return { ...f, key, qty, gio: qty * machineHoursPerUnit(f.cycleTimeSec, f.cavity), kgTP: qty * f.unitWeightKg, hasData: qty > 0 };
  });
  const totalFitGio = fittingRows.reduce((s, r) => s + r.gio, 0);
  const totalFitKg = fittingRows.reduce((s, r) => s + r.kgTP, 0);
  const fitHoursAvailable = fp.normalMachineHoursUtilizedYear * (periodMonths / 12);
  const fitUtilPct = fitHoursAvailable > 0 ? (totalFitGio / fitHoursAvailable) * 100 : 0;
  const fitUtilColor = totalFitGio === 0 ? '#b3b3b3' : totalFitGio <= fitHoursAvailable ? '#16A34A' : '#DC2626';

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError(null);
    const input: PlanInput = {
      scenarioId,
      period,
      periodMonths,
      currentLaborHeadcount: { pipe: laborPipe, fitting: laborFitting },
      pipePlan: pipeRows.filter((r) => r.meters > 0).map((r) => ({ dn: r.dn, meters: r.meters, materialId: r.materialId })),
      fittingPlan: fittingRows
        .filter((r) => r.qty > 0)
        .map((r) => ({ productName: r.productName, sizeLabel: r.sizeLabel, qty: r.qty, materialId: r.materialId })),
      materialSafetyStockFactor: safetyPct / 100,
    };
    const err = await onSave(input);
    if (err) {
      setSaveState('error');
      setSaveError(err);
    } else {
      setSaveState('saved');
    }
  };

  const numField = (label: string, value: number, onChange: (v: number) => void, step?: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em' }}>
      {label}
      <input type="number" value={value} step={step} min={0} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} style={{ ...numInputStyle('#b3b3b3', '#fff'), width: 90 }} />
    </label>
  );

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Kế Hoạch Sản Xuất · Vai Sản Xuất</div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Lập Kế Hoạch SX</h1>
        <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>Nhập số mét ống / số cái phụ kiện theo DN · Mô hình tự tính giờ máy, NVL, nhân công</div>
      </div>

      {/* Kỳ kế hoạch + tham số PlanInput (ADR-009 #3) + nút lưu */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, padding: '12px 16px', marginBottom: 20 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Kỳ kế hoạch
          <input value={period} onChange={(e) => setPeriod(e.target.value)} style={{ padding: '5px 10px', border: '1px solid #b3b3b3', borderRadius: 2, fontSize: 12, width: 110, outline: 'none' }} />
        </label>
        {numField('Số tháng', periodMonths, setPeriodMonths)}
        {numField('NC Ống hiện có', laborPipe, setLaborPipe)}
        {numField('NC PK hiện có', laborFitting, setLaborFitting)}
        {numField('Dự phòng NVL %', safetyPct, setSafetyPct, '0.5')}
        <button
          onClick={() => void handleSave()}
          disabled={saveState === 'saving'}
          style={{ padding: '9px 20px', background: '#a8003b', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}
        >
          {saveState === 'saving' ? 'Đang lưu…' : 'Lưu & tính'}
        </button>
        {saveState === 'saved' && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ Đã lưu — kết quả bên dưới do hệ thống tính</span>}
        {saveState === 'error' && <span style={{ fontSize: 11, color: '#DC2626' }}>{saveError}</span>}
      </div>

      {/* ỐNG */}
      <SectionHeader title="KẾ HOẠCH ỐNG — NHẬP MÉT THEO DN" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 11, marginBottom: 16 }}>
        <Tile label="Tổng sản lượng">{totalPipeKg > 0 ? `${fmtVnd(totalPipeKg)} kg` : '—'}</Tile>
        <Tile label="Tổng giờ máy đùn">{totalPipeGio > 0 ? `${totalPipeGio.toFixed(1)} giờ` : '—'}</Tile>
        <Tile
          label="Ca máy cần (hệ thống tính)"
          borderColor={planResult ? shiftsLabel(planResult.shiftsNeeded.pipe).color : undefined}
          note={planResult ? `cần tuyển thêm ${planResult.laborToHire.pipe} người` : 'Lưu & tính để cập nhật'}
        >
          <span style={{ color: planResult ? shiftsLabel(planResult.shiftsNeeded.pipe).color : '#b3b3b3' }}>
            {planResult ? shiftsLabel(planResult.shiftsNeeded.pipe).text : '—'}
          </span>
        </Tile>
        <Tile label="NVL cần mua (hệ thống tính)" note={`Gồm ${safetyPct}% dự phòng · theo từng nguyên liệu bên dưới`}>
          {planResult && planResult.materialRequirement.length > 0
            ? `${fmtVnd(planResult.materialRequirement.reduce((s, m) => s + m.vndValue, 0))} đ`
            : '—'}
        </Tile>
      </div>
      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)', marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 56px 140px 110px 100px 90px', padding: '9px 16px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', gap: 8 }}>
          {['DN', 'kg/m', 'MÉT KẾ HOẠCH', 'kg TP', 'Giờ máy', 'Ngày SX'].map((h, i) => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: i === 2 ? '#2563eb' : '#737373', textAlign: i === 0 ? 'left' : i === 2 ? 'center' : 'right', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>
        {pipeRows.map((r) => (
          <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '110px 56px 140px 110px 100px 90px', padding: '9px 16px', borderBottom: '1px solid #f5f5f5', gap: 8, alignItems: 'center', background: r.hasData ? '#f0fdf4' : '#fff' }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              {r.dn}
              {showPipeMaterial && <div style={{ fontSize: 8, color: '#737373', fontWeight: 400 }}>{r.materialName}</div>}
            </div>
            <div style={{ fontSize: 11, color: '#737373', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.unitWeightKgPerM}</div>
            <div style={{ textAlign: 'center' }}>
              <input type="number" min={0} placeholder="0" value={r.meters || ''} onChange={(e) => setPipeMeters((prev) => ({ ...prev, [r.key]: parseFloat(e.target.value) || 0 }))} style={{ ...numInputStyle('#2563eb', '#eff6ff'), width: 110 }} />
            </div>
            {[r.hasData ? fmtVnd(r.kgTP) : '—', r.hasData ? r.gio.toFixed(1) : '—', r.hasData ? r.ngay.toFixed(1) : '—'].map((v, i) => (
              <div key={i} style={{ fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.hasData ? '#1a1a1a' : '#b3b3b3' }}>{v}</div>
            ))}
          </div>
        ))}
      </div>

      {/* PHỤ KIỆN */}
      <SectionHeader title={`KẾ HOẠCH PHỤ KIỆN — NHẬP SỐ CÁI THEO LOẠI SẢN PHẨM (${activeFittings.length} SKU)`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 11, marginBottom: 16 }}>
        <Tile label="Giờ máy cần / khả dụng">
          <span style={{ color: fitUtilColor }}>{totalFitGio > 0 ? `${totalFitGio.toFixed(1)} / ${Math.round(fitHoursAvailable)} giờ` : '—'}</span>
        </Tile>
        <Tile label="Hệ số huy động" note={`CS bình thường: ${Math.round(fp.normalMachineHoursUtilizedYear)} giờ/năm`}>
          <span style={{ color: fitUtilColor }}>{totalFitGio > 0 ? `${Math.round(fitUtilPct)}%` : '—'}</span>
        </Tile>
        <Tile label="Tổng sản lượng PK">{totalFitKg > 0 ? `${fmtVnd(totalFitKg)} kg` : '—'}</Tile>
        <Tile
          label="Ca máy PK (hệ thống tính)"
          note={planResult ? `cần tuyển thêm ${planResult.laborToHire.fitting} người` : 'Lưu & tính để cập nhật'}
        >
          <span style={{ color: planResult ? shiftsLabel(planResult.shiftsNeeded.fitting).color : '#b3b3b3' }}>
            {planResult ? shiftsLabel(planResult.shiftsNeeded.fitting).text : '—'}
          </span>
        </Tile>
      </div>
      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 56px 48px 48px 120px 80px 80px', padding: '9px 16px', background: '#1a1a1a', gap: 6 }}>
          {['Sản phẩm / Kích cỡ', 'kg/cái', 'Cycle', 'Cavity', 'SỐ LƯỢNG (cái)', 'Giờ máy', 'kg TP'].map((h, i) => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: i === 4 ? '#93c5fd' : '#b3b3b3', textAlign: i === 0 ? 'left' : i === 4 ? 'center' : 'right', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>
        {fittingGroups.map((grp) => {
          const gGio = grp.rows.reduce((s, f) => s + (fittingQty[`${f.productName}|${f.sizeLabel}|${f.materialId}`] ?? 0) * machineHoursPerUnit(f.cycleTimeSec, f.cavity), 0);
          const gKg = grp.rows.reduce((s, f) => s + (fittingQty[`${f.productName}|${f.sizeLabel}|${f.materialId}`] ?? 0) * f.unitWeightKg, 0);
          const hasData = gGio > 0;
          return (
            <div key={grp.type}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 80px 80px', padding: '7px 16px', background: '#f5f5f3', borderTop: '1px solid #e0e0e0', gap: 6, alignItems: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700 }}>{grp.type}</div>
                <div style={{ fontSize: 9, color: '#737373' }}>{grp.rows.length} kích cỡ</div>
                <div style={{ fontSize: 10, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: hasData ? '#1a1a1a' : '#b3b3b3' }}>{hasData ? gGio.toFixed(2) : '—'} giờ</div>
                <div style={{ fontSize: 10, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: hasData ? '#1a1a1a' : '#b3b3b3' }}>{hasData ? fmtVnd(gKg) : '—'} kg</div>
              </div>
              {fittingRows
                .filter((r) => r.productName === grp.type)
                .map((r) => (
                  <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '150px 56px 48px 48px 120px 80px 80px', padding: '7px 16px', borderBottom: '1px solid #f8f8f8', gap: 6, alignItems: 'center', background: r.hasData ? '#f0fdf4' : '#fff' }}>
                    <div style={{ fontSize: 11, color: '#555', paddingLeft: 10 }}>
                      {r.sizeLabel}
                      {showFittingMaterial && <span style={{ fontSize: 8, color: '#999' }}> · {r.materialName}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: '#737373', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.unitWeightKg}</div>
                    <div style={{ fontSize: 10, color: '#737373', textAlign: 'right' }}>{r.cycleTimeSec}s</div>
                    <div style={{ fontSize: 10, color: '#737373', textAlign: 'right' }}>{r.cavity}</div>
                    <div style={{ textAlign: 'center' }}>
                      <input type="number" min={0} placeholder="0" value={r.qty || ''} onChange={(e) => setFittingQty((prev) => ({ ...prev, [r.key]: parseInt(e.target.value, 10) || 0 }))} style={numInputStyle('#93c5fd', '#eff6ff')} />
                    </div>
                    <div style={{ fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.hasData ? '#1a1a1a' : '#e0e0e0' }}>{r.hasData ? r.gio.toFixed(2) : '—'}</div>
                    <div style={{ fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.hasData ? '#1a1a1a' : '#e0e0e0' }}>{r.hasData ? fmtVnd(r.kgTP) : '—'}</div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, padding: '10px 14px', background: '#f5f5f3', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 10, color: '#737373' }}>
        MHR/cái = chu kỳ ÷ (3600 × cavity × {fp.yieldRate}) · Giờ máy khả dụng CS bình thường: {Math.round(fp.normalMachineHoursUtilizedYear)} giờ/năm · NVL dùng giá replacement (thị trường), không dùng giá khóa
      </div>

      {/* KẾT QUẢ HỆ THỐNG TÍNH (outputs/plan — Cloud Function onPlanInputWrite) */}
      {planResult && (
        <div style={{ marginTop: 28 }}>
          <SectionHeader title="KẾT QUẢ HỆ THỐNG TÍNH (SAU LƯU)" />
          {planResult.moldConstraintWarnings.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {planResult.moldConstraintWarnings.map((w) => (
                <div key={w.sizeDN} style={{ padding: '8px 14px', background: '#fef2f2', border: '1px solid #DC2626', borderRadius: 2, fontSize: 11, color: '#DC2626', marginBottom: 6 }}>
                  ⚠ Thiếu khuôn size DN{w.sizeDN}: cần {w.requiredMachineHours.toFixed(1)} giờ máy nhưng khuôn hiện có chỉ chạy được {w.availableMachineHours.toFixed(1)} giờ — cần thêm {w.extraMoldSetsNeeded} bộ khuôn
                </div>
              ))}
            </div>
          )}
          <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 160px', padding: '9px 16px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', gap: 8 }}>
              {['Nguyên liệu cần mua (gồm dự phòng)', 'kg', 'Giá trị VNĐ (giá khóa)', 'USD (replacement thô)'].map((h, i) => (
                <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#737373', textTransform: 'uppercase', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
              ))}
            </div>
            {planResult.materialRequirement.map((m) => (
              <div key={m.materialId} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 160px', padding: '8px 16px', borderBottom: '1px solid #f5f5f5', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{m.materialId}</div>
                <div style={{ fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(m.kgToBuy)}</div>
                <div style={{ fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtVnd(m.vndValue)} đ</div>
                <div style={{ fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(m.usdValueAtRawReplacement)} $</div>
              </div>
            ))}
            {planResult.materialRequirement.length === 0 && (
              <div style={{ padding: '10px 16px', fontSize: 11, color: '#737373' }}>Chưa có dòng NVL nào — kế hoạch trống.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
