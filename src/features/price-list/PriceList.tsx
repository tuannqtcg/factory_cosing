// M12.6 — màn hình Bảng Giá (tab `pricelist`), dựng ĐÚNG prototype Pha 1 đã
// duyệt: search theo tên/kích cỡ + toggle Trước VAT/Có VAT + hàng nút lọc
// loại SP + bảng 6 cột (STT/Sản phẩm/Kích cỡ/Quy cách/ĐVT/Giá). Sales-safe:
// nguồn DUY NHẤT là `outputs/priceList` (PriceListDocSchema — không có field
// giá vốn nào để lộ), dùng chung cho MỌI vai được xem tab này.
//
// Khác prototype (2 chỗ, đều là prototype mock sai so với nguồn chân lý):
// - 8 SKU chưa có khuôn ẨN bằng `managementStatus === 'pending_mold'` tính từ
//   moldAssets (ADR-007) — KHÔNG hard-code danh sách EXCLUDED_SKUS.
// - Không có dòng "Dung môi 550": PriceList Excel (99 dòng, nguồn chân lý)
//   không có; solvent550PricePerBox là vật tư phụ dùng chung trong CostPool
//   (cost-pool.md), không phải SKU thương mại.
import { useMemo, useState } from 'react';
import { fmtVnd } from '../../lib/format.js';
import type { PriceListDoc } from '../../schemas/scenario.js';

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
}

export default function PriceList({ priceList }: { priceList: PriceListDoc | null }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priceType, setPriceType] = useState<'before' | 'vat'>('before');
  const [productFilter, setProductFilter] = useState<string>('all');

  // Dòng hiển thị: chỉ SKU active (pending_mold ẩn theo ADR-007/008), STT đánh
  // trên danh sách active ĐẦY ĐỦ (giữ nguyên khi search/filter — giống prototype).
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
          priceBeforeVat: sku.chain.listPriceBeforeVat,
          priceWithVat: sku.chain.listPriceWithVat,
        };
      });
  }, [priceList]);

  const filteredRows = rows.filter((row) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || row.name.toLowerCase().includes(q) || row.size.toLowerCase().includes(q);
    const matchesFilter =
      productFilter === 'all' ||
      (productFilter === 'khác' ? !MAIN_CATEGORIES.includes(row.name) : row.name === productFilter);
    return matchesSearch && matchesFilter;
  });

  // Thuế suất VAT suy từ chính dữ liệu (sales không đọc được costPool) — chỉ để hiển thị nhãn.
  const vatPctLabel = rows[0] ? Math.round((rows[0].priceWithVat / rows[0].priceBeforeVat - 1) * 100) : 8;
  const colHeader = priceType === 'vat' ? `Đơn giá có VAT (đ)` : 'Đơn giá trước VAT (đ)';

  if (!priceList) {
    return <div style={{ padding: '32px 36px', fontSize: 12, color: '#737373' }}>Đang tải bảng giá…</div>;
  }

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Bảng Giá Sản Phẩm</div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>BlazeMaster CPVC — {rows.length} SKU</h1>
      </div>

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
        {filteredRows.map((row) => (
          <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '36px 1.5fr 70px 72px 100px 70px 52px 130px', padding: '8px 16px', borderBottom: '1px solid #f5f5f5', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 10, color: '#b3b3b3', fontVariantNumeric: 'tabular-nums' }}>{row.stt}</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{row.name}</div>
            <div style={{ fontSize: 11, color: '#737373', fontVariantNumeric: 'tabular-nums' }}>{row.size}</div>
            <div style={{ fontSize: 10, color: '#b3b3b3' }}>{row.spec}</div>
            <div style={{ fontSize: 10, color: '#b3b3b3' }}>{row.designationCode}</div>
            <div style={{ fontSize: 10, color: '#b3b3b3' }}>{row.classificationCode}</div>
            <div style={{ fontSize: 11, color: '#737373' }}>{row.unit}</div>
            <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {fmtVnd(priceType === 'vat' ? row.priceWithVat : row.priceBeforeVat)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
