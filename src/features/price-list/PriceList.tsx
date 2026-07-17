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
// ADR-033 — TRÌNH BÀY: Tailwind + shadcn/ui (Card/Input/Button/Segmented/Badge);
// chrome đen–trắng, màu CHỈ cho DỮ LIỆU/trạng thái (dải cảnh báo chốt giá).
import { useMemo, useState } from 'react';
import { fmtVnd, fmtPct } from '../../lib/format.js';
import type { PriceListDoc, ScenarioInput, ScenarioOutput } from '../../schemas/scenario.js';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';

const PIPE_LABEL = 'Ống CPVC';
// Prototype đóng băng: 8 nút loại chính + Tất cả + Khác.
const MAIN_CATEGORIES = [PIPE_LABEL, 'Tê đều', 'Tê giảm', 'Cút 90°', 'Cút 45°', 'Nối thẳng', 'Nối giảm', 'Lơ thu'];
const CAT_LIST = ['all', ...MAIN_CATEGORIES, 'khác'] as const;

const GRID = 'grid grid-cols-[36px_1.5fr_70px_72px_100px_70px_52px_130px] gap-2 px-4';

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
    return <div className="px-9 py-8 text-sm text-muted-foreground">Đang tải bảng giá…</div>;
  }

  return (
    <div className="px-9 py-8">
      <div className="mb-[18px]">
        <div className="text-eyebrow font-semibold uppercase tracking-[.14em] text-faint">Bảng Giá Xuất Xưởng (VF)</div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">BlazeMaster CPVC — {rows.length} SKU</h1>
        <div className="mt-1 text-xs text-muted-foreground">
          Giá bán xuất xưởng của nhà máy (VF) — ổn định theo khóa giá (ADR-004). Giá tới nhà phân phối xem tab <b>Bảng Giá NPP</b>.
        </div>
      </div>

      {/* ADR-025 — tín hiệu QUYẾT ĐỊNH GIÁ (không phải kiểm kho): giá vật liệu lệch
          quá ngưỡng → giá VF niêm yết có thể cũ → cân nhắc chốt lại. */}
      {internal && (
        staleMaterials.length > 0 ? (
          <div className="mb-3.5 flex flex-wrap items-center gap-3 rounded-md border border-warning/40 bg-warning-tint px-4 py-2.5 text-warning">
            <div className="min-w-[280px] flex-1 text-xs font-semibold">
              ⚠ Chi phí vật liệu thị trường đã đổi:{' '}
              {staleMaterials.map((m, i) => (
                <span key={m.name}>{i > 0 ? ', ' : ''}{m.name} ({m.deviationPct >= 0 ? '+' : ''}{fmtPct(m.deviationPct)}, ngưỡng {fmtPct(m.thresholdPct)})</span>
              ))}
              . Giá bán VF đang niêm yết có thể không còn phản ánh chi phí hiện tại — cân nhắc <b>chốt lại giá</b>.
            </div>
            {onNavigate && (
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => onNavigate('lot-costing')}>
                Xem Giá Vốn Theo Lô →
              </Button>
            )}
          </div>
        ) : (
          <div className="mb-3.5 rounded-md border border-success/40 bg-success-tint px-4 py-2.5 text-xs font-semibold text-success">
            ✅ Giá VF đang phản ánh đúng chi phí thị trường — mọi nguyên liệu còn trong ngưỡng, chưa cần điều chỉnh giá.
          </div>
        )
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm theo tên, kích cỡ..."
          className="h-8 w-full min-w-[200px] max-w-[260px]"
        />
        <Segmented
          value={priceType}
          onChange={setPriceType}
          options={[
            { id: 'before', label: 'Trước VAT' },
            { id: 'vat', label: `Có VAT (${vatPctLabel}%)` },
          ]}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {CAT_LIST.map((c) => {
          const active = productFilter === c;
          return (
            <Button
              key={c}
              variant={active ? 'default' : 'outline'}
              size="sm"
              className="font-medium"
              onClick={() => setProductFilter(c)}
            >
              {c === 'all' ? 'Tất cả' : c === 'khác' ? 'Khác' : c}
            </Button>
          );
        })}
      </div>

      <div className="mb-2.5 text-[10px] text-muted-foreground">Hiển thị {filteredRows.length} sản phẩm</div>

      <Card className="overflow-hidden p-0">
        <div className={cn(GRID, 'border-b bg-muted py-2.5')}>
          {['STT', 'Sản phẩm', 'Kích cỡ', 'Quy cách', 'Mã định danh', 'Phân lớp', 'ĐVT'].map((h) => (
            <div key={h} className="text-eyebrow font-bold uppercase text-faint">{h}</div>
          ))}
          <div className="text-right text-eyebrow font-bold uppercase text-faint">{colHeader}</div>
        </div>
        {filteredRows.map((row) => (
          <div key={row.key} className={cn(GRID, 'items-center border-b border-muted py-2')}>
            <div className="text-[10px] tabular-nums text-faint">{row.stt}</div>
            <div className="text-xs font-medium text-foreground">{row.name}</div>
            <div className="text-[11px] tabular-nums text-muted-foreground">{row.size}</div>
            <div className="text-[10px] text-faint">{row.spec}</div>
            <div className="text-[10px] text-faint">{row.designationCode}</div>
            <div className="text-[10px] text-faint">{row.classificationCode}</div>
            <div className="text-[11px] text-muted-foreground">{row.unit}</div>
            <div className="text-right text-[13px] font-bold tabular-nums text-foreground">
              {fmtVnd(priceType === 'vat' ? row.priceWithVat : row.priceBeforeVat)}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
