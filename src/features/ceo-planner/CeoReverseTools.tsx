// A/B (2026-07-22) — CÔNG CỤ "CÂU HỎI NGƯỢC" cho Trợ Lý CEO: đi từ MỤC TIÊU về
// NGUỒN LỰC, bổ trợ luồng xuôi (giá → hiệu quả) của CeoPlannerScreen.
// - A1 Target costing (T3): giá thị trường 1 SKU → giá compound TỐI ĐA được phép
//   (bisection trên calculateScenario — computeTargetPriceForScenario, ADR-013).
// - A2 Lợi nhuận mục tiêu (T2): LN mong muốn/năm 1 dòng → sản lượng + số ca cần
//   (dạng đóng forward-CVP — computeTargetProfitForScenario).
// - B  Sản lượng mục tiêu → số máy cần + CAPEX + hồi vốn (ADR-042 chế độ 2).
// Mọi kết quả LUÔN forward-verify (luật #4 skill inverse-solver): số hiển thị
// đọc từ output chiều xuôi, không phải con số solver trơ.
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import type { PipeProduct, FittingProduct } from '../../schemas/product.js';
import { fmtVnd, fmtUsd } from '../../lib/format.js';
import { referenceMaterialOf } from '../../engine/scenario.js';
import { computeTargetProfitForScenario, computeTargetPriceForScenario } from '../../engine/target-costing.js';
import { planCapacityForTargetVolume, type CapacityPlanResult } from '../../engine/capacity-planning.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e9) + ' tỷ đ';
const fmt1 = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v);

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d8d8d8', borderRadius: 6, fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const selStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #d8d8d8', borderRadius: 6, fontSize: 13, fontWeight: 600, background: '#fff' };
const runBtn: React.CSSProperties = { padding: '10px 18px', background: '#0e7490', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 9, color: '#737373', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function Stat({ k, v, strong, color }: { k: string; v: string; strong?: boolean; color?: string }) {
  return (
    <div style={{ background: '#f8fafb', border: '1px solid #e5eaee', borderRadius: 6, padding: 12 }}>
      <div style={{ fontSize: 9, color: '#737373' }}>{k}</div>
      <div style={{ fontSize: strong ? 20 : 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: color ?? '#0e2a36' }}>{v}</div>
    </div>
  );
}

type Tool = 'target-cost' | 'target-profit' | 'target-volume';

export default function CeoReverseTools({ scenario }: { scenario: ScenarioInput }) {
  const [tool, setTool] = useState<Tool>('target-cost');
  const tabs: { v: Tool; label: string }[] = [
    { v: 'target-cost', label: '① Giá thị trường → giá compound tối đa' },
    { v: 'target-profit', label: '② Lợi nhuận mục tiêu → sản lượng + ca' },
    { v: 'target-volume', label: '③ Sản lượng mục tiêu → số máy cần' },
  ];
  return (
    <div style={{ background: '#fff', border: '1px solid #d0e2e8', borderRadius: 8, padding: 18, marginTop: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#0e7490', textTransform: 'uppercase' }}>Câu hỏi ngược — từ mục tiêu về nguồn lực</div>
      <div style={{ fontSize: 12, color: '#737373', margin: '4px 0 14px' }}>Goal-seek trên chính engine (giải ngược bằng bisection/CVP, không công thức tay). Kết quả đã kiểm chứng chiều xuôi.</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map((t) => (
          <button key={t.v} onClick={() => setTool(t.v)} style={{ padding: '7px 12px', border: '1px solid ' + (tool === t.v ? '#0e7490' : '#d8d8d8'), background: tool === t.v ? '#0e7490' : '#fff', color: tool === t.v ? '#fff' : '#555', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{t.label}</button>
        ))}
      </div>
      {tool === 'target-cost' && <TargetCostTool scenario={scenario} />}
      {tool === 'target-profit' && <TargetProfitTool scenario={scenario} />}
      {tool === 'target-volume' && <TargetVolumeTool scenario={scenario} />}
    </div>
  );
}

// ── ① Target costing: giá niêm yết mục tiêu 1 SKU → giá compound tối đa ──
function TargetCostTool({ scenario }: { scenario: ScenarioInput }) {
  const [line, setLine] = useState<'pipe' | 'fitting'>('pipe');
  const [skuKey, setSkuKey] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [out, setOut] = useState<{ maxUsd: number; achievedListVnd: number; unit: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const skus = useMemo(() => {
    if (line === 'pipe')
      return (scenario.products.filter((p): p is PipeProduct => p.kind === 'pipe')).map((p) => ({ key: p.dn, label: `DN ${p.dn}`, dn: p.dn }));
    return (scenario.products.filter((p): p is FittingProduct => p.kind === 'fitting')).map((p) => ({ key: `${p.productName}||${p.sizeLabel}`, label: `${p.productName} · ${p.sizeLabel}`, productName: p.productName, sizeLabel: p.sizeLabel }));
  }, [scenario, line]);
  const sku = skus.find((s) => s.key === skuKey) ?? skus[0];
  const unit = line === 'pipe' ? 'đ/m' : 'đ/cái';

  const run = () => {
    setErr(null); setOut(null);
    if (!sku) { setErr('Chưa chọn SKU'); return; }
    const target = parseFloat(priceStr);
    if (!Number.isFinite(target) || target <= 0) { setErr('Nhập giá niêm yết mục tiêu (>0)'); return; }
    const refMat = referenceMaterialOf(scenario.materials, scenario.products, line);
    if (!refMat) { setErr('Dòng chưa có nguyên liệu tham chiếu'); return; }
    const matIdx = scenario.materials.findIndex((m) => m.id === refMat.id);
    try {
      const res = computeTargetPriceForScenario(scenario, {
        scenarioId: scenario.id,
        productLine: line,
        targetListPriceVnd: Math.round(target),
        freeVarPath: `materials.${matIdx}.inventory.replacementPriceUsdPerKg`,
        isPenetrationPrice: false,
        productKey: line === 'pipe' ? { dn: (sku as { dn: string }).dn } : { productName: (sku as { productName: string }).productName, sizeLabel: (sku as { sizeLabel: string }).sizeLabel },
      });
      if (!res.feasible) { setErr(`Không khả thi: mục tiêu ngoài khoảng đạt được [${fmtVnd(res.achievableRange[0])}, ${fmtVnd(res.achievableRange[1])}] ${unit}. Có thể đã thủng sàn biến phí hoặc vượt trần dò giá.`); return; }
      const chain = res.forwardOutput.skuPriceChains.find((s) => (line === 'pipe' ? s.productKey.dn === (sku as { dn: string }).dn : s.productKey.productName === (sku as { productName: string }).productName && s.productKey.sizeLabel === (sku as { sizeLabel: string }).sizeLabel));
      setOut({ maxUsd: res.value, achievedListVnd: chain?.chain.listPriceBeforeVat ?? target, unit });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>Thị trường chỉ chấp nhận giá niêm yết X đ/{line === 'pipe' ? 'm' : 'cái'} — vậy giá mua compound (USD/kg) <b>tối đa</b> được phép là bao nhiêu để vẫn giữ được cấu trúc giá? (target costing)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 180px auto', gap: 12, alignItems: 'end' }}>
        <Field label="Dòng"><select style={selStyle} value={line} onChange={(e) => { setLine(e.target.value as 'pipe' | 'fitting'); setSkuKey(''); setOut(null); }}><option value="pipe">Ống CPVC</option><option value="fitting">Phụ kiện</option></select></Field>
        <Field label="Sản phẩm (SKU)"><select style={selStyle} value={sku?.key ?? ''} onChange={(e) => setSkuKey(e.target.value)}>{skus.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></Field>
        <Field label={`Giá niêm yết mục tiêu (${unit})`}><input style={inputStyle} value={priceStr} placeholder="vd 260000" onChange={(e) => setPriceStr(e.target.value)} /></Field>
        <button onClick={run} style={runBtn}>Giải ngược →</button>
      </div>
      {err && <div style={{ marginTop: 10, color: '#DC2626', fontSize: 12 }}>{err}</div>}
      {out && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginTop: 14 }}>
          <Stat k={`Giá compound tối đa cho phép`} v={`${fmtUsd(out.maxUsd)} USD/kg`} strong color="#0e7490" />
          <Stat k="Kiểm chứng: giá niêm yết đạt được" v={`${fmtVnd(out.achievedListVnd)} ${out.unit}`} />
        </div>
      )}
    </div>
  );
}

// ── ② Lợi nhuận mục tiêu → sản lượng + số ca cần ──
function TargetProfitTool({ scenario }: { scenario: ScenarioInput }) {
  const [line, setLine] = useState<'pipe' | 'fitting'>('pipe');
  const [profitTyStr, setProfitTyStr] = useState('');
  const [out, setOut] = useState<{ qty: number; shifts: number; feasible: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    setErr(null); setOut(null);
    const ty = parseFloat(profitTyStr);
    if (!Number.isFinite(ty)) { setErr('Nhập lợi nhuận mục tiêu (tỷ đ)'); return; }
    try {
      const res = computeTargetProfitForScenario(scenario, { scenarioId: scenario.id, productLine: line, targetProfitVnd: Math.round(ty * 1e9) });
      setOut({ qty: res.requiredQtyKgOrMachineHours, shifts: res.requiredShifts, feasible: res.feasibleWithinNormalCapacity });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>Muốn lãi trước thuế X tỷ/năm từ 1 dòng — cần bán bao nhiêu kg và chạy mấy ca? (T2 forward-CVP: Q = (định phí + LN mục tiêu) ÷ biên đóng góp)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 200px auto', gap: 12, alignItems: 'end' }}>
        <Field label="Dòng"><select style={selStyle} value={line} onChange={(e) => { setLine(e.target.value as 'pipe' | 'fitting'); setOut(null); }}><option value="pipe">Ống CPVC</option><option value="fitting">Phụ kiện</option></select></Field>
        <Field label="Lợi nhuận trước thuế mục tiêu (tỷ đ/năm)"><input style={inputStyle} value={profitTyStr} placeholder="vd 20" onChange={(e) => setProfitTyStr(e.target.value)} /></Field>
        <button onClick={run} style={runBtn}>Giải ngược →</button>
      </div>
      {err && <div style={{ marginTop: 10, color: '#DC2626', fontSize: 12 }}>{err}</div>}
      {out && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 14 }}>
          <Stat k="Sản lượng cần bán/năm" v={`${fmtVnd(out.qty)} kg`} strong />
          <Stat k="Số ca cần chạy" v={`${fmt1(out.shifts)} ca`} color={out.feasible ? '#16A34A' : '#DC2626'} />
          <Stat k="Khả thi trong 3 ca?" v={out.feasible ? '✅ Có' : '⛔ Vượt trần — cần thêm máy'} color={out.feasible ? '#16A34A' : '#DC2626'} />
        </div>
      )}
    </div>
  );
}

// ── ③ Sản lượng mục tiêu → số máy cần + CAPEX + hồi vốn (ADR-042 chế độ 2) ──
function TargetVolumeTool({ scenario }: { scenario: ScenarioInput }) {
  const [pipeStr, setPipeStr] = useState('');
  const [fitStr, setFitStr] = useState('');
  const [plan, setPlan] = useState<CapacityPlanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    setErr(null); setPlan(null);
    const pipeT = parseFloat(pipeStr) || 0;
    const fitT = parseFloat(fitStr) || 0;
    if (pipeT <= 0 && fitT <= 0) { setErr('Nhập sản lượng mục tiêu ≥1 dòng (kg/năm)'); return; }
    try {
      setPlan(planCapacityForTargetVolume(scenario, { pipeTargetKgYear: pipeT, fittingTargetKgYear: fitT }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const row = (label: string, p: CapacityPlanResult['pipe']) => (
    <tr style={{ borderTop: '1px solid #eef0f3' }}>
      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{label}</td>
      <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(p.currentNormalKgYear)}</td>
      <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(p.perMachineCeiling3ShiftKgYear)}</td>
      <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.currentMachines} → <b>{p.machinesNeeded}</b></td>
      <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.extraMachines > 0 ? '#a8003b' : '#16A34A', fontWeight: 700 }}>{p.extraMachines > 0 ? `+${p.extraMachines}` : '0'}</td>
      <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.capexVnd > 0 ? fmtTy(p.capexVnd) : '—'}</td>
    </tr>
  );

  return (
    <div>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>Nhập sản lượng mong muốn/năm cho từng dòng — nếu vượt trần 3 ca của số máy hiện có, tính số máy cần mua thêm + vốn đầu tư + thời gian hồi vốn (ước tính theo biên đóng góp hiện tại).</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
        <Field label="Mục tiêu sản lượng Ống (kg/năm)"><input style={inputStyle} value={pipeStr} placeholder="vd 3000000" onChange={(e) => setPipeStr(e.target.value)} /></Field>
        <Field label="Mục tiêu sản lượng Phụ kiện (kg/năm)"><input style={inputStyle} value={fitStr} placeholder="vd 300000" onChange={(e) => setFitStr(e.target.value)} /></Field>
        <button onClick={run} style={runBtn}>Tính số máy →</button>
      </div>
      {err && <div style={{ marginTop: 10, color: '#DC2626', fontSize: 12 }}>{err}</div>}
      {plan && (
        <div style={{ marginTop: 14 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 640 }}>
              <thead><tr style={{ textAlign: 'left', color: '#737373', fontSize: 10 }}>
                <th style={{ padding: '4px 6px' }}>Dòng</th>
                <th style={{ padding: '4px 6px', textAlign: 'right' }}>SL hiện tại (kg)</th>
                <th style={{ padding: '4px 6px', textAlign: 'right' }}>Trần 3 ca/máy (kg)</th>
                <th style={{ padding: '4px 6px', textAlign: 'right' }}>Máy (nay→cần)</th>
                <th style={{ padding: '4px 6px', textAlign: 'right' }}>Thêm</th>
                <th style={{ padding: '4px 6px', textAlign: 'right' }}>CAPEX</th>
              </tr></thead>
              <tbody>
                {row('Ống (máy đùn)', plan.pipe)}
                {row('Phụ kiện (máy ép)', plan.fitting)}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 14 }}>
            <Stat k="Tổng vốn đầu tư thêm" v={plan.totalCapexVnd > 0 ? fmtTy(plan.totalCapexVnd) : 'Không cần'} strong color={plan.totalCapexVnd > 0 ? '#a8003b' : '#16A34A'} />
            <Stat k="Lợi nhuận tăng thêm/năm (ước tính)" v={fmtTy(plan.incrementalAnnualContributionVnd)} />
            <Stat k="Thời gian hồi vốn" v={plan.paybackYears === null ? '—' : `${fmt1(plan.paybackYears)} năm`} color={plan.paybackYears !== null && plan.paybackYears <= 3 ? '#16A34A' : '#b45309'} />
          </div>
          <div style={{ fontSize: 10, color: '#a3a3a3', marginTop: 8 }}>Trần per-máy dùng công suất thiết kế 3 ca (Ống: 1 đầu đùn; Phụ kiện: 1 máy ép × huy động × năng suất mix). Hồi vốn = CAPEX ÷ (sản lượng vượt hiện tại × biên đóng góp/kg) — ước tính, chưa gồm định phí tăng thêm khi mở rộng.</div>
        </div>
      )}
    </div>
  );
}
