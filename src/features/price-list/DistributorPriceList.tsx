// ADR-025 — màn "Bảng Giá NPP" (Nhà Phân Phối), tab `distributor-pricelist`.
// CHỈ đọc cùng `PriceListDoc` như Bảng Giá VF — KHÔNG engine/schema mới. Trình
// bày QUY TRÌNH DẪN XUẤT từ giá VF (giá xuất xưởng, tab Bảng Giá) ra giá tới nhà
// phân phối, để thấy đây là một chuỗi nối tiếp chứ không phải bảng giá tách rời:
//   Giá VF → ×(1+markupTcg) = Giá TCG → ROUNDUP(TCG/(1−biên NPP)) = niêm yết NPP
//           → ×(1+VAT) = giá có VAT.
// markupTcg / biên NPP suy ngược per-SKU từ chuỗi đã persist (đồng nhất toàn cục).
// ADR-033 — TRÌNH BÀY: Tailwind + shadcn/ui (Card/Input); chrome đen–trắng, bỏ hex trang trí.
import { useMemo, useState } from 'react';
import { fmtVnd } from '../../lib/format.js';
import type { PriceListDoc } from '../../schemas/scenario.js';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PIPE_LABEL = 'Ống CPVC';
// Suất quy trình là chính sách số tròn (markupTcg/biên NPP/VAT) — hiển thị tròn %
// để tránh nhiễu do làm-tròn-lên-trăm của giá list; số per-SKU vẫn chính xác tuyệt đối.
const pctWhole = (r: number) => `${Math.round(r * 100)}%`;

const GRID = 'grid grid-cols-[36px_1.4fr_70px_52px_1fr_1fr_1fr_1fr] gap-2 px-4';

interface Row {
  stt: number;
  key: string;
  name: string;
  size: string;
  unit: string;
  vf: number;
  tcg: number;
  listBeforeVat: number;
  listWithVat: number;
}

export default function DistributorPriceList({ priceList }: { priceList: PriceListDoc | null }) {
  const [searchQuery, setSearchQuery] = useState('');

  const rows = useMemo<Row[]>(() => {
    if (!priceList) return [];
    return priceList.skuPriceChains
      .filter((sku) => sku.managementStatus === 'active')
      .map((sku, i) => {
        const isPipe = sku.productKey.dn !== undefined;
        return {
          stt: i + 1,
          key: `${sku.productKey.materialId}|${sku.productKey.dn ?? `${sku.productKey.productName}|${sku.productKey.sizeLabel}`}`,
          name: isPipe ? PIPE_LABEL : sku.productKey.productName!,
          size: isPipe ? sku.productKey.dn! : sku.productKey.sizeLabel!,
          unit: sku.unit,
          vf: sku.chain.vfPricePerUnit,
          tcg: sku.chain.tcgPricePerUnit,
          listBeforeVat: sku.chain.listPriceBeforeVat,
          listWithVat: sku.chain.listPriceWithVat,
        };
      });
  }, [priceList]);

  // Suất quy trình suy ngược từ 1 SKU (đồng nhất toàn cục — cost-pool.markup).
  const rates = useMemo(() => {
    const s = priceList?.skuPriceChains.find((x) => x.chain.vfPricePerUnit > 0);
    if (!s) return { markupTcg: 0.3, listMargin: 0.3, vat: 0.08 };
    const { vfPricePerUnit: vf, tcgPricePerUnit: tcg, listPriceBeforeVat: lst, listPriceWithVat: lstV } = s.chain;
    return {
      markupTcg: tcg / vf - 1,
      listMargin: 1 - tcg / lst,
      vat: lstV / lst - 1,
    };
  }, [priceList]);

  const filteredRows = rows.filter((row) => {
    const q = searchQuery.toLowerCase();
    return !q || row.name.toLowerCase().includes(q) || row.size.toLowerCase().includes(q);
  });

  if (!priceList) {
    return <div className="px-9 py-8 text-sm text-muted-foreground">Đang tải bảng giá…</div>;
  }

  const Step = ({ n, title, formula }: { n: string; title: string; formula: string }) => (
    <Card className="min-w-[150px] flex-1 px-3 py-2.5">
      <div className="text-eyebrow font-bold uppercase tracking-[.06em] text-faint">{n}. {title}</div>
      <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">{formula}</div>
    </Card>
  );

  return (
    <div className="px-9 py-8">
      <div className="mb-3.5">
        <div className="text-eyebrow font-semibold uppercase tracking-[.14em] text-faint">Bảng Giá Nhà Phân Phối</div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">Từ giá VF → giá tới nhà phân phối</h1>
        <div className="mt-1 text-xs text-muted-foreground">
          Dẫn xuất từ <b>Giá Xuất Xưởng (VF)</b> — bảng này tự đổi theo VF, không nhập tay. VF ổn định theo khóa giá (ADR-004) nên giá NPP cũng ổn định theo.
        </div>
      </div>

      {/* Quy trình 4 bước */}
      <div className="mb-4 flex flex-wrap items-stretch gap-2">
        <Step n="1" title="Giá VF (xuất xưởng)" formula="Giá gốc — tab Bảng Giá" />
        <Step n="2" title="Markup TCG" formula={`× (1 + ${pctWhole(rates.markupTcg)})`} />
        <Step n="3" title="Biên nhà phân phối" formula={`÷ (1 − ${pctWhole(rates.listMargin)}), làm tròn lên trăm`} />
        <Step n="4" title="Giá niêm yết NPP" formula={`+ VAT ${pctWhole(rates.vat)}`} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm theo tên, kích cỡ..."
          className="h-8 w-full min-w-[200px] max-w-[260px]"
        />
        <div className="text-[10px] text-muted-foreground">Hiển thị {filteredRows.length} sản phẩm</div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className={cn(GRID, 'border-b bg-muted py-2.5')}>
          {['STT', 'Sản phẩm', 'Kích cỡ', 'ĐVT'].map((h) => (
            <div key={h} className="text-eyebrow font-bold uppercase text-faint">{h}</div>
          ))}
          {[`Giá VF (đ)`, `Giá TCG (đ)`, `Niêm yết NPP (đ)`, `Có VAT (đ)`].map((h) => (
            <div key={h} className="text-right text-eyebrow font-bold uppercase text-faint">{h}</div>
          ))}
        </div>
        {filteredRows.map((row) => (
          <div key={row.key} className={cn(GRID, 'items-center border-b border-muted py-2')}>
            <div className="text-[10px] tabular-nums text-faint">{row.stt}</div>
            <div className="text-xs font-medium text-foreground">{row.name}</div>
            <div className="text-[11px] tabular-nums text-muted-foreground">{row.size}</div>
            <div className="text-[11px] text-muted-foreground">{row.unit}</div>
            <div className="text-right text-xs font-semibold tabular-nums text-foreground">{fmtVnd(row.vf)}</div>
            <div className="text-right text-xs tabular-nums text-muted-foreground">{fmtVnd(row.tcg)}</div>
            <div className="text-right text-[13px] font-bold tabular-nums text-foreground">{fmtVnd(row.listBeforeVat)}</div>
            <div className="text-right text-xs tabular-nums text-muted-foreground">{fmtVnd(row.listWithVat)}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}
