// M12.6 + ADR-025 — màn hình Bảng Giá (tab `pricelist`). Niêm yết GIÁ VF (giá
// XUẤT XƯỞNG của nhà máy) = `chain.vfPricePerUnit`, KHÔNG phải giá list đã cộng
// markup nhà phân phối. Đây là tầng giá CEO thực sự chốt + cùng tầng với
// `targetPrice` màn Giá Vốn Theo Lô (ADR-024) → 2 màn nhất quán, khóa giá
// (ADR-004) áp trực tiếp. Bảng giá tới Nhà Phân Phối là bước DẪN XUẤT riêng
// (tab `distributor-pricelist`, DistributorPriceList.tsx).
// UI giữ nguyên prototype Pha 1: search theo tên/kích cỡ + toggle Trước VAT/Có
// VAT + hàng nút lọc loại SP + bảng cột (STT/Sản phẩm/Kích cỡ/…/Giá). Sales-safe:
// nguồn DUY NHẤT là `outputs/priceList` (PriceListDocSchema — không có field
// giá vốn nào để lộ; VF là GIÁ BÁN, không phải giá vốn).
//
// Khác prototype (2 chỗ, đều là prototype mock sai so với nguồn chân lý):
// - 8 SKU chưa có khuôn ẨN bằng `managementStatus === 'pending_mold'` tính từ
//   moldAssets (ADR-007) — KHÔNG hard-code danh sách EXCLUDED_SKUS.
// - Không có dòng "Dung môi 550": PriceList Excel (99 dòng, nguồn chân lý)
//   không có; solvent550PricePerBox là vật tư phụ dùng chung trong CostPool
//   (cost-pool.md), không phải SKU thương mại.
import { useMemo, useState } from 'react';
import { fmtVnd, fmtPct } from '../../lib/format.js';
import type { PriceListDoc, ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';

const PIPE_LABEL = 'Ống CPVC';
// Prototype đóng băng: 8 nút loại chính + Tất cả + Khác.
const MAIN_CATEGORIES = [PIPE_LABEL, 'Tê đều', 'Tê giảm', 'Cút 90°', 'Cút 45°', 'Nối thẳng', 'Nối giảm', 'Lơ thu'];
const CAT_LIST = ['all', ...MAIN_CATEGORIES, 'khác'] as const;

interface Row {
  stt: number;
  key: string;
  name: string;
  size: string;
  spec: string;
  unit: string;
  designationCode: string;
  classificationCode: string;
  priceBeforeVat: number;
  priceWithVat: number;
  materialId: string;
  // Bản sales-safe (chỉ giá bán); các bậc GIÁ VỐN tra từ `internal` lúc mở dòng.
  chain: PriceListDoc['skuPriceChains'][number]['chain'];
}

export default function PriceList({
  priceList,
  scenario = null,
  internal = null,
  onNavigate,
}: {
  priceList: PriceListDoc | null;
  scenario?: ScenarioInput | null;
  internal?: ScenarioOutput | null;
  onNavigate?: (tab: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priceType, setPriceType] = useState<'before' | 'vat'>('before');
  const [productFilter, setProductFilter] = useState<string>('all');
  // ADR-035 — bấm vào dòng để mở "Giá này từ đâu ra?": truy nguyên từng bậc giá
  // của đúng SKU đó, số lấy từ chuỗi giá đã lưu, không tính lại ở client.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // ADR-025 §nối 2 màn — TÍN HIỆU QUYẾT ĐỊNH GIÁ cho CEO (KHÔNG phải kiểm tra tồn
  // kho): nguyên liệu nào có giá thị trường (tái tạo) lệch khỏi baseline đã khóa
  // quá ngưỡng → giá bán VF niêm yết có thể không còn phản ánh chi phí hiện tại →
  // nên cân nhắc chốt lại giá. Chi tiết + quyết định nằm ở màn "Giá Vốn Theo Lô".
  const staleMaterials = useMemo(() => {
    if (!internal || !scenario) return [];
    return internal.priceLock.byMaterial
      .filter((e) => !e.evaluation.isLocked)
      .map((e) => {
        const mat = scenario.materials.find((m) => m.id === e.materialId);
        return {
          name: mat?.name ?? e.materialId,
          deviationPct: e.evaluation.deviationPct,
          thresholdPct: mat?.inventory.priceLock.thresholdPct ?? 0,
        };
      });
  }, [internal, scenario]);

  // Dòng hiển thị: chỉ SKU active (pending_mold ẩn theo ADR-007/008), STT đánh
  // trên danh sách active ĐẦY ĐỦ (giữ nguyên khi search/filter — giống prototype).
  // VAT suy từ chuỗi list đã persist (listWithVat/listBeforeVat) — ADR-025 áp
  // đúng suất đó lên giá VF để ra bản "Có VAT" (giá VF chưa persist bản có VAT).
  const vatRate = useMemo(() => {
    const first = priceList?.skuPriceChains.find((s) => s.chain.listPriceBeforeVat > 0);
    return first ? first.chain.listPriceWithVat / first.chain.listPriceBeforeVat - 1 : 0.08;
  }, [priceList]);

  const rows = useMemo<Row[]>(() => {
    if (!priceList) return [];
    return priceList.skuPriceChains
      .filter((sku) => sku.managementStatus === 'active')
      .map((sku, i) => {
        const isPipe = sku.productKey.dn !== undefined;
        return {
          stt: i + 1,
          // ADR-012: (tên, size) có thể trùng giữa BlazeMaster/Corzan — key phải gồm materialId.
          key: `${sku.productKey.materialId}|${sku.productKey.dn ?? `${sku.productKey.productName}|${sku.productKey.sizeLabel}`}`,
          name: isPipe ? PIPE_LABEL : sku.productKey.productName!,
          size: isPipe ? sku.productKey.dn! : sku.productKey.sizeLabel!,
          spec: sku.spec,
          unit: sku.unit,
          designationCode: sku.materialDesignationCode || '—',
          classificationCode: sku.materialClassificationCode || '—',
          // ADR-025 — niêm yết GIÁ VF (xuất xưởng), không phải giá list nhà phân phối.
          priceBeforeVat: sku.chain.vfPricePerUnit,
          priceWithVat: Math.round(sku.chain.vfPricePerUnit * (1 + vatRate)),
          materialId: sku.productKey.materialId,
          chain: sku.chain,
        };
      });
  }, [priceList, vatRate]);

  const filteredRows = rows.filter((row) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || row.name.toLowerCase().includes(q) || row.size.toLowerCase().includes(q);
    const matchesFilter =
      productFilter === 'all' ||
      (productFilter === 'khác' ? !MAIN_CATEGORIES.includes(row.name) : row.name === productFilter);
    return matchesSearch && matchesFilter;
  });

  // Thuế suất VAT suy từ chính dữ liệu (sales không đọc được costPool) — chỉ để hiển thị nhãn.
  const vatPctLabel = Math.round(vatRate * 100);
  const colHeader = priceType === 'vat' ? `Giá VF có VAT (đ)` : 'Giá VF trước VAT (đ)';

  if (!priceList) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải bảng giá…</div>;
  }

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Bảng Giá Xuất Xưởng (VF)</div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>BlazeMaster CPVC — {rows.length} SKU</h1>
        <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>
          Giá bán xuất xưởng của nhà máy (VF) = giá thành đầy đủ + phần lời của nhà máy, giữ ổn định theo cơ chế khóa giá.
          Giá tới nhà phân phối là bước suy tiếp tự động — xem tab <b>Bảng giá NPP</b>. <b>Bấm vào từng dòng</b> để xem giá đó từ đâu ra.
        </div>
      </div>

      {/* ADR-025 — tín hiệu QUYẾT ĐỊNH GIÁ (không phải kiểm kho): giá vật liệu lệch
          quá ngưỡng → giá VF niêm yết có thể cũ → cân nhắc chốt lại. */}
      {internal && (
        staleMaterials.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14, padding: '11px 16px', borderRadius: 6, border: '1px solid #b45309', background: '#fffbeb', color: '#92400e' }}>
            <div style={{ flex: 1, minWidth: 280, fontSize: 12, fontWeight: 600 }}>
              ⚠ Chi phí vật liệu thị trường đã đổi:{' '}
              {staleMaterials.map((m, i) => (
                <span key={m.name}>{i > 0 ? ', ' : ''}{m.name} ({m.deviationPct >= 0 ? '+' : ''}{fmtPct(m.deviationPct)}, ngưỡng {fmtPct(m.thresholdPct)})</span>
              ))}
              . Giá bán VF đang niêm yết có thể không còn phản ánh chi phí hiện tại — cân nhắc <b>chốt lại giá</b>.
            </div>
            {onNavigate && (
              <button onClick={() => onNavigate('lot-costing')} style={{ flexShrink: 0, padding: '7px 14px', background: '#b45309', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Xem Giá Vốn Theo Lô →
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 14, padding: '9px 16px', borderRadius: 6, border: '1px solid #16A34A', background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
            ✅ Giá VF đang phản ánh đúng chi phí thị trường — mọi nguyên liệu còn trong ngưỡng, chưa cần điều chỉnh giá.
          </div>
        )
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11, gap: 12, flexWrap: 'wrap' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm theo tên, kích cỡ..."
          style={{ padding: '7px 12px', border: '1px solid #b3b3b3', borderRadius: 2, fontSize: 12, background: '#fff', outline: 'none', minWidth: 200, maxWidth: 260, width: '100%' }}
        />
        <div style={{ display: 'flex', border: '1px solid #b3b3b3', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
          {(
            [
              ['before', 'Trước VAT'],
              ['vat', `Có VAT (${vatPctLabel}%)`],
            ] as const
          ).map(([id, label]) => (
            <div
              key={id}
              onClick={() => setPriceType(id)}
              style={{ padding: '6px 14px', cursor: 'pointer', background: priceType === id ? '#a8003b' : '#fff', color: priceType === id ? '#fff' : '#1a1a1a', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', borderRight: '1px solid #d8d8d8' }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 11 }}>
        {CAT_LIST.map((c) => {
          const active = productFilter === c;
          return (
            <div
              key={c}
              onClick={() => setProductFilter(c)}
              style={{ padding: '4px 10px', cursor: 'pointer', border: `1px solid ${active ? '#a8003b' : '#b3b3b3'}`, background: active ? '#a8003b' : '#fff', color: active ? '#fff' : '#1a1a1a', borderRadius: 2, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}
            >
              {c === 'all' ? 'Tất cả' : c === 'khác' ? 'Khác' : c}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: '#737373', marginBottom: 9 }}>Hiển thị {filteredRows.length} sản phẩm</div>

      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1.5fr 70px 72px 100px 70px 52px 130px', padding: '9px 16px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', gap: 8 }}>
          {['STT', 'Sản phẩm', 'Kích cỡ', 'Quy cách', 'Mã định danh', 'Phân lớp', 'ĐVT'].map((h) => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#737373', textTransform: 'uppercase' }}>{h}</div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textAlign: 'right', textTransform: 'uppercase' }}>{colHeader}</div>
        </div>
        {filteredRows.map((row) => {
          const expanded = expandedKey === row.key;
          const mat = scenario?.materials.find((m) => m.id === row.materialId);
          const lock = internal?.priceLock.byMaterial.find((e) => e.materialId === row.materialId);
          // Các bậc giá vốn nằm ở bản đầy đủ trong `internal` (bản priceList là
          // sales-safe, cố ý không chứa giá vốn) — tra theo cùng khóa SKU.
          const full = internal?.skuPriceChains.find(
            (s) =>
              s.productKey.materialId === row.materialId &&
              (s.productKey.dn !== undefined
                ? s.productKey.dn === row.size
                : s.productKey.productName === row.name && s.productKey.sizeLabel === row.size),
          )?.chain;
          const markupImplied = full && full.breakEvenPerUnit > 0 ? full.vfPricePerUnit / full.breakEvenPerUnit - 1 : null;
          const priceStep = (label: string, value: string, note?: string, strong?: boolean) => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '6px 0', borderBottom: '1px dashed #ece8dc' }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: strong ? 700 : 500 }}>{label}</span>
                {note && <span style={{ fontSize: 10, color: '#999' }}> — {note}</span>}
              </div>
              <div style={{ fontSize: strong ? 14 : 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
            </div>
          );
          return (
            <div key={row.key}>
              <div
                onClick={() => setExpandedKey(expanded ? null : row.key)}
                style={{ display: 'grid', gridTemplateColumns: '36px 1.5fr 70px 72px 100px 70px 52px 130px', padding: '8px 16px', borderBottom: '1px solid #f5f5f5', gap: 8, alignItems: 'center', cursor: 'pointer', background: expanded ? '#faf9f4' : '#fff' }}
              >
                <div style={{ fontSize: 10, color: '#b3b3b3', fontVariantNumeric: 'tabular-nums' }}>{row.stt}</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{expanded ? '▾ ' : '▸ '}{row.name}</div>
                <div style={{ fontSize: 11, color: '#737373', fontVariantNumeric: 'tabular-nums' }}>{row.size}</div>
                <div style={{ fontSize: 10, color: '#b3b3b3' }}>{row.spec}</div>
                <div style={{ fontSize: 10, color: '#b3b3b3' }}>{row.designationCode}</div>
                <div style={{ fontSize: 10, color: '#b3b3b3' }}>{row.classificationCode}</div>
                <div style={{ fontSize: 11, color: '#737373' }}>{row.unit}</div>
                <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtVnd(priceType === 'vat' ? row.priceWithVat : row.priceBeforeVat)}
                </div>
              </div>
              {expanded && (
                <div style={{ padding: '14px 20px 16px', background: '#faf9f4', borderBottom: '1px solid #e5e0d0' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#a8003b', marginBottom: 8 }}>
                    Giá này từ đâu ra? — {row.name} {row.size} (đ/{row.unit})
                  </div>
                  <div style={{ maxWidth: 560 }}>
                    {full && (
                      <>
                        {priceStep('① Tiền nguyên liệu', fmtVnd(full.materialCostPerUnit), `${mat?.name ?? ''} theo giá mua mới hôm nay`)}
                        {priceStep('② Tiền sản xuất & chi phí chung phân bổ', fmtVnd(full.processingCostPerUnit), 'lương, điện, khấu hao máy/khuôn, quản lý')}
                        {priceStep('③ = Giá thành đầy đủ (điểm hoà vốn)', fmtVnd(full.breakEvenPerUnit), 'bán đúng mức này thì không lãi không lỗ')}
                        {priceStep(`④ + Phần lời của nhà máy${markupImplied !== null ? ` (${fmtPct(markupImplied)})` : ''}`, fmtVnd(full.vfPricePerUnit - full.breakEvenPerUnit), 'chỉnh ở màn Tham Số (markup VF)')}
                      </>
                    )}
                    {priceStep('= GIÁ VF — giá xuất xưởng đang niêm yết', fmtVnd(row.chain.vfPricePerUnit), undefined, true)}
                    {priceStep('⑤ Suy tiếp cho kênh phân phối: giá TCG', fmtVnd(row.chain.tcgPricePerUnit), 'cộng lãi khâu thương mại')}
                    {priceStep('⑥ Giá niêm yết tới nhà phân phối', fmtVnd(row.chain.listPriceBeforeVat), `có VAT: ${fmtVnd(row.chain.listPriceWithVat)}`)}
                  </div>
                  {mat && lock && (
                    <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: lock.evaluation.isLocked ? '#15803d' : '#b45309' }}>
                      {lock.evaluation.isLocked
                        ? `✅ Giá đang ổn định: ${mat.name} ngoài thị trường lệch ${fmtPct(Math.abs(lock.evaluation.deviationPct))} so với lúc chốt giá — còn trong ngưỡng cho phép ±${fmtPct(mat.inventory.priceLock.thresholdPct)}, giữ nguyên giá bán.`
                        : `⚠ ${mat.name} ngoài thị trường đã lệch ${fmtPct(Math.abs(lock.evaluation.deviationPct))} — vượt ngưỡng ±${fmtPct(mat.inventory.priceLock.thresholdPct)}, giá trên đây đã tính theo giá mới; cân nhắc công bố lại bảng giá.`}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 10.5, color: '#737373', lineHeight: 1.5 }}>
                    Vì sao chốt ở giá VF? Đây là tầng giá duy nhất nhà máy kiểm soát được — các tầng sau (TCG, nhà phân phối, VAT)
                    chỉ là phép nhân theo chính sách phân phối, tự tính, không chốt tay từng tầng.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
