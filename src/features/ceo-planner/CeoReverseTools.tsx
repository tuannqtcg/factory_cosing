// A/B (2026-07-22) — CÔNG CỤ "CÂU HỎI NGƯỢC" cho Trợ Lý CEO: đi từ MỤC TIÊU về
// NGUỒN LỰC, bổ trợ luồng xuôi (giá → hiệu quả) của CeoPlannerScreen.
// - A1 Target costing (T3): giá thị trường 1 SKU → giá compound TỐI ĐA được phép
//   (bisection trên calculateScenario — computeTargetPriceForScenario, ADR-013).
// - A2 Lợi nhuận mục tiêu (T2): LN mong muốn/năm 1 dòng → sản lượng + số ca cần
//   (dạng đóng forward-CVP — computeTargetProfitForScenario).
// - B  Sản lượng mục tiêu → số máy cần + CAPEX + hồi vốn (ADR-042 chế độ 2).
// Mọi kết quả LUÔN forward-verify (luật #4 skill inverse-solver): số hiển thị
// đọc từ output chiều xuôi, không phải con số solver trơ.
// ADR-033 roll-out: trình bày qua design tokens (đen–trắng tối giản); accent
// teal cũ (#0e7490) thay bằng đen (tk.brand) — màu chỉ giữ cho tín hiệu tốt/xấu.
import { useMemo, useState } from 'react';
import type { ScenarioInput } from '../../schemas/scenario.js';
import type { PipeProduct, FittingProduct } from '../../schemas/product.js';
import { fmtVnd, fmtUsd } from '../../lib/format.js';
import { referenceMaterialOf } from '../../engine/scenario.js';
import { computeTargetProfitForScenario, computeTargetPriceForScenario } from '../../engine/target-costing.js';
import { planCapacityForTargetVolume, type CapacityPlanResult } from '../../engine/capacity-planning.js';
import { Card, tk, sp, ft, rd, tnum } from '../../design/primitives.js';
import { eyebrowStyle } from '../../design/tokens.js';

