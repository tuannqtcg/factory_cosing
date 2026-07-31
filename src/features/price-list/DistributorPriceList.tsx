// ADR-025 — màn "Bảng Giá NPP" (Nhà Phân Phối), tab `distributor-pricelist`.
// CHỈ đọc cùng `PriceListDoc` như Bảng Giá VF — KHÔNG engine/schema mới. Trình
// bày QUY TRÌNH DẪN XUẤT từ giá VF (giá xuất xưởng, tab Bảng Giá) ra giá tới nhà
// phân phối, để thấy đây là một chuỗi nối tiếp chứ không phải bảng giá tách rời:
//   Giá VF → ×(1+markupTcg) = Giá TCG → ROUNDUP(TCG/(1−biên NPP)) = niêm yết NPP
//           → ×(1+VAT) = giá có VAT.
// markupTcg / biên NPP suy ngược per-SKU từ chuỗi đã persist (đồng nhất toàn cục).
// ADR-033 roll-out: trình bày qua design tokens/primitives (đen–trắng tối giản).
import { useMemo, useState } from 'react';
import { fmtVnd } from '../../lib/format.js';
import type { PriceListDoc } from '../../schemas/scenario.js';
import { Screen, PageHeader, Card, tk, sp, ft, rd, tnum } from '../../design/primitives.js';
import { eyebrowStyle } from '../../design/tokens.js';

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
    return <Screen><div style={{ fontSize: ft.size.sm, color: tk.inkMuted }}>Đang tải bảng giá…</div></Screen>;
  }

  const Step = ({ n, title, formula }: { n: string; title: string; formula: string }) => (
    <Card pad={12} style={{ flex: 1, minWidth: 150 }}>
      <div style={{ ...eyebrowStyle, color: tk.inkMuted }}>{n}. {title}</div>
      <div style={{ fontSize: ft.size.sm, color: tk.inkMuted, marginTop: 3, ...tnum }}>{formula}</div>
    </Card>
  );

  const cols = '36px 1.4fr 70px 52px 1fr 1fr 1fr 1fr';

  return (
    <Screen>
      <PageHeader
        eyebrow="Bảng Giá Nhà Phân Phối"
        title="Từ giá VF → giá tới nhà phân phối"
        subtitle={<>Dẫn xuất từ <b>Giá Xuất Xưởng (VF)</b> — bảng này tự đổi theo VF, không nhập tay. VF ổn định theo khóa giá (ADR-004) nên giá NPP cũng ổn định theo.</>}
      />

      {/* Quy trình 4 bước */}
      <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap', marginBottom: sp[4], alignItems: 'stretch' }}>
        <Step n="1" title="Giá VF (xuất xưởng)" formula="Giá gốc — tab Bảng Giá" />
        <Step n="2" title="Markup TCG" formula={`× (1 + ${pctWhole(rates.markupTcg)})`} />
        <Step n="3" title="Biên nhà phân phối" formula={`÷ (1 − ${pctWhole(rates.listMargin)}), làm tròn lên trăm`} />
        <Step n="4" title="Giá niêm yết NPP" formula={`+ VAT ${pctWhole(rates.vat)}`} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp[3], gap: 12, flexWrap: 'wrap' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm theo tên, kích cỡ..."
          style={{ padding: '7px 12px', border: `1px solid ${tk.borderStrong}`, borderRadius: rd.sm, fontSize: ft.size.sm, background: tk.surface, outline: 'none', minWidth: 200, maxWidth: 260, width: '100%', color: tk.ink }}
        />
        <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>Hiển thị {filteredRows.length} sản phẩm</div>
      </div>

      <Card pad={0} style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '9px 16px', background: tk.surfaceMuted, borderBottom: `1px solid ${tk.border}`, gap: 8, minWidth: 760 }}>
          {['STT', 'Sản phẩm', 'Kích cỡ', 'ĐVT'].map((h) => (
            <div key={h} style={{ ...eyebrowStyle, color: tk.inkMuted }}>{h}</div>
          ))}
          {[`Giá VF (đ)`, `Giá TCG (đ)`, `Niêm yết NPP (đ)`, `Có VAT (đ)`].map((h) => (
            <div key={h} style={{ ...eyebrowStyle, color: tk.inkMuted, textAlign: 'right' }}>{h}</div>
          ))}
        </div>
        {filteredRows.map((row) => (
          <div key={row.key} style={{ display: 'grid', gridTemplateColumns: cols, padding: '8px 16px', borderBottom: `1px solid ${tk.surfaceMuted}`, gap: 8, alignItems: 'center', minWidth: 760 }}>
            <div style={{ fontSize: ft.size.xs, color: tk.inkFaint, ...tnum }}>{row.stt}</div>
            <div style={{ fontSize: ft.size.sm, fontWeight: ft.weight.medium, color: tk.ink }}>{row.name}</div>
            <div style={{ fontSize: ft.size.xs, color: tk.inkMuted, ...tnum }}>{row.size}</div>
            <div style={{ fontSize: ft.size.xs, color: tk.inkMuted }}>{row.unit}</div>
            <div style={{ fontSize: ft.size.sm, textAlign: 'right', color: tk.ink, fontWeight: ft.weight.semibold, ...tnum }}>{fmtVnd(row.vf)}</div>
            <div style={{ fontSize: ft.size.sm, textAlign: 'right', color: tk.inkMuted, ...tnum }}>{fmtVnd(row.tcg)}</div>
            <div style={{ fontSize: ft.size.md, textAlign: 'right', fontWeight: ft.weight.bold, color: tk.ink, ...tnum }}>{fmtVnd(row.listBeforeVat)}</div>
            <div style={{ fontSize: ft.size.sm, textAlign: 'right', color: tk.inkMuted, ...tnum }}>{fmtVnd(row.listWithVat)}</div>
          </div>
        ))}
      </Card>
    </Screen>
  );
}
