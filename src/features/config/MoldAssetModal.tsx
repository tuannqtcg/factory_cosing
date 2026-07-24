// ADR-033 roll-out: trình bày qua design tokens (đen–trắng tối giản).
import React, { useState } from 'react';
import type { MoldAsset } from '../../schemas/resource.js';
import { fmtVnd } from '../../lib/format.js';
import { color, font, radius, shadow } from '../../design/tokens.js';

interface MoldAssetModalProps {
  initialMolds: MoldAsset[];
  onSave: (molds: MoldAsset[]) => void;
  onClose: () => void;
  canEdit: boolean;
}

export function MoldAssetModal({ initialMolds, onSave, onClose, canEdit }: MoldAssetModalProps) {
  const [molds, setMolds] = useState<MoldAsset[]>([...initialMolds]);

  const handleChange = (index: number, key: keyof MoldAsset, value: string | number) => {
    const newMolds = [...molds];
    // Need to cast to any to bypass TS complaining about spread with union keys
    const updatedMold: any = { ...newMolds[index] };
    updatedMold[key] = value;
    newMolds[index] = updatedMold as MoldAsset;
    setMolds(newMolds);
  };

  const totalCost = molds.reduce((sum, m) => sum + m.costVnd, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 40 }}>
      <div style={{ background: color.surface, borderRadius: radius.lg, width: '100%', maxWidth: 900, maxHeight: '100%', display: 'flex', flexDirection: 'column', boxShadow: shadow.lg }}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: font.size.xl, color: color.ink }}>Quản lý Danh sách Khuôn mẫu Phụ kiện</h2>
            <div style={{ fontSize: font.size.sm, color: color.inkMuted, marginTop: 4 }}>Tổng cộng: <strong>{molds.length}</strong> bộ khuôn — Tổng giá trị: <strong>{fmtVnd(totalCost)} đ</strong></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: color.inkFaint }}>&times;</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.size.sm }}>
            <thead style={{ position: 'sticky', top: -24, background: color.surface, zIndex: 10, boxShadow: shadow.sm }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${color.border}`, color: color.ink }}>Tên Khuôn / Kích thước</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid ${color.border}`, width: 80, color: color.ink }}>Số Cavity</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid ${color.border}`, width: 160, color: color.ink }}>Nguyên giá (VND)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid ${color.border}`, width: 110, color: color.ink }}>Khấu hao (năm)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid ${color.border}`, width: 90, color: color.ink }}>Năm mua</th>
              </tr>
            </thead>
            <tbody>
              {molds.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${color.surfaceMuted}` }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="text" value={m.label} disabled={!canEdit} onChange={e => handleChange(i, 'label', e.target.value)} style={{ width: '100%', padding: '4px 8px', border: '1px solid transparent', background: 'transparent', fontWeight: font.weight.medium, color: color.ink, outline: 'none' }} onFocus={e => canEdit && (e.target.style.border = `1px solid ${color.borderStrong}`, e.target.style.background = color.surface)} onBlur={e => (e.target.style.border = '1px solid transparent', e.target.style.background = 'transparent')} />
                    <div style={{ fontSize: font.size.xs, color: color.inkFaint, paddingLeft: 8 }}>Mã: {m.id}</div>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <input type="number" value={m.cavity} disabled={!canEdit} onChange={e => handleChange(i, 'cavity', parseFloat(e.target.value) || 0)} style={{ width: '100%', textAlign: 'right', padding: '4px 8px', border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, outline: 'none', color: color.ink }} />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <input type="number" value={m.costVnd} disabled={!canEdit} onChange={e => handleChange(i, 'costVnd', parseFloat(e.target.value) || 0)} style={{ width: '100%', textAlign: 'right', padding: '4px 8px', border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, outline: 'none', color: color.ink }} />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <input type="number" value={m.usefulLifeYears} disabled={!canEdit} onChange={e => handleChange(i, 'usefulLifeYears', parseFloat(e.target.value) || 0)} style={{ width: '100%', textAlign: 'right', padding: '4px 8px', border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, outline: 'none', color: color.ink }} />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <input type="number" value={m.purchaseYear} disabled={!canEdit} onChange={e => handleChange(i, 'purchaseYear', parseFloat(e.target.value) || 0)} style={{ width: '100%', textAlign: 'right', padding: '4px 8px', border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, outline: 'none', color: color.ink }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canEdit ? (
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${color.border}`, display: 'flex', justifyContent: 'flex-end', gap: 12, background: color.surfaceMuted, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg }}>
            <button onClick={onClose} style={{ padding: '8px 16px', background: color.surface, border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, cursor: 'pointer', fontWeight: font.weight.medium, color: color.ink }}>Hủy</button>
            <button onClick={() => onSave(molds)} style={{ padding: '8px 16px', background: color.brand, color: color.inkInverse, border: 'none', borderRadius: radius.sm, cursor: 'pointer', fontWeight: font.weight.medium }}>Lưu Thay Đổi</button>
          </div>
        ) : (
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: color.surfaceMuted, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg }}>
            <div style={{ fontSize: font.size.sm, color: color.inkMuted }}>Bạn không có quyền chỉnh sửa tài sản khuôn. Vui lòng liên hệ Admin.</div>
            <button onClick={onClose} style={{ padding: '8px 16px', background: color.surface, border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, cursor: 'pointer', fontWeight: font.weight.medium, color: color.ink }}>Đóng</button>
          </div>
        )}
      </div>
    </div>
  );
}
