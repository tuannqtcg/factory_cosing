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
// ADR-033 roll-out: trình bày qua design tokens (đen–trắng tối giản) — accent
// burgundy/be cũ thay bằng đen (tk.brand) + xám trung tính; màu chỉ giữ cho
// tín hiệu khóa giá (thành công/cảnh báo) và chip thương hiệu.
import { useMemo, useState } from 'react';
import { fmtVnd, fmtPct, fmtUsd } from '../../lib/format.js';
import { weightedAvgUsdPerKg } from '../../engine/dual-costing.js';
import type { PriceListDoc, ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import TermInfo from '../shell/TermInfo.js';
import { Screen, PageHeader, Card, Banner, tk, sp, ft, rd, tnum } from '../../design/primitives.js';
import { eyebrowStyle } from '../../design/tokens.js';

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

  // ADR-067 — user 2026-08-02: "phải có cột giá baseline, giá bình quân gia
  // quyền, chênh lệch để còn biết". Baseline = giá đã CHỐT dùng cho thang giá
  // (mat.inventory.priceLock.baseline). Bình quân gia quyền = giá VỐN THẬT
  // đang mua theo lô (weightedAvgUsdPerKg, dual-costing.ts — tính client-side
  // từ scenario.materials[].inventory.lots đã có sẵn, không thêm field mới).
  // Chênh lệch = (bình quân − baseline)/baseline — KHÁC "lệch" ở banner cảnh
  // báo phía trên (đó là replacement THỊ TRƯỜNG vs baseline; đây là giá MUA
  // THỰC TẾ đã trả vs baseline — 2 câu hỏi khác nhau, không trộn).
  const materialCostSummary = useMemo(() => {
    if (!scenario) return [];
    return scenario.materials.map((m) => {
      const baseline = m.inventory.priceLock.baseline;
      const wAvg = weightedAvgUsdPerKg(m.inventory.lots);
      const deviationPct = wAvg !== null && baseline > 0 ? (wAvg - baseline) / baseline : null;
      return { id: m.id, name: m.name, baseline, wAvg, deviationPct };
    });
  }, [scenario]);

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
    // ADR-065 — bóc tách chi phí bao bì (túi ni lông Ống / carton Phụ kiện)
    // NGAY TRONG khối "Giá này từ đâu ra?", user 2026-08-02: "chưa bóc tách
    // hiển thị trên bảng giá". Tính LẠI client-side từ scenario (đã có sẵn,
    // sales-safe: chỉ non-null cho vai admin/pricing) bằng ĐÚNG công thức
    // engine đang dùng (scenario.ts packagingCostPerUnitOverride cho Phụ kiện;
    // packagingCostPerKg × unitWeightKgPerM cho Ống — luôn phẳng, ADR-062) —
    // KHÔNG phát minh công thức mới, không cần thêm field vào SkuPriceChainSchema.
    const product = scenario?.products.find((p) =>
      p.materialId === row.materialId &&
      (p.kind === 'pipe' ? p.dn === row.size : p.productName === row.name && p.sizeLabel === row.size),
    );
    const packagingPerUnit = (() => {
      if (!product || !scenario) return null;
      if (product.kind === 'pipe') {
        const pipeResource = scenario.resources.pipe as { packagingCostPerKg: number };
        return pipeResource.packagingCostPerKg * product.unitWeightKgPerM;
      }
      const fittingResource = scenario.resources.fitting as { packagingCostPerKg: number; packagingBoxCostVnd?: number };
      const method = scenario.fittingPackagingMethod ?? 'flat_per_kg';
      return method === 'per_box' && product.piecesPerBox !== undefined && fittingResource.packagingBoxCostVnd !== undefined
        ? fittingResource.packagingBoxCostVnd / product.piecesPerBox
        : product.unitWeightKg * fittingResource.packagingCostPerKg;
    })();
    const packagingNote =
      product?.kind === 'fitting' && (scenario?.fittingPackagingMethod ?? 'flat_per_kg') === 'per_box' && product.piecesPerBox !== undefined
        ? 'theo thùng carton'
        : 'theo kg (túi ni lông/bao bì phẳng)';
    const markupImplied = full && full.breakEvenPerUnit > 0 ? full.vfPricePerUnit / full.breakEvenPerUnit - 1 : null;
    const priceStep = (label: string, value: string, note?: string, strong?: boolean) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '6px 0', borderBottom: `1px dashed ${tk.border}` }}>
        <div>
          <span style={{ fontSize: ft.size.sm, fontWeight: strong ? ft.weight.bold : ft.weight.medium, color: tk.ink }}>{label}</span>
          {note && <span style={{ fontSize: ft.size.xs, color: tk.inkFaint }}> — {note}</span>}
        </div>
        <div style={{ fontSize: strong ? ft.size.md : ft.size.sm, fontWeight: ft.weight.bold, ...tnum, whiteSpace: 'nowrap', color: tk.ink }}>{value}</div>
      </div>
    );
    return (
      <>
        <div style={{ ...eyebrowStyle, marginBottom: 8 }}>
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
            const packagingSubStep = packagingPerUnit !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0 3px 14px' }}>
                <span style={{ fontSize: ft.size.xs, color: tk.inkFaint }}>— trong đó bao bì ({packagingNote})</span>
                <span style={{ fontSize: ft.size.xs, color: tk.inkFaint, ...tnum, whiteSpace: 'nowrap' }}>{fmtVnd(Math.round(packagingPerUnit))}</span>
              </div>
            );
            if (isPipe && ladder && ladder.breakEvenFullCost > 0) {
              const w = full.breakEvenPerUnit / ladder.breakEvenFullCost; // kg/đơn vị
              const varPerUnit = ladder.variableCostFloor * w;
              return (
                <>
                  {priceStep('① Chi phí biến đổi', fmtVnd(Math.round(varPerUnit)), `${mat?.name ?? 'nguyên liệu'} theo giá mua mới + điện, nước, bao bì`)}
                  {packagingSubStep}
                  {priceStep('② Chi phí cố định phân bổ', fmtVnd(Math.round(full.breakEvenPerUnit - varPerUnit)), 'khấu hao máy/khuôn, lương, chi phí chung')}
                  {priceStep('③ = Giá thành đầy đủ (điểm hoà vốn)', fmtVnd(Math.round(full.breakEvenPerUnit)), 'bán đúng mức này thì không lãi không lỗ')}
                  {priceStep(`④ + Phần lời của nhà máy${markupImplied !== null ? ` (${fmtPct(markupImplied)})` : ''}`, fmtVnd(Math.round(full.vfPricePerUnit - full.breakEvenPerUnit)), 'chỉnh ở màn Tham Số (markup VF)')}
                </>
              );
            }
            return (
              <>
                {priceStep('① Tiền nguyên liệu', fmtVnd(Math.round(full.materialCostPerUnit)), `${mat?.name ?? ''} theo giá mua mới hôm nay${full.processingCostPerUnit > 0 ? ' (+ ren kim loại nếu có)' : ''}`)}
                {packagingSubStep}
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
          <div style={{ marginTop: 10, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, color: lock.evaluation.isLocked ? tk.successInk : tk.warningInk }}>
            {lock.evaluation.isLocked
              ? `✅ Giá đang ổn định: ${mat.name} ngoài thị trường lệch ${fmtPct(Math.abs(lock.evaluation.deviationPct))} so với lúc chốt giá — còn trong ngưỡng cho phép ±${fmtPct(mat.inventory.priceLock.thresholdPct)}, giữ nguyên giá bán.`
              : `⚠ ${mat.name} ngoài thị trường đã lệch ${fmtPct(Math.abs(lock.evaluation.deviationPct))} — vượt ngưỡng ±${fmtPct(mat.inventory.priceLock.thresholdPct)}, giá trên đây đã tính theo giá mới; cân nhắc công bố lại bảng giá.`}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: ft.size.xs, color: tk.inkMuted, lineHeight: 1.5 }}>
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
    return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải bảng giá…</div></Screen>;
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="Bảng Giá Xuất Xưởng (VF)"
        title={
          multiBrand
            ? `BlazeMaster & Corzan CPVC — ${rows.length} SKU`
            : `${[...new Set(allMaterials.map(([id]) => brandOf(id as string)))][0] ?? 'BlazeMaster'} CPVC — ${rows.length} SKU`
        }
        subtitle={<>Giá bán xuất xưởng của nhà máy (VF) = giá thành đầy đủ + phần lời của nhà máy, giữ ổn định theo cơ chế khóa giá. Giá tới nhà phân phối là bước suy tiếp tự động — xem tab <b>Bảng giá NPP</b>. <b>Bấm vào từng dòng</b> để xem giá đó từ đâu ra.</>}
      />

      {/* ADR-025 — tín hiệu QUYẾT ĐỊNH GIÁ (không phải kiểm kho): giá vật liệu lệch
          quá ngưỡng → giá VF niêm yết có thể cũ → cân nhắc chốt lại. */}
      {internal && (
        staleMaterials.length > 0 ? (
          <div style={{ marginBottom: sp[4] }}>
            <Banner
              tone="warning"
              action={onNavigate && (
                <button onClick={() => onNavigate('lot-costing')} style={{ flexShrink: 0, padding: '7px 14px', background: tk.warningInk, color: tk.inkInverse, border: 'none', borderRadius: rd.sm, fontSize: ft.size.xs, fontWeight: ft.weight.bold, cursor: 'pointer' }}>
                  Xem Giá Vốn Theo Lô →
                </button>
              )}
            >
              ⚠ Chi phí vật liệu thị trường đã đổi:{' '}
              {staleMaterials.map((m, i) => (
                <span key={m.name}>{i > 0 ? ', ' : ''}{m.name} ({m.deviationPct >= 0 ? '+' : ''}{fmtPct(m.deviationPct)}, ngưỡng {fmtPct(m.thresholdPct)})</span>
              ))}
              . Giá bán VF đang niêm yết có thể không còn phản ánh chi phí hiện tại — cân nhắc <b>chốt lại giá</b>.
            </Banner>
          </div>
        ) : (
          <div style={{ marginBottom: sp[4] }}>
            <Banner tone="success">✅ Giá VF đang phản ánh đúng chi phí thị trường — mọi nguyên liệu còn trong ngưỡng, chưa cần điều chỉnh giá.</Banner>
          </div>
        )
      )}

      {/* ADR-067 — Baseline / Bình quân gia quyền / Chênh lệch, gộp 1 bảng gọn cho MỌI nguyên liệu. */}
      {scenario && materialCostSummary.length > 0 && (
        <div style={{ marginBottom: sp[4], border: `1px solid ${tk.border}`, borderRadius: rd.md, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', background: tk.surfaceMuted, ...eyebrowStyle }}>Giá nguyên liệu — Baseline vs Bình quân gia quyền thực mua</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nguyên liệu', 'Baseline (USD/kg)', 'Bình quân gia quyền (USD/kg)', 'Chênh lệch'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '7px 14px', fontSize: ft.size.eyebrow, color: tk.inkMuted, borderBottom: `1px solid ${tk.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materialCostSummary.map((m) => (
                <tr key={m.id}>
                  <td style={{ padding: '7px 14px', fontSize: ft.size.sm, color: tk.ink, borderBottom: `1px solid ${tk.surfaceMuted}` }}>{m.name}</td>
                  <td style={{ padding: '7px 14px', textAlign: 'right', fontSize: ft.size.sm, ...tnum, color: tk.ink, borderBottom: `1px solid ${tk.surfaceMuted}` }}>{fmtUsd(m.baseline)}</td>
                  <td style={{ padding: '7px 14px', textAlign: 'right', fontSize: ft.size.sm, ...tnum, color: tk.ink, borderBottom: `1px solid ${tk.surfaceMuted}` }}>
                    {m.wAvg !== null ? fmtUsd(m.wAvg) : <span style={{ color: tk.inkFaint }}>— chưa nhập lô</span>}
                  </td>
                  <td style={{ padding: '7px 14px', textAlign: 'right', fontSize: ft.size.sm, fontWeight: ft.weight.bold, ...tnum, borderBottom: `1px solid ${tk.surfaceMuted}`, color: m.deviationPct === null ? tk.inkFaint : m.deviationPct > 0 ? tk.dangerInk : tk.successInk }}>
                    {m.deviationPct === null ? '—' : `${m.deviationPct >= 0 ? '+' : ''}${fmtPct(m.deviationPct)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '7px 14px', fontSize: ft.size.eyebrow, color: tk.inkFaint }}>
            Baseline = giá đã chốt dùng để tính giá bán. Bình quân gia quyền = giá vốn THẬT đang mua theo các lô đã nhập (Thiết Lập ④/Tồn Kho). Chênh lệch dương (đỏ) = đang mua ĐẮT hơn giá đã chốt.
          </div>
        </div>
      )}

      {/* ADR-036 — 2 dạng xem: danh sách liệt kê gọn | phiếu giá từng sản phẩm */}
      <div style={{ display: 'flex', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, overflow: 'hidden', width: 'fit-content', marginBottom: sp[4] }}>
        {([['list', '☰ Danh sách'], ['card', '🗎 Phiếu giá từng sản phẩm']] as const).map(([id, label]) => (
          <div
            key={id}
            onClick={() => setViewMode(id)}
            style={{ padding: '7px 18px', cursor: 'pointer', background: viewMode === id ? tk.brand : tk.surface, color: viewMode === id ? tk.inkInverse : tk.ink, fontSize: ft.size.sm, fontWeight: ft.weight.semibold, borderRight: `1px solid ${tk.borderStrong}` }}
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
        if (!cardRow) return <div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Chưa có sản phẩm.</div>;
        return (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            {/* Chọn 3 tầng: Nguyên liệu → Sản phẩm → Kích cỡ */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...eyebrowStyle, marginBottom: 4 }}>① Nguyên liệu (compound)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cardMaterials.map(([id]) => {
                  const active = id === activeMatId;
                  return (
                    <div
                      key={id}
                      onClick={() => { setCardMaterial(id); setCardGroup(null); setCardKey(null); }}
                      style={{ padding: '8px 20px', cursor: 'pointer', border: `2px solid ${active ? tk.brand : tk.borderStrong}`, background: active ? tk.brand : tk.surface, color: active ? tk.inkInverse : tk.ink, borderRadius: rd.md, fontSize: ft.size.md, fontWeight: ft.weight.bold }}
                    >
                      {matChipLabel(id as string)}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <div style={{ ...eyebrowStyle, marginBottom: 4 }}>② Sản phẩm</div>
                <select
                  value={activeCardGroup}
                  onChange={(e) => { setCardGroup(e.target.value); setCardKey(null); }}
                  style={{ padding: '8px 12px', fontSize: ft.size.md, fontWeight: ft.weight.semibold, border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, outline: 'none', background: tk.surface, color: tk.ink, minWidth: 180 }}
                >
                  {cardGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ ...eyebrowStyle, marginBottom: 4 }}>③ Kích cỡ · tiêu chuẩn</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {cardRows.map((r) => {
                    const active = r.key === cardRow.key;
                    return (
                      <div
                        key={r.key}
                        onClick={() => setCardKey(r.key)}
                        style={{ padding: '5px 12px', cursor: 'pointer', border: `1px solid ${active ? tk.brand : tk.borderStrong}`, background: active ? tk.brand : tk.surface, color: active ? tk.inkInverse : tk.ink, borderRadius: rd.sm, fontSize: ft.size.sm, fontWeight: ft.weight.semibold, ...tnum }}
                      >
                        {r.size}{r.spec ? ` · ${r.spec}` : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* PHIẾU GIÁ */}
            <Card pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ background: tk.sidebar, padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: tk.sidebarText, fontSize: ft.size.eyebrow, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: ft.weight.bold }}>Phiếu giá xuất xưởng (VF)</div>
                  <div style={{ color: tk.inkInverse, fontSize: ft.size.lg, fontWeight: ft.weight.bold }}>
                    {cardRow.name} — {cardRow.matName}{cardRow.spec ? ` — ${cardRow.spec}` : ''} — {cardRow.size}
                  </div>
                </div>
                <div style={{ color: tk.sidebarText, fontSize: ft.size.xs }}>Model v3.7</div>
              </div>
              <div style={{ padding: '18px 22px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {([['Nguyên liệu', cardRow.matName], ['Tiêu chuẩn', cardRow.spec || '—'], ['Đơn vị tính', cardRow.unit], ['Mã định danh', cardRow.designationCode], ['Phân lớp', cardRow.classificationCode]] as const).map(([l, val]) => (
                    <div key={l}>
                      <div style={{ ...eyebrowStyle }}>{l}</div>
                      <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.semibold, color: tk.ink }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
                  <Card pad={0} inverse style={{ padding: '14px 16px' }}>
                    <div style={{ ...eyebrowStyle, color: tk.sidebarText }}>Giá VF trước VAT</div>
                    <div style={{ fontSize: ft.size.xxl, fontWeight: ft.weight.extrabold, ...tnum }}>{fmtVnd(cardRow.priceBeforeVat)} <span style={{ fontSize: ft.size.xs, color: tk.sidebarText, fontWeight: ft.weight.regular }}>đ/{cardRow.unit}</span></div>
                  </Card>
                  <Card pad={0} style={{ background: tk.surfaceMuted, padding: '14px 16px' }}>
                    <div style={{ ...eyebrowStyle }}>Giá VF có VAT ({vatPctLabel}%)</div>
                    <div style={{ fontSize: ft.size.xxl, fontWeight: ft.weight.extrabold, ...tnum, color: tk.ink }}>{fmtVnd(cardRow.priceWithVat)} <span style={{ fontSize: ft.size.xs, color: tk.inkFaint, fontWeight: ft.weight.regular }}>đ/{cardRow.unit}</span></div>
                  </Card>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
                  {([['Giá TCG (khâu thương mại)', cardRow.chain.tcgPricePerUnit], ['Niêm yết NPP trước VAT', cardRow.chain.listPriceBeforeVat], ['Niêm yết NPP có VAT', cardRow.chain.listPriceWithVat]] as const).map(([l, val]) => (
                    <div key={l} style={{ border: `1px solid ${tk.border}`, borderRadius: rd.md, padding: '10px 12px', background: tk.surfaceMuted }}>
                      <div style={{ ...eyebrowStyle }}>{l}</div>
                      <div style={{ fontSize: ft.size.lg, fontWeight: ft.weight.bold, ...tnum, color: tk.ink }}>{fmtVnd(val)} <span style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint, fontWeight: ft.weight.regular }}>đ/{cardRow.unit}</span></div>
                    </div>
                  ))}
                </div>
                {renderOrigin(cardRow)}
              </div>
            </Card>
          </div>
        );
      })() : (<>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11, gap: 12, flexWrap: 'wrap' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm theo tên, kích cỡ..."
          style={{ padding: '7px 12px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, fontSize: ft.size.sm, background: tk.surface, outline: 'none', minWidth: 200, maxWidth: 260, width: '100%', color: tk.ink }}
        />
        <div style={{ display: 'flex', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, overflow: 'hidden', flexShrink: 0 }}>
          {(
            [
              ['before', 'Trước VAT'],
              ['vat', `Có VAT (${vatPctLabel}%)`],
            ] as const
          ).map(([id, label]) => (
            <div
              key={id}
              onClick={() => setPriceType(id)}
              style={{ padding: '6px 14px', cursor: 'pointer', background: priceType === id ? tk.brand : tk.surface, color: priceType === id ? tk.inkInverse : tk.ink, fontSize: ft.size.xs, fontWeight: ft.weight.semibold, whiteSpace: 'nowrap', borderRight: `1px solid ${tk.borderStrong}` }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {allMaterials.length > 1 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: ft.size.xs, color: tk.inkFaint, marginRight: 4 }}>Nguyên liệu:</span>
          {[['all', 'Tất cả'] as [string, string], ...allMaterials].map(([id, name]) => {
            const active = materialFilter === id;
            return (
              <div
                key={id}
                onClick={() => setMaterialFilter(id)}
                style={{ padding: '4px 12px', cursor: 'pointer', border: `1px solid ${active ? tk.brand : tk.borderStrong}`, background: active ? tk.brand : tk.surface, color: active ? tk.inkInverse : tk.ink, borderRadius: rd.sm, fontSize: ft.size.xs, fontWeight: ft.weight.semibold }}
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
              style={{ padding: '4px 10px', cursor: 'pointer', border: `1px solid ${active ? tk.brand : tk.borderStrong}`, background: active ? tk.brand : tk.surface, color: active ? tk.inkInverse : tk.ink, borderRadius: rd.sm, fontSize: ft.size.xs, fontWeight: ft.weight.medium, whiteSpace: 'nowrap' }}
            >
              {c === 'all' ? 'Tất cả' : c === 'khác' ? 'Khác' : c}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, marginBottom: 9 }}>Hiển thị {filteredRows.length} sản phẩm</div>

      <Card pad={0} style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1.5fr 70px 72px 100px 70px 52px 130px', padding: '9px 16px', background: tk.surfaceMuted, borderBottom: `1px solid ${tk.border}`, gap: 8, minWidth: 760 }}>
          {['STT', 'Sản phẩm', 'Kích cỡ', 'Quy cách', 'Mã định danh', 'Phân lớp', 'ĐVT'].map((h) => (
            <div key={h} style={{ ...eyebrowStyle }}>{h}</div>
          ))}
          <div style={{ ...eyebrowStyle, textAlign: 'right' }}>{colHeader}</div>
        </div>
        {filteredRows.map((row) => {
          const expanded = expandedKey === row.key;
          return (
            <div key={row.key}>
              <div
                onClick={() => setExpandedKey(expanded ? null : row.key)}
                style={{ display: 'grid', gridTemplateColumns: '36px 1.5fr 70px 72px 100px 70px 52px 130px', padding: '8px 16px', borderBottom: `1px solid ${tk.surfaceMuted}`, gap: 8, alignItems: 'center', cursor: 'pointer', background: expanded ? tk.surfaceMuted : tk.surface, minWidth: 760 }}
              >
                <div style={{ fontSize: ft.size.xs, color: tk.inkFaint, ...tnum }}>{row.stt}</div>
                <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.medium, color: tk.ink }}>
                  {expanded ? '▾ ' : '▸ '}{row.name}
                  {multiBrand && <span style={{ marginLeft: 5, fontSize: ft.size.eyebrow, fontWeight: ft.weight.bold, color: tk.ink, background: tk.surfaceMuted, border: `1px solid ${tk.border}`, padding: '1px 5px', borderRadius: 3, verticalAlign: 'middle' }}>{row.brand}</span>}
                </div>
                <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, ...tnum }}>{row.size}</div>
                <div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>{row.spec}</div>
                <div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>{row.designationCode}</div>
                <div style={{ fontSize: ft.size.eyebrow, color: tk.inkFaint }}>{row.classificationCode}</div>
                <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>{row.unit}</div>
                <div style={{ fontSize: ft.size.md, fontWeight: ft.weight.bold, textAlign: 'right', ...tnum, color: tk.ink }}>
                  {fmtVnd(priceType === 'vat' ? row.priceWithVat : row.priceBeforeVat)}
                </div>
              </div>
              {expanded && (
                <div style={{ padding: '14px 20px 16px', background: tk.surfaceMuted, borderBottom: `1px solid ${tk.border}` }}>
                  {renderOrigin(row)}
                </div>
              )}
            </div>
          );
        })}
      </Card>
      </>)}
    </Screen>
  );
}
