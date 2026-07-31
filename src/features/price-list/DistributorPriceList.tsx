// ADR-025 — màn "Bảng Giá NPP" (Nhà Phân Phối), tab `distributor-pricelist`.
// CHỈ đọc cùng `PriceListDoc` như Bảng Giá VF — KHÔNG engine/schema mới. Trình
// bày QUY TRÌNH DẪN XUẤT từ giá VF (giá xuất xưởng, tab Bảng Giá) ra giá tới nhà
// phân phối, để thấy đây là một chuỗi nối tiếp chứ không phải bảng giá tách rời:
//   Giá VF → ×(1+markupTcg) = Giá TCG → ROUNDUP(TCG/(1−biên NPP)) = niêm yết NPP
//           → ×(1+VAT) = giá có VAT.
// markupTcg / biên NPP suy ngược per-SKU từ chuỗi đã persist (đồng nhất toàn cục).
import { useMemo, useState } from 'react';
import { fmtVnd } from '../../lib/format.js';
import type { PriceListDoc } from '../../schemas/scenario.js';

const PIPE_LABEL = 'Ống CPVC';
// Suất quy trình là chính sách số tròn (markupTcg/biên NPP/VAT) — hiển thị tròn %
// để tránh nhiễu do làm-tròn-lên-trăm của giá list; số per-SKU vẫn chính xác tuyệt đối.
const pctWhole = (r: number) => `${Math.round(r * 100)}%`;

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
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải bảng giá…</div>;
  }

  const Step = ({ n, title, formula, color }: { n: string; title: string; formula: string; color: string }) => (
    <div style={{ flex: 1, minWidth: 150, background: '#fff', border: '1px solid #e5e0d0', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontSize: 9, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{n}. {title}</div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{formula}</div>
    </div>
  );

  const cols = '36px 1.4fr 70px 52px 1fr 1fr 1fr 1fr';

  return (
    <div className="px-4 py-6 md:px-9 md:py-8">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Bảng Giá Nhà Phân Phối</div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Từ giá VF → giá tới nhà phân phối</h1>
        <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>
          Dẫn xuất từ <b>Giá Xuất Xưởng (VF)</b> — bảng này tự đổi theo VF, không nhập tay. VF ổn định theo khóa giá (ADR-004) nên giá NPP cũng ổn định theo.
        </div>
      </div>

      {/* Quy trình 4 bước */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'stretch' }}>
        <Step n="1" title="Giá VF (xuất xưởng)" formula="Giá gốc — tab Bảng Giá" color="#a8003b" />
        <Step n="2" title="Markup TCG" formula={`× (1 + ${pctWhole(rates.markupTcg)})`} color="#b45309" />
        <Step n="3" title="Biên nhà phân phối" formula={`÷ (1 − ${pctWhole(rates.listMargin)}), làm tròn lên trăm`} color="#b45309" />
        <Step n="4" title="Giá niêm yết NPP" formula={`+ VAT ${pctWhole(rates.vat)}`} color="#16A34A" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11, gap: 12, flexWrap: 'wrap' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm theo tên, kích cỡ..."
          style={{ padding: '7px 12px', border: '1px solid #b3b3b3', borderRadius: 2, fontSize: 12, background: '#fff', outline: 'none', minWidth: 200, maxWidth: 260, width: '100%' }}
        />
        <div style={{ fontSize: 10, color: '#737373' }}>Hiển thị {filteredRows.length} sản phẩm</div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,.04)', overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '9px 16px', background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', gap: 8, minWidth: 760 }}>
          {['STT', 'Sản phẩm', 'Kích cỡ', 'ĐVT'].map((h) => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#737373', textTransform: 'uppercase' }}>{h}</div>
          ))}
          {[`Giá VF (đ)`, `Giá TCG (đ)`, `Niêm yết NPP (đ)`, `Có VAT (đ)`].map((h) => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#737373', textAlign: 'right', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>
        {filteredRows.map((row) => (
          <div key={row.key} style={{ display: 'grid', gridTemplateColumns: cols, padding: '8px 16px', borderBottom: '1px solid #f5f5f5', gap: 8, alignItems: 'center', minWidth: 760 }}>
            <div style={{ fontSize: 10, color: '#b3b3b3', fontVariantNumeric: 'tabular-nums' }}>{row.stt}</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{row.name}</div>
            <div style={{ fontSize: 11, color: '#737373', fontVariantNumeric: 'tabular-nums' }}>{row.size}</div>
            <div style={{ fontSize: 11, color: '#737373' }}>{row.unit}</div>
            <div style={{ fontSize: 12, textAlign: 'right', color: '#a8003b', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(row.vf)}</div>
            <div style={{ fontSize: 12, textAlign: 'right', color: '#737373', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(row.tcg)}</div>
            <div style={{ fontSize: 13, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(row.listBeforeVat)}</div>
            <div style={{ fontSize: 12, textAlign: 'right', color: '#737373', fontVariantNumeric: 'tabular-nums' }}>{fmtVnd(row.listWithVat)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