const fmtTy = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(v / 1e9) + ' tỷ đ';
const fmt1 = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v);

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.md, fontSize: ft.size.md, textAlign: 'right', ...tnum, color: tk.ink };
const selStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.md, fontSize: ft.size.sm, fontWeight: ft.weight.semibold, background: tk.surface, color: tk.ink };
const runBtn: React.CSSProperties = { padding: '10px 18px', background: tk.brand, color: tk.inkInverse, border: 'none', borderRadius: rd.md, fontSize: ft.size.sm, fontWeight: ft.weight.bold, cursor: 'pointer' };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div style={{ fontSize: ft.size.xs, fontWeight: ft.weight.semibold, marginBottom: 4, color: tk.ink }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function Stat({ k, v, strong, color }: { k: string; v: string; strong?: boolean; color?: string }) {
  return (
    <Card pad={12} style={{ background: tk.surfaceMuted }}>
      <div style={{ fontSize: ft.size.eyebrow, color: tk.inkMuted }}>{k}</div>
      <div style={{ fontSize: strong ? ft.size.xxl : ft.size.lg, fontWeight: ft.weight.bold, ...tnum, color: color ?? tk.ink }}>{v}</div>
    </Card>
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
    <Card style={{ marginTop: sp[5] }}>
      <div style={{ ...eyebrowStyle, color: tk.inkMuted }}>Câu hỏi ngược — từ mục tiêu về nguồn lực</div>
      <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, margin: '4px 0 14px' }}>Goal-seek trên chính engine (giải ngược bằng bisection/CVP, không công thức tay). Kết quả đã kiểm chứng chiều xuôi.</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map((t) => (
          <button key={t.v} onClick={() => setTool(t.v)} style={{ padding: '7px 12px', border: `1px solid ${tool === t.v ? tk.brand : tk.borderStrong}`, background: tool === t.v ? tk.brand : tk.surface, color: tool === t.v ? tk.inkInverse : tk.inkMuted, borderRadius: rd.md, fontSize: ft.size.xs, fontWeight: ft.weight.bold, cursor: 'pointer' }}>{t.label}</button>
        ))}
      </div>
      {tool === 'target-cost' && <TargetCostTool scenario={scenario} />}
      {tool === 'target-profit' && <TargetProfitTool scenario={scenario} />}
      {tool === 'target-volume' && <TargetVolumeTool scenario={scenario} />}
    </Card>
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
      <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, marginBottom: 12 }}>Thị trường chỉ chấp nhận giá niêm yết X đ/{line === 'pipe' ? 'm' : 'cái'} — vậy giá mua compound (USD/kg) <b>tối đa</b> được phép là bao nhiêu để vẫn giữ được cấu trúc giá? (target costing)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 180px auto', gap: 12, alignItems: 'end' }}>
        <Field label="Dòng"><select style={selStyle} value={line} onChange={(e) => { setLine(e.target.value as 'pipe' | 'fitting'); setSkuKey(''); setOut(null); }}><option value="pipe">Ống CPVC</option><option value="fitting">Phụ kiện</option></select></Field>
        <Field label="Sản phẩm (SKU)"><select style={selStyle} value={sku?.key ?? ''} onChange={(e) => setSkuKey(e.target.value)}>{skus.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></Field>
        <Field label={`Giá niêm yết mục tiêu (${unit})`}><input style={inputStyle} value={priceStr} placeholder="vd 260000" onChange={(e) => setPriceStr(e.target.value)} /></Field>
        <button onClick={run} style={runBtn}>Giải ngược →</button>
      </div>
      {err && <div style={{ marginTop: 10, color: tk.dangerInk, fontSize: ft.size.sm }}>{err}</div>}
      {out && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginTop: 14 }}>
          <Stat k={`Giá compound tối đa cho phép`} v={`${fmtUsd(out.maxUsd)} USD/kg`} strong color={tk.ink} />
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
      <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, marginBottom: 12 }}>Muốn lãi trước thuế X tỷ/năm từ 1 dòng — cần bán bao nhiêu kg và chạy mấy ca? (T2 forward-CVP: Q = (định phí + LN mục tiêu) ÷ biên đóng góp)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 200px auto', gap: 12, alignItems: 'end' }}>
        <Field label="Dòng"><select style={selStyle} value={line} onChange={(e) => { setLine(e.target.value as 'pipe' | 'fitting'); setOut(null); }}><option value="pipe">Ống CPVC</option><option value="fitting">Phụ kiện</option></select></Field>
        <Field label="Lợi nhuận trước thuế mục tiêu (tỷ đ/năm)"><input style={inputStyle} value={profitTyStr} placeholder="vd 20" onChange={(e) => setProfitTyStr(e.target.value)} /></Field>
        <button onClick={run} style={runBtn}>Giải ngược →</button>
      </div>
      {err && <div style={{ marginTop: 10, color: tk.dangerInk, fontSize: ft.size.sm }}>{err}</div>}
      {out && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 14 }}>
          <Stat k="Sản lượng cần bán/năm" v={`${fmtVnd(out.qty)} kg`} strong />
          <Stat k="Số ca cần chạy" v={`${fmt1(out.shifts)} ca`} color={out.feasible ? tk.successInk : tk.dangerInk} />
          <Stat k="Khả thi trong 3 ca?" v={out.feasible ? '✅ Có' : '⛔ Vượt trần — cần thêm máy'} color={out.feasible ? tk.successInk : tk.dangerInk} />
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
    <tr style={{ borderTop: `1px solid ${tk.surfaceMuted}` }}>
      <td style={{ padding: '8px 6px', fontWeight: ft.weight.semibold, color: tk.ink }}>{label}</td>
      <td style={{ padding: '8px 6px', textAlign: 'right', ...tnum }}>{fmtVnd(p.currentNormalKgYear)}</td>
      <td style={{ padding: '8px 6px', textAlign: 'right', ...tnum }}>{fmtVnd(p.perMachineCeiling3ShiftKgYear)}</td>
      <td style={{ padding: '8px 6px', textAlign: 'right', ...tnum }}>{p.currentMachines} → <b>{p.machinesNeeded}</b></td>
      <td style={{ padding: '8px 6px', textAlign: 'right', ...tnum, color: p.extraMachines > 0 ? tk.dangerInk : tk.successInk, fontWeight: ft.weight.bold }}>{p.extraMachines > 0 ? `+${p.extraMachines}` : '0'}</td>
      <td style={{ padding: '8px 6px', textAlign: 'right', ...tnum }}>{p.capexVnd > 0 ? fmtTy(p.capexVnd) : '—'}</td>
    </tr>
  );

  return (
    <div>
      <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, marginBottom: 12 }}>Nhập sản lượng mong muốn/năm cho từng dòng — nếu vượt trần 3 ca của số máy hiện có, tính số máy cần mua thêm + vốn đầu tư + thời gian hồi vốn (ước tính theo biên đóng góp hiện tại).</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
        <Field label="Mục tiêu sản lượng Ống (kg/năm)"><input style={inputStyle} value={pipeStr} placeholder="vd 3000000" onChange={(e) => setPipeStr(e.target.value)} /></Field>
        <Field label="Mục tiêu sản lượng Phụ kiện (kg/năm)"><input style={inputStyle} value={fitStr} placeholder="vd 300000" onChange={(e) => setFitStr(e.target.value)} /></Field>
        <button onClick={run} style={runBtn}>Tính số máy →</button>
      </div>
      {err && <div style={{ marginTop: 10, color: tk.dangerInk, fontSize: ft.size.sm }}>{err}</div>}
      {plan && (
        <div style={{ marginTop: 14 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: ft.size.sm, minWidth: 640 }}>
              <thead><tr style={{ textAlign: 'left', color: tk.inkMuted, fontSize: ft.size.eyebrow }}>
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
            <Stat k="Tổng vốn đầu tư thêm" v={plan.totalCapexVnd > 0 ? fmtTy(plan.totalCapexVnd) : 'Không cần'} strong color={plan.totalCapexVnd > 0 ? tk.dangerInk : tk.successInk} />
            <Stat k="Lợi nhuận tăng thêm/năm (ước tính)" v={fmtTy(plan.incrementalAnnualContributionVnd)} />
            <Stat k="Thời gian hồi vốn" v={plan.paybackYears === null ? '—' : `${fmt1(plan.paybackYears)} năm`} color={plan.paybackYears !== null && plan.paybackYears <= 3 ? tk.successInk : tk.warningInk} />
          </div>
          <div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint, marginTop: 8 }}>Trần per-máy dùng công suất thiết kế 3 ca (Ống: 1 đầu đùn; Phụ kiện: 1 máy ép × huy động × năng suất mix). Hồi vốn = CAPEX ÷ (sản lượng vượt hiện tại × biên đóng góp/kg) — ước tính, chưa gồm định phí tăng thêm khi mở rộng.</div>
        </div>
      )}
    </div>
  );
}
