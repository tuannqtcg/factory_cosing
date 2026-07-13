import React, { useState } from 'react';
import type { MoldAsset } from '../../schemas/resource.js';
import { fmtVnd } from '../../lib/format.js';

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 40 }}>
      <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 900, maxHeight: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#1a1a1a' }}>Quản lý Danh sách Khuôn mẫu Phụ kiện</h2>
            <div style={{ fontSize: 13, color: '#737373', marginTop: 4 }}>Tổng cộng: <strong>{molds.length}</strong> bộ khuôn — Tổng giá trị: <strong>{fmtVnd(totalCost)} đ</strong></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#a3a3a3' }}>&times;</button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: -24, background: '#fff', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e5e5e5' }}>Tên Khuôn / Kích thước</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #e5e5e5', width: 80 }}>Số Cavity</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #e5e5e5', width: 160 }}>Nguyên giá (VND)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #e5e5e5', width: 110 }}>Khấu hao (năm)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #e5e5e5', width: 90 }}>Năm mua</th>
              </tr>
            </thead>
            <tbody>
              {molds.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f2f2f2' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="text" value={m.label} disabled={!canEdit} onChange={e => handleChange(i, 'label', e.target.value)} style={{ width: '100%', padding: '4px 8px', border: '1px solid transparent', background: 'transparent', fontWeight: 500, color: '#1a1a1a', outline: 'none' }} onFocus={e => canEdit && (e.target.style.border = '1px solid #d8d8d8', e.target.style.background = '#fff')} onBlur={e => (e.target.style.border = '1px solid transparent', e.target.style.background = 'transparent')} />
                    <div style={{ fontSize: 11, color: '#a3a3a3', paddingLeft: 8 }}>Mã: {m.id}</div>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <input type="number" value={m.cavity} disabled={!canEdit} onChange={e => handleChange(i, 'cavity', parseFloat(e.target.value) || 0)} style={{ width: '100%', textAlign: 'right', padding: '4px 8px', border: '1px solid #d8d8d8', borderRadius: 4, outline: 'none' }} />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <input type="number" value={m.costVnd} disabled={!canEdit} onChange={e => handleChange(i, 'costVnd', parseFloat(e.target.value) || 0)} style={{ width: '100%', textAlign: 'right', padding: '4px 8px', border: '1px solid #d8d8d8', borderRadius: 4, outline: 'none' }} />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <input type="number" value={m.usefulLifeYears} disabled={!canEdit} onChange={e => handleChange(i, 'usefulLifeYears', parseFloat(e.target.value) || 0)} style={{ width: '100%', textAlign: 'right', padding: '4px 8px', border: '1px solid #d8d8d8', borderRadius: 4, outline: 'none' }} />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <input type="number" value={m.purchaseYear} disabled={!canEdit} onChange={e => handleChange(i, 'purchaseYear', parseFloat(e.target.value) || 0)} style={{ width: '100%', textAlign: 'right', padding: '4px 8px', border: '1px solid #d8d8d8', borderRadius: 4, outline: 'none' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canEdit ? (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#f9f9f9', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d8d8d8', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>Hủy</button>
            <button onClick={() => onSave(molds)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>Lưu Thay Đổi</button>
          </div>
        ) : (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9f9f9', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#737373' }}>Bạn không có quyền chỉnh sửa tài sản khuôn. Vui lòng liên hệ Admin.</div>
            <button onClick={onClose} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d8d8d8', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>Đóng</button>
          </div>
        )}
      </div>
    </div>
  );
}
