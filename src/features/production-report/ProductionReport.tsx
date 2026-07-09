// M12.9c — màn hình báo cáo Giá Thành & Bảng Giá theo dòng SX (tab `ong`/`pk`,
// vai admin/pricing), theo bố cục prototype Pha 1 (thẻ chi phí + thang giá +
// CVP + bảng giá theo SKU) NHƯNG chỉ dùng field ĐÃ CÓ trong ScenarioOutput —
// KHÔNG gọi lại engine cost breakdown (`calculatePipe/FittingCostAtNormalCapacity`)
// vì hàm đó không xuất field trung gian (compoundLandedPerKg/materialCostPerKg/
// processingCostPerKg riêng) ra ScenarioOutput (schema đã đóng băng); tự gọi lại
// wiring nội bộ của `calculateScenario()` ở client sẽ trùng lặp/rủi ro trôi
// logic (client không lắp lại công thức engine — luật PROJECT_SPEC §3). Thay
// bằng "thẻ chi phí" 2 mảng dùng ĐÚNG số đã tổng hợp sẵn trong thang giá 5 bậc:
// sàn biến phí (tier 1, ≈ vật liệu+bao bì) và giá thành đầy đủ (tier 3) — 2 số
// này LÀ output thật của engine, không suy diễn thêm. Nếu cần breakdown chi
// tiết hơn (vật liệu/gia công/bao bì tách riêng) phải export thêm field vào
// ScenarioOutput — đổi schema đóng băng, cần ADR, để dành quyết định cho phiên
// sau nếu user cần đúng bố cục prototype.
import { useMemo, useState } from 'react';
import { fmtVnd } from '../../lib/format.js';
import type { AppRole } from '../../lib/firebase.js';
import type { ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';

type Line = 'pipe' | 'fitting';

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
      <div style={{ width: 3, height: 14, background: '#a8003b', borderRadius: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, color: '#a8003b' }}>{title}</div>
      {note && <div style={{ fontSize: 9, color: '#737373', marginLeft: 4 }}>{note}</div>}
    </div>
  );
}
function Card({ label, value, note, accent }: { label: string; value: string; note?: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? '#a8003b' : '#fff', border: accent ? 'none' : '1px solid #d8d8d8', padding: 13, borderRadius: 2 }}>
      <div style={{ fontSize: 9, color: accent ? 'rgba(255,255,255,.65)' : '#737373', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: accent ? '#fff' : '#1a1a1a' }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: accent ? 'rgba(255,255,255,.65)' : '#737373', marginTop: 2 }}>{note}</div>}
    </div>
  );
}
function LadderCard({ ladder }: { ladder: ScenarioOutput['priceLadder']['byLineMaterial'][number]['ladder'] }) {
  const rows: Array<[string, number, string]> = [
    ['Sàn biến phí', ladder.variableCostFloor, '#DC2626'],
    ['Hòa vốn tiền mặt', ladder.cashBreakEven, '#ea580c'],
    ['Giá thành đầy đủ', ladder.breakEvenFullCost, '#d97706'],
    ['Hòa vốn toàn DN', ladder.enterpriseBreakEven, '#2563eb'],
    ['Giá mục tiêu VF', ladder.targetPrice, '#16A34A'],
  ];
  return (
    <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, padding: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 10 }}>Thang giá tham chiếu (đ/kg)</div>
      {rows.map(([label, v, color], i) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < rows.length - 1 ? '1px solid #f5f5f5' : undefined }}>
          <span style={{ fontSize: 11, color: '#737373' }}>{label}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(v)} đ/kg</span>
        </div>
      ))}
    </div>
  );
}
function CvpCard({ cvp, capacityLabel }: { cvp: ScenarioOutput['cvp']['byLineMaterial'][number]; capacityLabel: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, padding: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 10 }}>CVP — Hòa vốn</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
        <span style={{ fontSize: 11, color: '#737373' }}>Lãi biên/kg (contribution margin)</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>+{fmtVnd(cvp.contributionMarginPerKg)} đ</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
        <span style={{ fontSize: 11, color: '#737373' }}>Định phí/năm</span>
        <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(cvp.fixedCostPerYear)} đ</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
        <span style={{ fontSize: 11, color: '#737373' }}>SL hòa vốn CVP</span>
        <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(cvp.breakEvenKgYear)} kg/năm</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
        <span style={{ fontSize: 11, color: '#737373' }}>{capacityLabel}</span>
        <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {(cvp.line === 'pipe' ? cvp.pctOfNormalCapacity : cvp.pctOfUtilizedHours) !== undefined
            ? `${((cvp.line === 'pipe' ? cvp.pctOfNormalCapacity : cvp.pctOfUtilizedHours) * 100).toFixed(1)}%`
            : '—'}
        </span>
      </div>
    </div>
  );
}
function MaterialPicker({ materials, selectedId, onSelect }: { materials: ScenarioInput['materials']; selectedId: string; onSelect: (id: string) => void }) {
  if (materials.length <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      {materials.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          style={{ padding: '4px 12px', cursor: 'pointer', border: `1px solid ${m.id === selectedId ? '#a8003b' : '#d8d8d8'}`, background: m.id === selectedId ? '#a8003b' : '#fff', color: m.id === selectedId ? '#fff' : '#555', borderRadius: 12, fontSize: 10, fontWeight: 600 }}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
}

export default function ProductionReport({
  role,
  line,
  scenario,
  internal,
}: {
  role: AppRole;
  line: Line;
  scenario: ScenarioInput | null;
  internal: ScenarioOutput | null;
}) {
  const canView = role === 'admin' || role === 'pricing';
  const [search, setSearch] = useState('');
  const materials = useMemo(
    () => (scenario ? scenario.materials.filter((m) => scenario.products.some((p) => p.kind === line && p.materialId === m.id)) : []),
    [scenario, line],
  );
  const [materialId, setMaterialId] = useState<string | null>(null);
  const activeMaterialId = materialId ?? materials[0]?.id ?? null;

  if (!canView) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>{line === 'pipe' ? 'Ống CPVC' : 'Phụ Kiện'}</h1>
        <p style={{ fontSize: 12, color: '#737373' }}>Màn hình này chỉ dành cho vai Toàn Quyền / Định Giá.</p>
      </div>
    );
  }
  if (!scenario || !internal) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải kịch bản + kết quả tính…</div>;
  }

  const ladderEntry = internal.priceLadder.byLineMaterial.find((e) => e.line === line && e.materialId === activeMaterialId);
  const cvpEntry = internal.cvp.byLineMaterial.find((e) => e.line === line && e.materialId === activeMaterialId);
  const skus = internal.skuPriceChains.filter((s) => (line === 'pipe' ? s.productKey.dn !== undefined : s.productKey.productName !== undefined) && s.productKey.materialId === activeMaterialId);
  const filteredSkus = skus.filter((s) => {
    if (!search.trim()) return true;
    const label = line === 'pipe' ? s.productKey.dn! : `${s.productKey.productName} ${s.productKey.sizeLabel}`;
    return label.toLowerCase().includes(search.trim().toLowerCase());
  });

  const capacityFmt =
    line === 'pipe'
      ? `${fmtVnd(internal.capacity.pipe.normalCapacityKgYear)} kg/năm · ${internal.capacity.pipe.batchesPerYear} đợt/năm`
      : `${fmtVnd(internal.capacity.fitting.normalMachineHoursUtilized)} giờ máy/năm · MHR ${fmtVnd(internal.mhrPerMachineHour)} đ/giờ`;

  const barMax = ladderEntry?.ladder.breakEvenFullCost ?? 1;
  const floorPct = ladderEntry ? Math.round((ladderEntry.ladder.variableCostFloor / barMax) * 1000) / 10 : 0;
  const gcPct = ladderEntry ? Math.max(0, 100 - floorPct) : 0;

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>
          {line === 'pipe' ? 'Ống CPVC · SDR 13.5 · Đùn liên tục' : 'Phụ Kiện · Ép phun · ADR-001: cost driver = giờ máy'}
        </div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>
          {line === 'pipe' ? 'Giá Thành & Bảng Giá Ống' : 'Giá Thành & Bảng Giá Phụ Kiện'}
        </h1>
        <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>CS bình thường: {capacityFmt}</div>
      </div>

      <MaterialPicker materials={materials} selectedId={activeMaterialId ?? ''} onSelect={setMaterialId} />

      {ladderEntry && cvpEntry ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11, marginBottom: 16 }}>
            <Card label="Sàn biến phí (vật liệu + bao bì)" value={`${fmtVnd(ladderEntry.ladder.variableCostFloor)} đ`} note="đ/kg · tier 1 thang giá" />
            <Card label="Chênh lệch gia công + phân bổ chung" value={`${fmtVnd(ladderEntry.ladder.breakEvenFullCost - ladderEntry.ladder.variableCostFloor)} đ`} note="đ/kg · tier3 − tier1" />
            <Card label="Giá thành đầy đủ" value={`${fmtVnd(ladderEntry.ladder.breakEvenFullCost)} đ`} note="đ/kg · CS bình thường" accent />
          </div>

          <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, padding: 15, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 9 }}>Cơ cấu giá thành/kg — tại CS bình thường</div>
            <div style={{ display: 'flex', height: 26, borderRadius: 2, overflow: 'hidden', marginBottom: 7 }}>
              <div style={{ width: `${floorPct}%`, background: '#a8003b', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>Vật liệu+bao bì {floorPct}%</span>
              </div>
              <div style={{ flex: 1, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 9 }}>GC + chung {gcPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <LadderCard ladder={ladderEntry.ladder} />
            <CvpCard cvp={cvpEntry} capacityLabel={line === 'pipe' ? '% công suất bình thường' : '% giờ máy huy động'} />
          </div>
        </>
      ) : (
        <div style={{ padding: '14px 16px', background: '#f5f5f3', border: '1px dashed #d8d8d8', borderRadius: 2, fontSize: 10, color: '#737373', marginBottom: 20 }}>
          Chưa có dữ liệu thang giá/CVP cho nguyên liệu đang chọn.
        </div>
      )}

      <SectionHeader title={line === 'pipe' ? 'Bảng giá theo DN' : `Bảng giá theo SKU (${skus.length} dòng)`} />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={line === 'pipe' ? 'Tìm theo DN…' : 'Tìm theo tên/kích cỡ…'}
        style={{ width: 260, padding: '7px 10px', border: '1px solid #d8d8d8', borderRadius: 2, fontSize: 11, outline: 'none', marginBottom: 10, background: '#fff' }}
      />
      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 110px 110px', padding: '9px 16px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', gap: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textTransform: 'uppercase' }}>{line === 'pipe' ? 'DN' : 'Sản phẩm / Kích cỡ'}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#DC2626', textAlign: 'right', textTransform: 'uppercase' }}>Giá thành</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#2563eb', textAlign: 'right', textTransform: 'uppercase' }}>Giá VF</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textAlign: 'right', textTransform: 'uppercase' }}>Giá TCG</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textAlign: 'right', textTransform: 'uppercase' }}>Niêm yết</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textAlign: 'right', textTransform: 'uppercase' }}>Có VAT</div>
        </div>
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          {filteredSkus.map((s) => {
            const label = line === 'pipe' ? s.productKey.dn! : `${s.productKey.productName} ${s.productKey.sizeLabel}`;
            return (
              <div key={`${label}|${s.productKey.materialId}`} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 110px 110px', padding: '9px 16px', borderBottom: '1px solid #f2f2f2', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {label}
                  {s.managementStatus === 'pending_mold' && <span style={{ marginLeft: 6, fontSize: 8, color: '#DC2626', border: '1px solid #DC2626', borderRadius: 2, padding: '1px 4px' }}>CHƯA KHUÔN</span>}
                </div>
                <div style={{ fontSize: 11, color: '#DC2626', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(s.chain.breakEvenPerUnit)}</div>
                <div style={{ fontSize: 11, color: '#2563eb', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(s.chain.vfPricePerUnit)}</div>
                <div style={{ fontSize: 11, color: '#1a1a1a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(s.chain.tcgPricePerUnit)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(s.chain.listPriceBeforeVat)}</div>
                <div style={{ fontSize: 11, color: '#737373', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(s.chain.listPriceWithVat)}</div>
              </div>
            );
          })}
          {filteredSkus.length === 0 && <div style={{ padding: '14px 16px', fontSize: 11, color: '#737373' }}>Không có dòng nào khớp tìm kiếm.</div>}
        </div>
      </div>
    </div>
  );
}
