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
import TermInfo from '../shell/TermInfo.js';
import SlideOverPanel from '../shell/SlideOverPanel.js';
import { calculateScenario } from '../../engine/scenario.js';
import { scenarioWithCostBasis } from '../../engine/price-cost-scenarios.js';

const PIPE_LABEL = 'Ống CPVC';
// Prototype đóng băng: 8 nút loại chính + Tất cả + Khác.
const MAIN_CATEGORIES = [PIPE_LABEL, 'Tê đều', 'Tê giảm', 'Cút 90°', 'Cút 45°', 'Nối thẳng', 'Nối giảm', 'Lơ thu'];

// Tên thương hiệu từ materialId (corzan-* → Corzan, còn lại → BlazeMaster).
const brandOf = (matId: string): string => matId.startsWith('corzan') ? 'Corzan' : 'BlazeMaster';
// Nhãn chip lọc nguyên liệu: "BlazeMaster (ống)", "Corzan (phụ kiện)", v.v.
const matChipLabel = (matId: string): string => {
  const brand = brandOf(matId);
  if (matId.endsWith('-pipe')) return `${brand} (ống)`;
  if (matId.endsWith('-fitting')) return `${brand} (phụ kiện)`;
  return brand;
};
const CAT_LIST = ['all', ...MAIN_CATEGORIES, 'khác'] as const;
// ADR-057 — thêm cột "Giá VF BQGQ" + "Chênh lệch" vào bảng danh sách (trước đây
// chỉ thấy khi bấm mở dòng): CEO cần quét nhanh cả danh sách, không phải bấm
// từng dòng mới thấy lệch bao nhiêu so với giá vốn bình quân gia quyền.
const LIST_GRID_COLS = '32px 1.2fr 56px 58px 82px 54px 40px 112px 112px 96px';

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
  matName: string;
  brand: string;
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
  // ADR-036 — 2 dạng xem: 'list' (liệt kê gọn) | 'card' (phiếu giá từng SKU).
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  // Phiếu giá chọn 3 tầng: Nguyên liệu → Sản phẩm → Kích cỡ.
  const [cardMaterial, setCardMaterial] = useState<string | null>(null);
  const [cardGroup, setCardGroup] = useState<string | null>(null);
  const [cardKey, setCardKey] = useState<string | null>(null);
  // Dạng danh sách: lọc theo nguyên liệu (chỉ hiện khi có ≥2 nguyên liệu).
  const [materialFilter, setMaterialFilter] = useState<string>('all');

  // ADR-025 §nối 2 màn — TÍN HIỆU QUYẾT ĐỊNH GIÁ cho CEO (KHÔNG phải kiểm tra tồn
  // kho): nguyên liệu nào có giá mua mới hôm nay lệch khỏi baseline đã khóa
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

  // ADR-057 — 2 kịch bản giá vốn SONG SONG để so sánh với Giá VF chính thức
  // (đang tính theo baseline/khóa giá của scenario gốc): "Giá VF dự kiến" (luôn
  // neo theo Giá mua mới hôm nay, bỏ qua trạng thái khóa) và "Giá VF bình quân
  // gia quyền" (giá đã thực nhập kho, sổ sách). Tái dùng NGUYÊN calculateScenario
  // — không công thức mới (xem price-cost-scenarios.ts).
  const marketOutput = useMemo(() => (scenario ? calculateScenario(scenarioWithCostBasis(scenario, 'market-today')) : null), [scenario]);
  const bookOutput = useMemo(() => (scenario ? calculateScenario(scenarioWithCostBasis(scenario, 'weighted-avg')) : null), [scenario]);
  const findChain = (output: ScenarioOutput | null, row: { materialId: string; name: string; size: string }) =>
    output?.skuPriceChains.find(
      (s) =>
        s.productKey.materialId === row.materialId &&
        (s.productKey.dn !== undefined
          ? s.productKey.dn === row.size
          : s.productKey.productName === row.name && s.productKey.sizeLabel === row.size),
    )?.chain ?? null;

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
          matName: scenario?.materials.find((m) => m.id === sku.productKey.materialId)?.name ?? sku.productKey.materialId,
          brand: brandOf(sku.productKey.materialId),
          chain: sku.chain,
        };
      });
  }, [priceList, vatRate, scenario]);

  const filteredRows = rows.filter((row) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || row.name.toLowerCase().includes(q) || row.size.toLowerCase().includes(q) || row.matName.toLowerCase().includes(q);
    const matchesFilter =
      productFilter === 'all' ||
      (productFilter === 'khác' ? !MAIN_CATEGORIES.includes(row.name) : row.name === productFilter);
    const matchesMaterial = materialFilter === 'all' || row.materialId === materialFilter;
    return matchesSearch && matchesFilter && matchesMaterial;
  });
  const allMaterials = [...new Map(rows.map((r) => [r.materialId, r.matName])).entries()];
  const multiBrand = new Set(allMaterials.map(([id]) => brandOf(id as string))).size > 1;

  // Thuế suất VAT suy từ chính dữ liệu (sales không đọc được costPool) — chỉ để hiển thị nhãn.
  const vatPctLabel = Math.round(vatRate * 100);
  const colHeader = priceType === 'vat' ? `Giá VF có VAT (đ)` : 'Giá VF trước VAT (đ)';

  // ADR-035/036 — khối "Giá này từ đâu ra?" dùng chung cho dòng mở rộng (dạng
  // danh sách) và phiếu giá. Bậc giá vốn tra từ `internal` (bản priceList là
  // sales-safe, cố ý không chứa giá vốn) — client không tính lại số nào.
  const renderOrigin = (row: Row) => {
    const mat = scenario?.materials.find((m) => m.id === row.materialId);
    const lock = internal?.priceLock.byMaterial.find((e) => e.materialId === row.materialId);
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
      <>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#a8003b', marginBottom: 8 }}>
          Giá này từ đâu ra? — {row.name} {row.size} (đ/{row.unit})
        </div>
        <div style={{ maxWidth: 560 }}>
          {full && (() => {
            // Ống: mô hình gốc không tách "nguyên liệu/chế biến" theo SKU (chế
            // biến = 0 trong chuỗi) — hiển thị cặp đó sẽ gây hiểu lầm "chi phí
            // sản xuất = 0". Thay bằng phân rã biến phí / định phí phân bổ từ
            // thang giá đ/kg đã persist, quy về đơn vị theo đơn trọng ẩn
            // (= hoà vốn per-unit ÷ full cost per-kg). Phụ kiện giữ cặp
            // nguyên liệu / giờ máy vì chuỗi có tách thật.
            const isPipe = full.processingCostPerUnit === 0;
            const ladder = isPipe
              ? internal?.priceLadder.byLineMaterial.find((e) => e.line === 'pipe' && e.materialId === row.materialId)?.ladder
              : null;
            if (isPipe && ladder && ladder.breakEvenFullCost > 0) {
              const w = full.breakEvenPerUnit / ladder.breakEvenFullCost; // kg/đơn vị
              const varPerUnit = ladder.variableCostFloor * w;
              return (
                <>
                  {priceStep('① Chi phí biến đổi', fmtVnd(Math.round(varPerUnit)), `${mat?.name ?? 'nguyên liệu'} theo giá mua mới + điện, nước, bao bì`)}
                  {priceStep('② Chi phí cố định phân bổ', fmtVnd(Math.round(full.breakEvenPerUnit - varPerUnit)), 'khấu hao máy/khuôn, lương, chi phí chung')}
                  {priceStep('③ = Giá thành đầy đủ (điểm hoà vốn)', fmtVnd(Math.round(full.breakEvenPerUnit)), 'bán đúng mức này thì không lãi không lỗ')}
                  {priceStep(`④ + Phần lời của nhà máy${markupImplied !== null ? ` (${fmtPct(markupImplied)})` : ''}`, fmtVnd(Math.round(full.vfPricePerUnit - full.breakEvenPerUnit)), 'chỉnh ở màn Tham Số (markup VF)')}
                </>
              );
            }
            return (
              <>
                {priceStep('① Tiền nguyên liệu', fmtVnd(Math.round(full.materialCostPerUnit)), `${mat?.name ?? ''} theo giá mua mới hôm nay${full.processingCostPerUnit > 0 ? ' (+ ren kim loại nếu có)' : ''}`)}
                {priceStep('② Tiền sản xuất (giờ máy ép)', fmtVnd(Math.round(full.processingCostPerUnit)), 'lương, điện, khấu hao máy/khuôn, quản lý — theo giờ máy')}
                {priceStep('③ = Giá thành đầy đủ (điểm hoà vốn)', fmtVnd(Math.round(full.breakEvenPerUnit)), 'bán đúng mức này thì không lãi không lỗ')}
                {priceStep(`④ + Phần lời của nhà máy${markupImplied !== null ? ` (${fmtPct(markupImplied)})` : ''}`, fmtVnd(Math.round(full.vfPricePerUnit - full.breakEvenPerUnit)), 'chỉnh ở màn Tham Số (markup VF)')}
              </>
            );
          })()}
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
        {(() => {
          const marketChain = findChain(marketOutput, row);
          const bookChain = findChain(bookOutput, row);
          if (!marketChain || !bookChain) return null;
          const diff = marketChain.vfPricePerUnit - bookChain.vfPricePerUnit;
          return (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #ece8dc' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#2563eb', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                So sánh 2 kịch bản giá vốn nguyên liệu <TermInfo term="baseline-mechanism" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10 }}>
                <div style={{ background: '#faf9f4', border: '1px solid #ece8dc', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Giá VF dự kiến</div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(marketChain.vfPricePerUnit)} đ</div>
                  <div style={{ fontSize: 9.5, color: '#999', marginTop: 2 }}>neo theo Giá mua mới hôm nay</div>
                </div>
                <div style={{ background: '#faf9f4', border: '1px solid #ece8dc', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Giá VF bình quân gia quyền</div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(bookChain.vfPricePerUnit)} đ</div>
                  <div style={{ fontSize: 9.5, color: '#999', marginTop: 2 }}>theo giá đã thực nhập kho (sổ sách)</div>
                </div>
                <div style={{ background: diff === 0 ? '#f5f5f3' : diff > 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${diff === 0 ? '#e5e5e5' : diff > 0 ? '#16A34A' : '#DC2626'}`, borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>Chênh lệch</div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: diff === 0 ? '#1a1a1a' : diff > 0 ? '#16A34A' : '#DC2626' }}>{diff >= 0 ? '+' : ''}{fmtVnd(diff)} đ</div>
                  <div style={{ fontSize: 9.5, color: '#999', marginTop: 2 }}>dự kiến − bình quân gia quyền</div>
                </div>
              </div>
            </div>
          );
        })()}
        <div style={{ marginTop: 8, fontSize: 10.5, color: '#737373', lineHeight: 1.5 }}>
          Vì sao chốt ở giá VF? Đây là tầng giá duy nhất nhà máy kiểm soát được — các tầng sau (TCG, nhà phân phối, VAT)
          chỉ là phép nhân theo chính sách phân phối, tự tính, không chốt tay từng tầng.
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <TermInfo term="suggested-vf" label="ⓘ Vì sao đề xuất mức giá này?" />
          <TermInfo term="full-cost" label="ⓘ Giá sàn là gì?" />
          <TermInfo term="market-ceiling" label="ⓘ Giá trần nằm ở đâu?" />
        </div>
      </>
    );
  };

  if (!priceList) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải bảng giá…</div>;
  }

  return (
    <div className="px-4 py-6 md:px-9 md:py-8">
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Bảng Giá Xuất Xưởng (VF)</div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>
          {multiBrand
            ? `BlazeMaster & Corzan CPVC — ${rows.length} SKU`
            : `${[...new Set(allMaterials.map(([id]) => brandOf(id as string)))][0] ?? 'BlazeMaster'} CPVC — ${rows.length} SKU`}
        </h1>
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
              <button onClick={() => onNavigate('materials')} style={{ flexShrink: 0, padding: '7px 14px', background: '#b45309', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Xem Nguyên Liệu →
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 14, padding: '9px 16px', borderRadius: 6, border: '1px solid #16A34A', background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
            ✅ Giá VF đang phản ánh đúng chi phí thị trường — mọi nguyên liệu còn trong ngưỡng, chưa cần điều chỉnh giá.
          </div>
        )
      )}

      {/* ADR-036 — 2 dạng xem: danh sách liệt kê gọn | phiếu giá từng sản phẩm */}
      <div style={{ display: 'flex', border: '1px solid #b3b3b3', borderRadius: 2, overflow: 'hidden', width: 'fit-content', marginBottom: 14 }}>
        {([['list', '☰ Danh sách'], ['card', '🗎 Phiếu giá từng sản phẩm']] as const).map(([id, label]) => (
          <div
            key={id}
            onClick={() => setViewMode(id)}
            style={{ padding: '7px 18px', cursor: 'pointer', background: viewMode === id ? '#0a0a0a' : '#fff', color: viewMode === id ? '#fff' : '#1a1a1a', fontSize: 12, fontWeight: 600, borderRight: '1px solid #d8d8d8' }}
          >
            {label}
          </div>
        ))}
      </div>

      {viewMode === 'card' ? (() => {
        // Tầng 1: nguyên liệu (compound) — phân biệt rõ BlazeMaster / Corzan.
        const cardMaterials = [...new Map(rows.map((r) => [r.materialId, r.matName])).entries()];
        const activeMatId = cardMaterial && cardMaterials.some(([id]) => id === cardMaterial) ? cardMaterial : cardMaterials[0]?.[0] ?? '';
        const matRows = rows.filter((r) => r.materialId === activeMatId);
        // Tầng 2: sản phẩm trong nguyên liệu đó. Tầng 3: kích cỡ (kèm tiêu chuẩn).
        const cardGroups = [...new Set(matRows.map((r) => r.name))];
        const activeCardGroup = cardGroup && cardGroups.includes(cardGroup) ? cardGroup : cardGroups[0] ?? '';
        const cardRows = matRows.filter((r) => r.name === activeCardGroup);
        const cardRow = cardRows.find((r) => r.key === cardKey) ?? cardRows[0];
        if (!cardRow) return <div style={{ fontSize: 12, color: '#737373' }}>Chưa có sản phẩm.</div>;
        return (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            {/* Chọn 3 tầng: Nguyên liệu → Sản phẩm → Kích cỡ */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', marginBottom: 4 }}>① Nguyên liệu (compound)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cardMaterials.map(([id]) => {
                  const active = id === activeMatId;
                  return (
                    <div
                      key={id}
                      onClick={() => { setCardMaterial(id); setCardGroup(null); setCardKey(null); }}
                      style={{ padding: '8px 20px', cursor: 'pointer', border: `2px solid ${active ? '#a8003b' : '#d8d8d8'}`, background: active ? '#a8003b' : '#fff', color: active ? '#fff' : '#1a1a1a', borderRadius: 6, fontSize: 13, fontWeight: 700 }}
                    >
                      {matChipLabel(id as string)}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', marginBottom: 4 }}>② Sản phẩm</div>
                <select
                  value={activeCardGroup}
                  onChange={(e) => { setCardGroup(e.target.value); setCardKey(null); }}
                  style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, border: '1px solid #b3b3b3', borderRadius: 2, outline: 'none', background: '#fff', minWidth: 180 }}
                >
                  {cardGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', marginBottom: 4 }}>③ Kích cỡ · tiêu chuẩn</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {cardRows.map((r) => {
                    const active = r.key === cardRow.key;
                    return (
                      <div
                        key={r.key}
                        onClick={() => setCardKey(r.key)}
                        style={{ padding: '5px 12px', cursor: 'pointer', border: `1px solid ${active ? '#0a0a0a' : '#b3b3b3'}`, background: active ? '#0a0a0a' : '#fff', color: active ? '#fff' : '#1a1a1a', borderRadius: 2, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {r.size}{r.spec ? ` · ${r.spec}` : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* PHIẾU GIÁ */}
            <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
              <div style={{ background: '#0a0a0a', padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#a3a3a3', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700 }}>Phiếu giá xuất xưởng (VF)</div>
                  <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>
                    {cardRow.name} — {cardRow.matName}{cardRow.spec ? ` — ${cardRow.spec}` : ''} — {cardRow.size}
                  </div>
                </div>
                <div style={{ color: '#a3a3a3', fontSize: 10 }}>Model v3.7</div>
              </div>
              <div style={{ padding: '18px 22px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {([['Nguyên liệu', cardRow.matName], ['Tiêu chuẩn', cardRow.spec || '—'], ['Đơn vị tính', cardRow.unit], ['Mã định danh', cardRow.designationCode], ['Phân lớp', cardRow.classificationCode]] as const).map(([l, val]) => (
                    <div key={l}>
                      <div style={{ fontSize: 9, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: '#0a0a0a', color: '#fff', borderRadius: 6, padding: '14px 16px' }}>
                    <div style={{ fontSize: 9, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '.05em' }}>Giá VF trước VAT</div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(cardRow.priceBeforeVat)} <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>đ/{cardRow.unit}</span></div>
                  </div>
                  <div style={{ background: '#f7f7f7', border: '1px solid #e5e5e5', borderRadius: 6, padding: '14px 16px' }}>
                    <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', letterSpacing: '.05em' }}>Giá VF có VAT ({vatPctLabel}%)</div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(cardRow.priceWithVat)} <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>đ/{cardRow.unit}</span></div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
                  {([['Giá TCG (khâu thương mại)', cardRow.chain.tcgPricePerUnit], ['Niêm yết NPP trước VAT', cardRow.chain.listPriceBeforeVat], ['Niêm yết NPP có VAT', cardRow.chain.listPriceWithVat]] as const).map(([l, val]) => (
                    <div key={l} style={{ border: '1px solid #ece8dc', borderRadius: 6, padding: '10px 12px', background: '#faf9f4' }}>
                      <div style={{ fontSize: 9, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em' }}>{l}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(val)} <span style={{ fontSize: 10, color: '#b3b3b3', fontWeight: 400 }}>đ/{cardRow.unit}</span></div>
                    </div>
                  ))}
                </div>
                {renderOrigin(cardRow)}
              </div>
            </div>
          </div>
        );
      })() : (<>
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

      {allMaterials.length > 1 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#999', marginRight: 4 }}>Nguyên liệu:</span>
          {[['all', 'Tất cả'] as [string, string], ...allMaterials].map(([id, name]) => {
            const active = materialFilter === id;
            return (
              <div
                key={id}
                onClick={() => setMaterialFilter(id)}
                style={{ padding: '4px 12px', cursor: 'pointer', border: `1px solid ${active ? '#0a0a0a' : '#b3b3b3'}`, background: active ? '#0a0a0a' : '#fff', color: active ? '#fff' : '#1a1a1a', borderRadius: 2, fontSize: 11, fontWeight: 600 }}
              >
                {id === 'all' ? name : matChipLabel(id as string)}
              </div>
            );
          })}
        </div>
      )}
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
        <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: LIST_GRID_COLS, padding: '9px 16px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', gap: 8, minWidth: 920 }}>
          {['STT', 'Sản phẩm', 'Kích cỡ', 'Quy cách', 'Mã định danh', 'Phân lớp', 'ĐVT'].map((h) => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#737373', textTransform: 'uppercase' }}>{h}</div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textAlign: 'right', textTransform: 'uppercase' }}>{colHeader}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#2563eb', textAlign: 'right', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
            Giá VF BQGQ (đ) <TermInfo term="baseline-mechanism" />
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#737373', textAlign: 'right', textTransform: 'uppercase' }}>Chênh lệch</div>
        </div>
        {filteredRows.map((row) => {
          const expanded = expandedKey === row.key;
          const bookChain = findChain(bookOutput, row);
          const officialVal = priceType === 'vat' ? row.priceWithVat : row.priceBeforeVat;
          const bookVal = bookChain ? (priceType === 'vat' ? Math.round(bookChain.vfPricePerUnit * (1 + vatRate)) : bookChain.vfPricePerUnit) : null;
          const diff = bookVal !== null ? officialVal - bookVal : null;
          const diffColor = diff === null || diff === 0 ? '#737373' : diff > 0 ? '#16A34A' : '#DC2626';
          return (
            <div key={row.key}>
              <div
                onClick={() => setExpandedKey(expanded ? null : row.key)}
                style={{ display: 'grid', gridTemplateColumns: LIST_GRID_COLS, padding: '8px 16px', borderBottom: '1px solid #f5f5f5', gap: 8, alignItems: 'center', cursor: 'pointer', background: expanded ? '#faf9f4' : '#fff', minWidth: 920 }}
              >
                <div style={{ fontSize: 10, color: '#b3b3b3', fontVariantNumeric: 'tabular-nums' }}>{row.stt}</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>
                  {expanded ? '▾ ' : '▸ '}{row.name}
                  {multiBrand && <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, color: '#6b5e00', background: '#fef9c3', padding: '1px 5px', borderRadius: 3, verticalAlign: 'middle' }}>{row.brand}</span>}
                </div>
                <div style={{ fontSize: 11, color: '#737373', fontVariantNumeric: 'tabular-nums' }}>{row.size}</div>
                <div style={{ fontSize: 10, color: '#b3b3b3' }}>{row.spec}</div>
                <div style={{ fontSize: 10, color: '#b3b3b3' }}>{row.designationCode}</div>
                <div style={{ fontSize: 10, color: '#b3b3b3' }}>{row.classificationCode}</div>
                <div style={{ fontSize: 11, color: '#737373' }}>{row.unit}</div>
                <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtVnd(officialVal)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#2563eb' }}>
                  {bookVal !== null ? fmtVnd(bookVal) : '—'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: diffColor }}>
                  {diff !== null ? `${diff >= 0 ? '+' : ''}${fmtVnd(diff)}` : '—'}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
      {/* ADR-059 — chi tiết SKU mở qua panel bên phải thay vì mở rộng tại chỗ,
          dùng chung SlideOverPanel với màn Nguyên Liệu. */}
      <SlideOverPanel
        open={expandedKey !== null}
        onClose={() => setExpandedKey(null)}
        title={(() => {
          const r = filteredRows.find((x) => x.key === expandedKey);
          return r ? `${r.name} ${r.size} (đ/${r.unit})` : '';
        })()}
        level={1}
      >
        {(() => {
          const r = filteredRows.find((x) => x.key === expandedKey);
          return r ? renderOrigin(r) : null;
        })()}
      </SlideOverPanel>
      <div style={{ fontSize: 10, color: '#999', marginTop: 6 }}>
        Giá VF BQGQ = giá bán xuất xưởng nếu tính theo giá nguyên liệu bình quân gia quyền đã thực nhập kho (sổ sách) thay vì giá mua mới hôm nay. Chênh lệch = giá đang niêm yết − giá VF BQGQ (dương = còn dư địa biên lợi nhuận so với giá vốn sổ sách).
      </div>
      </>)}
    </div>
  );
}
